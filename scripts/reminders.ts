/**
 * "Class starts soon" reminders (in-app + email) about an hour before each scheduled class.
 * Runs as a Railway cron service every 15 minutes: `npm run cron:reminders`.
 */
import { db } from "@/lib/db";
import { learnerIds, notifyMany } from "@/lib/notify";

async function main() {
  const now = new Date();
  const soon = await db.classSession.findMany({
    where: { status: "SCHEDULED", reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + 65 * 60_000) } },
    include: { batch: { include: { course: true } } },
  });
  for (const s of soon) {
    const time = s.startsAt.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", hourCycle: "h12" });
    const where = s.mode === "ONLINE" ? (s.hosting === "PLATFORM" ? "online on DoB Live" : "online") : s.venue ? `at ${s.venue}` : "in person";
    await notifyMany(await learnerIds(s.batch.courseId, s.batchId), {
      type: "session",
      title: `Class starts at ${time}`,
      body: `${s.title} — ${s.batch.course.title}, ${where}.`,
      link: s.mode === "ONLINE" && s.hosting === "PLATFORM" ? `/live/${s.id}` : "/dashboard/schedule",
      email: true,
    });
    await db.classSession.update({ where: { id: s.id }, data: { reminderSentAt: new Date() } });
  }
  console.log(`Reminders sent for ${soon.length} class(es).`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Reminders failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
