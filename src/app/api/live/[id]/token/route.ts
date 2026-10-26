import { createJoinToken, liveConfig } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (!liveConfig()) return json({ error: "Live streaming isn’t configured on this server yet." }, 503);
  if (!ctx.access.canConnect) return json({ error: "The class isn’t open yet.", state: ctx.access.state }, 409);
  if (!rateLimit(`live-token:${ctx.user.id}`, 30, 10 * 60_000).ok) return json({ error: "Too many attempts" }, 429);
  const { token, url } = await createJoinToken(ctx.user, ctx.session.id, ctx.role);
  return json({ token, url, role: ctx.role });
}
