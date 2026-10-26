import { recordPresence } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.session.status !== "LIVE") return json({ state: ctx.access.state });
  await recordPresence(ctx.session.id, ctx.user.id, ctx.role === "host");
  return json({ ok: true, state: "live" });
}
