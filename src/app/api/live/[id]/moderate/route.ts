import { z } from "zod";
import { moderate } from "@/lib/live";
import { json, liveContext } from "@/lib/live-api";
import { audit } from "@/lib/audit";

const body = z.object({
  action: z.enum(["allow-speak", "revoke-speak", "remove", "mute"]),
  identity: z.string().min(1),
  trackSid: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await liveContext((await params).id);
  if ("error" in ctx) return ctx.error;
  if (ctx.role === "learner") return json({ error: "Only the instructor can moderate" }, 403);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  if (parsed.data.identity === ctx.user.id && parsed.data.action === "remove") return json({ error: "You can’t remove yourself" }, 400);
  await moderate(ctx.session.id, parsed.data.action, parsed.data.identity, parsed.data.trackSid);
  if (parsed.data.action === "remove") await audit(ctx.user.id, "live.remove_participant", "ClassSession", ctx.session.id, { identity: parsed.data.identity });
  return json({ ok: true });
}
