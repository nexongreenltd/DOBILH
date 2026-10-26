import { endLive } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.role === "learner") return json({ error: "Only the instructor can end the class" }, 403);
  const s = await endLive(ctx.session.id, ctx.user.id);
  return json({ status: s.status, recordingStatus: s.recordingStatus });
}
