import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { Badge, Card, Disclosure, EmptyState, IconChip, PageHeader, StatusBadge } from "@/components/ui";
import { NewAssessmentForm } from "@/components/assessment-form";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Assessments" };

export default async function InstructorAssessments() {
  const user = await requireStaffOrInstructor();
  const ids = await manageableCourseIds(user);
  const [assessments, courses] = await Promise.all([
    db.assessment.findMany({
      where: { courseId: { in: ids } },
      include: { course: true, batch: true, _count: { select: { questions: true, submissions: true } }, submissions: { where: { status: "SUBMITTED" }, select: { id: true } } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    }),
    db.course.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, batches: { where: { status: { in: ["UPCOMING", "RUNNING"] } }, select: { id: true, name: true } } }, orderBy: { title: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Assessments" description="Quizzes, assignments, class tests and exams." />
      <Disclosure summary="Create an assessment"><NewAssessmentForm courses={courses} /></Disclosure>
      <Card>
        {assessments.length === 0 ? <EmptyState icon={<ClipboardCheck className="size-5" />} title="No assessments yet" /> : (
          <ul className="divide-y divide-[#eef1f6]">
            {assessments.map((a) => (
              <li key={a.id}>
                <Link href={`/instructor/assessments/${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-azure-50/40">
                  <IconChip tone={a.type === "QUIZ" ? "azure" : a.type === "EXAM" ? "red" : "orange"}><ClipboardCheck /></IconChip>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted-500">{humanize(a.type)} · {a.course.title}{a.batch ? ` · ${a.batch.code}` : ""}</div>
                    <div className="text-sm font-medium text-navy-950">{a.title}</div>
                  </div>
                  <div className="text-right text-xs text-muted-500">{a._count.questions} questions · {a._count.submissions} submissions<div>{a.dueAt ? `Due ${formatDateTime(a.dueAt)}` : "No deadline"}</div></div>
                  {a.submissions.length > 0 && <Badge tone="amber">{a.submissions.length} to grade</Badge>}
                  {a.resultsPublished && <Badge tone="green">Results out</Badge>}
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
