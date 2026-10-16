import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { createCourse, createCategory } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, CourseCover, Disclosure, Field, Input, PageHeader, Select, StatusBadge, Table, TD, TH, THead, TR, Textarea } from "@/components/ui";
import { effectivePrice, formatBDT, humanize } from "@/lib/utils";

export const metadata = { title: "Courses" };

export default async function AdminCourses() {
  await requireAdmin();
  const [courses, categories, instructors] = await Promise.all([
    db.course.findMany({
      include: { category: true, instructors: { include: { user: true } }, _count: { select: { lessons: true, batches: true, enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } } } } },
      orderBy: [{ status: "asc" }, { title: "asc" }],
    }),
    db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { courses: true } } } }),
    db.user.findMany({ where: { role: "INSTRUCTOR", status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Courses" description="Course builder, pricing, curriculum, instructor mapping and publishing." />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Disclosure summary="Create a course">
          <ActionForm action={createCourse} className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2"><Input name="title" required /></Field>
            <Field label="Subtitle" className="sm:col-span-2"><Input name="subtitle" /></Field>
            <Field label="Description" className="sm:col-span-2"><Textarea name="description" required /></Field>
            <Field label="Category"><Select name="categoryId" defaultValue=""><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Lead instructor"><Select name="instructorId" defaultValue=""><option value="">— assign later —</option>{instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
            <Field label="Mode"><Select name="mode"><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="HYBRID">Hybrid</option></Select></Field>
            <Field label="Level"><Select name="level"><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></Select></Field>
            <Field label="Price (BDT)" hint="0 for a free course"><Input name="price" type="number" min={0} defaultValue={0} /></Field>
            <Field label="Duration (weeks)"><Input name="durationWeeks" type="number" min={1} defaultValue={8} /></Field>
            <Field label="Outcomes (one per line)"><Textarea name="outcomes" rows={3} /></Field>
            <Field label="Requirements (one per line)"><Textarea name="requirements" rows={3} /></Field>
            <div className="sm:col-span-2"><SubmitButton>Create course (as draft)</SubmitButton></div>
          </ActionForm>
        </Disclosure>
        <Disclosure summary={`Categories (${categories.length})`}>
          <div className="mb-4 flex flex-wrap gap-2">{categories.map((c) => <Badge key={c.id}>{c.name} · {c._count.courses}</Badge>)}</div>
          <ActionForm action={createCategory} className="flex gap-2" resetOnSuccess>
            <Input name="name" placeholder="New category" required />
            <SubmitButton variant="secondary">Add</SubmitButton>
          </ActionForm>
        </Disclosure>
      </div>
      <Card>
        <Table>
          <THead><tr><TH>Course</TH><TH>Instructors</TH><TH>Mode</TH><TH>Price</TH><TH>Content</TH><TH>Learners</TH><TH>Status</TH></tr></THead>
          <tbody>
            {courses.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/admin/courses/${c.id}`} className="flex items-center gap-3">
                    <CourseCover hue={c.coverHue} title="" small className="size-10 shrink-0 rounded-lg" />
                    <span><span className="block font-medium text-navy-950 hover:text-azure-500">{c.title}</span><span className="block text-xs text-muted-500">{c.category?.name}{c.featured ? " · featured" : ""}</span></span>
                  </Link>
                </TD>
                <TD className="text-muted-600">{c.instructors.map((i) => i.user.name).join(", ") || <span className="text-tangerine-500">Unassigned</span>}</TD>
                <TD>{humanize(c.mode)}</TD>
                <TD className="whitespace-nowrap tabular-nums">{formatBDT(effectivePrice(c))}</TD>
                <TD className="whitespace-nowrap text-muted-600">{c._count.lessons} lessons · {c._count.batches} batches</TD>
                <TD className="tabular-nums">{c._count.enrollments}</TD>
                <TD><StatusBadge status={c.status} /></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
