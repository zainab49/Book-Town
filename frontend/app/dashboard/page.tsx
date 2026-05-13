"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Group } from "three";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { NotificationBell, NotificationToast } from "@/components/notification-bell";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type MeData = { id: number; username: string; email: string; points: number };

type Book = {
  id: number;
  title: string;
  author: string;
  cover_url: string;
  rating?: number;
  total_pages: number;
  current_page: number;
  status: "to_read" | "reading" | "finished";
  finished_at: string | null;
  started_at?: string | null;
  created_at?: string;
};

type TownAsset = {
  id: number;
  model_filename: string;
  pos_x: number;
  pos_z: number;
  rotation_y?: number;
};

function ReadOnlyBuilding({ asset }: { asset: TownAsset }) {
  const { scene } = useGLTF(`/assets/3d/${asset.model_filename}`);
  // Clone the cached scene so each building instance has its own transform.
  const model = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={[asset.pos_x, 0, asset.pos_z]} rotation={[0, asset.rotation_y ?? 0, 0]}>
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

type Stats = {
  started: number;
  finished: number;
  ratio: number;
  points: number;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const BookCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <polyline points="9 11 11 13 15 9" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="7" width="20" height="14" rx="1" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const BookOpenIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("booktown_token") : "";
  return {
    Authorization: `Bearer ${token ?? ""}`,
    "Content-Type": "application/json",
  };
}

export default function DashboardPage() {
  const router = useRouter();
  // Called without destructuring just to assert that AuthProvider is in the tree.
  useAuth();

  const [me, setMe] = useState<MeData | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [townAssets, setTownAssets] = useState<TownAsset[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, booksRes, townRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/me`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/books`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/town`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${API_BASE}/api/users/me/stats`, { headers: authHeaders(), cache: "no-store" }),
      ]);

      if (!meRes.ok) { router.push("/login"); return; }

      setMe((await meRes.json()) as MeData);
      if (booksRes.ok) {
        const payload = (await booksRes.json()) as { books: Book[] };
        setBooks(payload.books ?? []);
      }
      if (townRes.ok) {
        const payload = (await townRes.json()) as { assets: TownAsset[] };
        setTownAssets(payload.assets ?? []);
      }
      if (statsRes.ok) setStats((await statsRes.json()) as Stats);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = window.localStorage.getItem("booktown_token");
    if (!token) { router.push("/login"); return; }
    void loadAll();
  }, [loadAll, router]);

  const readingBooks = useMemo(
    () => books.filter((b) => b.status === "reading"),
    [books],
  );

  if (loading) {
    return (
      <main className="dark-shell flex min-h-screen items-center justify-center">
        <p className="text-sm text-[rgba(255,255,255,0.4)]">Loading...</p>
      </main>
    );
  }

  const points = stats?.points ?? me?.points ?? 0;
  const readingCount = readingBooks.length;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60">

      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-username">
          <span>{getGreeting()},</span>
          @{me?.username ?? "reader"}
        </div>
        <NotificationBell />
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-4 pb-24 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:gap-5 lg:px-6 lg:py-5 lg:pb-8">

        {/* Stats — 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">

          {/* Points — gradient accent card */}
          <div className="rounded-[var(--r-lg)] bg-gradient-to-br from-[var(--primary-deep)] to-[#8b3d6a] p-4 shadow-[var(--sh-md)] lg:rounded-[var(--r-xl)] lg:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-white lg:text-3xl">{points}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.55)] lg:text-[10px]">points</p>
              </div>
              <span className="shrink-0 rounded-full bg-[rgba(255,255,255,0.15)] p-1.5 text-white">
                <StarIcon />
              </span>
            </div>
            <p className="mt-2.5 text-[11px] text-[rgba(255,255,255,0.45)]">your reading score</p>
          </div>

          {/* Finished */}
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh-xs)] transition-shadow duration-150 hover:shadow-[var(--sh-sm)] lg:rounded-[var(--r-xl)] lg:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-[var(--primary-deep)] lg:text-3xl">{stats?.finished ?? 0}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--ink-muted)] lg:text-[10px]">finished</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-alt)] p-1.5 text-[var(--primary)]">
                <BookCheckIcon />
              </span>
            </div>
            <p className="mt-2.5 text-[11px] text-[var(--ink-muted)]">
              {stats?.ratio != null ? `${Math.round(stats.ratio * 100)}% completion` : "books read"}
            </p>
          </div>

          {/* Buildings */}
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh-xs)] transition-shadow duration-150 hover:shadow-[var(--sh-sm)] lg:rounded-[var(--r-xl)] lg:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-[var(--primary-deep)] lg:text-3xl">{townAssets.length}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--ink-muted)] lg:text-[10px]">buildings</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-alt)] p-1.5 text-[var(--primary)]">
                <BuildingIcon />
              </span>
            </div>
            <p className="mt-2.5 text-[11px] text-[var(--ink-muted)]">in your town</p>
          </div>

          {/* Reading now */}
          <div className="rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh-xs)] transition-shadow duration-150 hover:shadow-[var(--sh-sm)] lg:rounded-[var(--r-xl)] lg:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-[var(--primary-deep)] lg:text-3xl">{readingCount}</p>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--ink-muted)] lg:text-[10px]">reading</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-alt)] p-1.5 text-[var(--primary)]">
                <BookOpenIcon />
              </span>
            </div>
            <p className="mt-2.5 text-[11px] text-[var(--ink-muted)]">active books</p>
          </div>

        </div>

        {/* 2-column on desktop */}
        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr] lg:items-start lg:gap-5">

          {/* Left: Town 3-D */}
          <div className="flex flex-col gap-2.5">
            <p className="section-label">your town</p>
            <div
              className="relative h-[260px] cursor-pointer overflow-hidden rounded-[var(--r-lg)] shadow-[var(--sh-lg)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 lg:h-[340px] lg:rounded-[var(--r-xl)]"
              onClick={() => router.push("/town")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && router.push("/town")}
              aria-label="Open town editor"
            >
              {/* pointerEvents: none lets clicks pass through to the parent div
                  which handles navigation to the town editor. */}
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
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-[rgba(0,0,0,0.65)] to-transparent px-4 py-3 lg:px-6 lg:py-5">
                <div>
                  <p className="font-bold text-white lg:text-lg">{me?.username}&apos;s Town</p>
                  <p className="text-[11px] text-[rgba(255,255,255,0.55)] lg:text-xs">
                    {townAssets.length} building{townAssets.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[11px] font-bold text-white shadow-[var(--sh-sm)] lg:px-4 lg:py-2 lg:text-xs">
                  Edit →
                </span>
              </div>
            </div>
          </div>

          {/* Right: Currently reading — all books */}
          <div className="flex flex-col gap-2.5">
            <p className="section-label">currently reading</p>
            {readingBooks.length > 0 ? (
              <div className="flex flex-col gap-3">
                {readingBooks.map((book) => {
                  const pct =
                    book.total_pages > 0
                      ? Math.min(100, Math.round((book.current_page / book.total_pages) * 100))
                      : 0;
                  return (
                    <div
                      key={book.id}
                      className="rounded-[var(--r-lg)] border border-[var(--border-brand)] bg-[var(--surface)] p-4 shadow-[var(--sh-sm)] lg:rounded-[var(--r-xl)] lg:p-5"
                    >
                      <div className="flex gap-3">
                        <div className="h-[72px] w-[48px] shrink-0 overflow-hidden rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-alt)] shadow-[var(--sh-xs)] lg:h-[90px] lg:w-[60px] lg:rounded-[var(--r-md)]">
                          {book.cover_url ? (
                            <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-snug text-[var(--ink)] lg:text-[15px]">{book.title}</p>
                          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">{book.author || "Unknown author"}</p>
                          <div className="progress-track mt-2.5">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--primary)]">{pct}%</span>
                            {book.total_pages > 0 ? (
                              <span className="text-[10px] text-[var(--ink-muted)] lg:text-xs">
                                p.{book.current_page} / {book.total_pages}
                              </span>
                            ) : null}
                          </div>
                          {book.started_at ? (
                            <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                              Since {formatDate(book.started_at)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--border-brand)] bg-[var(--surface-alt)] px-4 py-8 text-center lg:rounded-[var(--r-xl)] lg:py-12">
                <p className="text-sm font-semibold text-[var(--ink-muted)]">No active book yet</p>
                <Link
                  href="/library"
                  className="mt-2 inline-block text-xs font-bold text-[var(--primary)] underline underline-offset-2"
                >
                  Add one in Books →
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>

      <NotificationToast />
      <BottomNav />
    </div>
  );
}

function formatDate(input: string): string {
  const date = new Date(input.includes("T") ? input : input.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
