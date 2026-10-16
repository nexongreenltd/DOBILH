import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle, Lock, PlayCircle, FileText, Presentation, Link2, Download, ExternalLink, CalendarDays, MapPin, Video, Megaphone, ClipboardCheck, Award, PartyPopper } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActiveEnrollment, courseProgress, attendanceSummary, assessmentSummary, touchLesson } from "@/lib/learning";
import { setLessonComplete } from "@/app/actions/student";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, IconChip, InfoTile, Panel, Progress, StatusBadge, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { cn, formatDate, formatDateTime, humanize, timeAgo } from "@/lib/utils";

const MAT_ICON = { VIDEO: PlayCircle, PDF: FileText, SLIDE: Presentation, LINK: Link2, FILE: FileText };

type SP = { lesson?: string; tab?: string; welcome?: string; completed?: string };

export default async function LearnCourse({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { courseId } = await params;
  const sp = await searchParams;
  const enrollment = await getActiveEnrollment(user.id, courseId);
  if (!enrollment) {
    const exists = await db.course.findUnique({ where: { id: courseId }, select: { slug: true } });
    if (!exists) notFound();
    redirect(`/courses/${exists.slug}`);
  }
  const now = new Date();
  const lessons = await db.lesson.findMany({
    where: { courseId },
    orderBy: { orderNo: "asc" },
    include: { materials: { where: { visibility: { not: "HIDDEN" } }, orderBy: { orderNo: "asc" }, include: { file: true } }, progress: { where: { studentId: user.id } } },
  });
  const released = lessons.filter((l) => l.publishAt && l.publishAt <= now);
  const firstIncomplete = released.find((l) => !l.progress[0]?.completedAt);
  const current = released.find((l) => l.id === sp.lesson) ?? firstIncomplete ?? released[0];
  if (current) await touchLesson(user.id, current.id);

  const tab = sp.tab ?? "lessons";
  const [progress, attendance, assess] = await Promise.all([
    courseProgress(user.id, courseId),
    attendanceSummary(user.id, enrollment.batchId),
    assessmentSummary(user.id, courseId, enrollment.batchId),
  ]);
  const base = `/dashboard/courses/${courseId}`;

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <Alert tone="green"><span className="flex items-center gap-2"><PartyPopper className="size-4" /> You’re enrolled in <b>{enrollment.course.title}</b>. Welcome aboard!</span></Alert>
      )}
      {sp.completed && (() => {
        const done = lessons.find((l) => l.id === sp.completed);
        return done ? <Alert tone="green"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Lesson {done.orderNo} marked complete{current && current.id !== done.id ? ` — up next: ${current.title}` : ""}.</span></Alert> : null;
      })()}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-muted-500">{enrollment.batch?.name}</div>
          <h1 className="font-display text-2xl font-semibold text-navy-950 sm:text-[28px]">{enrollment.course.title}</h1>
        </div>
        <div className="flex w-full max-w-xs items-center gap-3">
          <Progress value={progress.pct} />
          <span className="font-display text-lg font-semibold text-navy-950">{progress.pct}%</span>
        </div>
      </div>

      <Tabs
        active={tab}
        tabs={[
          { key: "lessons", label: "Lessons", href: `${base}?tab=lessons` },
          { key: "schedule", label: "Schedule & attendance", href: `${base}?tab=schedule` },
          { key: "assessments", label: "Assessments", href: `${base}?tab=assessments` },
          { key: "progress", label: "Progress", href: `${base}?tab=progress` },
          { key: "announcements", label: "Announcements", href: `${base}?tab=announcements` },
        ]}
      />

      {tab === "lessons" && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit lg:sticky lg:top-20">
            <CardHeader title="Course content" description={`${progress.completed} of ${progress.total} completed`} />
            <ol className="max-h-[65vh] space-y-1 overflow-y-auto p-2">
              {lessons.map((l) => {
                const open = l.publishAt && l.publishAt <= now;
                const done = !!l.progress[0]?.completedAt;
                const active = current?.id === l.id;
                return (
                  <li key={l.id}>
                    {open ? (
                      <Link href={`${base}?lesson=${l.id}`} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-azure-50 text-navy-950" : "hover:bg-slate-50")}>
                        {done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" /> : <Circle className={cn("mt-0.5 size-4 shrink-0", active ? "text-azure-500" : "text-slate-300")} />}
                        <span className="flex-1"><span className="text-muted-500">{l.orderNo}.</span> {l.title}</span>
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-500">
                        <Lock className="mt-0.5 size-4 shrink-0" />
                        <span className="flex-1">{l.orderNo}. {l.title}<span className="block text-[11px]">{l.publishAt ? `Opens ${formatDate(l.publishAt)}` : "Coming soon"}</span></span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          {current ? (
            <div className="space-y-5">
              {(() => {
                const video = current.materials.find((m) => m.type === "VIDEO" && m.url);
                return video ? (
                  <div className="aspect-video overflow-hidden rounded-2xl border border-[#e8ebf1] bg-navy-950 shadow-lg">
                    <iframe src={video.url!} title={video.title} className="size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
                  </div>
                ) : null;
              })()}
              <Card className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] text-muted-500">Lesson {current.orderNo} · {current.durationMin} min</div>
                    <h2 className="mt-1 font-display text-xl font-semibold text-navy-950">{current.title}</h2>
                    {current.summary && <p className="mt-2 max-w-2xl text-sm text-muted-600">{current.summary}</p>}
                  </div>
                  <form action={setLessonComplete}>
                    <input type="hidden" name="lessonId" value={current.id} />
                    <input type="hidden" name="done" value={current.progress[0]?.completedAt ? "0" : "1"} />
                    {current.progress[0]?.completedAt ? (
                      <SubmitButton variant="soft"><CheckCircle2 className="size-4" /> Completed</SubmitButton>
                    ) : (
                      <SubmitButton>Mark as complete</SubmitButton>
                    )}
                  </form>
                </div>
              </Card>
              <Panel title={`Resources · ${current.materials.length}`}>
                {current.materials.length === 0 && <div className="px-2 py-4 text-sm text-muted-500">No resources yet for this lesson.</div>}
                {current.materials.map((m) => {
                  const I = MAT_ICON[m.type];
                  const href = m.file ? `/api/files/${m.file.id}` : m.url ?? "#";
                  const tone = m.type === "VIDEO" ? "red" : m.type === "PDF" ? "orange" : m.type === "SLIDE" ? "violet" : "azure";
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] bg-white p-3">
                      <IconChip tone={tone}><I /></IconChip>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted-500">{humanize(m.type)}{m.file ? ` · ${(m.file.size / 1024).toFixed(0)} KB` : ""}</div>
                        <div className="truncate text-sm font-medium text-navy-950">{m.title}</div>
                      </div>
                      <a href={href} target="_blank" className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-azure-500 hover:bg-azure-50">
                        <ExternalLink className="size-4" /> Open
                      </a>
                      {m.file && (
                        <a href={`${href}?download=1`} className="rounded-lg p-1.5 text-muted-500 hover:bg-azure-50 hover:text-navy-950" aria-label="Download"><Download className="size-4" /></a>
                      )}
                    </div>
                  );
                })}
              </Panel>
              {current.materials.filter((m) => m.type === "PDF" && m.file).slice(0, 1).map((m) => (
                <div key={m.id} className="h-[70vh] overflow-hidden rounded-2xl border border-[#e8ebf1] bg-white">
                  <iframe src={`/api/files/${m.file!.id}`} title={m.title} className="size-full" />
                </div>
              ))}
              {current.materials.filter((m) => m.type === "SLIDE" && m.url).slice(0, 1).map((m) => (
                <div key={m.id} className="aspect-video overflow-hidden rounded-2xl border border-[#e8ebf1] bg-white">
                  <iframe src={m.url!} title={m.title} className="size-full" allowFullScreen />
                </div>
              ))}
            </div>
          ) : (
            <Card><EmptyState icon={<Lock className="size-5" />} title="Lessons open soon" description="Your first lesson will be published when the batch starts." /></Card>
          )}
        </div>
      )}

      {tab === "schedule" && <ScheduleTab userId={user.id} batchId={enrollment.batchId} attendance={attendance} />}
      {tab === "assessments" && (
        <Card>
          <CardHeader title="Assessments" description={`${assess.passed} of ${assess.total} passed`} />
          <div className="space-y-2 p-3">
            {assess.rows.length === 0 && <EmptyState icon={<ClipboardCheck className="size-5" />} title="No assessments yet" />}
            {assess.rows.map((a) => (
              <Link key={a.id} href={`/dashboard/assessments/${a.id}`} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-3 hover:border-azure-200 hover:bg-azure-50/40">
                <IconChip tone="orange"><ClipboardCheck /></IconChip>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-500">{humanize(a.type)} · {a.totalMarks} marks · pass {a.passMarks}</div>
                  <div className="text-sm font-medium text-navy-950">{a.title}</div>
                </div>
                {a.best != null && a.resultsPublished ? <Badge tone={a.passed ? "green" : "red"}>{a.best}/{a.totalMarks}</Badge> : <Badge tone="slate">Open</Badge>}
              </Link>
            ))}
          </div>
        </Card>
      )}
      {tab === "progress" && (
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Lessons completed", value: `${progress.completed}/${progress.total}`, pct: progress.pct, need: enrollment.course.certMinProgress, icon: <FileText /> },
            { label: "Attendance", value: `${attendance.attended}/${attendance.held} classes`, pct: attendance.pct, need: enrollment.course.certMinAttendance, icon: <CalendarDays /> },
            { label: "Assessments passed", value: `${assess.passed}/${assess.total}`, pct: assess.total ? Math.round((assess.passed / assess.total) * 100) : 100, need: enrollment.course.certRequirePass ? 100 : 0, icon: <Award /> },
          ].map((m) => (
            <Card key={m.label} className="p-5">
              <div className="flex items-center gap-3"><IconChip tone={m.pct >= m.need ? "green" : "orange"}>{m.icon}</IconChip><span className="text-[13px] text-muted-500">{m.label}</span></div>
              <div className="mt-3 font-display text-2xl font-semibold text-navy-950">{m.pct}%</div>
              <div className="text-xs text-muted-500">{m.value}</div>
              <Progress value={m.pct} className="mt-3" tone={m.pct >= m.need ? "brand" : "gold"} />
              <div className="mt-2 text-xs text-muted-500">Certificate needs {m.need}%</div>
            </Card>
          ))}
          <div className="md:col-span-3">
            <Link href="/dashboard/certificates" className="text-sm font-medium text-azure-500 hover:underline">Check certificate eligibility →</Link>
          </div>
        </div>
      )}
      {tab === "announcements" && <AnnouncementsTab courseId={courseId} batchId={enrollment.batchId} />}
    </div>
  );
}

async function ScheduleTab({ userId, batchId, attendance }: { userId: string; batchId: string | null; attendance: { held: number; attended: number; pct: number } }) {
  if (!batchId) return <Card><EmptyState title="No batch assigned" /></Card>;
  const sessions = await db.classSession.findMany({ where: { batchId }, orderBy: { startsAt: "asc" }, include: { attendance: { where: { studentId: userId } } } });
  const now = new Date();
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile icon={<CalendarDays />} tone="azure" label="Classes held" value={attendance.held} />
        <InfoTile icon={<CheckCircle2 />} tone="green" label="Attended" value={attendance.attended} />
        <InfoTile icon={<Award />} tone="violet" label="Attendance rate" value={`${attendance.pct}%`} />
      </div>
      <Card>
        <ul className="divide-y divide-[#eef1f6]">
          {sessions.map((s) => {
            const past = s.endsAt < now;
            const mark = s.attendance[0]?.status;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-navy-950">{s.title}</div>
                  <div className="text-xs text-muted-500">{formatDateTime(s.startsAt)} · {s.mode === "ONLINE" ? "Online" : s.venue}</div>
                </div>
                {s.status === "CANCELLED" ? <StatusBadge status="CANCELLED" /> : past ? (mark ? <StatusBadge status={mark} /> : <Badge>Not marked</Badge>) : <StatusBadge status="SCHEDULED" />}
                {past && s.recordingUrl && <a href={s.recordingUrl} target="_blank" className="text-sm font-medium text-azure-500">Recording</a>}
                {!past && s.mode === "ONLINE" && s.liveUrl && <a href={s.liveUrl} target="_blank" className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-semibold text-white">Join link</a>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

async function AnnouncementsTab({ courseId, batchId }: { courseId: string; batchId: string | null }) {
  const items = await db.announcement.findMany({
    where: { OR: [{ courseId, batchId: null }, ...(batchId ? [{ batchId }] : [])] },
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-3">
      {items.length === 0 && <Card><EmptyState icon={<Megaphone className="size-5" />} title="No announcements yet" /></Card>}
      {items.map((a) => (
        <Card key={a.id} className="p-5">
          <div className="flex items-center gap-3">
            {a.author && <Avatar name={a.author.name} color={a.author.avatarColor} size={32} />}
            <div>
              <div className="text-sm font-medium text-navy-950">{a.author?.name ?? "DoB Team"}</div>
              <div className="text-xs text-muted-500">{timeAgo(a.createdAt)}</div>
            </div>
          </div>
          <h3 className="mt-3 font-semibold text-navy-950">{a.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-600">{a.body}</p>
        </Card>
      ))}
    </div>
  );
}
