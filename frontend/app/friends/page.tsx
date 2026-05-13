"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { useNotifications } from "@/components/notification-provider";
import { NotificationBell } from "@/components/notification-bell";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type MeData = { username: string };

type SearchedUser = {
  username: string;
  is_following: boolean;
};

type SelfProfile = {
  following: string[];
};

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("booktown_token") : "";
  return {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
  };
}

function initials(username: string): string {
  return username.slice(0, 2).toUpperCase();
}

export default function FriendsPage() {
  const router = useRouter();
  const { notifications } = useNotifications();

  const [me, setMe] = useState<MeData | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"followers" | "following">("followers");

  const processedNotifIds = useRef(new Set<number>());

  const loadSelf = useCallback(async () => {
    const meRes = await fetch(`${API_BASE}/api/users/me`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!meRes.ok) { router.push("/login"); return; }
    const meData = (await meRes.json()) as MeData;
    setMe(meData);

    const profileRes = await fetch(
      `${API_BASE}/api/users/${encodeURIComponent(meData.username)}`,
      { headers: authHeaders(), cache: "no-store" },
    );
    if (!profileRes.ok) return;
    const profile = (await profileRes.json()) as SelfProfile;
    setFollowing(profile.following ?? []);
  }, [router]);

  async function fetchFollowers() {
    const res = await fetch(`${API_BASE}/api/users/me/followers`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { followers: string[] };
    setFollowers(data.followers ?? []);
  }

  useEffect(() => {
    const token = window.localStorage.getItem("booktown_token");
    if (!token) { router.push("/login"); return; }
    void loadSelf();
    void fetchFollowers();
  }, [loadSelf, router]);

  // Real-time: when a new follow notification arrives via WebSocket,
  // immediately prepend that user to the followers list.
  useEffect(() => {
    const newFollows = notifications.filter(
      (n) => (n.type === "follow" || n.type === "follow_back") && !processedNotifIds.current.has(n.id),
    );
    newFollows.forEach((n) => processedNotifIds.current.add(n.id));
    if (newFollows.length === 0) return;

    const incoming = newFollows.map((n) => n.actor_username);
    setFollowers((prev) => {
      const seen = new Set(prev);
      const toAdd = incoming.filter((u) => !seen.has(u));
      return toAdd.length > 0 ? [...toAdd, ...prev] : prev;
    });
  }, [notifications]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) { setSearchResults([]); return; }
    const timeout = setTimeout(() => void runSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function runSearch(query: string) {
    setSearchLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`,
        { headers: authHeaders(), cache: "no-store" },
      );
      if (!res.ok) { setSearchResults([]); return; }
      const payload = (await res.json()) as { users: SearchedUser[] };
      setSearchResults(payload.users ?? []);
    } finally {
      setSearchLoading(false);
    }
  }

  async function toggleFollow(username: string, isFollowing: boolean) {
    setSearchResults((prev) =>
      prev.map((u) => (u.username === username ? { ...u, is_following: !isFollowing } : u)),
    );
    setFollowing((prev) => {
      if (isFollowing) return prev.filter((n) => n !== username);
      return prev.includes(username) ? prev : [...prev, username];
    });
    if (!isFollowing) setActionLoading(username);
    try {
      const res = await fetch(
        `${API_BASE}/api/${isFollowing ? "unfollow" : "follow"}/${encodeURIComponent(username)}`,
        { method: isFollowing ? "DELETE" : "POST", headers: authHeaders() },
      );
      if (!res.ok) {
        setSearchResults((prev) =>
          prev.map((u) => (u.username === username ? { ...u, is_following: isFollowing } : u)),
        );
        setFollowing((prev) => {
          if (isFollowing) return prev.includes(username) ? prev : [...prev, username];
          return prev.filter((n) => n !== username);
        });
      }
    } finally {
      if (!isFollowing) setActionLoading(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60">

      <header className="page-header-bar">
        <p className="page-title">Friends</p>
        <div className="flex items-center gap-3">
          <NotificationBell size={20} />
          {me ? (
            <span className="rounded-full border border-[var(--border-brand)] px-3 py-1 text-[11px] font-semibold text-[var(--primary-deep)]">
              @{me.username}
            </span>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 py-4 pb-24 lg:mx-auto lg:grid lg:w-full lg:max-w-[1100px] lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-6 lg:px-6 lg:py-6">

        {/* ── Left: search ── */}
        <div className="flex flex-col gap-4">

          <div className="flex flex-col gap-2">
            <p className="section-label px-0">find people</p>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username..."
              className="field"
            />
          </div>

          {searchLoading ? (
            <p className="text-xs text-[var(--ink-muted)]">Searching...</p>
          ) : null}

          {searchResults.length > 0 ? (
            <div className="flex flex-col gap-2">
              {searchResults.map((user) => (
                <article
                  key={user.username}
                  className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--sh-xs)]"
                >
                  <button
                    onClick={() => router.push(`/profile/${encodeURIComponent(user.username)}`)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-xs font-bold text-white shadow-[var(--sh-xs)]">
                      {initials(user.username)}
                    </div>
                    <p className="text-sm font-semibold text-[var(--ink)]">@{user.username}</p>
                  </button>
                  <button
                    className={user.is_following ? "btn-secondary px-3 py-1.5 text-xs" : "btn-primary px-3 py-1.5 text-xs"}
                    onClick={() => void toggleFollow(user.username, user.is_following)}
                    disabled={actionLoading === user.username}
                  >
                    {actionLoading === user.username ? "..." : user.is_following ? "Unfollow" : "Follow"}
                  </button>
                </article>
              ))}
            </div>
          ) : searchQuery.trim() && !searchLoading ? (
            <p className="text-sm text-[var(--ink-muted)]">No users found.</p>
          ) : null}

        </div>

        {/* ── Right: tab switcher (followers / following) ── */}
        <div className="flex flex-col gap-4">

          {/* Tab switcher */}
          <div className="flex rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface-alt)] p-1">
            <button
              onClick={() => setActiveTab("followers")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] py-2 text-xs font-semibold transition-colors ${
                activeTab === "followers"
                  ? "bg-white shadow-[var(--sh-xs)] text-[var(--primary-deep)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              Followers
              {followers.length > 0 ? (
                <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                  {followers.length}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => setActiveTab("following")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] py-2 text-xs font-semibold transition-colors ${
                activeTab === "following"
                  ? "bg-white shadow-[var(--sh-xs)] text-[var(--primary-deep)]"
                  : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              Following
              {following.length > 0 ? (
                <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                  {following.length}
                </span>
              ) : null}
            </button>
          </div>

          {/* Followers tab */}
          {activeTab === "followers" ? (
            followers.length > 0 ? (
              <div className="flex flex-col gap-2">
                {followers.map((username) => (
                  <article
                    key={username}
                    className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--sh-xs)]"
                  >
                    <button
                      onClick={() => router.push(`/profile/${encodeURIComponent(username)}`)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-deep)] text-xs font-bold text-white shadow-[var(--sh-xs)]">
                        {initials(username)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">@{username}</p>
                        <p className="text-[10px] text-[var(--ink-muted)]">follows you</p>
                      </div>
                    </button>
                    {!following.includes(username) ? (
                      <button
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => void toggleFollow(username, false)}
                        disabled={actionLoading === username}
                      >
                        {actionLoading === username ? "..." : "Follow"}
                      </button>
                    ) : (
                      <span className="rounded-full border border-[var(--border-brand)] px-2.5 py-1 text-[10px] font-semibold text-[var(--primary-deep)]">
                        Following
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)] px-4 py-5 text-center">
                <p className="text-sm font-semibold text-[var(--ink-muted)]">No followers yet</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">When someone follows you they'll appear here instantly.</p>
              </div>
            )
          ) : null}

          {/* Following tab */}
          {activeTab === "following" ? (
            following.length > 0 ? (
              <div className="flex flex-col gap-2">
                {following.map((username) => (
                    <article
                      key={username}
                      className="flex items-center gap-3 rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--sh-xs)]"
                    >
                      <button
                        onClick={() => router.push(`/profile/${encodeURIComponent(username)}`)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-deep)] text-xs font-bold text-white shadow-[var(--sh-xs)]">
                          {initials(username)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink)]">@{username}</p>
                          <p className="text-[10px] text-[var(--ink-muted)]">tap to view profile</p>
                        </div>
                      </button>
                      <button
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => void toggleFollow(username, true)}
                        disabled={actionLoading === username}
                        aria-label={`Unfollow ${username}`}
                      >
                        {actionLoading === username ? "..." : "Unfollow"}
                      </button>
                    </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border-brand)] bg-[var(--surface-alt)] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[var(--ink-muted)]">Not following anyone yet</p>
                <p className="mt-1 text-xs text-[var(--ink-muted)]">Search for people above to get started.</p>
              </div>
            )
          ) : null}

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
