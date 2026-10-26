import { appendRecordingChunk } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";

const MAX_CHUNK = 25 * 1024 * 1024;

/** Host browser streams its recording here in sequential chunks: ?segment=<startMs>&seq=<n>. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.role !== "host") return json({ error: "Only the host records the class" }, 403);
  if (ctx.session.status !== "LIVE" || ctx.session.recordingStatus !== "RECORDING") return json({ error: "Not recording" }, 409);
  const u = new URL(req.url);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) return json({ ok: true });
  if (buf.length > MAX_CHUNK) return json({ error: "Chunk too large" }, 413);
  const r = await appendRecordingChunk(ctx.session.id, u.searchParams.get("segment") ?? "", Number(u.searchParams.get("seq")), buf);
  return r.ok ? json(r) : json(r, r.status);
}
