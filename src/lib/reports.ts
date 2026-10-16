import "server-only";
import { db } from "./db";
import { pct } from "./utils";

export type Row = Record<string, string | number | null>;

export const REPORTS = {
  enrollments: "Enrollments",
  payments: "Payments & revenue",
  attendance: "Attendance by student",
  marks: "Assessment marks",
  progress: "Course progress",
} as const;
export type ReportType = keyof typeof REPORTS;

export async function buildReport(type: ReportType, courseId?: string | null): Promise<Row[]> {
  const courseFilter = courseId ? { courseId } : {};
  switch (type) {
    case "enrollments": {
      const rows = await db.enrollment.findMany({ where: courseFilter, include: { user: true, course: true, batch: true }, orderBy: { enrolledAt: "desc" } });
      return rows.map((e) => ({ student: e.user.name, email: e.user.email, course: e.course.title, batch: e.batch?.code ?? "", status: e.status, enrolled_at: e.enrolledAt.toISOString().slice(0, 10) }));
    }
    case "payments": {
      const rows = await db.payment.findMany({ where: courseId ? { enrollment: { courseId } } : {}, include: { user: true, enrollment: { include: { course: true } }, coupon: true }, orderBy: { createdAt: "desc" } });
      return rows.map((p) => ({ invoice: p.invoiceNo, student: p.user.name, course: p.enrollment.course.title, original: p.originalAmount, discount: p.discount, amount: p.amount, coupon: p.coupon?.code ?? "", method: p.method, status: p.status, gateway_ref: p.gatewayRef, paid_at: p.paidAt?.toISOString().slice(0, 10) ?? "" }));
    }
    case "attendance": {
      const enrollments = await db.enrollment.findMany({ where: { ...courseFilter, status: { in: ["ACTIVE", "COMPLETED"] }, batchId: { not: null } }, include: { user: true, course: true, batch: true } });
      const out: Row[] = [];
      for (const e of enrollments) {
        const held = await db.classSession.count({ where: { batchId: e.batchId!, startsAt: { lte: new Date() }, status: { not: "CANCELLED" } } });
        const marks = await db.attendance.groupBy({ by: ["status"], where: { studentId: e.userId, session: { batchId: e.batchId! } }, _count: true });
        const c = (s: string) => marks.find((m) => m.status === s)?._count ?? 0;
        out.push({ student: e.user.name, course: e.course.title, batch: e.batch!.code, sessions_held: held, present: c("PRESENT"), late: c("LATE"), excused: c("EXCUSED"), absent: c("ABSENT"), attendance_pct: pct(c("PRESENT") + c("LATE") + c("EXCUSED"), held) });
      }
      return out;
    }
    case "marks": {
      const rows = await db.submission.findMany({ where: { status: "GRADED", assessment: courseFilter }, include: { student: true, assessment: { include: { course: true } } }, orderBy: { gradedAt: "desc" } });
      return rows.map((s) => ({ student: s.student.name, course: s.assessment.course.title, assessment: s.assessment.title, type: s.assessment.type, attempt: s.attemptNo, obtained: s.obtained, total: s.assessment.totalMarks, pass_marks: s.assessment.passMarks, passed: (s.obtained ?? 0) >= s.assessment.passMarks ? "yes" : "no", graded_at: s.gradedAt?.toISOString().slice(0, 10) ?? "" }));
    }
    case "progress": {
      const enrollments = await db.enrollment.findMany({ where: { ...courseFilter, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { user: true, course: true } });
      const now = new Date();
      const out: Row[] = [];
      for (const e of enrollments) {
        const total = await db.lesson.count({ where: { courseId: e.courseId, publishAt: { not: null, lte: now } } });
        const done = await db.lessonProgress.count({ where: { studentId: e.userId, completedAt: { not: null }, lesson: { courseId: e.courseId, publishAt: { not: null, lte: now } } } });
        out.push({ student: e.user.name, course: e.course.title, status: e.status, lessons_completed: done, lessons_published: total, progress_pct: pct(done, total) });
      }
      return out;
    }
  }
}

export function toCsv(rows: Row[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // neutralise spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
