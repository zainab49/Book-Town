"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () => identifier.trim().length > 0 && password.length >= 8,
    [identifier, password],
  );

  useBackgroundMusic("/assets/music/8-joyride.wav");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/")) setNextPath(next);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (identifier.trim() === "") { setError("Enter your email or username."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const payload = (await response.json().catch(() => null)) as {
        token?: string; error?: string;
      } | null;

      if (!response.ok || !payload?.token) {
        setError(payload?.error ?? `Login failed (${response.status}).`);
        return;
      }

      // Token goes into localStorage for client-side reads, then into an httpOnly
      // cookie via /api/set-cookie so the edge middleware can verify auth on SSR.
      window.localStorage.setItem("booktown_token", payload.token);
      window.dispatchEvent(new Event("booktown-auth-changed"));

      const cookieResponse = await fetch("/api/set-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: payload.token }),
      });

      // If the cookie write fails, roll back localStorage so both stores stay in sync.
      if (!cookieResponse.ok) {
        window.localStorage.removeItem("booktown_token");
        window.dispatchEvent(new Event("booktown-auth-changed"));
        setError("Login failed: could not persist session cookie.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Login failed: network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dark-shell flex flex-col">

      {/* Illustration top */}
      <div className="auth-illustration min-h-[200px] sm:min-h-[240px]">
        <svg
          viewBox="0 0 280 140"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[320px]"
          aria-hidden="true"
        >
          <rect x="0" y="118" width="280" height="4" fill="rgba(97,45,83,0.5)" rx="2"/>
          <rect x="18" y="82" width="30" height="40" fill="rgba(133,57,83,0.55)" rx="2"/>
          <rect x="26" y="73" width="14" height="11" fill="rgba(133,57,83,0.75)" rx="1"/>
          <rect x="58" y="58" width="46" height="64" fill="rgba(133,57,83,0.65)" rx="2"/>
          <polygon points="58,58 81,34 104,58" fill="rgba(97,45,83,0.55)"/>
          <rect x="71" y="80" width="18" height="42" fill="rgba(44,44,44,0.55)"/>
          <rect x="62" y="65" width="10" height="10" fill="rgba(255,220,100,0.5)" rx="1"/>
          <rect x="84" y="65" width="10" height="10" fill="rgba(255,220,100,0.5)" rx="1"/>
          <rect x="114" y="68" width="34" height="54" fill="rgba(97,45,83,0.65)" rx="2"/>
          <rect x="122" y="59" width="18" height="11" fill="rgba(133,57,83,0.6)" rx="1"/>
          <rect x="117" y="75" width="10" height="10" fill="rgba(255,220,100,0.45)" rx="1"/>
          <rect x="133" y="75" width="10" height="10" fill="rgba(255,220,100,0.45)" rx="1"/>
          <rect x="158" y="63" width="40" height="59" fill="rgba(133,57,83,0.6)" rx="2"/>
          <polygon points="158,63 178,42 198,63" fill="rgba(154,68,98,0.6)"/>
          <rect x="170" y="84" width="16" height="38" fill="rgba(44,44,44,0.5)"/>
          <circle cx="10" cy="94" r="10" fill="rgba(45,90,39,0.85)"/>
          <circle cx="10" cy="87" r="8" fill="rgba(58,112,50,0.85)"/>
          <circle cx="210" cy="90" r="12" fill="rgba(45,90,39,0.8)"/>
          <circle cx="210" cy="82" r="9" fill="rgba(58,112,50,0.8)"/>
          <circle cx="48" cy="96" r="8" fill="rgba(58,112,50,0.85)"/>
        </svg>
      </div>

      {/* Form area */}
      <div className="flex flex-1 flex-col px-6 pt-4 pb-8 sm:mx-auto sm:w-full sm:max-w-sm">

        {/* Tabs */}
        <div className="auth-tabs">
          <span className="auth-tab active">Log in</span>
          <Link href="/register" className="auth-tab">Register</Link>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            autoComplete="username"
            className="field-dark"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="field-dark"
          />

          {error ? (
            <p className="rounded-[var(--r-sm)] bg-[rgba(179,38,58,0.2)] border border-[rgba(179,38,58,0.4)] px-3 py-2 text-xs text-[#ff9999]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="btn-auth mt-2"
          >
            {submitting ? "Signing in..." : "Log in ->"}
          </button>
        </form>
      </div>
    </main>
  );
}

