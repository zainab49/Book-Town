import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware runs on the server edge — localStorage is not available here,
// so auth is checked via the httpOnly cookie set by /api/set-cookie.
const COOKIE_NAME = "booktown_token";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    return NextResponse.next();
  }

  // Preserve the original destination so we can redirect back after login.
  const loginURL = new URL("/login", request.url);
  loginURL.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginURL);
}

export const config = {
  // /friends is intentionally omitted — user search is public-facing.
  matcher: ["/dashboard/:path*", "/library/:path*", "/town/:path*", "/profile/:path*"],
};
