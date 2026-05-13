"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

function HomeIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function BooksIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  );
}

function FriendsIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function ProfileIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function LogoutIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const bcls = (href: string) => `nav-btn${pathname === href ? " active" : ""}`;
  const scls = (href: string) => `sidebar-link${pathname === href ? " active" : ""}`;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────── */}
      <aside className="sidebar-nav">
        <div className="sidebar-nav__logo">
          <div className="sidebar-nav__logo-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
          </div>
          BookTown
        </div>

        <Link href="/dashboard" className={scls("/dashboard")}>
          <HomeIcon size={18} />
          Home
        </Link>
        <Link href="/library" className={scls("/library")}>
          <BooksIcon size={18} />
          Books
        </Link>
        <Link href="/friends" className={scls("/friends")}>
          <FriendsIcon size={18} />
          Friends
        </Link>
        <Link href="/profile" className={scls("/profile")}>
          <ProfileIcon size={18} />
          Profile
        </Link>

        <div style={{ flex: 1 }} />

        <button
          onClick={handleLogout}
          className="sidebar-link w-full"
          style={{ color: "rgba(255,255,255,0.38)", background: "none", border: "none", cursor: "pointer" }}
        >
          <LogoutIcon size={18} />
          Log out
        </button>
      </aside>

      {/* ── Mobile bottom bar (<lg) ───────────────────── */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className={bcls("/dashboard")}>
          <HomeIcon size={20} />
          home
        </Link>
        <Link href="/library" className={bcls("/library")}>
          <BooksIcon size={20} />
          books
        </Link>
        <Link href="/friends" className={bcls("/friends")}>
          <FriendsIcon size={20} />
          friends
        </Link>
        <Link href="/profile" className={bcls("/profile")}>
          <ProfileIcon size={20} />
          profile
        </Link>
        <button onClick={handleLogout} className="nav-btn" style={{ color: "#c0392b" }}>
          <LogoutIcon size={20} />
          logout
        </button>
      </nav>
    </>
  );
}
