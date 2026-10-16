import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { humanize, timeAgo } from "@/lib/utils";

export const metadata = { title: "Grading queue" };

export default async function GradingQueue() {
  const user = await requireStaffOrInstructor();
  const ids = await manageableCourseIds(user);
  const subs = await db.submission.findMany({
    where: { status: "SUBMITTED", assessment: { courseId: { in: ids } } },
    include: { student: true, assessment: { include: { course: true } } },
    orderBy: { submittedAt: "asc" },
  });
  return (
    <div>
      <PageHeader title="Grading queue" description="Oldest first. Grades stay private until you release results for the assessment." />
      <Card>
        {subs.length === 0 ? <EmptyState icon={<FileCheck2 className="size-5" />} title="Nothing to grade" description="You’re all caught up." /> : (
          <ul className="divide-y divide-[#eef1f6]">
            {subs.map((s) => (
              <li key={s.id}>
                <Link href={`/instructor/assessments/${s.assessmentId}?sub=${s.id}#${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-azure-50/40">
                  <Avatar name={s.student.name} color={s.student.avatarColor} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy-950">{s.student.name}</div>
                    <div className="text-xs text-muted-500">{humanize(s.assessment.type)} · {s.assessment.title} · {s.assessment.course.title}</div>
                  </div>
                  <Badge tone="amber">Submitted {timeAgo(s.submittedAt ?? s.startedAt)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
