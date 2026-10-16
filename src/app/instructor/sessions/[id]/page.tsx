import Link from "next/link";
import { notFound } from "next/navigation";
import { Video, MapPin, Clock, BookOpen, Users } from "lucide-react";
import { db } from "@/lib/db";
import { assertCanManageCourse, requireStaffOrInstructor } from "@/lib/auth";
import { saveAttendance, updateSessionStatus } from "@/app/actions/instructor";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AttendanceGrid } from "@/components/attendance-grid";
import { Card, CardHeader, EmptyState, InfoTile, Input, StatusBadge } from "@/components/ui";
import { formatDateTime, humanize } from "@/lib/utils";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffOrInstructor();
  const { id } = await params;
  const session = await db.classSession.findUnique({ where: { id }, include: { batch: { include: { course: true } }, lesson: true, attendance: true } });
  if (!session) notFound();
  await assertCanManageCourse(user, session.batch.courseId);
  const roster = await db.enrollment.findMany({ where: { batchId: session.batchId, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  const marks = new Map(session.attendance.map((a) => [a.studentId, a.status]));

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
        <InfoTile icon={session.mode === "ONLINE" ? <Video /> : <MapPin />} tone="green" label={humanize(session.mode)} value={session.mode === "ONLINE" ? (session.liveUrl ? <a href={session.liveUrl} target="_blank" className="text-azure-500">Open live link</a> : "No link") : session.venue ?? "—"} />
        <InfoTile icon={<BookOpen />} tone="violet" label="Lesson" value={session.lesson?.title ?? "—"} />
        <InfoTile icon={<Users />} tone="orange" label="Marked" value={`${session.attendance.length} / ${roster.length}`} />
      </div>

      <Card>
        <CardHeader title="Attendance" description="Present, late and excused count toward attendance." />
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
