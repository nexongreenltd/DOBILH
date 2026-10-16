import Link from "next/link";
import { CalendarClock, Video, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffOrInstructor } from "@/lib/auth";
import { manageableCourseIds } from "@/lib/learning";
import { Card, Disclosure, EmptyState, IconChip, PageHeader, StatusBadge, Tabs } from "@/components/ui";
import { SessionForm } from "@/components/session-form";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Sessions & attendance" };

export default async function Sessions({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireStaffOrInstructor();
  const { view = "upcoming" } = await searchParams;
  const ids = await manageableCourseIds(user);
  const now = new Date();
  const [sessions, batches, lessons] = await Promise.all([
    db.classSession.findMany({
      where: { batch: { courseId: { in: ids } }, ...(view === "upcoming" ? { endsAt: { gte: now } } : { endsAt: { lt: now } }) },
      include: { batch: { include: { course: true, _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED"] } } } } } } }, _count: { select: { attendance: true } } },
      orderBy: { startsAt: view === "upcoming" ? "asc" : "desc" },
      take: 60,
    }),
    db.batch.findMany({ where: { courseId: { in: ids }, status: { in: ["UPCOMING", "RUNNING"] } }, include: { course: true } }),
    db.lesson.findMany({ where: { courseId: { in: ids } }, orderBy: [{ courseId: "asc" }, { orderNo: "asc" }], select: { id: true, orderNo: true, title: true } }),
  ]);
  return (
    <div className="space-y-5">
      <PageHeader title="Sessions & attendance" description="Schedule online and offline classes and record attendance." />
      {batches.length > 0 && (
        <Disclosure summary="Schedule a class session">
          <SessionForm batches={batches.map((b) => ({ id: b.id, name: `${b.course.title} — ${b.name}`, mode: b.mode, venue: b.venue }))} lessons={lessons} />
        </Disclosure>
      )}
      <Tabs active={view} tabs={[{ key: "upcoming", label: "Upcoming", href: "?view=upcoming" }, { key: "past", label: "Past", href: "?view=past" }]} />
      <Card>
        {sessions.length === 0 ? <EmptyState icon={<CalendarClock className="size-5" />} title={view === "upcoming" ? "No upcoming sessions" : "No past sessions"} /> : (
          <ul className="divide-y divide-[#eef1f6]">
            {sessions.map((s) => {
              const needs = view === "past" && s._count.attendance < s.batch._count.enrollments && s.status !== "CANCELLED";
              return (
                <li key={s.id}>
                  <Link href={`/instructor/sessions/${s.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-azure-50/40">
                    <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-muted-500">{s.batch.course.title} · {s.batch.code}</div>
                      <div className="text-sm font-medium text-navy-950">{s.title}</div>
                    </div>
                    <div className="text-right text-xs text-muted-600">{formatDateTime(s.startsAt)}<div className="text-muted-500">{s._count.attendance}/{s.batch._count.enrollments} marked</div></div>
                    {needs ? <span className="rounded-lg bg-tangerine-50 px-2 py-1 text-xs font-medium text-tangerine-500">Needs attendance</span> : <StatusBadge status={s.status} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
