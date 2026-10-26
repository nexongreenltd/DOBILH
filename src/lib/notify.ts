import "server-only";
import { db } from "./db";
import { renderEmail, sendEmails } from "./email";

/** `email: true` also sends the notice by email (class changes, payments, certificates…). */
type Note = { type: string; title: string; body: string; link?: string; email?: boolean };

export async function notify(userId: string, note: Note) {
  await notifyMany([userId], note);
}

export async function notifyMany(userIds: string[], { email, ...note }: Note) {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...note })) });
  if (!email) return;
  const users = await db.user.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, select: { email: true, name: true } });
  await sendEmails(
    users.map((u) => ({
      to: u.email,
      subject: note.title,
      ...renderEmail({ name: u.name, title: note.title, body: note.body, cta: note.link ? { label: "Open DoB Hub", path: note.link } : undefined }),
    })),
  );
}

/** Active learners in a course (optionally one batch). */
export async function learnerIds(courseId: string, batchId?: string | null) {
  const rows = await db.enrollment.findMany({
    where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] }, ...(batchId ? { batchId } : {}) },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
