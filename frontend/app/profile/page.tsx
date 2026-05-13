"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Group } from "three";
import { BottomNav } from "@/components/bottom-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type MeData = { id: number; username: string; email: string; points: number };

type ProfileData = {
  username: string;
  started: number;
  finished: number;
  points: number;
  ratio: number;
  following_count: number;
  follower_count?: number;
  town_asset_count: number;
  following: string[];
};

type Book = {
  id: number;
  title: string;
  author: string;
  cover_url: string;
  rating?: number;
  total_pages: number;
  current_page: number;
  status: "to_read" | "reading" | "finished";
  started_at?: string | null;
};

type TownAsset = {
  id: number;
  model_filename: string;
  pos_x: number;
  pos_z: number;
  rotation_y: number;
};

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("booktown_token") : "";
  return {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
  };
}

// ── 3-D components ────────────────────────────────────────────────────────────

function ReadOnlyBuilding({ asset }: { asset: TownAsset }) {
  const { scene } = useGLTF(`/assets/3d/${asset.model_filename}`);
  // scene.clone(true) is required: useGLTF caches a single scene object and
  // reusing it across multiple <primitive> elements causes only the last mounted
  // instance to appear at the correct position/rotation.
  const model = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={[asset.pos_x, 0, asset.pos_z]} rotation={[0, asset.rotation_y, 0]}>
      <primitive object={model} scale={1} />
    </group>
  );
}

function TownSceneInner({ assets }: { assets: TownAsset[] }) {
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.18;
  });
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[10, 14, 8]} intensity={0.8} />
      <group ref={groupRef}>
        {assets.map((asset) => (
          <ReadOnlyBuilding key={asset.id} asset={asset} />
        ))}
      </group>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [townAssets, setTownAssets] = useState<TownAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/users/me`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!meRes.ok) { router.push("/login"); return; }

      const meData = (await meRes.json()) as MeData;
      setMe(meData);

      const [profileRes, booksRes, townRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/${encodeURIComponent(meData.username)}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/books`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/town`, { headers: authHeaders(), cache: "no-store" }),
      ]);

      if (profileRes.ok) setProfile((await profileRes.json()) as ProfileData);
      if (booksRes.ok) {
        const payload = (await booksRes.json()) as { books: Book[] };
        setBooks(payload.books ?? []);
      }
      if (townRes.ok) {
        const payload = (await townRes.json()) as { assets?: TownAsset[] };
        setTownAssets(payload.assets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = window.localStorage.getItem("booktown_token");
    if (!token) { router.push("/login"); return; }
    void loadProfile();
  }, [loadProfile, router]);

  const currentBook = useMemo(
    () => books.find((b) => b.status === "reading") ?? null,
    [books],
  );

  if (loading) {
    return (
      <main className="dark-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-[rgba(255,255,255,0.4)]">Loading...</p>
      </main>
    );
  }

  if (!profile || !me) return null;

  const initials = me.username.slice(0, 2).toUpperCase();
  const currentlyReading = Math.max(0, profile.started - profile.finished);
  const followerCount = profile.follower_count ?? 0;
  const progress =
    currentBook && currentBook.total_pages > 0
      ? Math.min(100, Math.round((currentBook.current_page / currentBook.total_pages) * 100))
      : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60">

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a0f1e] via-[var(--primary-deep)] to-[#4a1f3f] px-6 pb-8 pt-10">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[rgba(133,57,83,0.2)]" />
        <div className="absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-[rgba(133,57,83,0.15)]" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[rgba(255,255,255,0.15)] bg-[var(--primary)] text-2xl font-bold text-white shadow-[0_0_0_3px_rgba(133,57,83,0.5),var(--sh-lg)]">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">@{profile.username}</p>
            <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.4)]">{me.email}</p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-4 overflow-hidden rounded-[var(--r-md)] bg-[rgba(0,0,0,0.28)]">
            <div className="flex flex-col items-center py-3">
              <p className="text-base font-bold text-white">{profile.finished}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">finished</p>
            </div>
            <div className="flex flex-col items-center border-l border-[rgba(255,255,255,0.08)] py-3">
              <p className="text-base font-bold text-white">{currentlyReading}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">reading</p>
            </div>
            <Link
              href="/friends"
              className="flex flex-col items-center border-l border-[rgba(255,255,255,0.08)] py-3 transition-colors hover:bg-[rgba(255,255,255,0.07)]"
            >
              <p className="text-base font-bold text-white">{followerCount}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">followers</p>
            </Link>
            <Link
              href="/friends"
              className="flex flex-col items-center border-l border-[rgba(255,255,255,0.08)] py-3 transition-colors hover:bg-[rgba(255,255,255,0.07)]"
            >
              <p className="text-base font-bold text-white">{profile.following_count}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">following</p>
            </Link>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-5 px-4 py-4 pb-24 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-6 lg:py-6 lg:pb-8">

        {/* Desktop: town left, book right — mobile: stacked */}
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">

          {/* Town 3-D preview */}
          <div className="flex flex-col gap-2.5">
            <p className="section-label">my town</p>
            <div
              className="relative cursor-pointer overflow-hidden rounded-[var(--r-lg)] shadow-[var(--sh-md)]"
              style={{ height: 260 }}
              onClick={() => router.push("/town")}
            >
              <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                <Canvas
                  camera={{ position: [10, 16, 18], fov: 46 }}
                  style={{ width: "100%", height: "100%", background: "#f7f6f6" }}
                >
                  <Suspense fallback={null}>
                    <TownSceneInner assets={townAssets} />
                  </Suspense>
                </Canvas>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-transparent px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">@{profile.username}&apos;s Town</p>
                  <p className="text-[11px] text-[rgba(255,255,255,0.55)]">
                    {townAssets.length} building{townAssets.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[11px] font-bold text-white shadow-[var(--sh-sm)]">
                  Edit →
                </span>
              </div>
            </div>
          </div>

          {/* Currently reading */}
          <div className="flex flex-col gap-2.5">
            <p className="section-label">currently reading</p>
            {currentBook ? (
              <div className="rounded-[var(--r-lg)] border border-[var(--border-brand)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)]">
                <div className="flex gap-4">
                  <div className="h-32 w-[86px] shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-alt)] shadow-[var(--sh-xs)]">
                    {currentBook.cover_url ? (
                      <img src={currentBook.cover_url} alt={currentBook.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-[var(--ink)]">{currentBook.title}</p>
                    <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">{currentBook.author || "Unknown author"}</p>
                    <div className="progress-track mt-4">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--primary)]">{progress}%</span>
                      <span className="text-[10px] text-[var(--ink-muted)]">
                        {currentBook.total_pages > 0 ? `p. ${currentBook.current_page} / ${currentBook.total_pages}` : ""}
                      </span>
                    </div>
                    {currentBook.started_at ? (
                      <p className="mt-2 text-[10px] text-[var(--ink-muted)]">
                        Started {formatDate(currentBook.started_at)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[260px] items-center justify-center rounded-[var(--r-lg)] border border-dashed border-[var(--border-brand)] bg-[var(--surface-alt)]">
                <p className="text-sm text-[var(--ink-muted)]">No active book right now.</p>
              </div>
            )}
          </div>

        </div>

      </main>

      <BottomNav />
    </div>
  );
}

function formatDate(input: string): string {
  const date = new Date(input.includes("T") ? input : input.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
