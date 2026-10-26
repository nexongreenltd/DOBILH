import { z } from "zod";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";
import { rateLimit } from "@/lib/rate-limit";

const send = z.object({ kind: z.enum(["CHAT", "QUESTION"]).default("CHAT"), body: z.string().trim().min(1).max(1000) });
const answer = z.object({ messageId: z.string().min(1), answered: z.boolean() });

function toWire(m: { id: string; kind: string; body: string; offsetSec: number; answeredAt: Date | null; createdAt: Date; user: { id: string; name: string; avatarColor: string } }) {
  return { id: m.id, kind: m.kind, body: m.body, offsetSec: m.offsetSec, answered: !!m.answeredAt, at: m.createdAt, user: m.user };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  const rows = await db.liveChatMessage.findMany({
    where: { sessionId: ctx.session.id },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return json(rows.map(toWire));
}

/** Persist a chat message / question, then fan it out to the room. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.session.status !== "LIVE") return json({ error: "Chat opens when the class is live" }, 409);
  if (!ctx.access.settings.liveChatEnabled) return json({ error: "Chat is turned off for live classes" }, 403);
  if (!rateLimit(`live-chat:${ctx.user.id}`, 20, 60_000).ok) return json({ error: "You’re sending messages too quickly" }, 429);
  const parsed = send.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Message can’t be empty" }, 400);
  const offsetSec = ctx.session.liveStartedAt ? Math.max(0, Math.round((Date.now() - ctx.session.liveStartedAt.getTime()) / 1000)) : 0;
  const m = await db.liveChatMessage.create({
    data: { sessionId: ctx.session.id, userId: ctx.user.id, kind: parsed.data.kind, body: parsed.data.body, offsetSec },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });
  const wire = toWire(m);
  await broadcast(ctx.session.id, { type: "chat", message: wire });
  return json(wire);
}

/** Host marks a question answered / unanswered. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.role === "learner") return json({ error: "Only the instructor can answer questions" }, 403);
  const parsed = answer.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const m = await db.liveChatMessage.update({
    where: { id: parsed.data.messageId, sessionId: ctx.session.id },
    data: { answeredAt: parsed.data.answered ? new Date() : null },
    include: { user: { select: { id: true, name: true, avatarColor: true } } },
  });
  await broadcast(ctx.session.id, { type: "chat-update", message: toWire(m) });
  return json(toWire(m));
}
