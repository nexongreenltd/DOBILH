import type { Question, QuestionOption } from "@prisma/client";

export type Answers = Record<string, string[] | string>;
type Q = Question & { options: QuestionOption[] };

/** Auto-grades objective questions; returns whether any answers still need manual review. */
export function gradeObjective(questions: Q[], answers: Answers) {
  let score = 0;
  let needsManual = false;
  const perQuestion: Record<string, { correct: boolean | null; earned: number }> = {};
  for (const q of questions) {
    const a = answers[q.id];
    if (q.type === "SHORT_ANSWER") {
      needsManual = true;
      perQuestion[q.id] = { correct: null, earned: 0 };
      continue;
    }
    const chosen = new Set(Array.isArray(a) ? a : a ? [a] : []);
    const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const ok = chosen.size === correct.size && [...chosen].every((id) => correct.has(id));
    if (ok) score += q.marks;
    perQuestion[q.id] = { correct: ok, earned: ok ? q.marks : 0 };
  }
  return { score, needsManual, perQuestion };
}
