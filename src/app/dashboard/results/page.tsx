import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, Table, THead, TH, TR, TD } from "@/components/ui";
import { formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "Marks & feedback" };

export default async function Results() {
  const user = await requireUser();
  const subs = await db.submission.findMany({
    where: { studentId: user.id, status: { not: "IN_PROGRESS" } },
    include: { assessment: { include: { course: true } }, gradedBy: { select: { name: true } } },
    orderBy: { submittedAt: "desc" },
  });
  return (
    <div>
      <PageHeader title="Marks & feedback" description="Results appear here once your instructor publishes them." />
      <Card>
        {subs.length === 0 ? (
          <EmptyState icon={<FileCheck2 className="size-5" />} title="No results yet" description="Attempt a quiz or submit an assignment to see marks here." />
        ) : (
          <Table>
            <THead><tr><TH>Assessment</TH><TH>Course</TH><TH>Submitted</TH><TH>Score</TH><TH>Feedback</TH></tr></THead>
            <tbody>
              {subs.map((s) => {
                const visible = s.status === "GRADED" && s.assessment.resultsPublished;
                const pass = (s.obtained ?? 0) >= s.assessment.passMarks;
                return (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/dashboard/assessments/${s.assessmentId}`} className="font-medium text-navy-950 hover:text-azure-500">{s.assessment.title}</Link>
                      <div className="text-xs text-muted-500">{humanize(s.assessment.type)} · attempt {s.attemptNo}</div>
                    </TD>
                    <TD className="text-muted-600">{s.assessment.course.title}</TD>
                    <TD className="whitespace-nowrap text-muted-600">{formatDate(s.submittedAt)}</TD>
                    <TD>{visible ? <Badge tone={pass ? "green" : "red"}>{s.obtained}/{s.assessment.totalMarks} · {pass ? "Pass" : "Below pass"}</Badge> : <Badge tone="amber">{s.status === "GRADED" ? "Awaiting release" : "Being graded"}</Badge>}</TD>
                    <TD className="max-w-xs text-sm text-muted-600">{visible ? s.feedback ?? "—" : "—"}{visible && s.gradedBy && <div className="text-xs text-muted-500">— {s.gradedBy.name}</div>}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
