"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AssessmentType, AttendanceStatus, CourseMode, MaterialType, QuestionType, SessionStatus, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCanManageCourse, requireStaffOrInstructor } from "@/lib/auth";
import { saveUpload, fileFromForm, UploadError } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { notifyMany, learnerIds } from "@/lib/notify";
import { str, optStr, int, fromLocalInput } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

async function guardCourse(courseId: string) {
  const user = await requireStaffOrInstructor();
  await assertCanManageCourse(user, courseId);
  return user;
}

const coursePath = (id: string) => `/instructor/courses/${id}`;

// ───────── Lessons ─────────

export async function createLesson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const courseId = str(form, "courseId");
  const user = await guardCourse(courseId);
  const title = str(form, "title");
  if (title.length < 2) return { error: "Give the lesson a title." };
  const last = await db.lesson.findFirst({ where: { courseId }, orderBy: { orderNo: "desc" } });
  const publishMode = str(form, "publish");
  const publishAt = publishMode === "now" ? new Date() : publishMode === "schedule" ? fromLocalInput(str(form, "publishAt")) : null;
  const lesson = await db.lesson.create({
    data: { courseId, title, summary: optStr(form, "summary"), durationMin: int(form, "durationMin", 30), orderNo: (last?.orderNo ?? 0) + 1, publishAt, isPreview: form.get("isPreview") === "on" },
  });
  await audit(user.id, "lesson.create", "Lesson", lesson.id, { courseId });
  if (publishAt && publishAt <= new Date()) await announceLesson(courseId, lesson.title);
  revalidatePath(coursePath(courseId));
  return { ok: true, message: "Lesson created." };
}

async function announceLesson(courseId: string, title: string) {
  await notifyMany(await learnerIds(courseId), { type: "announcement", title: "New lesson published", body: `“${title}” is now available with today’s resources.`, link: `/dashboard/courses/${courseId}` });
}

export async function updateLesson(_: ActionResult, form: FormData): Promise<ActionResult> {
  const lesson = await db.lesson.findUnique({ where: { id: str(form, "lessonId") } });
  if (!lesson) return { error: "Lesson not found." };
  const user = await guardCourse(lesson.courseId);
  const publishMode = str(form, "publish");
  const publishAt = publishMode === "now" ? lesson.publishAt && lesson.publishAt <= new Date() ? lesson.publishAt : new Date() : publishMode === "schedule" ? fromLocalInput(str(form, "publishAt")) : null;
  await db.lesson.update({
    where: { id: lesson.id },
    data: { title: str(form, "title") || lesson.title, summary: optStr(form, "summary"), durationMin: int(form, "durationMin", lesson.durationMin), orderNo: int(form, "orderNo", lesson.orderNo), isPreview: form.get("isPreview") === "on", publishAt },
  });
  if (!lesson.publishAt && publishAt && publishAt <= new Date()) await announceLesson(lesson.courseId, lesson.title);
  await audit(user.id, "lesson.update", "Lesson", lesson.id);
  revalidatePath(coursePath(lesson.courseId));
  return { ok: true, message: "Lesson saved." };
}

export async function deleteLesson(form: FormData) {
  const lesson = await db.lesson.findUnique({ where: { id: str(form, "lessonId") } });
  if (!lesson) return;
  const user = await guardCourse(lesson.courseId);
  await db.lesson.delete({ where: { id: lesson.id } });
  await audit(user.id, "lesson.delete", "Lesson", lesson.id, { title: lesson.title });
  revalidatePath(coursePath(lesson.courseId));
}

export async function addMaterial(_: ActionResult, form: FormData): Promise<ActionResult> {
  const lesson = await db.lesson.findUnique({ where: { id: str(form, "lessonId") } });
  if (!lesson) return { error: "Lesson not found." };
  const user = await guardCourse(lesson.courseId);
  const type = str(form, "type") as MaterialType;
  if (!["VIDEO", "PDF", "SLIDE", "LINK", "FILE"].includes(type)) return { error: "Choose a material type." };
  const title = str(form, "title");
  if (!title) return { error: "Give the resource a title." };
  const upload = fileFromForm(form, "file");
  let url = optStr(form, "url");
  if (url && !/^https:\/\//.test(url)) return { error: "Links must start with https://" };
  if (url && type === "VIDEO") url = toEmbedUrl(url);
  if (!upload && !url) return { error: "Upload a file or paste a link." };
  let fileId: string | null = null;
  if (upload) {
    try {
      fileId = (await saveUpload(upload, user.id)).id;
    } catch (e) {
      return { error: e instanceof UploadError ? e.message : "Upload failed." };
    }
  }
  const count = await db.material.count({ where: { lessonId: lesson.id } });
  await db.material.create({ data: { lessonId: lesson.id, type, title, url: fileId ? null : url, fileId, orderNo: count, visibility: (str(form, "visibility") as Visibility) || "ENROLLED" } });
  await audit(user.id, "material.add", "Lesson", lesson.id, { type, title });
  revalidatePath(coursePath(lesson.courseId));
  return { ok: true, message: "Resource added." };
}

function toEmbedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export async function deleteMaterial(form: FormData) {
  const m = await db.material.findUnique({ where: { id: str(form, "materialId") }, include: { lesson: true } });
  if (!m) return;
  const user = await guardCourse(m.lesson.courseId);
  await db.material.delete({ where: { id: m.id } });
  await audit(user.id, "material.delete", "Material", m.id, { title: m.title });
  revalidatePath(coursePath(m.lesson.courseId));
}

// ───────── Sessions & attendance ─────────

export async function createSession(_: ActionResult, form: FormData): Promise<ActionResult> {
  const batch = await db.batch.findUnique({ where: { id: str(form, "batchId") } });
  if (!batch) return { error: "Choose a batch." };
  const user = await guardCourse(batch.courseId);
  const startsAt = fromLocalInput(str(form, "startsAt"));
  const minutes = int(form, "durationMin", 120);
  if (!startsAt) return { error: "Choose a start time." };
  const mode = (str(form, "mode") as CourseMode) || "ONLINE";
  const liveUrl = optStr(form, "liveUrl");
  if (mode === "ONLINE" && liveUrl && !/^https:\/\//.test(liveUrl)) return { error: "Live link must start with https://" };
  const session = await db.classSession.create({
    data: {
      batchId: batch.id,
      lessonId: optStr(form, "lessonId"),
      title: str(form, "title") || "Class session",
      mode,
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60000),
      liveUrl: mode === "ONLINE" ? liveUrl : null,
      venue: mode !== "ONLINE" ? optStr(form, "venue") ?? batch.venue : null,
    },
  });
  await notifyMany(await learnerIds(batch.courseId, batch.id), {
    type: "session",
    title: "New class scheduled",
    body: `${session.title} — ${startsAt.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}`,
    link: "/dashboard/schedule",
  });
  await audit(user.id, "session.create", "ClassSession", session.id, { batchId: batch.id });
  revalidatePath("/instructor/sessions");
  revalidatePath(coursePath(batch.courseId));
  return { ok: true, message: "Session scheduled and learners notified." };
}

export async function updateSessionStatus(form: FormData) {
  const session = await db.classSession.findUnique({ where: { id: str(form, "sessionId") }, include: { batch: true } });
  if (!session) return;
  const user = await guardCourse(session.batch.courseId);
  const status = str(form, "status") as SessionStatus;
  if (!["SCHEDULED", "LIVE", "COMPLETED", "CANCELLED"].includes(status)) return;
  await db.classSession.update({ where: { id: session.id }, data: { status, recordingUrl: optStr(form, "recordingUrl") ?? session.recordingUrl } });
  if (status === "CANCELLED") {
    await notifyMany(await learnerIds(session.batch.courseId, session.batchId), { type: "session", title: "Class cancelled", body: `${session.title} has been cancelled.`, link: "/dashboard/schedule" });
  }
  await audit(user.id, "session.status", "ClassSession", session.id, { status });
  revalidatePath(`/instructor/sessions/${session.id}`);
  revalidatePath("/instructor/sessions");
}

export async function saveAttendance(_: ActionResult, form: FormData): Promise<ActionResult> {
  const session = await db.classSession.findUnique({ where: { id: str(form, "sessionId") }, include: { batch: true } });
  if (!session) return { error: "Session not found." };
  const user = await guardCourse(session.batch.courseId);
  const roster = await db.enrollment.findMany({ where: { batchId: session.batchId, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { userId: true } });
  const valid: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];
  let count = 0;
  await db.$transaction(async (tx) => {
    for (const { userId } of roster) {
      const status = str(form, `s_${userId}`) as AttendanceStatus;
      if (!valid.includes(status)) continue;
      await tx.attendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: userId } },
        create: { sessionId: session.id, studentId: userId, status, markedById: user.id },
        update: { status, markedById: user.id, markedAt: new Date() },
      });
      count++;
    }
    if (session.status === "SCHEDULED" && session.startsAt <= new Date()) await tx.classSession.update({ where: { id: session.id }, data: { status: "COMPLETED" } });
  });
  await audit(user.id, "attendance.save", "ClassSession", session.id, { marked: count });
  revalidatePath(`/instructor/sessions/${session.id}`);
  return { ok: true, message: `Attendance saved for ${count} learner${count === 1 ? "" : "s"}.` };
}

// ───────── Assessments ─────────

const assessmentSchema = z.object({
  title: z.string().trim().min(2, "Give the assessment a title."),
  type: z.enum(["QUIZ", "ASSIGNMENT", "CLASS_TEST", "EXAM"]),
  totalMarks: z.coerce.number().int().min(1).max(1000),
  passMarks: z.coerce.number().int().min(0),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  durationMin: z.coerce.number().int().min(0).max(600),
});

export async function createAssessment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const courseId = str(form, "courseId");
  const user = await guardCourse(courseId);
  const parsed = assessmentSchema.safeParse({
    title: str(form, "title"), type: str(form, "type"), totalMarks: str(form, "totalMarks") || 10, passMarks: str(form, "passMarks") || 0,
    maxAttempts: str(form, "maxAttempts") || 1, durationMin: str(form, "durationMin") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.passMarks > parsed.data.totalMarks) return { error: "Pass marks can't exceed total marks." };
  const a = await db.assessment.create({
    data: {
      courseId, batchId: optStr(form, "batchId"), type: parsed.data.type as AssessmentType, title: parsed.data.title, instructions: optStr(form, "instructions"),
      totalMarks: parsed.data.totalMarks, passMarks: parsed.data.passMarks, maxAttempts: parsed.data.maxAttempts, durationMin: parsed.data.durationMin || null,
      dueAt: fromLocalInput(str(form, "dueAt")), createdById: user.id,
    },
  });
  await audit(user.id, "assessment.create", "Assessment", a.id, { courseId });
  redirect(`/instructor/assessments/${a.id}`);
}

export async function updateAssessment(_: ActionResult, form: FormData): Promise<ActionResult> {
  const a = await db.assessment.findUnique({ where: { id: str(form, "assessmentId") } });
  if (!a) return { error: "Not found." };
  const user = await guardCourse(a.courseId);
  const parsed = assessmentSchema.safeParse({
    title: str(form, "title"), type: a.type, totalMarks: str(form, "totalMarks"), passMarks: str(form, "passMarks"), maxAttempts: str(form, "maxAttempts"), durationMin: str(form, "durationMin") || 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.passMarks > parsed.data.totalMarks) return { error: "Pass marks can't exceed total marks." };
  await db.assessment.update({
    where: { id: a.id },
    data: { title: parsed.data.title, instructions: optStr(form, "instructions"), totalMarks: parsed.data.totalMarks, passMarks: parsed.data.passMarks, maxAttempts: parsed.data.maxAttempts, durationMin: parsed.data.durationMin || null, dueAt: fromLocalInput(str(form, "dueAt")), batchId: optStr(form, "batchId") },
  });
  await audit(user.id, "assessment.update", "Assessment", a.id);
  revalidatePath(`/instructor/assessments/${a.id}`);
  return { ok: true, message: "Saved." };
}

export async function setAssessmentStatus(form: FormData) {
  const a = await db.assessment.findUnique({ where: { id: str(form, "assessmentId") }, include: { _count: { select: { questions: true } } } });
  if (!a) return;
  const user = await guardCourse(a.courseId);
  const action = str(form, "action");
  if (action === "publish") {
    if (a.type === "QUIZ" && a._count.questions === 0) redirect(`/instructor/assessments/${a.id}?error=no-questions`);
    await db.assessment.update({ where: { id: a.id }, data: { status: "PUBLISHED" } });
    await notifyMany(await learnerIds(a.courseId, a.batchId), { type: "assessment", title: `New ${a.type.toLowerCase().replace("_", " ")}: ${a.title}`, body: a.dueAt ? `Due ${a.dueAt.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })}.` : "Now open.", link: `/dashboard/assessments/${a.id}` });
  } else if (action === "close") {
    await db.assessment.update({ where: { id: a.id }, data: { status: "CLOSED" } });
  } else if (action === "draft") {
    await db.assessment.update({ where: { id: a.id }, data: { status: "DRAFT" } });
  } else if (action === "release") {
    await db.assessment.update({ where: { id: a.id }, data: { resultsPublished: true } });
    const graded = await db.submission.findMany({ where: { assessmentId: a.id, status: "GRADED" }, select: { studentId: true } });
    await notifyMany(graded.map((g) => g.studentId), { type: "result", title: "Results published", body: `Marks for “${a.title}” are now available.`, link: `/dashboard/assessments/${a.id}` });
  } else if (action === "hide") {
    await db.assessment.update({ where: { id: a.id }, data: { resultsPublished: false } });
  }
  await audit(user.id, `assessment.${action}`, "Assessment", a.id);
  revalidatePath(`/instructor/assessments/${a.id}`);
}

export async function deleteAssessment(form: FormData) {
  const a = await db.assessment.findUnique({ where: { id: str(form, "assessmentId") } });
  if (!a) return;
  const user = await guardCourse(a.courseId);
  await db.assessment.delete({ where: { id: a.id } });
  await audit(user.id, "assessment.delete", "Assessment", a.id, { title: a.title });
  redirect("/instructor/assessments");
}

export async function addQuestion(_: ActionResult, form: FormData): Promise<ActionResult> {
  const a = await db.assessment.findUnique({ where: { id: str(form, "assessmentId") } });
  if (!a) return { error: "Not found." };
  await guardCourse(a.courseId);
  const type = (str(form, "type") as QuestionType) || "SINGLE_CHOICE";
  const prompt = str(form, "prompt");
  if (!prompt) return { error: "Write the question." };
  let options: { text: string; isCorrect: boolean }[] = [];
  if (type === "TRUE_FALSE") {
    const correct = str(form, "tf") === "false" ? 1 : 0;
    options = [{ text: "True", isCorrect: correct === 0 }, { text: "False", isCorrect: correct === 1 }];
  } else if (type !== "SHORT_ANSWER") {
    for (let i = 0; i < 6; i++) {
      const text = str(form, `opt_${i}`);
      if (text) options.push({ text, isCorrect: form.get(`correct_${i}`) === "on" });
    }
    if (options.length < 2) return { error: "Add at least two options." };
    const nCorrect = options.filter((o) => o.isCorrect).length;
    if (nCorrect === 0) return { error: "Mark the correct option." };
    if (type === "SINGLE_CHOICE" && nCorrect > 1) return { error: "Single-choice questions need exactly one correct option." };
  }
  const order = await db.question.count({ where: { assessmentId: a.id } });
  await db.question.create({
    data: { assessmentId: a.id, type, prompt, marks: int(form, "marks", 1), orderNo: order, explanation: optStr(form, "explanation"), options: { create: options.map((o, i) => ({ ...o, orderNo: i })) } },
  });
  revalidatePath(`/instructor/assessments/${a.id}`);
  return { ok: true, message: "Question added." };
}

export async function deleteQuestion(form: FormData) {
  const q = await db.question.findUnique({ where: { id: str(form, "questionId") }, include: { assessment: true } });
  if (!q) return;
  await guardCourse(q.assessment.courseId);
  await db.question.delete({ where: { id: q.id } });
  revalidatePath(`/instructor/assessments/${q.assessmentId}`);
}

export async function gradeSubmission(_: ActionResult, form: FormData): Promise<ActionResult> {
  const sub = await db.submission.findUnique({ where: { id: str(form, "submissionId") }, include: { assessment: true } });
  if (!sub) return { error: "Submission not found." };
  const user = await guardCourse(sub.assessment.courseId);
  const obtained = Number(str(form, "obtained"));
  if (!Number.isFinite(obtained) || obtained < 0 || obtained > sub.assessment.totalMarks) return { error: `Marks must be between 0 and ${sub.assessment.totalMarks}.` };
  await db.submission.update({ where: { id: sub.id }, data: { obtained, feedback: optStr(form, "feedback"), status: "GRADED", gradedById: user.id, gradedAt: new Date() } });
  // Grade changes are always audited, with the previous value.
  await audit(user.id, sub.status === "GRADED" ? "grade.change" : "grade.set", "Submission", sub.id, { from: sub.obtained, to: obtained, assessmentId: sub.assessmentId });
  if (sub.assessment.resultsPublished) {
    await notifyMany([sub.studentId], { type: "result", title: "Assessment graded", body: `You scored ${obtained}/${sub.assessment.totalMarks} on “${sub.assessment.title}”.`, link: `/dashboard/assessments/${sub.assessmentId}` });
  }
  revalidatePath(`/instructor/assessments/${sub.assessmentId}`);
  revalidatePath("/instructor/grading");
  return { ok: true, message: "Grade saved." };
}

// ───────── Announcements ─────────

export async function createAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const courseId = str(form, "courseId");
  const user = await guardCourse(courseId);
  const title = str(form, "title");
  const body = str(form, "body");
  if (!title || !body) return { error: "Add a title and message." };
  const batchId = optStr(form, "batchId");
  await db.announcement.create({ data: { authorId: user.id, courseId, batchId, title, body } });
  await notifyMany(await learnerIds(courseId, batchId), { type: "announcement", title, body: body.slice(0, 160), link: `/dashboard/courses/${courseId}?tab=announcements` });
  await audit(user.id, "announcement.create", "Course", courseId, { batchId });
  revalidatePath("/instructor/announcements");
  return { ok: true, message: "Announcement sent." };
}
