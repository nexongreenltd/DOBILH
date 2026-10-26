import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** Clears a session cookie whose user no longer exists (or is suspended) and sends them to sign in. */
export function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
