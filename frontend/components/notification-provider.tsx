"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export type Notification = {
  id: number;
  type: "follow" | "follow_back";
  actor_username: string;
  read: boolean;
  created_at: string;
};

type NotifCtx = {
  notifications: Notification[];
  unreadCount: number;
  liveToast: Notification | null;
  dismissToast: () => void;
  markAllRead: () => void;
  followBack: (username: string) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
};

const Ctx = createContext<NotifCtx>({
  notifications: [],
  unreadCount: 0,
  liveToast: null,
  dismissToast: () => {},
  markAllRead: () => {},
  followBack: async () => {},
  deleteNotification: async () => {},
});

export function useNotifications() {
  return useContext(Ctx);
}

function token(): string {
  return typeof window !== "undefined"
    ? (window.localStorage.getItem("booktown_token") ?? "")
    : "";
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [liveToast, setLiveToast] = useState<Notification | null>(null);
  const initializedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const tok = token();
    if (!tok) return;

    wsRef.current?.close();
    initializedRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    // Convert http(s) base URL to ws(s) for the WebSocket endpoint.
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(
      `${wsBase}/api/notifications/ws?token=${encodeURIComponent(tok)}`,
    );

    ws.onopen = () => {
      // Events arriving in the first 500ms are the initial unread flush,
      // not live notifications, so suppress toasts for them.
      setTimeout(() => { initializedRef.current = true; }, 500);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const n = JSON.parse(event.data as string) as Notification;
        setNotifications((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev;
          return [n, ...prev];
        });
        if (initializedRef.current) {
          setLiveToast(n);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setLiveToast(null), 8000);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      reconnectTimerRef.current = setTimeout(connect, 5000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    const handler = () => connect();
    window.addEventListener("booktown-auth-changed", handler);
    return () => {
      wsRef.current?.close();
      window.removeEventListener("booktown-auth-changed", handler);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const markAllRead = useCallback(() => {
    void fetch(`${API_BASE}/api/notifications/read`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const followBack = useCallback(async (username: string) => {
    await fetch(`${API_BASE}/api/follow/${encodeURIComponent(username)}`, {
      method: "POST",
      headers: authHeaders(),
    });
  }, []);

  const deleteNotification = useCallback(async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await fetch(`${API_BASE}/api/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  }, []);

  const dismissToast = useCallback(() => {
    setLiveToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Ctx.Provider value={{ notifications, unreadCount, liveToast, dismissToast, markAllRead, followBack, deleteNotification }}>
      {children}
    </Ctx.Provider>
  );
}
