import Link from "next/link";
import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { updateCourse, setCourseStatus, addInstructor, removeInstructor } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { BatchForm } from "@/components/batch-form";
import { Avatar, Badge, Card, CardHeader, Checkbox, CourseCover, Disclosure, Field, Input, LinkButton, Select, StatusBadge, Textarea } from "@/components/ui";
import { formatDate, humanize } from "@/lib/utils";

export default async function AdminCourse({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [course, categories, instructors] = await Promise.all([
    db.course.findUnique({
      where: { id },
      include: {
        instructors: { include: { user: true }, orderBy: { isLead: "desc" } },
        batches: { orderBy: { startDate: "desc" }, include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED", "PENDING"] } } }, sessions: true } } } },
        _count: { select: { lessons: true, assessments: true, enrollments: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ where: { role: { in: ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  if (!course) notFound();
  const assigned = new Set(course.instructors.map((i) => i.userId));

  return (
    <div className="space-y-6">
      <Link href="/admin/courses" className="text-[13px] text-muted-500 hover:text-navy-950">← Courses</Link>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5">
          <CourseCover hue={course.coverHue} title="" small className="size-16 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold text-navy-950">{course.title}</h1>
            <div className="mt-1 flex flex-wrap gap-2"><StatusBadge status={course.status} /><Badge>{course._count.lessons} lessons</Badge><Badge>{course._count.assessments} assessments</Badge><Badge>{course._count.enrollments} enrollments</Badge></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/instructor/courses/${course.id}`} variant="secondary">Open content builder</LinkButton>
            <LinkButton href={`/courses/${course.slug}`} variant="ghost" target="_blank">Preview</LinkButton>
            <form action={setCourseStatus} className="flex gap-2">
              <input type="hidden" name="courseId" value={course.id} />
              {course.status !== "PUBLISHED" && <SubmitButton name="status" value="PUBLISHED">Publish</SubmitButton>}
              {course.status === "PUBLISHED" && <SubmitButton name="status" value="DRAFT" variant="secondary">Unpublish</SubmitButton>}
              {course.status !== "ARCHIVED" && <SubmitButton name="status" value="ARCHIVED" variant="ghost" confirm="Archive this course? It will be hidden from the catalogue.">Archive</SubmitButton>}
            </form>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Details, pricing & certificate rules" />
          <ActionForm action={updateCourse} className="grid gap-4 p-5 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Title" className="sm:col-span-2"><Input name="title" defaultValue={course.title} required /></Field>
            <Field label="Subtitle" className="sm:col-span-2"><Input name="subtitle" defaultValue={course.subtitle ?? ""} /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea name="description" rows={5} defaultValue={course.description} /></Field>
            <Field label="Category"><Select name="categoryId" defaultValue={course.categoryId ?? ""}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Language"><Input name="language" defaultValue={course.language} /></Field>
            <Field label="Mode"><Select name="mode" defaultValue={course.mode}><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="HYBRID">Hybrid</option></Select></Field>
            <Field label="Level"><Select name="level" defaultValue={course.level}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></Select></Field>
            <Field label="Price (BDT)"><Input name="price" type="number" min={0} defaultValue={course.price} /></Field>
            <Field label="Sale price (optional)"><Input name="salePrice" type="number" min={0} defaultValue={course.salePrice ?? ""} /></Field>
            <Field label="Duration (weeks)"><Input name="durationWeeks" type="number" defaultValue={course.durationWeeks} /></Field>
            <Field label="Cover hue (0–359)"><Input name="coverHue" type="number" min={0} max={359} defaultValue={course.coverHue} /></Field>
            <Field label="Outcomes (one per line)"><Textarea name="outcomes" rows={4} defaultValue={course.outcomes.join("\n")} /></Field>
            <Field label="Requirements (one per line)"><Textarea name="requirements" rows={4} defaultValue={course.requirements.join("\n")} /></Field>
            <div className="rounded-2xl bg-azure-50/60 p-4 sm:col-span-2">
              <div className="mb-3 text-[13px] font-medium text-navy-950">Certificate eligibility</div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Min. lesson completion %"><Input name="certMinProgress" type="number" min={0} max={100} defaultValue={course.certMinProgress} /></Field>
                <Field label="Min. attendance %"><Input name="certMinAttendance" type="number" min={0} max={100} defaultValue={course.certMinAttendance} /></Field>
                <div className="flex items-end pb-2"><Checkbox name="certRequirePass" defaultChecked={course.certRequirePass} label="Must pass all assessments" /></div>
              </div>
            </div>
            <Checkbox name="featured" defaultChecked={course.featured} label="Feature on the home page" />
            <div className="sm:col-span-2"><SubmitButton>Save course</SubmitButton></div>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Instructors" />
            <ul className="space-y-2 p-4">
              {course.instructors.map((i) => (
                <li key={i.userId} className="flex items-center gap-3 rounded-xl border border-[#e8ebf1] p-2.5">
                  <Avatar name={i.user.name} color={i.user.avatarColor} size={30} />
                  <div className="flex-1 text-sm text-navy-950">{i.user.name}{i.isLead && <Badge tone="blue" className="ml-2">Lead</Badge>}</div>
                  <form action={removeInstructor}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="userId" value={i.userId} />
                    <SubmitButton variant="ghost" size="sm"><X className="size-4" /></SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            <form action={addInstructor} className="flex flex-wrap items-center gap-2 border-t border-[#eef1f6] p-4">
              <input type="hidden" name="courseId" value={course.id} />
              <Select name="userId" className="flex-1">{instructors.filter((i) => !assigned.has(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
              <Checkbox name="isLead" label="Lead" />
              <SubmitButton variant="secondary">Assign</SubmitButton>
            </form>
          </Card>
          <Card>
            <CardHeader title="Batches" />
            <ul className="space-y-2 p-4">
              {course.batches.map((b) => (
                <li key={b.id}>
                  <details className="group rounded-xl border border-[#e8ebf1]">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy-950">{b.name}</div>
                        <div className="text-xs text-muted-500">{b.code} · {humanize(b.mode)} · {formatDate(b.startDate)} · {b._count.enrollments}/{b.capacity} seats · {b._count.sessions} sessions</div>
                      </div>
                      <StatusBadge status={b.status} />
                    </summary>
                    <div className="border-t border-[#eef1f6] p-4"><BatchForm courses={[{ id: course.id, title: course.title }]} batch={b} /></div>
                  </details>
                </li>
              ))}
            </ul>
            <div className="p-4 pt-0"><Disclosure summary="New batch"><BatchForm courses={[{ id: course.id, title: course.title }]} /></Disclosure></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
