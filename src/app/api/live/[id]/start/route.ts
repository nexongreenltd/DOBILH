import { goLive } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.role !== "host") return json({ error: "Only the class instructor can go live" }, 403);
  if (ctx.access.state === "ended" || ctx.access.state === "cancelled") return json({ error: "This class has ended" }, 409);
  if (ctx.access.state === "too-early") return json({ error: "It’s too early to start this class" }, 409);
  const s = await goLive(ctx.session.id, ctx.user.id);
  return json({ status: s.status, liveStartedAt: s.liveStartedAt, recording: s.recordingStatus === "RECORDING" });
}
