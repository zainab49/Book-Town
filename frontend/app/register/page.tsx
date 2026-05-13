"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export default function RegisterPage() {
  useBackgroundMusic("/assets/music/8-joyride.wav");

  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(
    () =>
      username.trim() !== "" &&
      isValidEmail(email) &&
      password.length >= 8 &&
      password === confirm,
    [username, email, password, confirm],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (username.trim() === "" || !isValidEmail(email) || password.length < 8) {
      setError("Fill in all fields. Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const regRes = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });

      const regPayload = (await regRes.json().catch(() => null)) as {
        token?: string; error?: string;
      } | null;

      if (!regRes.ok) {
        setError(regPayload?.error ?? `Registration failed (${regRes.status}).`);
        return;
      }

      // Use the token returned by the register endpoint to skip a separate login request.
      // If the backend doesn't return a token (e.g. older API version), fall back to an
      // explicit login call so the user is always taken straight to the dashboard.
      let token = regPayload?.token ?? null;

      if (!token) {
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email.trim(), password }),
        });
        const loginPayload = (await loginRes.json().catch(() => null)) as {
          token?: string; error?: string;
        } | null;
        if (!loginRes.ok || !loginPayload?.token) {
          setError("Account created — please log in.");
          router.push("/login");
          return;
        }
        token = loginPayload.token;
      }

      window.localStorage.setItem("booktown_token", token);
      window.dispatchEvent(new Event("booktown-auth-changed"));

      const cookieRes = await fetch("/api/set-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!cookieRes.ok) {
        window.localStorage.removeItem("booktown_token");
        window.dispatchEvent(new Event("booktown-auth-changed"));
        setError("Registration failed: could not persist session cookie.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Registration failed: network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="dark-shell flex flex-col">

      {/* Illustration top */}
      <div className="auth-illustration min-h-[160px] sm:min-h-[200px]">
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
          <rect x="158" y="63" width="40" height="59" fill="rgba(133,57,83,0.6)" rx="2"/>
          <polygon points="158,63 178,42 198,63" fill="rgba(154,68,98,0.6)"/>
          <circle cx="10" cy="94" r="10" fill="rgba(45,90,39,0.85)"/>
          <circle cx="10" cy="87" r="8" fill="rgba(58,112,50,0.85)"/>
          <circle cx="210" cy="90" r="12" fill="rgba(45,90,39,0.8)"/>
          <circle cx="48" cy="96" r="8" fill="rgba(58,112,50,0.85)"/>
        </svg>
      </div>

      {/* Form area */}
      <div className="flex flex-1 flex-col px-6 pt-4 pb-8 sm:mx-auto sm:w-full sm:max-w-sm">

        {/* Tabs */}
        <div className="auth-tabs">
          <Link href="/login" className="auth-tab">Log in</Link>
          <span className="auth-tab active">Register</span>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="field-dark"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            className="field-dark"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="new-password"
            className="field-dark"
          />
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            type="password"
            autoComplete="new-password"
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
            {submitting ? "Creating account..." : "Create Account ->"}
          </button>
        </form>
      </div>
    </main>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
