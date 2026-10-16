import "server-only";
import { db } from "./db";
import { pct } from "./utils";
import { notify } from "./notify";
import { audit } from "./audit";

export const ACCESS_STATUSES = ["ACTIVE", "COMPLETED"] as const;

/** Paid-course access gate: only ACTIVE/COMPLETED enrollments (i.e. verified payment or free) see content. */
export async function getActiveEnrollment(userId: string, courseId: string) {
  return db.enrollment.findFirst({
    where: { userId, courseId, status: { in: [...ACCESS_STATUSES] } },
    include: { batch: true, course: true },
  });
}

export function publishedLessonFilter(now = new Date()) {
  return { publishAt: { not: null, lte: now } };
}

export async function courseProgress(userId: string, courseId: string) {
  const lessons = await db.lesson.findMany({
    where: { courseId, ...publishedLessonFilter() },
    select: { id: true },
  });
  const ids = lessons.map((l) => l.id);
  const done = ids.length
    ? await db.lessonProgress.count({ where: { studentId: userId, lessonId: { in: ids }, completedAt: { not: null } } })
    : 0;
  return { total: ids.length, completed: done, pct: pct(done, ids.length) };
}

export async function attendanceSummary(userId: string, batchId: string | null) {
  if (!batchId) return { held: 0, attended: 0, pct: 100 };
  const held = await db.classSession.findMany({
    where: { batchId, status: { not: "CANCELLED" }, startsAt: { lte: new Date() } },
    select: { id: true },
  });
  if (held.length === 0) return { held: 0, attended: 0, pct: 100 };
  const attended = await db.attendance.count({
    where: { studentId: userId, sessionId: { in: held.map((s) => s.id) }, status: { in: ["PRESENT", "LATE", "EXCUSED"] } },
  });
  return { held: held.length, attended, pct: pct(attended, held.length) };
}

export async function assessmentSummary(userId: string, courseId: string, batchId: string | null) {
  const assessments = await db.assessment.findMany({
    where: { courseId, status: { not: "DRAFT" }, OR: [{ batchId: null }, ...(batchId ? [{ batchId }] : [])] },
    select: {
      id: true,
      title: true,
      type: true,
      totalMarks: true,
      passMarks: true,
      resultsPublished: true,
      submissions: { where: { studentId: userId, status: "GRADED" }, select: { obtained: true } },
    },
  });
  const rows = assessments.map((a) => {
    const best = a.submissions.reduce<number | null>((m, s) => (s.obtained != null && (m == null || s.obtained > m) ? s.obtained : m), null);
    return { ...a, best, passed: best != null && best >= a.passMarks, pct: best != null ? pct(best, a.totalMarks) : null };
  });
  const graded = rows.filter((r) => r.best != null);
  const avg = graded.length ? Math.round(graded.reduce((s, r) => s + (r.pct ?? 0), 0) / graded.length) : null;
  return { rows, total: rows.length, passed: rows.filter((r) => r.passed).length, avgPct: avg };
}

export async function certificateEligibility(userId: string, courseId: string) {
  const enrollment = await getActiveEnrollment(userId, courseId);
  if (!enrollment) return null;
  const { course } = enrollment;
  const [progress, attendance, assess] = await Promise.all([
    courseProgress(userId, courseId),
    attendanceSummary(userId, enrollment.batchId),
    assessmentSummary(userId, courseId, enrollment.batchId),
  ]);
  const checks = [
    {
      label: `Complete at least ${course.certMinProgress}% of lessons`,
      ok: progress.pct >= course.certMinProgress,
      value: `${progress.pct}%`,
    },
    {
      label: `Attend at least ${course.certMinAttendance}% of classes`,
      ok: attendance.pct >= course.certMinAttendance,
      value: `${attendance.pct}%`,
    },
    ...(course.certRequirePass
      ? [{ label: "Pass every published assessment", ok: assess.passed === assess.total, value: `${assess.passed}/${assess.total}` }]
      : []),
  ];
  return { enrollment, progress, attendance, assess, checks, eligible: checks.every((c) => c.ok) };
}

function certificateNumber() {
  const y = new Date().getFullYear();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DOB-${y}-${r}`;
}

/** Issues (idempotently) a certificate and marks the enrollment completed. */
export async function issueCertificate(enrollmentId: string, actorId: string | null) {
  const existing = await db.certificate.findUnique({ where: { enrollmentId } });
  if (existing) return existing;
  const enrollment = await db.enrollment.findUniqueOrThrow({ where: { id: enrollmentId }, include: { course: true } });
  const assess = await assessmentSummary(enrollment.userId, enrollment.courseId, enrollment.batchId);
  const cert = await db.$transaction(async (tx) => {
    const c = await tx.certificate.create({
      data: {
        certificateNo: certificateNumber(),
        enrollmentId,
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        finalScore: assess.avgPct,
      },
    });
    await tx.enrollment.update({ where: { id: enrollmentId }, data: { status: "COMPLETED", completedAt: new Date() } });
    return c;
  });
  await notify(enrollment.userId, {
    type: "certificate",
    title: "Your certificate is ready",
    body: `Congratulations on completing ${enrollment.course.title}.`,
    link: `/certificates/${cert.certificateNo}`,
  });
  await audit(actorId, "certificate.issue", "Certificate", cert.id, { certificateNo: cert.certificateNo });
  return cert;
}

/** Courses an instructor teaches (admins: all). */
export async function manageableCourseIds(user: { id: string; role: string }) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return (await db.course.findMany({ select: { id: true } })).map((c) => c.id);
  }
  return (await db.courseInstructor.findMany({ where: { userId: user.id }, select: { courseId: true } })).map((c) => c.courseId);
}

/** Records that a lesson was opened (partial progress) without marking it complete. */
export async function touchLesson(userId: string, lessonId: string) {
  await db.lessonProgress.upsert({
    where: { studentId_lessonId: { studentId: userId, lessonId } },
    create: { studentId: userId, lessonId, completionPct: 10 },
    update: { lastViewedAt: new Date() },
  });
}
