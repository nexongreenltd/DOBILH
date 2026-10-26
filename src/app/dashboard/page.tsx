import Link from "next/link";
import { ArrowRight, BookOpen, CalendarClock, ClipboardCheck, Award, Video, MapPin, Clock, Sparkles, Bell, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { courseProgress, attendanceSummary } from "@/lib/learning";
import { Card, CardHeader, CourseCover, EmptyState, IconChip, LinkButton, Progress, StatCard, StatusBadge } from "@/components/ui";
import { WelcomeTour } from "@/components/welcome-tour";
import { SessionJoin } from "@/components/session-join";
import { formatDateTime, formatTime, timeAgo, humanize } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function StudentHome() {
  const user = await requireUser();
  const now = new Date();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { course: true, batch: true },
    orderBy: { enrolledAt: "desc" },
  });
  const courseIds = enrollments.map((e) => e.courseId);
  const batchIds = enrollments.map((e) => e.batchId).filter(Boolean) as string[];

  const [progress, sessions, deadlines, notifications, certs, graded] = await Promise.all([
    Promise.all(enrollments.map(async (e) => ({ e, p: await courseProgress(user.id, e.courseId), a: await attendanceSummary(user.id, e.batchId) }))),
    db.classSession.findMany({
      where: { batchId: { in: batchIds }, endsAt: { gte: now }, status: { not: "CANCELLED" } },
      include: { batch: { include: { course: true } } },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    db.assessment.findMany({
      where: {
        courseId: { in: courseIds },
        status: "PUBLISHED",
        dueAt: { gte: now },
        OR: [{ batchId: null }, { batchId: { in: batchIds } }],
        submissions: { none: { studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } } },
      },
      include: { course: true },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.certificate.count({ where: { userId: user.id, status: "VALID" } }),
    db.submission.findMany({ where: { studentId: user.id, status: "GRADED", assessment: { resultsPublished: true } }, include: { assessment: true } }),
  ]);

  const avgProgress = progress.length ? Math.round(progress.reduce((s, x) => s + x.p.pct, 0) / progress.length) : 0;
  const avgAttendance = progress.filter((x) => x.a.held > 0);
  const attendancePct = avgAttendance.length ? Math.round(avgAttendance.reduce((s, x) => s + x.a.pct, 0) / avgAttendance.length) : null;
  const avgScore = graded.length ? Math.round(graded.reduce((s, g) => s + ((g.obtained ?? 0) / g.assessment.totalMarks) * 100, 0) / graded.length) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted-500">{greeting()}</div>
          <h1 className="font-display text-[28px] font-semibold text-navy-950">Hey {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-600">
            {sessions[0] ? <>Your next class is <span className="font-medium text-navy-950">{sessions[0].title}</span> at {formatTime(sessions[0].startsAt)}.</> : "Here’s what’s happening with your learning."}
          </p>
        </div>
        <form action="/dashboard/assistant" className="relative w-full max-w-sm md:hidden">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-azure-500" />
          <input name="q" placeholder="Ask DoB AI…" className="h-11 w-full rounded-xl border border-[#e8ebf1] bg-white pl-9 pr-3 text-sm" />
        </form>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active courses" value={enrollments.filter((e) => e.status === "ACTIVE").length} icon={<BookOpen />} accent="sky" />
        <StatCard label="Average progress" value={`${avgProgress}%`} icon={<TrendingUp />} accent="brand" hint="Across enrolled courses" />
        <StatCard label="Attendance" value={attendancePct == null ? "—" : `${attendancePct}%`} icon={<CalendarClock />} accent="violet" />
        <StatCard label="Avg. score" value={avgScore == null ? "—" : `${avgScore}%`} icon={<Award />} accent="gold" hint={`${certs} certificate${certs === 1 ? "" : "s"} earned`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Continue learning" action={<Link href="/dashboard/courses" className="text-sm font-medium text-azure-500 hover:underline">All courses</Link>} />
          {progress.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="No courses yet"
              description="Courses help you organise your learning. Browse the catalogue to enroll in your first one."
              action={<LinkButton href="/courses">Browse courses</LinkButton>}
            />
          ) : (
            <ul className="divide-y divide-[#eef1f6]">
              {progress.map(({ e, p, a }) => (
                <li key={e.id}>
                  <Link href={`/dashboard/courses/${e.courseId}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-azure-50/40">
                    <CourseCover hue={e.course.coverHue} title="" small className="size-14 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-navy-950">{e.course.title}</span>
                        {e.status === "COMPLETED" && <StatusBadge status="COMPLETED" />}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-500">{e.batch?.name} · {p.completed}/{p.total} lessons · {a.pct}% attendance</div>
                      <Progress value={p.pct} className="mt-2.5 h-1.5" />
                    </div>
                    <div className="hidden text-right sm:block">
                      <div className="font-display text-lg font-semibold text-navy-950">{p.pct}%</div>
                      <ArrowRight className="ml-auto size-4 text-muted-500 transition group-hover:translate-x-0.5 group-hover:text-azure-500" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming classes" action={<Link href="/dashboard/schedule" className="text-sm font-medium text-azure-500 hover:underline">Schedule</Link>} />
          <div className="space-y-2 p-3">
            {sessions.length === 0 && <EmptyState icon={<CalendarClock className="size-5" />} title="No upcoming classes" />}
            {sessions.map((s) => {
              return (
                <div key={s.id} className="rounded-xl border border-[#e8ebf1] bg-white p-3">
                  <div className="flex items-start gap-3">
                    <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-muted-500">{s.batch.course.title}</div>
                      <div className="truncate text-sm font-medium text-navy-950">{s.title}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-600">
                        <Clock className="size-3" /> {formatDateTime(s.startsAt)}
                        {s.mode === "OFFLINE" && s.venue && <span className="truncate">· {s.venue}</span>}
                      </div>
                    </div>
                    <SessionJoin s={s} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Due soon" action={<Link href="/dashboard/assessments" className="text-sm font-medium text-azure-500 hover:underline">All assessments</Link>} />
          <div className="space-y-2 p-3">
            {deadlines.length === 0 && <EmptyState icon={<ClipboardCheck className="size-5" />} title="You’re all caught up" description="No pending assessments right now." />}
            {deadlines.map((a) => (
              <Link key={a.id} href={`/dashboard/assessments/${a.id}`} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-3 transition hover:border-azure-200 hover:bg-azure-50/40">
                <IconChip tone="orange"><ClipboardCheck /></IconChip>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-500">{humanize(a.type)} · {a.course.title}</div>
                  <div className="truncate text-sm font-medium text-navy-950">{a.title}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-muted-500">Due</div>
                  <div className="font-medium text-tangerine-500">{formatDateTime(a.dueAt)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent updates" action={<Link href="/dashboard/notifications" className="text-sm font-medium text-azure-500 hover:underline">View all</Link>} />
          <div className="space-y-2 p-3">
            {notifications.length === 0 && <EmptyState icon={<Bell className="size-5" />} title="No notifications" />}
            {notifications.map((n) => (
              <div key={n.id} className="flex gap-3 rounded-xl p-3 hover:bg-azure-50/40">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-slate-200" : "bg-azure-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-navy-950">{n.title}</div>
                  <div className="line-clamp-1 text-sm text-muted-600">{n.body}</div>
                </div>
                <div className="shrink-0 text-xs text-muted-500">{timeAgo(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <WelcomeTour
        storageKey={`dob-tour-student-${user.id}`}
        name={user.name}
        steps={[
          { title: "Welcome! Let me show you around", body: "This is your learning home — progress, upcoming classes and deadlines all in one place." },
          { title: "Open a course to learn", body: "Each lesson has recorded video, daily PDF notes and slides. Mark lessons complete to track progress." },
          { title: "Ask DoB AI anytime", body: "Use the Ask DoB AI bar at the top for questions about schedules, deadlines and certificates." },
        ]}
      />
    </div>
  );
}
