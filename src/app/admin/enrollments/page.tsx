import type { EnrollmentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { manualEnroll, updateEnrollment } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, Disclosure, Field, Input, PageHeader, Select, StatusBadge, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Enrollments" };

export default async function AdminEnrollments({ searchParams }: { searchParams: Promise<{ status?: string; course?: string }> }) {
  await requireAdmin();
  const { status, course } = await searchParams;
  const where: Prisma.EnrollmentWhereInput = {};
  if (status) where.status = status as EnrollmentStatus;
  if (course) where.courseId = course;
  const [rows, batches, courses] = await Promise.all([
    db.enrollment.findMany({ where, include: { user: true, course: { include: { batches: { select: { id: true, code: true } } } }, batch: true }, orderBy: { enrolledAt: "desc" }, take: 300 }),
    db.batch.findMany({ where: { status: { in: ["UPCOMING", "RUNNING"] } }, include: { course: true }, orderBy: { startDate: "asc" } }),
    db.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const href = (s?: string) => `/admin/enrollments?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(course ? { course } : {}) })}`;
  return (
    <div className="space-y-5">
      <PageHeader title="Enrollments" description="Who is enrolled where. Paid enrollments activate automatically after payment verification." />
      <Disclosure summary="Enroll a learner manually (offline payment, scholarship, staff)">
        <ActionForm action={manualEnroll} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" resetOnSuccess>
          <Field label="Learner email"><Input name="email" type="email" required /></Field>
          <Field label="Batch">
            <Select name="batchId" required>{batches.map((b) => <option key={b.id} value={b.id}>{b.course.title} — {b.name}</option>)}</Select>
          </Field>
          <Field label="Amount received (BDT)" hint="0 for scholarship/free"><Input name="amount" type="number" min={0} defaultValue={0} /></Field>
          <Field label="Note"><Input name="note" placeholder="e.g. Cash receipt #123" /></Field>
          <div className="sm:col-span-2 lg:col-span-4"><SubmitButton>Enroll &amp; record payment</SubmitButton></div>
        </ActionForm>
      </Disclosure>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Tabs active={status ?? "all"} tabs={[{ key: "all", label: "All", href: href() }, ...["ACTIVE", "PENDING", "COMPLETED", "CANCELLED"].map((s) => ({ key: s, label: s.charAt(0) + s.slice(1).toLowerCase(), href: href(s) }))]} />
        <form className="flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <Select name="course" defaultValue={course ?? ""} className="w-64"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
          <SubmitButton variant="secondary">Filter</SubmitButton>
        </form>
      </div>
      <Card>
        <Table>
          <THead><tr><TH>Learner</TH><TH>Course</TH><TH>Batch</TH><TH>Enrolled</TH><TH>Status</TH><TH /></tr></THead>
          <tbody>
            {rows.map((e) => (
              <TR key={e.id}>
                <TD><div className="flex items-center gap-2"><Avatar name={e.user.name} color={e.user.avatarColor} size={28} /><span><span className="block font-medium text-navy-950">{e.user.name}</span><span className="block text-xs text-muted-500">{e.user.email}</span></span></div></TD>
                <TD className="text-muted-600">{e.course.title}</TD>
                <TD>
                  <form action={updateEnrollment} className="flex items-center gap-1">
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    <input type="hidden" name="action" value="move" />
                    <select name="batchId" defaultValue={e.batchId ?? ""} className="h-8 rounded-lg border border-[#e8ebf1] bg-white px-2 text-xs">{e.course.batches.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}</select>
                    <SubmitButton variant="ghost" size="sm">Move</SubmitButton>
                  </form>
                </TD>
                <TD className="whitespace-nowrap text-muted-600">{formatDate(e.enrolledAt)}</TD>
                <TD><StatusBadge status={e.status} /></TD>
                <TD className="text-right">
                  <form action={updateEnrollment}>
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    {e.status === "ACTIVE" || e.status === "PENDING" ? (
                      <SubmitButton name="action" value="cancel" variant="ghost" size="sm" confirm="Cancel this enrollment? The learner loses access.">Cancel</SubmitButton>
                    ) : e.status === "CANCELLED" ? (
                      <SubmitButton name="action" value="activate" variant="ghost" size="sm">Reactivate</SubmitButton>
                    ) : null}
                  </form>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
