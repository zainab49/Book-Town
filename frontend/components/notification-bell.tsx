"use client";

import { useState } from "react";
import { useNotifications } from "./notification-provider";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function BellIcon({ size, ringing }: { size: number; ringing?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      style={ringing ? { animation: "bell-ring 1s ease-in-out infinite", transformOrigin: "50% 0%" } : undefined}
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function NotificationBell({ size = 20 }: { size?: number }) {
  const { notifications, unreadCount, markAllRead, followBack, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  const [followingNow, setFollowingNow] = useState<Set<string>>(new Set());

  function toggle() {
    setOpen((v) => {
      if (!v && unreadCount > 0) markAllRead();
      return !v;
    });
  }

  async function handleFollowBack(username: string) {
    setFollowingNow((s) => { const n = new Set(s); n.add(username); return n; });
    await followBack(username);
    setFollowedBack((s) => { const n = new Set(s); n.add(username); return n; });
    setFollowingNow((s) => { const n = new Set(s); n.delete(username); return n; });
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={toggle}
          className="relative flex items-center justify-center"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`}
        >
          <BellIcon size={size} ringing={unreadCount > 0} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--primary)] text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-9 z-50 w-[280px] overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-brand)] bg-white shadow-[var(--sh-lg)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
                  Notifications
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="text-lg leading-none text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  ×
                </button>
              </div>

              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[var(--ink-muted)]">
                  No notifications yet.
                </p>
              ) : (
                <ul className="max-h-80 divide-y divide-[var(--border)] overflow-y-auto">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 ${n.read ? "bg-white" : "bg-[var(--surface-alt)]"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white">
                          {n.actor_username.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--ink)]">
                            <span className="font-bold">@{n.actor_username}</span>{" "}
                            {n.type === "follow_back" ? "follows you back" : "started following you"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
                            {relativeTime(n.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => void deleteNotification(n.id)}
                          className="shrink-0 text-[var(--ink-muted)] hover:text-red-500 transition-colors"
                          aria-label="Delete notification"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      {n.type === "follow" && !followedBack.has(n.actor_username) ? (
                        <button
                          onClick={() => void handleFollowBack(n.actor_username)}
                          disabled={followingNow.has(n.actor_username)}
                          className="btn-primary mt-2 w-full py-1.5 text-[11px]"
                        >
                          {followingNow.has(n.actor_username) ? "Following..." : "Follow back"}
                        </button>
                      ) : n.type === "follow" && followedBack.has(n.actor_username) ? (
                        <p className="mt-2 text-center text-[11px] font-semibold text-[var(--primary)]">
                          Following ✓
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

// Live toast shown when a new follow notification arrives in real time
export function NotificationToast() {
  const { liveToast, dismissToast, followBack } = useNotifications();
  const [followed, setFollowed] = useState(false);
  const [following, setFollowing] = useState(false);

  if (!liveToast) return null;

  async function handleFollow() {
    setFollowing(true);
    await followBack(liveToast!.actor_username);
    setFollowed(true);
    setFollowing(false);
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-[60] w-[min(320px,90vw)] -translate-x-1/2 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-brand)] bg-white shadow-[var(--sh-lg)] lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
      <div className="h-1 w-full bg-gradient-to-r from-[var(--primary-deep)] to-[var(--primary)]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
            {liveToast.actor_username.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--ink)]">
              {liveToast.type === "follow_back" ? "Follows you back!" : "New follower!"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
              <span className="font-bold text-[var(--ink)]">@{liveToast.actor_username}</span>{" "}
              {liveToast.type === "follow_back" ? "follows you back" : "started following you"}
            </p>
          </div>
          <button
            onClick={dismissToast}
            className="shrink-0 text-lg leading-none text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            ×
          </button>
        </div>

        {liveToast.type === "follow" && !followed ? (
          <button
            onClick={() => void handleFollow()}
            disabled={following}
            className="btn-primary mt-3 w-full py-1.5 text-xs"
          >
            {following ? "Following..." : "Follow back"}
          </button>
        ) : liveToast.type === "follow" && followed ? (
          <p className="mt-3 text-center text-xs font-semibold text-[var(--primary)]">
            Following ✓
          </p>
        ) : null}
      </div>
    </div>
  );
}

function relativeTime(raw: string): string {
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return raw;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
