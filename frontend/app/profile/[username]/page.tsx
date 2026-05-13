"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Group } from "three";
import { BottomNav } from "@/components/bottom-nav";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type UserProfile = {
  username: string;
  started: number;
  finished: number;
  points: number;
  ratio: number;
  following_count: number;
  town_asset_count: number;
  is_following: boolean;
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

function ReadOnlyBuilding({ asset }: { asset: TownAsset }) {
  const { scene } = useGLTF(`/assets/3d/${asset.model_filename}`);
  const model = useMemo(() => scene.clone(true), [scene]);
  return (
    <group position={[asset.pos_x, 0, asset.pos_z]} rotation={[0, asset.rotation_y, 0]}>
      <primitive object={model} scale={1} />
    </group>
  );
}

function TownScene({ assets }: { assets: TownAsset[] }) {
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

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = decodeURIComponent(params.username as string);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [townAssets, setTownAssets] = useState<TownAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch(`${API_BASE}/api/users/me`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!meRes.ok) { router.push("/login"); return; }
      const me = (await meRes.json()) as { username: string };

      // Redirect to own profile page if viewing self
      if (me.username === username) {
        router.replace("/profile");
        return;
      }

      const [profileRes, townRes] = await Promise.all([
        fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
        fetch(`${API_BASE}/api/town/${encodeURIComponent(username)}`, {
          headers: authHeaders(),
          cache: "no-store",
        }),
      ]);

      if (profileRes.status === 404) { router.push("/friends"); return; }
      if (profileRes.ok) {
        const data = (await profileRes.json()) as UserProfile;
        setProfile(data);
        setIsFollowing(data.is_following);
      }
      if (townRes.ok) {
        const data = (await townRes.json()) as { assets?: TownAsset[] };
        setTownAssets(data.assets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [username, router]);

  useEffect(() => {
    const token = window.localStorage.getItem("booktown_token");
    if (!token) { router.push("/login"); return; }
    void load();
  }, [load, router]);

  async function toggleFollow() {
    if (!profile) return;
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/${wasFollowing ? "unfollow" : "follow"}/${encodeURIComponent(username)}`,
        { method: wasFollowing ? "DELETE" : "POST", headers: authHeaders() },
      );
      if (!res.ok) setIsFollowing(wasFollowing);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] lg:pl-60">
        <p className="text-sm text-[var(--ink-muted)]">Loading...</p>
      </main>
    );
  }

  if (!profile) return null;

  const avatarInitials = username.slice(0, 2).toUpperCase();
  const currentlyReading = Math.max(0, profile.started - profile.finished);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60">

      {/* Header */}
      <header className="page-header-bar">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            aria-label="Go back"
          >
            ←
          </button>
          <p className="page-title">@{username}</p>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1a0f1e] via-[var(--primary-deep)] to-[#4a1f3f] px-6 pb-8 pt-10">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[rgba(133,57,83,0.2)]" />
        <div className="absolute -left-6 bottom-0 h-28 w-28 rounded-full bg-[rgba(133,57,83,0.15)]" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[rgba(255,255,255,0.15)] bg-[var(--primary)] text-2xl font-bold text-white shadow-[0_0_0_3px_rgba(133,57,83,0.5),var(--sh-lg)]">
            {avatarInitials}
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-white">@{profile.username}</p>
            <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.4)]">
              {profile.points} pts · {profile.town_asset_count} buildings
            </p>
          </div>

          {/* Stats */}
          <div className="grid w-full max-w-xs grid-cols-3 overflow-hidden rounded-[var(--r-md)] bg-[rgba(0,0,0,0.28)]">
            <div className="flex flex-col items-center py-3">
              <p className="text-base font-bold text-white">{profile.finished}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">finished</p>
            </div>
            <div className="flex flex-col items-center border-l border-[rgba(255,255,255,0.08)] py-3">
              <p className="text-base font-bold text-white">{currentlyReading}</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">reading</p>
            </div>
            <div className="flex flex-col items-center border-l border-[rgba(255,255,255,0.08)] py-3">
              <p className="text-base font-bold text-white">{Math.round(profile.ratio * 100)}%</p>
              <p className="text-[8px] uppercase tracking-wider text-[rgba(255,255,255,0.42)]">complete</p>
            </div>
          </div>

          {/* Follow button */}
          <button
            onClick={() => void toggleFollow()}
            disabled={actionLoading}
            className={`w-full max-w-xs rounded-[var(--r-md)] py-2.5 text-sm font-semibold transition-all ${
              isFollowing
                ? "border border-[rgba(255,255,255,0.25)] bg-transparent text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.08)]"
                : "bg-white text-[var(--primary-deep)] hover:bg-[rgba(255,255,255,0.9)]"
            }`}
          >
            {actionLoading ? "..." : isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-5 px-4 py-4 pb-24 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-6 lg:py-6 lg:pb-8">

        {/* Town preview */}
        <div className="flex flex-col gap-2.5">
          <p className="section-label">{username}&apos;s town</p>
          {townAssets.length > 0 ? (
            <Link
              href={`/town?visit=${encodeURIComponent(username)}`}
              className="relative block overflow-hidden rounded-[var(--r-lg)] shadow-[var(--sh-md)]"
              style={{ height: 260 }}
            >
              <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
                <Canvas
                  camera={{ position: [10, 16, 18], fov: 46 }}
                  style={{ width: "100%", height: "100%", background: "#f7f6f6" }}
                >
                  <Suspense fallback={null}>
                    <TownScene assets={townAssets} />
                  </Suspense>
                </Canvas>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-transparent px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-white">@{username}&apos;s Town</p>
                  <p className="text-[11px] text-[rgba(255,255,255,0.55)]">
                    {townAssets.length} building{townAssets.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[11px] font-bold text-white shadow-[var(--sh-sm)]">
                  Visit →
                </span>
              </div>
            </Link>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-[var(--r-lg)] border border-dashed border-[var(--border)] bg-[var(--surface-alt)]">
              <p className="text-sm text-[var(--ink-muted)]">Town is empty</p>
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
