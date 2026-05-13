"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

export default function LandingPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(6);

  // useMemo with the SSR guard prevents this from running on the server where
  // window is undefined; the memo also ensures we compute this only once.
  const targetPath = useMemo(() => {
    if (typeof window === "undefined") return "/login";
    return window.localStorage.getItem("booktown_token") ? "/dashboard" : "/login";
  }, []);

  useBackgroundMusic("/assets/music/8-joyride.wav");

  useEffect(() => {
    const tick = window.setInterval(() => setSecondsLeft((c) => (c > 0 ? c - 1 : 0)), 1000);
    const timeout = window.setTimeout(() => router.push(targetPath), 6000);
    return () => { window.clearInterval(tick); window.clearTimeout(timeout); };
  }, [router, targetPath]);

  return (
    <main className="dark-shell flex flex-col items-center justify-center px-5 py-10">
      <div className="fade-up flex w-full max-w-xs flex-col items-center gap-6 text-center sm:max-w-sm">

        {/* Town illustration */}
        <svg
          viewBox="0 0 220 130"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[260px]"
          aria-hidden="true"
        >
          {/* Ground */}
          <rect x="0" y="108" width="220" height="4" fill="rgba(97,45,83,0.6)" rx="2"/>

          {/* Building 1 — small left */}
          <rect x="10" y="76" width="26" height="36" fill="rgba(133,57,83,0.7)" rx="2"/>
          <rect x="17" y="67" width="12" height="11" fill="rgba(154,68,98,0.8)" rx="1"/>
          <rect x="13" y="81" width="7" height="7" fill="rgba(255,220,100,0.55)" rx="1"/>
          <rect x="25" y="81" width="7" height="7" fill="rgba(255,220,100,0.55)" rx="1"/>

          {/* Building 2 — tall with roof */}
          <rect x="44" y="52" width="38" height="60" fill="rgba(133,57,83,0.82)" rx="2"/>
          <polygon points="44,52 63,28 82,52" fill="rgba(97,45,83,0.9)"/>
          <rect x="56" y="72" width="14" height="40" fill="rgba(44,44,44,0.65)"/>
          <rect x="47" y="58" width="9" height="9" fill="rgba(255,220,100,0.6)" rx="1"/>
          <rect x="67" y="58" width="9" height="9" fill="rgba(255,220,100,0.6)" rx="1"/>

          {/* Building 3 — medium */}
          <rect x="90" y="64" width="28" height="48" fill="rgba(97,45,83,0.78)" rx="2"/>
          <rect x="97" y="55" width="14" height="11" fill="rgba(133,57,83,0.7)" rx="1"/>
          <rect x="93" y="70" width="8" height="8" fill="rgba(255,220,100,0.5)" rx="1"/>
          <rect x="107" y="70" width="8" height="8" fill="rgba(255,220,100,0.5)" rx="1"/>

          {/* Building 4 — tall right */}
          <rect x="126" y="55" width="32" height="57" fill="rgba(133,57,83,0.75)" rx="2"/>
          <polygon points="126,55 142,34 158,55" fill="rgba(154,68,98,0.85)"/>
          <rect x="136" y="75" width="12" height="37" fill="rgba(44,44,44,0.6)"/>
          <rect x="129" y="62" width="8" height="8" fill="rgba(255,220,100,0.55)" rx="1"/>
          <rect x="148" y="62" width="8" height="8" fill="rgba(255,220,100,0.55)" rx="1"/>

          {/* Building 5 — small far right */}
          <rect x="167" y="72" width="22" height="40" fill="rgba(97,45,83,0.7)" rx="2"/>
          <rect x="174" y="63" width="8" height="11" fill="rgba(133,57,83,0.6)" rx="1"/>

          {/* Trees */}
          <circle cx="5" cy="86" r="9" fill="rgba(45,90,39,0.9)"/>
          <circle cx="5" cy="79" r="7" fill="rgba(58,112,50,0.9)"/>
          <circle cx="193" cy="82" r="10" fill="rgba(45,90,39,0.85)"/>
          <circle cx="193" cy="75" r="7" fill="rgba(58,112,50,0.85)"/>
          <circle cx="38" cy="88" r="6" fill="rgba(58,112,50,0.9)"/>
          <circle cx="120" cy="84" r="7" fill="rgba(45,90,39,0.8)"/>
        </svg>

        {/* Brand */}
        <div className="space-y-1.5">
          <h1 className="splash-brand-name">BookTown</h1>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-[rgba(255,255,255,0.45)]">
            Read - Build - Connect
          </p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-2.5">
          <button
            className="btn-auth"
            onClick={() => router.push(targetPath)}
          >
            Enter BookTown
          </button>
          <button
            className="w-full border border-[rgba(133,57,83,0.5)] rounded-[var(--r-sm)] py-3 text-sm font-semibold text-[rgba(255,255,255,0.65)] bg-transparent cursor-pointer hover:border-[var(--primary)] hover:text-white transition-colors"
            onClick={() => router.push("/register")}
          >
            Create Account
          </button>
        </div>

        <p className="text-xs text-[rgba(255,255,255,0.3)]">
          Continuing in {secondsLeft}s
        </p>
      </div>
    </main>
  );
}
