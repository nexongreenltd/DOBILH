import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ROUTE_RULES, homeFor } from "@/lib/rbac";

// First line of defence only — every page and action re-checks authorization server-side.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  const rule = ROUTE_RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return NextResponse.next();

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/forbidden", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/instructor/:path*", "/dashboard/:path*", "/checkout/:path*", "/pay/:path*", "/login", "/register"],
};
