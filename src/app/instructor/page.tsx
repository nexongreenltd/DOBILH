import Link from "next/link";
import { BookOpen, Users, CalendarClock, FileCheck2, Video, MapPin, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { Card, CardHeader, EmptyState, IconChip, LinkButton, StatCard, Badge } from "@/components/ui";
import { formatDateTime, formatTime, humanize, timeAgo } from "@/lib/utils";

export const metadata = { title: "Instructor workspace" };

export default async function InstructorHome() {
  const user = await requireStaffOrInstructor();
  const courseIds = await manageableCourseIds(user);
  const now = new Date();
  const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(startDay.getTime() + 86400000);

  const [students, today, upcoming, pending, recentSubs] = await Promise.all([
    db.enrollment.count({ where: { courseId: { in: courseIds }, status: { in: ["ACTIVE", "COMPLETED"] } } }),
    db.classSession.findMany({ where: { batch: { courseId: { in: courseIds } }, startsAt: { gte: startDay, lt: endDay } }, include: { batch: { include: { course: true } }, _count: { select: { attendance: true } } }, orderBy: { startsAt: "asc" } }),
    db.classSession.findMany({ where: { batch: { courseId: { in: courseIds } }, startsAt: { gte: endDay }, status: "SCHEDULED" }, include: { batch: { include: { course: true } } }, orderBy: { startsAt: "asc" }, take: 5 }),
    db.submission.count({ where: { status: "SUBMITTED", assessment: { courseId: { in: courseIds } } } }),
    db.submission.findMany({ where: { status: "SUBMITTED", assessment: { courseId: { in: courseIds } } }, include: { student: true, assessment: true }, orderBy: { submittedAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-muted-500">Instructor workspace</div>
        <h1 className="font-display text-[28px] font-semibold text-navy-950">Hey {user.name.split(" ").slice(-1)[0]} 👋</h1>
        <p className="mt-1 text-sm text-muted-600">{today.length ? `You have ${today.length} class${today.length > 1 ? "es" : ""} today.` : "No classes today."} {pending ? `${pending} submission${pending > 1 ? "s" : ""} waiting for grades.` : ""}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="My courses" value={courseIds.length} icon={<BookOpen />} accent="sky" />
        <StatCard label="Active learners" value={students} icon={<Users />} accent="brand" />
        <StatCard label="Classes today" value={today.length} icon={<CalendarClock />} accent="violet" />
        <StatCard label="To grade" value={pending} icon={<FileCheck2 />} accent="gold" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Today’s classes" action={<Link href="/instructor/sessions" className="text-sm font-medium text-azure-500 hover:underline">All sessions</Link>} />
          <div className="space-y-2 p-3">
            {today.length === 0 && <EmptyState icon={<CalendarClock className="size-5" />} title="Nothing scheduled today" action={<LinkButton href="/instructor/sessions" variant="secondary" size="sm">Schedule a class</LinkButton>} />}
            {today.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-3">
                <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-500">{formatTime(s.startsAt)} · {s.batch.course.title}</div>
                  <div className="truncate text-sm font-medium text-navy-950">{s.title}</div>
                </div>
                <Link href={`/instructor/sessions/${s.id}`} className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-semibold text-white">{s._count.attendance ? "Edit attendance" : "Take attendance"}</Link>
              </div>
            ))}
            {upcoming.length > 0 && <div className="px-2 pt-3 text-[11px] text-muted-500">Coming up</div>}
            {upcoming.map((s) => (
              <Link key={s.id} href={`/instructor/sessions/${s.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-azure-50/40">
                <IconChip tone="slate">{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-navy-950">{s.title}</div>
                  <div className="text-xs text-muted-500">{formatDateTime(s.startsAt)} · {s.batch.code}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Grading queue" action={<Link href="/instructor/grading" className="text-sm font-medium text-azure-500 hover:underline">Open queue</Link>} />
          <div className="space-y-2 p-3">
            {recentSubs.length === 0 && <EmptyState icon={<FileCheck2 className="size-5" />} title="All caught up" description="New submissions will appear here." />}
            {recentSubs.map((s) => (
              <Link key={s.id} href={`/instructor/assessments/${s.assessmentId}?sub=${s.id}`} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-3 hover:border-azure-200">
                <IconChip tone="orange"><ClipboardCheck /></IconChip>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-500">{humanize(s.assessment.type)} · {s.assessment.title}</div>
                  <div className="truncate text-sm font-medium text-navy-950">{s.student.name}</div>
                </div>
                <Badge tone="amber">{timeAgo(s.submittedAt ?? s.startedAt)}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
