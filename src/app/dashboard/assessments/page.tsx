import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card, EmptyState, IconChip, PageHeader, Tabs } from "@/components/ui";
import { formatDateTime, humanize } from "@/lib/utils";

export const metadata = { title: "Assessments" };

export default async function Assessments({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { view = "open" } = await searchParams;
  const enrollments = await db.enrollment.findMany({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } } });
  const now = new Date();
  const all = await db.assessment.findMany({
    where: {
      status: { not: "DRAFT" },
      OR: enrollments.map((e) => ({ courseId: e.courseId, OR: [{ batchId: null }, ...(e.batchId ? [{ batchId: e.batchId }] : [])] })),
    },
    include: { course: true, submissions: { where: { studentId: user.id }, orderBy: { attemptNo: "desc" } } },
    orderBy: { dueAt: "asc" },
  });
  const isOpen = (a: (typeof all)[number]) =>
    a.status === "PUBLISHED" && (!a.dueAt || a.dueAt > now) && a.submissions.filter((s) => s.status !== "IN_PROGRESS").length < a.maxAttempts && !a.submissions.some((s) => s.status === "GRADED" && a.maxAttempts === 1);
  const list = enrollments.length === 0 ? [] : view === "open" ? all.filter(isOpen) : all.filter((a) => !isOpen(a));

  return (
    <div>
      <PageHeader title="Assessments" description="Quizzes, assignments, class tests and exams across your courses." />
      <Tabs active={view} tabs={[{ key: "open", label: "To do", href: "?view=open" }, { key: "done", label: "Submitted & closed", href: "?view=done" }]} />
      <Card>
        {list.length === 0 && <EmptyState icon={<ClipboardCheck className="size-5" />} title={view === "open" ? "Nothing due — nice work!" : "No past assessments yet"} />}
        <ul className="divide-y divide-[#eef1f6]">
          {list.map((a) => {
            const last = a.submissions[0];
            const overdue = a.dueAt && a.dueAt < now;
            return (
              <li key={a.id}>
                <Link href={`/dashboard/assessments/${a.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-azure-50/40">
                  <IconChip tone={a.type === "QUIZ" ? "azure" : a.type === "EXAM" ? "red" : "orange"} size={38}><ClipboardCheck /></IconChip>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-muted-500">{humanize(a.type)} · {a.course.title}</div>
                    <div className="font-medium text-navy-950">{a.title}</div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-muted-500">{a.totalMarks} marks{a.durationMin ? ` · ${a.durationMin} min` : ""}</div>
                    <div className={overdue ? "text-muted-500" : "font-medium text-tangerine-500"}>{a.dueAt ? `${overdue ? "Closed" : "Due"} ${formatDateTime(a.dueAt)}` : "No deadline"}</div>
                  </div>
                  {last ? (
                    last.status === "GRADED" && a.resultsPublished ? <Badge tone={(last.obtained ?? 0) >= a.passMarks ? "green" : "red"}>{last.obtained}/{a.totalMarks}</Badge> : <Badge tone="amber">{humanize(last.status)}</Badge>
                  ) : overdue ? <Badge tone="red">Missed</Badge> : <Badge tone="blue">Not started</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
