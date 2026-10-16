import Link from "next/link";
import { BookOpen, Users, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { Card, CourseCover, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { humanize } from "@/lib/utils";

export const metadata = { title: "My courses" };

export default async function InstructorCourses() {
  const user = await requireStaffOrInstructor();
  const ids = await manageableCourseIds(user);
  const courses = await db.course.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { lessons: true, enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } }, batches: true } } },
    orderBy: { title: "asc" },
  });
  return (
    <div>
      <PageHeader title="My courses" description="Build lessons, upload daily resources and manage sessions for the courses you teach." />
      {courses.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="size-5" />} title="No courses assigned" description="An administrator will assign you to courses." /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/instructor/courses/${c.id}`} className="group">
              <Card className="overflow-hidden transition group-hover:-translate-y-0.5 group-hover:border-azure-200">
                <CourseCover hue={c.coverHue} title={c.title} className="h-28" />
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between"><StatusBadge status={c.status} /><span className="text-xs text-muted-500">{humanize(c.mode)}</span></div>
                  <div className="flex gap-4 text-xs text-muted-600">
                    <span className="flex items-center gap-1"><BookOpen className="size-3.5" /> {c._count.lessons} lessons</span>
                    <span className="flex items-center gap-1"><Layers className="size-3.5" /> {c._count.batches} batches</span>
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {c._count.enrollments}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
