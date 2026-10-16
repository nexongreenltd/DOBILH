"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEnrollment, certificateEligibility, issueCertificate } from "@/lib/learning";
import { gradeObjective, type Answers } from "@/lib/grading";
import { saveUpload, fileFromForm, UploadError } from "@/lib/storage";
import { notifyMany } from "@/lib/notify";
import { answerQuestion } from "@/lib/ai";
import { getSettings } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

// ───────── Lessons ─────────

async function loadAccessibleLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson || !lesson.publishAt || lesson.publishAt > new Date()) return null;
  const enrollment = await getActiveEnrollment(userId, lesson.courseId);
  return enrollment ? lesson : null;
}

export async function setLessonComplete(form: FormData) {
  const user = await requireUser();
  const lesson = await loadAccessibleLesson(user.id, str(form, "lessonId"));
  if (!lesson) redirect("/forbidden");
  const done = str(form, "done") !== "0";
  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId: user.id, lessonId: lesson.id } },
    create: { studentId: user.id, lessonId: lesson.id, completionPct: done ? 100 : 0, completedAt: done ? new Date() : null },
    update: { completionPct: done ? 100 : 0, completedAt: done ? new Date() : null, lastViewedAt: new Date() },
  });
  revalidatePath(`/dashboard/courses/${lesson.courseId}`);
  // Completing a lesson advances to the next released lesson; un-completing stays put.
  const next = done
    ? await db.lesson.findFirst({ where: { courseId: lesson.courseId, orderNo: { gt: lesson.orderNo }, publishAt: { not: null, lte: new Date() } }, orderBy: { orderNo: "asc" } })
    : null;
  redirect(`/dashboard/courses/${lesson.courseId}?lesson=${next?.id ?? lesson.id}${done ? `&completed=${lesson.id}` : ""}`);
}

// ───────── Assessments ─────────

async function loadAssessmentForStudent(userId: string, assessmentId: string) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId }, include: { questions: { include: { options: true }, orderBy: { orderNo: "asc" } } } });
  if (!a || a.status === "DRAFT") return null;
  const enrollment = await getActiveEnrollment(userId, a.courseId);
  if (!enrollment) return null;
  if (a.batchId && a.batchId !== enrollment.batchId) return null;
  return a;
}

export async function startAttempt(form: FormData) {
  const user = await requireUser();
  const a = await loadAssessmentForStudent(user.id, str(form, "assessmentId"));
  if (!a) redirect("/forbidden");
  const base = `/dashboard/assessments/${a.id}`;
  if (a.status !== "PUBLISHED" || (a.dueAt && a.dueAt < new Date())) redirect(`${base}?error=closed`);
  const open = await db.submission.findFirst({ where: { assessmentId: a.id, studentId: user.id, status: "IN_PROGRESS" } });
  if (open) redirect(`${base}?attempt=${open.id}`);
  const count = await db.submission.count({ where: { assessmentId: a.id, studentId: user.id } });
  if (count >= a.maxAttempts) redirect(`${base}?error=attempts`);
  const sub = await db.submission.create({ data: { assessmentId: a.id, studentId: user.id, attemptNo: count + 1 } });
  redirect(`${base}?attempt=${sub.id}`);
}

export async function submitQuiz(form: FormData) {
  const user = await requireUser();
  const sub = await db.submission.findUnique({ where: { id: str(form, "submissionId") } });
  if (!sub || sub.studentId !== user.id || sub.status !== "IN_PROGRESS") redirect("/dashboard/assessments");
  const a = await loadAssessmentForStudent(user.id, sub.assessmentId);
  if (!a) redirect("/forbidden");

  // Grace window of 2 min past the time limit for network latency.
  const late = a.durationMin != null && Date.now() - sub.startedAt.getTime() > (a.durationMin + 2) * 60000;

  const answers: Answers = {};
  for (const q of a.questions) {
    if (q.type === "MULTI_CHOICE") answers[q.id] = form.getAll(`q_${q.id}`).map(String);
    else if (q.type === "SHORT_ANSWER") answers[q.id] = str(form, `q_${q.id}`);
    else answers[q.id] = form.get(`q_${q.id}`) ? [String(form.get(`q_${q.id}`))] : [];
  }
  const { score, needsManual } = gradeObjective(a.questions, answers);
  const auto = !needsManual;
  await db.submission.update({
    where: { id: sub.id },
    data: {
      answers: answers as Prisma.InputJsonValue,
      submittedAt: new Date(),
      autoScore: score,
      status: auto ? "GRADED" : "SUBMITTED",
      obtained: auto ? score : null,
      gradedAt: auto ? new Date() : null,
      feedback: late ? "Submitted after the time limit." : null,
    },
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard/assessments/${a.id}?done=1`);
}

export async function submitAssignment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const a = await loadAssessmentForStudent(user.id, str(form, "assessmentId"));
  if (!a) return { error: "You don't have access to this assessment." };
  if (a.status !== "PUBLISHED") return { error: "This assessment is closed." };
  if (a.dueAt && a.dueAt < new Date()) return { error: "The deadline has passed." };
  const text = str(form, "textAnswer");
  const upload = fileFromForm(form, "file");
  if (!text && !upload) return { error: "Write your answer or attach a file." };

  const count = await db.submission.count({ where: { assessmentId: a.id, studentId: user.id } });
  if (count >= a.maxAttempts) return { error: "You've used all your submission attempts." };

  let fileId: string | null = null;
  if (upload) {
    try {
      fileId = (await saveUpload(upload, user.id)).id;
    } catch (e) {
      return { error: e instanceof UploadError ? e.message : "Upload failed." };
    }
  }
  await db.submission.create({
    data: { assessmentId: a.id, studentId: user.id, attemptNo: count + 1, status: "SUBMITTED", textAnswer: text || null, fileId, submittedAt: new Date() },
  });
  const teachers = await db.courseInstructor.findMany({ where: { courseId: a.courseId }, select: { userId: true } });
  await notifyMany(teachers.map((t) => t.userId), {
    type: "submission",
    title: "New submission to grade",
    body: `${user.name} submitted “${a.title}”.`,
    link: `/instructor/assessments/${a.id}`,
  });
  revalidatePath(`/dashboard/assessments/${a.id}`);
  return { ok: true, message: "Submitted! Your instructor will grade it soon." };
}

// ───────── Certificates ─────────

export async function claimCertificate(form: FormData) {
  const user = await requireUser();
  const courseId = str(form, "courseId");
  const result = await certificateEligibility(user.id, courseId);
  if (!result || !result.eligible) redirect("/dashboard/certificates?error=not-eligible");
  const cert = await issueCertificate(result.enrollment.id, user.id);
  redirect(`/certificates/${cert.certificateNo}`);
}

// ───────── Notifications ─────────

export async function markAllRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/dashboard", "layout");
}

export async function openNotification(form: FormData) {
  const user = await requireUser();
  const n = await db.notification.findUnique({ where: { id: str(form, "id") } });
  if (!n || n.userId !== user.id) redirect("/dashboard/notifications");
  if (!n.readAt) await db.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  redirect(n.link ?? "/dashboard/notifications");
}

// ───────── AI assistant ─────────

type AskResult = { ok?: boolean; error?: string; conversationId?: string } | undefined;

export async function askAssistant(_: AskResult, form: FormData): Promise<AskResult> {
  const user = await requireUser();
  const settings = await getSettings();
  if (!settings.aiEnabled) return { error: "The assistant is currently turned off." };
  const question = str(form, "question").slice(0, 1000);
  if (!question) return { error: "Type a question first." };
  const rl = rateLimit(`ai:${user.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return { error: "You've reached the hourly question limit. Please try again later." };

  let conversationId = str(form, "conversationId");
  const courseId = str(form, "courseId") || null;
  if (courseId && !(await getActiveEnrollment(user.id, courseId))) return { error: "You're not enrolled in that course." };

  let convo = conversationId ? await db.aiConversation.findUnique({ where: { id: conversationId }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null;
  if (convo && convo.userId !== user.id) return { error: "Conversation not found." };
  if (!convo) {
    convo = await db.aiConversation.create({ data: { userId: user.id, courseId, title: question.slice(0, 60) }, include: { messages: true } });
    conversationId = convo.id;
  }

  await db.aiMessage.create({ data: { conversationId: convo.id, role: "USER", content: question } });
  const reply = await answerQuestion({
    userId: user.id,
    courseId: convo.courseId,
    question,
    history: convo.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  await db.aiMessage.create({
    data: { conversationId: convo.id, role: "ASSISTANT", content: reply.content, sourceIds: reply.sourceIds, needsReview: reply.needsReview },
  });
  await db.aiConversation.update({ where: { id: convo.id }, data: { updatedAt: new Date() } });
  revalidatePath("/dashboard/assistant");
  return { ok: true, conversationId };
}

export async function deleteConversation(form: FormData) {
  const user = await requireUser();
  await db.aiConversation.deleteMany({ where: { id: str(form, "id"), userId: user.id } });
  redirect("/dashboard/assistant");
}
