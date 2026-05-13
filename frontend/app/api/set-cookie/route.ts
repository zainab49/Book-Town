import { NextResponse } from "next/server";

// Client-side JS cannot set httpOnly cookies directly.
// This route acts as a thin proxy so login/register pages can persist the
// token as an httpOnly cookie, which the edge middleware then reads for auth.
const COOKIE_NAME = "booktown_token";
const ONE_DAY_SECONDS = 60 * 60 * 24;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string; clear?: boolean } | null;

  const response = NextResponse.json({ ok: true });

  if (body?.clear) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  }

  const token = (body?.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    path: "/",
    maxAge: ONE_DAY_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
