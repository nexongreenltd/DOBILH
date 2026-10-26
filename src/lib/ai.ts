import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiKnowledge } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { formatDateTime } from "./utils";

/**
 * Phase-1 learning assistant.
 *  1. Retrieve curated knowledge (course-scoped + platform FAQs) by keyword overlap.
 *  2. Add the learner's live course context (schedule, lessons, deadlines).
 *  3. If a Claude credential is configured, generate a grounded answer constrained to that
 *     context; otherwise return the best curated answer.
 * Anything the assistant can't answer is flagged for the admin review queue.
 */

// AI_MODEL=claude-sonnet-5-5 halves the cost; Opus gives the strongest answers.
const MODEL = process.env.AI_MODEL || "claude-opus-5-5";
const MATCH_THRESHOLD = 2.5;

const STOP = new Set(
  "a an the is are am was were be to of in on for and or but with how what when where why who which do does did can could i my me you your it this that there here about from at by as".split(" "),
);

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ঀ-৿\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function score(entry: AiKnowledge, q: Set<string>) {
  let s = 0;
  for (const k of entry.keywords) for (const t of tokens(k)) if (q.has(t)) s += 3;
  for (const t of new Set(tokens(entry.question))) if (q.has(t)) s += 2;
  for (const t of new Set(tokens(entry.answer))) if (q.has(t)) s += 0.25;
  return s;
}

export async function retrieve(question: string, courseId: string | null, limit = 4) {
  const entries = await db.aiKnowledge.findMany({
    where: { status: "ACTIVE", OR: [{ courseId: null }, ...(courseId ? [{ courseId }] : [])] },
  });
  const q = new Set(tokens(question));
  return entries
    .map((e) => ({ entry: e, score: score(e, q) + (e.courseId ? 0.5 : 0) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function learnerContext(userId: string, courseId: string | null) {
  if (!courseId) return "";
  const enrollment = await db.enrollment.findFirst({
    where: { userId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { course: { select: { title: true, mode: true } }, batch: true },
  });
  if (!enrollment) return "";
  const now = new Date();
  const [sessions, lessons, due] = await Promise.all([
    enrollment.batchId
      ? db.classSession.findMany({
          where: { batchId: enrollment.batchId, startsAt: { gte: now }, status: { not: "CANCELLED" } },
          orderBy: { startsAt: "asc" },
          take: 3,
        })
      : [],
    db.lesson.findMany({
      where: { courseId, publishAt: { not: null, lte: now } },
      orderBy: { orderNo: "asc" },
      select: { orderNo: true, title: true, summary: true },
    }),
    db.assessment.findMany({
      where: { courseId, status: "PUBLISHED", dueAt: { gte: now } },
      orderBy: { dueAt: "asc" },
      take: 3,
      select: { title: true, type: true, dueAt: true, totalMarks: true },
    }),
  ]);
  const lines = [
    `Course: ${enrollment.course.title} (${enrollment.course.mode.toLowerCase()})`,
    enrollment.batch ? `Batch: ${enrollment.batch.name}${enrollment.batch.venue ? `, venue ${enrollment.batch.venue}` : ""}` : "",
    sessions.length
      ? `Upcoming classes:\n${sessions
          .map((s) => `- ${s.title} — ${formatDateTime(s.startsAt)} (${s.mode.toLowerCase()}${s.venue ? `, ${s.venue}` : ""})`)
          .join("\n")}`
      : "",
    lessons.length ? `Published lessons:\n${lessons.map((l) => `- ${l.orderNo}. ${l.title}${l.summary ? `: ${l.summary}` : ""}`).join("\n")}` : "",
    due.length
      ? `Upcoming deadlines:\n${due.map((a) => `- ${a.title} (${a.type.toLowerCase()}, ${a.totalMarks} marks) due ${formatDateTime(a.dueAt)}`).join("\n")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

const SYSTEM = `You are the learning assistant for DoB Innovation & Learning Hub, a learning platform run by Dreams of Bangladesh.

You help enrolled students with questions about their courses, schedules, deadlines, and how the platform works (enrollment, payments, certificates, attendance).

Answer only from the knowledge base entries and learner context provided in each request. If they don't contain the answer, set "answered" to false and write a short, kind reply saying you've passed the question to the learning team, who will follow up. Do not guess at policies, prices, dates, or grades.

Keep answers brief and practical: a few sentences, or a short list when steps are involved. Students may write in Bangla or English; reply in the language they used.`;

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    answered: { type: "boolean", description: "True only if the provided knowledge or context answers the question." },
    answer: { type: "string" },
  },
  required: ["answered", "answer"],
  additionalProperties: false,
} as const;

function hasClaudeCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function claude() {
  client ??= new Anthropic();
  return client;
}

export type AssistantReply = { content: string; sourceIds: string[]; needsReview: boolean; generated: boolean };

const FALLBACK =
  "I don't have a confident answer to that yet, so I've passed your question to the learning team — they'll follow up. Meanwhile, you can check your course page or contact support.";

export async function answerQuestion(opts: {
  userId: string;
  courseId: string | null;
  question: string;
  history: { role: "USER" | "ASSISTANT"; content: string }[];
}): Promise<AssistantReply> {
  const settings = await getSettings();
  const matches = await retrieve(opts.question, opts.courseId);
  const sourceIds = matches.map((m) => m.entry.id);
  const strong = matches.filter((m) => m.score >= MATCH_THRESHOLD);

  const curated = (): AssistantReply =>
    strong.length
      ? { content: strong[0]!.entry.answer, sourceIds: [strong[0]!.entry.id], needsReview: false, generated: false }
      : { content: FALLBACK, sourceIds: [], needsReview: true, generated: false };

  if (!settings.aiGenerative || !hasClaudeCredentials()) return bump(curated());

  const context = await learnerContext(opts.userId, opts.courseId);
  const knowledge = matches.length
    ? matches.map((m, i) => `[${i + 1}] Q: ${m.entry.question}\nA: ${m.entry.answer}`).join("\n\n")
    : "(no matching entries)";

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...opts.history.slice(-6).map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    {
      role: "user",
      content: `<knowledge_base>\n${knowledge}\n</knowledge_base>\n\n<learner_context>\n${context || "(student has no active course selected)"}\n</learner_context>\n\n<question>\n${opts.question}\n</question>`,
    },
  ];

  try {
    const response = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      output_config: { effort: "low", format: { type: "json_schema", schema: ANSWER_SCHEMA } },
      messages,
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return bump(curated());
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) return bump(curated());
    const parsed = JSON.parse(text) as { answered: boolean; answer: string };
    return bump({ content: parsed.answer, sourceIds, needsReview: !parsed.answered, generated: true });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn("[ai] rate limited; using curated answer");
    else if (error instanceof Anthropic.APIError) console.error(`[ai] API error ${error.status}: ${error.message}`);
    else console.error("[ai] unexpected error", error);
    return bump(curated());
  }
}

async function bump(reply: AssistantReply) {
  if (reply.sourceIds.length) {
    await db.aiKnowledge.updateMany({ where: { id: { in: reply.sourceIds } }, data: { hits: { increment: 1 } } });
  }
  return reply;
}
