"use client";

import { useLayoutEffect, useEffect, useRef, useCallback, useState } from "react";
import confetti from "canvas-confetti";

interface Props {
  title: string;
  coverUrl: string;
  finishedAt: string | null;
  onDismiss: () => void;
  audioCtx: AudioContext | null;
}

interface PaperPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
  borderRadius: string;
  sway: number;
}

function formatDate(raw: string | null): string {
  const date = raw
    ? new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z")
    : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const BRAND = "#853953";
const BRAND_LIGHT = "#d4a0b0";
const COLORS = [BRAND, BRAND_LIGHT, "#ffd700", "#ff6b6b", "#4ecdc4", "#ffffff", "#a8edea", "#fed6e3", "#c3f584"];

// Fetch lazily the first time the celebration is shown, then cache for repeat plays.
let rawAudioCache: Promise<ArrayBuffer | null> | null = null;
function getRawAudio(): Promise<ArrayBuffer | null> {
  if (!rawAudioCache) {
    rawAudioCache = fetch("/assets/music/6-fun_maze.wav")
      .then((r) => r.arrayBuffer())
      .catch(() => null);
  }
  return rawAudioCache;
}

// Stable paper pieces — generated once, never on server (component is always client-only)
function makePieces(): PaperPiece[] {
  return Array.from({ length: 55 }, (_, i) => ({
    id: i,
    left: 1 + Math.random() * 97,
    delay: Math.random() * 3.0,
    duration: 3.4 + Math.random() * 2.4,
    width: 7 + Math.random() * 8,
    height: 9 + Math.random() * 13,
    color: COLORS[i % COLORS.length],
    borderRadius: Math.random() > 0.42 ? "50%" : "3px",
    sway: Math.round(14 + Math.random() * 36),
  }));
}

export default function BookFinishedCelebration({ title, coverUrl, finishedAt, onDismiss, audioCtx }: Props) {
  const firedRef = useRef(false);
  const piecesRef = useRef<PaperPiece[]>([]);
  if (piecesRef.current.length === 0) piecesRef.current = makePieces();

  const [dismissing, setDismissing] = useState(false);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleDismiss = useCallback(() => {
    setDismissing((prev) => { if (prev) return prev; return true; });
  }, []);

  // When the shrink animation ends, call onDismiss — audio has already faded by then.
  const handleCoverAnimEnd = useCallback((e: React.AnimationEvent) => {
    if (e.animationName !== "celebrationShrink") return;
    onDismiss();
  }, [onDismiss]);

  // Fade audio out as soon as the dismiss animation starts (matches the 0.45s CSS shrink).
  useEffect(() => {
    if (!dismissing || !audioCtx || audioCtx.state === "closed") return;
    const gain = gainRef.current;
    if (!gain) return;
    gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
    const src = sourceRef.current;
    const t = setTimeout(() => { try { src?.stop(); } catch { /* already stopped */ } }, 400);
    return () => clearTimeout(t);
  }, [dismissing, audioCtx]);

  const burst = useCallback(() => {
    const shared = { ticks: 220, gravity: 0.85, decay: 0.93, startVelocity: 34, colors: COLORS };
    confetti({ ...shared, particleCount: 90, spread: 70,  origin: { x: 0.15, y: 0.92 } });
    confetti({ ...shared, particleCount: 90, spread: 70,  origin: { x: 0.85, y: 0.92 } });
    confetti({ ...shared, particleCount: 50, spread: 110, origin: { x: 0.50, y: 0.75 },
      colors: ["#ffd700", "#ffec99", "#fff"] });
  }, []);

  useLayoutEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // audioCtx was created synchronously in the parent's click handler, satisfying autoplay policy.
    // Decode the pre-fetched ArrayBuffer and start playback immediately on mount.
    if (audioCtx) {
      getRawAudio()
        .then((raw: ArrayBuffer | null) => {
          if (!raw || audioCtx.state === "closed") return null;
          return audioCtx.decodeAudioData(raw.slice(0));
        })
        .then((buffer: AudioBuffer | null) => {
          if (!buffer || audioCtx.state === "closed") return;
          const gain = audioCtx.createGain();
          gain.gain.value = 0.65;
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(gain);
          gain.connect(audioCtx.destination);
          gainRef.current = gain;
          sourceRef.current = source;
          source.start(0);
        })
        .catch(() => {});
    }

    const t1 = setTimeout(burst, 300);
    const t2 = setTimeout(burst, 1100);
    const t3 = setTimeout(handleDismiss, 5800);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      try { sourceRef.current?.stop(); } catch { /* already stopped */ }
    };
  }, [burst, handleDismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center backdrop-blur-sm cursor-pointer select-none overflow-hidden"
      style={{ background: "rgba(18, 8, 12, 0.75)" }}
      onClick={handleDismiss}
    >
      {/* ── Paper rain from the top ── */}
      {piecesRef.current.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 pointer-events-none"
          style={{
            left: `${p.left}%`,
            width: p.width,
            height: p.height,
            backgroundColor: p.color,
            borderRadius: p.borderRadius,
            ["--sway" as string]: `${p.sway}px`,
            animation: `paperRain ${p.duration}s ${p.delay}s ease-in both`,
          } as React.CSSProperties}
        />
      ))}

      {/* ── Book cover ── */}
      <div
        style={{
          animation: dismissing
            ? "celebrationShrink 0.45s cubic-bezier(0.36,0,0.66,-0.56) forwards"
            : "celebrationPop 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={handleCoverAnimEnd}
      >
        <div className="relative">
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              boxShadow: "0 0 55px 22px rgba(133,57,83,0.55), 0 0 110px 44px rgba(212,160,176,0.25)",
              borderRadius: "12px",
            }}
          />
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="relative z-10 w-44 h-64 object-cover rounded-xl shadow-2xl"
            />
          ) : (
            <div className="relative z-10 w-44 h-64 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-2xl">
              <span className="text-white text-6xl">📖</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Text ── */}
      <div
        className="mt-7 text-center px-8 max-w-sm"
        style={{ animation: "celebrationFadeUp 0.5s ease 0.45s both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase mb-2">
          You finished
        </p>
        <h2
          className="text-white text-2xl font-bold leading-snug mb-3"
          style={{ textShadow: "0 2px 16px rgba(133,57,83,0.85)" }}
        >
          {title}
        </h2>
        <p className="text-white/50 text-sm">{formatDate(finishedAt)}</p>
      </div>

      {/* ── Dismiss hint ── */}
      <button
        className="mt-10 text-white/30 text-xs hover:text-white/60 transition-colors duration-200"
        style={{ animation: "celebrationFadeUp 0.5s ease 0.85s both" }}
        onClick={handleDismiss}
      >
        tap to dismiss
      </button>
    </div>
  );
}
