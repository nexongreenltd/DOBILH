import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { BatchForm } from "@/components/batch-form";
import { Card, Disclosure, PageHeader, Progress, StatusBadge, Table, TD, TH, THead, TR, Tabs } from "@/components/ui";
import { formatDate, humanize, pct } from "@/lib/utils";

export const metadata = { title: "Batches & sessions" };

export default async function AdminBatches({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "active" } = await searchParams;
  const [batches, courses] = await Promise.all([
    db.batch.findMany({
      where: status === "active" ? { status: { in: ["UPCOMING", "RUNNING"] } } : { status: { in: ["COMPLETED", "CANCELLED"] } },
      include: { course: true, _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED", "PENDING"] } } }, sessions: true } } },
      orderBy: { startDate: "asc" },
    }),
    db.course.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const held = await db.classSession.groupBy({ by: ["batchId"], where: { startsAt: { lte: new Date() }, status: { not: "CANCELLED" } }, _count: true });
  return (
    <div className="space-y-5">
      <PageHeader title="Batches & sessions" description="Cohorts across all courses — schedule, capacity, venue and mode." />
      <Disclosure summary="Create a batch"><BatchForm courses={courses} /></Disclosure>
      <Tabs active={status} tabs={[{ key: "active", label: "Upcoming & running", href: "?status=active" }, { key: "past", label: "Completed & cancelled", href: "?status=past" }]} />
      <Card>
        <Table>
          <THead><tr><TH>Batch</TH><TH>Course</TH><TH>Mode / venue</TH><TH>Dates</TH><TH>Seats</TH><TH>Sessions</TH><TH>Status</TH></tr></THead>
          <tbody>
            {batches.map((b) => {
              const done = held.find((h) => h.batchId === b.id)?._count ?? 0;
              return (
                <TR key={b.id}>
                  <TD><div className="font-medium text-navy-950">{b.name}</div><div className="font-mono text-xs text-muted-500">{b.code}</div></TD>
                  <TD><Link href={`/admin/courses/${b.courseId}`} className="text-navy-950 hover:text-azure-500">{b.course.title}</Link></TD>
                  <TD className="text-muted-600">{humanize(b.mode)}{b.venue ? <div className="max-w-[200px] truncate text-xs">{b.venue}</div> : null}</TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDate(b.startDate)} – {formatDate(b.endDate)}<div className="text-xs">{b.scheduleText}</div></TD>
                  <TD className="w-36"><div className="mb-1 text-xs text-muted-600">{b._count.enrollments}/{b.capacity}</div><Progress value={pct(b._count.enrollments, b.capacity)} className="h-1.5" /></TD>
                  <TD className="text-muted-600"><Link href={`/instructor/courses/${b.courseId}?tab=sessions`} className="hover:text-azure-500">{done}/{b._count.sessions} held</Link></TD>
                  <TD><StatusBadge status={b.status} /></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
