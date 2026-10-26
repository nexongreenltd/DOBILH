import { notFound } from "next/navigation";
import Link from "next/link";
import { Video, MapPin, Clock, BookOpen, Users, Radio, Film, MessageSquare, HelpCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/db";
import { assertCanManageCourse, requireStaffOrInstructor } from "@/lib/auth";
import { saveAttendance, updateSessionStatus, forceEndLive, retryRecording } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AttendanceGrid } from "@/components/attendance-grid";
import { Badge, Card, CardHeader, EmptyState, InfoTile, Input, LinkButton, StatusBadge } from "@/components/ui";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffOrInstructor();
  const { id } = await params;
  const session = await db.classSession.findUnique({ where: { id }, include: { batch: { include: { course: true } }, lesson: true, attendance: true } });
  if (!session) notFound();
  await assertCanManageCourse(user, session.batch.courseId);
  const roster = await db.enrollment.findMany({ where: { batchId: session.batchId, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const marks = new Map(session.attendance.map((a) => [a.studentId, a.status]));
  const isLive = session.hosting === "PLATFORM" && session.mode === "ONLINE";
  const [joined, chatCount, questionCount] = isLive
    ? await Promise.all([
        db.livePresence.count({ where: { sessionId: session.id, isHost: false } }),
        db.liveChatMessage.count({ where: { sessionId: session.id, kind: "CHAT" } }),
        db.liveChatMessage.count({ where: { sessionId: session.id, kind: "QUESTION" } }),
      ])
    : [0, 0, 0];
  const duration = session.liveStartedAt && session.liveEndedAt ? Math.round((session.liveEndedAt.getTime() - session.liveStartedAt.getTime()) / 60000) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/instructor/sessions" className="text-[13px] text-muted-500 hover:text-navy-950">← Sessions</Link>
        <div className="mt-1 text-[13px] text-muted-500">{session.batch.course.title} · {session.batch.name}</div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-navy-950 sm:text-[28px]">{session.title}</h1>
          <StatusBadge status={session.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <InfoTile icon={<Clock />} tone="azure" label="When" value={formatDateTime(session.startsAt)} />
        <InfoTile icon={session.mode === "ONLINE" ? <Video /> : <MapPin />} tone="green" label={humanize(session.mode)} value={session.mode === "ONLINE" ? (session.hosting === "PLATFORM" ? "DoB Live (in-app)" : session.liveUrl ? <a href={session.liveUrl} target="_blank" className="text-azure-500">Open live link</a> : "No link") : session.venue ?? "—"} />
        <InfoTile icon={<BookOpen />} tone="violet" label="Lesson" value={session.lesson?.title ?? "—"} />
        <InfoTile icon={<Users />} tone="orange" label="Marked" value={`${session.attendance.length} / ${roster.length}`} />
      </div>

      {isLive && (
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><Radio className="size-4 text-azure-500" /> DoB Live</span>}
            description="Stream in the platform. Attendance is marked automatically from watch time and the recording is published to the course as a replay."
            action={
              session.status === "LIVE" ? <Badge tone="red">● Live now</Badge> : session.liveEndedAt ? <Badge tone="blue">Ended · {duration} min</Badge> : <Badge>Not started</Badge>
            }
          />
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile icon={<Users />} tone="azure" label="Learners joined" value={`${joined} / ${roster.length}`} />
            <InfoTile icon={<MessageSquare />} tone="violet" label="Chat messages" value={chatCount} />
            <InfoTile icon={<HelpCircle />} tone="orange" label="Questions" value={questionCount} />
            <InfoTile
              icon={session.recordingStatus === "PROCESSING" ? <Loader2 className="animate-spin" /> : <Film />}
              tone={session.recordingStatus === "READY" ? "green" : session.recordingStatus === "FAILED" ? "red" : "slate"}
              label="Recording"
              value={{ NONE: "Not recorded", RECORDING: "Recording…", PROCESSING: "Processing…", READY: "Published", FAILED: "Failed" }[session.recordingStatus]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-[#eef1f6] px-5 py-4">
            {!session.liveEndedAt && session.status !== "CANCELLED" && (
              <LinkButton href={`/live/${session.id}`}><Radio className="size-4" /> {session.status === "LIVE" ? "Rejoin the live class" : "Open live studio"}</LinkButton>
            )}
            {session.status === "LIVE" && (
              <form action={forceEndLive}>
                <input type="hidden" name="sessionId" value={session.id} />
                <SubmitButton variant="danger" confirm="End this live class for everyone? Attendance will be finalised.">End class for everyone</SubmitButton>
              </form>
            )}
            {session.recordingStatus === "READY" && session.lessonId && (
              <Link href={`/instructor/courses/${session.batch.courseId}`} className="text-sm font-medium text-azure-500 hover:underline">Replay published in “{session.lesson?.title}” →</Link>
            )}
            {session.recordingStatus === "FAILED" && (
              <form action={retryRecording}>
                <input type="hidden" name="sessionId" value={session.id} />
                <SubmitButton variant="secondary">Retry publishing the recording</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Attendance" description={isLive ? "Marked automatically when the class ends — you can still adjust any learner." : "Present, late and excused count toward attendance."} />
        {roster.length === 0 ? <EmptyState icon={<Users className="size-5" />} title="No learners in this batch" /> : (
          <ActionForm action={saveAttendance}>
            <input type="hidden" name="sessionId" value={session.id} />
            <AttendanceGrid students={roster.map((e) => ({ id: e.userId, name: e.user.name, email: e.user.email, avatarColor: e.user.avatarColor, status: marks.get(e.userId) ?? null }))} />
            <div className="border-t border-[#eef1f6] px-5 py-4"><SubmitButton>Save attendance</SubmitButton></div>
          </ActionForm>
        )}
      </Card>

      <Card>
        <CardHeader title="Session status" />
        <form action={updateSessionStatus} className="flex flex-wrap items-end gap-3 p-5">
          <input type="hidden" name="sessionId" value={session.id} />
          {session.mode === "ONLINE" && (
            <label className="min-w-64 flex-1">
              <span className="mb-1.5 block text-[13px] text-muted-600">Recording link (optional)</span>
              <Input name="recordingUrl" defaultValue={session.recordingUrl ?? ""} placeholder="https://" />
            </label>
          )}
          <SubmitButton variant="secondary" name="status" value="LIVE">Mark live</SubmitButton>
          <SubmitButton variant="secondary" name="status" value="COMPLETED">Mark completed</SubmitButton>
          <SubmitButton variant="danger" name="status" value="CANCELLED" confirm="Cancel this class? Learners will be notified.">Cancel class</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
