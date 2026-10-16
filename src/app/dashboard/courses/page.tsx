import Link from "next/link";
import { BookOpen, CalendarDays, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { courseProgress } from "@/lib/learning";
import { Card, CourseCover, EmptyState, LinkButton, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "My courses" };

export default async function MyCourses() {
  const user = await requireUser();
  const enrollments = await db.enrollment.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED", "PENDING"] } },
    include: { course: true, batch: true },
    orderBy: { enrolledAt: "desc" },
  });
  const rows = await Promise.all(enrollments.map(async (e) => ({ e, p: await courseProgress(user.id, e.courseId) })));
  return (
    <div>
      <PageHeader title="My courses" description="Pick up where you left off." actions={<LinkButton href="/courses" variant="secondary">Browse catalogue</LinkButton>} />
      {rows.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="size-5" />} title="You haven’t enrolled yet" description="Find a course that fits your goals." action={<LinkButton href="/courses">Explore courses</LinkButton>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ e, p }) => {
            const pending = e.status === "PENDING";
            return (
              <Link key={e.id} href={pending ? "/dashboard/payments" : `/dashboard/courses/${e.courseId}`} className="group">
                <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:border-azure-200">
                  <CourseCover hue={e.course.coverHue} title={e.course.title} className="h-32" />
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={e.status} />
                      <span className="text-xs text-muted-500">{humanize(e.course.mode)}</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-600">
                      <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {e.batch?.name ?? "Self-paced"} · from {formatDate(e.batch?.startDate)}</div>
                      {e.batch?.venue && <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {e.batch.venue}</div>}
                    </div>
                    {pending ? (
                      <div className="rounded-xl bg-tangerine-50 px-3 py-2 text-xs font-medium text-tangerine-500">Payment pending — complete payment to unlock</div>
                    ) : (
                      <div>
                        <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-500">{p.completed}/{p.total} lessons</span><span className="font-semibold text-navy-950">{p.pct}%</span></div>
                        <Progress value={p.pct} />
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
