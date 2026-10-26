import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { liveAccess, loadLiveSession } from "./live";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Resolves the signed-in user, the session and their live access — or an error response. */
export async function liveContext(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: json({ error: "Sign in required" }, 401) } as const;
  const session = await loadLiveSession(id);
  if (!session || session.hosting !== "PLATFORM") return { error: json({ error: "Live class not found" }, 404) } as const;
  const access = await liveAccess(user, session);
  if (!access.role) return { error: json({ error: "You’re not part of this class" }, 403) } as const;
  return { user, session, access, role: access.role } as const;
}
