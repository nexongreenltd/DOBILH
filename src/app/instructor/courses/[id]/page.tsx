import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayCircle, FileText, Presentation, Link2, Trash2, Eye, EyeOff, Clock, Video, MapPin, Users, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { assertCanManageCourse, requireStaffOrInstructor } from "@/lib/auth";
import { courseProgress, attendanceSummary } from "@/lib/learning";
import { createLesson, updateLesson, deleteLesson, addMaterial, deleteMaterial } from "@/app/actions/instructor";
import { SessionForm } from "@/components/session-form";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, CardHeader, Checkbox, Disclosure, EmptyState, Field, IconChip, Input, LinkButton, Progress, Select, StatusBadge, Tabs, Textarea } from "@/components/ui";
import { formatDate, formatDateTime, humanize, toLocalInput } from "@/lib/utils";

const MAT_ICON = { VIDEO: PlayCircle, PDF: FileText, SLIDE: Presentation, LINK: Link2, FILE: FileText };
const MAT_TONE = { VIDEO: "red", PDF: "orange", SLIDE: "violet", LINK: "azure", FILE: "slate" } as const;

export default async function CourseWorkspace({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireStaffOrInstructor();
  const { id } = await params;
  const { tab = "content" } = await searchParams;
  const course = await db.course.findUnique({ where: { id }, include: { batches: { orderBy: { startDate: "desc" } } } });
  if (!course) notFound();
  await assertCanManageCourse(user, course.id);
  const base = `/instructor/courses/${id}`;
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/instructor/courses" className="text-[13px] text-muted-500 hover:text-navy-950">← My courses</Link>
          <h1 className="font-display text-2xl font-semibold text-navy-950 sm:text-[28px]">{course.title}</h1>
          <div className="mt-1 flex gap-2"><StatusBadge status={course.status} /><Badge>{humanize(course.mode)}</Badge></div>
        </div>
        <div className="flex gap-2">
          <LinkButton href={`/courses/${course.slug}`} variant="secondary" target="_blank">View public page</LinkButton>
          {isAdmin && <LinkButton href={`/admin/courses/${course.id}`} variant="secondary">Course settings</LinkButton>}
        </div>
      </div>
      <Tabs
        active={tab}
        tabs={[
          { key: "content", label: "Lessons & resources", href: `${base}?tab=content` },
          { key: "sessions", label: "Batches & sessions", href: `${base}?tab=sessions` },
          { key: "students", label: "Students", href: `${base}?tab=students` },
        ]}
      />
      {tab === "content" && <ContentTab courseId={course.id} />}
      {tab === "sessions" && <SessionsTab courseId={course.id} batches={course.batches} />}
      {tab === "students" && <StudentsTab courseId={course.id} />}
    </div>
  );
}

async function ContentTab({ courseId }: { courseId: string }) {
  const lessons = await db.lesson.findMany({ where: { courseId }, orderBy: { orderNo: "asc" }, include: { materials: { orderBy: { orderNo: "asc" }, include: { file: true } } } });
  const now = new Date();
  return (
    <div className="space-y-4">
      <Disclosure summary="Add a lesson">
        <ActionForm action={createLesson} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
          <input type="hidden" name="courseId" value={courseId} />
          <Field label="Title" className="sm:col-span-2"><Input name="title" required placeholder="e.g. Day 8 — Testing and quality" /></Field>
          <Field label="Summary" className="sm:col-span-2"><Textarea name="summary" rows={2} /></Field>
          <Field label="Duration (min)"><Input name="durationMin" type="number" defaultValue={45} min={5} /></Field>
          <Field label="Publishing">
            <Select name="publish" defaultValue="now">
              <option value="now">Publish now</option>
              <option value="schedule">Schedule…</option>
              <option value="draft">Keep as draft</option>
            </Select>
          </Field>
          <Field label="Scheduled release (if scheduling)"><Input name="publishAt" type="datetime-local" /></Field>
          <div className="flex items-end"><Checkbox name="isPreview" label="Free preview lesson" /></div>
          <div className="sm:col-span-2"><SubmitButton>Create lesson</SubmitButton></div>
        </ActionForm>
      </Disclosure>

      {lessons.length === 0 && <Card><EmptyState title="No lessons yet" description="Create your first lesson above." /></Card>}
      {lessons.map((l) => {
        const state = !l.publishAt ? "DRAFT" : l.publishAt > now ? "SCHEDULED" : "PUBLISHED";
        return (
          <Card key={l.id}>
            <div className="flex flex-wrap items-center gap-3 border-b border-[#eef1f6] px-5 py-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-azure-50 text-sm font-semibold text-azure-500">{l.orderNo}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-navy-950">{l.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-500">
                  <Clock className="size-3" /> {l.durationMin} min
                  {state === "SCHEDULED" && <>· opens {formatDateTime(l.publishAt)}</>}
                  {l.isPreview && <Badge tone="green">Preview</Badge>}
                </div>
              </div>
              <StatusBadge status={state} />
              <form action={deleteLesson}>
                <input type="hidden" name="lessonId" value={l.id} />
                <SubmitButton variant="ghost" size="sm" confirm={`Delete “${l.title}” and its resources?`}><Trash2 className="size-4" /></SubmitButton>
              </form>
            </div>
            <div className="space-y-2 p-4">
              {l.materials.map((m) => {
                const I = MAT_ICON[m.type];
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-2.5">
                    <IconChip tone={MAT_TONE[m.type]}><I /></IconChip>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-navy-950">{m.title}</div>
                      <div className="truncate text-[11px] text-muted-500">{m.file ? `${m.file.originalName} · ${(m.file.size / 1024).toFixed(0)} KB` : m.url}</div>
                    </div>
                    {m.visibility === "PUBLIC" ? <Badge tone="green"><Eye className="size-3" /> Public</Badge> : m.visibility === "HIDDEN" ? <Badge><EyeOff className="size-3" /> Hidden</Badge> : null}
                    <a href={m.file ? `/api/files/${m.file.id}` : m.url ?? "#"} target="_blank" className="text-xs font-medium text-azure-500">Open</a>
                    <form action={deleteMaterial}>
                      <input type="hidden" name="materialId" value={m.id} />
                      <SubmitButton variant="ghost" size="sm" confirm="Remove this resource?"><Trash2 className="size-3.5" /></SubmitButton>
                    </form>
                  </div>
                );
              })}
              <div className="grid gap-3 lg:grid-cols-2">
                <Disclosure summary="Add resource (PDF, slides, video, link)">
                  <ActionForm action={addMaterial} className="grid gap-3" resetOnSuccess>
                    <input type="hidden" name="lessonId" value={l.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Type">
                        <Select name="type" defaultValue="PDF">
                          <option value="PDF">PDF notes</option>
                          <option value="SLIDE">Presentation slides</option>
                          <option value="VIDEO">Video (YouTube/Vimeo link)</option>
                          <option value="LINK">Link</option>
                          <option value="FILE">Other file</option>
                        </Select>
                      </Field>
                      <Field label="Visibility">
                        <Select name="visibility" defaultValue="ENROLLED">
                          <option value="ENROLLED">Enrolled learners</option>
                          <option value="PUBLIC">Public preview</option>
                          <option value="HIDDEN">Hidden</option>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Title"><Input name="title" required placeholder="e.g. Daily notes — Day 8" /></Field>
                    <Field label="Upload file" hint="PDF, PPTX, DOCX, ZIP, MP4 — up to 50 MB. Stored privately."><input type="file" name="file" className="block w-full text-sm text-muted-600 file:mr-3 file:rounded-lg file:border-0 file:bg-azure-50 file:px-3 file:py-1.5 file:text-sm file:text-azure-500" /></Field>
                    <Field label="…or link"><Input name="url" placeholder="https://" /></Field>
                    <SubmitButton pendingText="Uploading…">Add resource</SubmitButton>
                  </ActionForm>
                </Disclosure>
                <Disclosure summary="Edit lesson details">
                  <ActionForm action={updateLesson} className="grid gap-3">
                    <input type="hidden" name="lessonId" value={l.id} />
                    <Field label="Title"><Input name="title" defaultValue={l.title} /></Field>
                    <Field label="Summary"><Textarea name="summary" rows={2} defaultValue={l.summary ?? ""} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Order"><Input name="orderNo" type="number" defaultValue={l.orderNo} /></Field>
                      <Field label="Duration (min)"><Input name="durationMin" type="number" defaultValue={l.durationMin} /></Field>
                    </div>
                    <Field label="Publishing">
                      <Select name="publish" defaultValue={state === "PUBLISHED" ? "now" : state === "SCHEDULED" ? "schedule" : "draft"}>
                        <option value="now">Published</option>
                        <option value="schedule">Scheduled</option>
                        <option value="draft">Draft</option>
                      </Select>
                    </Field>
                    <Field label="Release time (if scheduled)"><Input name="publishAt" type="datetime-local" defaultValue={toLocalInput(l.publishAt)} /></Field>
                    <Checkbox name="isPreview" defaultChecked={l.isPreview} label="Free preview lesson" />
                    <SubmitButton variant="secondary">Save lesson</SubmitButton>
                  </ActionForm>
                </Disclosure>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function SessionsTab({ courseId, batches }: { courseId: string; batches: { id: string; name: string; code: string; mode: string; venue: string | null; status: string; startDate: Date; endDate: Date; scheduleText: string | null }[] }) {
  const [sessions, lessons] = await Promise.all([
    db.classSession.findMany({ where: { batch: { courseId } }, include: { batch: true, _count: { select: { attendance: true } } }, orderBy: { startsAt: "desc" }, take: 40 }),
    db.lesson.findMany({ where: { courseId }, orderBy: { orderNo: "asc" }, select: { id: true, orderNo: true, title: true } }),
  ]);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {batches.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-center justify-between"><div className="font-medium text-navy-950">{b.name}</div><StatusBadge status={b.status} /></div>
            <div className="mt-1 text-xs text-muted-500">{b.code} · {humanize(b.mode)} · {formatDate(b.startDate)} – {formatDate(b.endDate)}</div>
            <div className="mt-1 text-xs text-muted-500">{b.scheduleText}{b.venue ? ` · ${b.venue}` : ""}</div>
          </Card>
        ))}
      </div>
      {batches.length > 0 && (
        <Disclosure summary="Schedule a class session">
          <SessionForm batches={batches} lessons={lessons} />
        </Disclosure>
      )}
      <Card>
        <CardHeader title="Sessions" />
        {sessions.length === 0 ? <EmptyState icon={<CalendarClock className="size-5" />} title="No sessions yet" /> : (
          <ul className="divide-y divide-[#eef1f6]">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/instructor/sessions/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-azure-50/40">
                  <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy-950">{s.title}</div>
                    <div className="text-xs text-muted-500">{formatDateTime(s.startsAt)} · {s.batch.code}</div>
                  </div>
                  <span className="text-xs text-muted-500">{s._count.attendance} marked</span>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function StudentsTab({ courseId }: { courseId: string }) {
  const enrollments = await db.enrollment.findMany({ where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { user: true, batch: true }, orderBy: { user: { name: "asc" } } });
  const rows = await Promise.all(enrollments.map(async (e) => ({ e, p: await courseProgress(e.userId, courseId), a: await attendanceSummary(e.userId, e.batchId) })));
  return (
    <Card>
      <CardHeader title={`${rows.length} learners`} />
      {rows.length === 0 ? <EmptyState icon={<Users className="size-5" />} title="No learners yet" /> : (
        <ul className="divide-y divide-[#eef1f6]">
          {rows.map(({ e, p, a }) => (
            <li key={e.id} className="flex flex-wrap items-center gap-4 px-5 py-3">
              <Avatar name={e.user.name} color={e.user.avatarColor} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-navy-950">{e.user.name}</div>
                <div className="text-xs text-muted-500">{e.user.email} · {e.batch?.code}</div>
              </div>
              <div className="w-40">
                <div className="mb-1 flex justify-between text-[11px] text-muted-500"><span>Progress</span><span>{p.pct}%</span></div>
                <Progress value={p.pct} className="h-1.5" />
              </div>
              <Badge tone={a.pct >= 75 ? "green" : a.pct >= 50 ? "amber" : "red"}>{a.pct}% attendance</Badge>
              {e.status === "COMPLETED" && <StatusBadge status="COMPLETED" />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
