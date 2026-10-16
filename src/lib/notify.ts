import "server-only";
import { db } from "./db";

type Note = { type: string; title: string; body: string; link?: string };

export async function notify(userId: string, note: Note) {
  await db.notification.create({ data: { userId, ...note } });
}

export async function notifyMany(userIds: string[], note: Note) {
  if (userIds.length === 0) return;
  await db.notification.createMany({ data: [...new Set(userIds)].map((userId) => ({ userId, ...note })) });
}

/** Active learners in a course (optionally one batch). */
export async function learnerIds(courseId: string, batchId?: string | null) {
  const rows = await db.enrollment.findMany({
    where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] }, ...(batchId ? { batchId } : {}) },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}
