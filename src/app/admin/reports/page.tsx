import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { REPORTS, buildReport, type ReportType } from "@/lib/reports";
import { BarList } from "@/components/bar-list";
import { Card, CardHeader, EmptyState, PageHeader, Select, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { formatTaka, humanize, pct } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ type?: string; course?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const type = (sp.type && sp.type in REPORTS ? sp.type : "enrollments") as ReportType;
  const course = sp.course || null;
  const [rows, courses, revenueByCourse, attendanceByBatch, marksByCourse] = await Promise.all([
    buildReport(type, course),
    db.course.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    db.course.findMany({ select: { title: true, enrollments: { select: { payments: { where: { status: "PAID" }, select: { amount: true } } } } } }),
    db.batch.findMany({ where: { status: { in: ["RUNNING", "COMPLETED"] } }, select: { code: true, sessions: { select: { attendance: { select: { status: true } } } } } }),
    db.course.findMany({ select: { title: true, assessments: { select: { totalMarks: true, submissions: { where: { status: "GRADED" }, select: { obtained: true } } } } } }),
  ]);
  const revenue = revenueByCourse.map((c) => ({ label: c.title, value: c.enrollments.flatMap((e) => e.payments).reduce((s, p) => s + p.amount, 0) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const attendance = attendanceByBatch.map((b) => {
    const all = b.sessions.flatMap((s) => s.attendance);
    return { label: b.code, value: pct(all.filter((a) => a.status !== "ABSENT").length, all.length) };
  }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const marks = marksByCourse.map((c) => {
    const scores = c.assessments.flatMap((a) => a.submissions.map((s) => ((s.obtained ?? 0) / a.totalMarks) * 100));
    return { label: c.title, value: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0 };
  }).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const qs = new URLSearchParams({ ...(course ? { course } : {}) }).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Enrollment, attendance, marks, progress and revenue — preview here, export as CSV." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader title="Revenue by course" /><div className="p-5">{revenue.length ? <BarList rows={revenue} format={formatTaka} /> : <EmptyState title="No revenue yet" />}</div></Card>
        <Card><CardHeader title="Attendance rate by batch" /><div className="p-5">{attendance.length ? <BarList rows={attendance} format={(v) => `${v}%`} max={100} /> : <EmptyState title="No attendance yet" />}</div></Card>
        <Card><CardHeader title="Average assessment score" /><div className="p-5">{marks.length ? <BarList rows={marks} format={(v) => `${v}%`} max={100} /> : <EmptyState title="No graded work yet" />}</div></Card>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f6] px-5 py-4">
          <Tabs active={type} tabs={(Object.keys(REPORTS) as ReportType[]).map((k) => ({ key: k, label: REPORTS[k], href: `?${new URLSearchParams({ type: k, ...(course ? { course } : {}) })}` }))} />
          <div className="mb-6 flex items-center gap-2">
            <form className="flex gap-2">
              <input type="hidden" name="type" value={type} />
              <Select name="course" defaultValue={course ?? ""} className="w-56"><option value="">All courses</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
              <SubmitButton variant="secondary">Apply</SubmitButton>
            </form>
            <a href={`/api/reports/${type}${qs ? `?${qs}` : ""}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-950 px-4 text-sm font-medium text-white hover:bg-navy-800"><Download className="size-4" /> CSV</a>
          </div>
        </div>
        {rows.length === 0 ? <EmptyState title="No rows for this report" /> : (
          <>
            <Table>
              <THead><tr>{headers.map((h) => <TH key={h}>{humanize(h)}</TH>)}</tr></THead>
              <tbody>{rows.slice(0, 50).map((r, i) => <TR key={i}>{headers.map((h) => <TD key={h} className="whitespace-nowrap">{String(r[h] ?? "")}</TD>)}</TR>)}</tbody>
            </Table>
            <div className="px-5 py-3 text-xs text-muted-500">Showing {Math.min(50, rows.length)} of {rows.length} rows · export CSV for the full report</div>
          </>
        )}
      </Card>
    </div>
  );
}
