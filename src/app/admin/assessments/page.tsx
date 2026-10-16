import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Disclosure, PageHeader, StatusBadge, Table, TD, TH, THead, TR } from "@/components/ui";
import { NewAssessmentForm } from "@/components/assessment-form";
import { formatDateTime, humanize, pct } from "@/lib/utils";

export const metadata = { title: "Assessments" };

export default async function AdminAssessments() {
  await requireAdmin();
  const [items, courses] = await Promise.all([
    db.assessment.findMany({ include: { course: true, submissions: { where: { status: { not: "IN_PROGRESS" } }, select: { status: true, obtained: true } } }, orderBy: { dueAt: "desc" } }),
    db.course.findMany({ select: { id: true, title: true, batches: { where: { status: { in: ["UPCOMING", "RUNNING"] } }, select: { id: true, name: true } } }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Assessments" description="Quiz bank, assignments, tests and exams across all courses — grading and result publishing." />
      <Disclosure summary="Create an assessment"><NewAssessmentForm courses={courses} /></Disclosure>
      <Card>
        <Table>
          <THead><tr><TH>Assessment</TH><TH>Course</TH><TH>Due</TH><TH>Submissions</TH><TH>Pass rate</TH><TH>Status</TH></tr></THead>
          <tbody>
            {items.map((a) => {
              const graded = a.submissions.filter((s) => s.status === "GRADED");
              const passed = graded.filter((g) => (g.obtained ?? 0) >= a.passMarks).length;
              const waiting = a.submissions.length - graded.length;
              return (
                <TR key={a.id}>
                  <TD><Link href={`/instructor/assessments/${a.id}`} className="font-medium text-navy-950 hover:text-azure-500">{a.title}</Link><div className="text-xs text-muted-500">{humanize(a.type)} · {a.totalMarks} marks</div></TD>
                  <TD className="text-muted-600">{a.course.title}</TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDateTime(a.dueAt)}</TD>
                  <TD>{a.submissions.length}{waiting > 0 && <Badge tone="amber" className="ml-2">{waiting} to grade</Badge>}</TD>
                  <TD className="tabular-nums">{graded.length ? `${pct(passed, graded.length)}%` : "—"}</TD>
                  <TD><div className="flex gap-1.5"><StatusBadge status={a.status} />{a.resultsPublished && <Badge tone="green">Results out</Badge>}</div></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
