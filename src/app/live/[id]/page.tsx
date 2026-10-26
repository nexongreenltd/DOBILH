import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { liveAccess, liveConfig, loadLiveSession } from "@/lib/live";
import { db } from "@/lib/db";
import { Classroom } from "@/components/live/classroom";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await db.classSession.findUnique({ where: { id: (await params).id }, select: { title: true } });
  return { title: s ? `Live · ${s.title}` : "Live class" };
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const session = await loadLiveSession(id);
  if (!session) notFound();
  if (session.hosting === "EXTERNAL") {
    if (session.liveUrl) redirect(session.liveUrl);
    notFound();
  }
  const access = await liveAccess(user, session);
  if (!access.role) redirect("/forbidden");

  const lead = await db.courseInstructor.findFirst({ where: { courseId: session.batch.courseId }, orderBy: { isLead: "desc" }, include: { user: { select: { name: true } } } });
  const staffSide = access.role !== "learner";

  return (
    <Classroom
      sessionId={session.id}
      title={session.title}
      courseTitle={session.batch.course.title}
      batchName={session.batch.name}
      startsAt={session.startsAt.toISOString()}
      endsAt={session.endsAt.toISOString()}
      role={access.role}
      initialState={access.state}
      hostName={lead?.user.name ?? "your instructor"}
      chatEnabled={access.settings.liveChatEnabled}
      recordingEnabled={access.settings.liveRecordingEnabled}
      configured={!!liveConfig()}
      backHref={staffSide ? `/instructor/sessions/${session.id}` : "/dashboard/schedule"}
      courseHref={staffSide ? `/instructor/courses/${session.batch.courseId}?tab=sessions` : `/dashboard/courses/${session.batch.courseId}`}
    />
  );
}
