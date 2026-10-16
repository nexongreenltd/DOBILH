import { CalendarDays, MapPin, Video, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, EmptyState, IconChip, PageHeader, StatusBadge, Badge } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata = { title: "Schedule" };

export default async function Schedule() {
  const user = await requireUser();
  const enrollments = await db.enrollment.findMany({ where: { userId: user.id, status: { in: ["ACTIVE", "COMPLETED"] }, batchId: { not: null } }, select: { batchId: true } });
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86400000);
  const sessions = await db.classSession.findMany({
    where: { batchId: { in: enrollments.map((e) => e.batchId!) }, startsAt: { gte: from } },
    include: { batch: { include: { course: true } }, attendance: { where: { studentId: user.id } } },
    orderBy: { startsAt: "asc" },
  });
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const k = formatDate(s.startsAt, { weekday: "long", day: "numeric", month: "long", year: undefined });
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  return (
    <div>
      <PageHeader title="Schedule" description="Your live online and in-person classes. Times shown in Dhaka time." />
      {sessions.length === 0 && <Card><EmptyState icon={<CalendarDays className="size-5" />} title="Nothing scheduled" description="Classes appear here once you join a batch." /></Card>}
      <div className="space-y-6">
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day}>
            <div className="mb-2 text-[13px] font-medium text-muted-500">{day}</div>
            <div className="space-y-2">
              {list.map((s) => {
                const live = s.startsAt <= now && s.endsAt >= now;
                const past = s.endsAt < now;
                return (
                  <Card key={s.id} className={`flex flex-wrap items-center gap-4 p-4 ${live ? "border-sun-400 ring-4 ring-sun-500/10" : ""}`}>
                    <div className="w-20 text-sm">
                      <div className="font-semibold text-navy-950">{formatTime(s.startsAt)}</div>
                      <div className="text-xs text-muted-500">{formatTime(s.endsAt)}</div>
                    </div>
                    <IconChip tone={s.mode === "ONLINE" ? "azure" : "green"} size={38}>{s.mode === "ONLINE" ? <Video /> : <MapPin />}</IconChip>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-muted-500">{s.batch.course.title} · {s.batch.name}</div>
                      <div className="font-medium text-navy-950">{s.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-600">
                        {s.mode === "ONLINE" ? <><Video className="size-3" /> Online live class</> : <><MapPin className="size-3" /> {s.venue}</>}
                      </div>
                    </div>
                    {live && <Badge tone="red">● Live now</Badge>}
                    {past ? (s.attendance[0] ? <StatusBadge status={s.attendance[0].status} /> : s.status === "CANCELLED" ? <StatusBadge status="CANCELLED" /> : <Badge><Clock className="size-3" /> Awaiting attendance</Badge>) : null}
                    {!past && s.mode === "ONLINE" && s.liveUrl && (
                      <a href={s.liveUrl} target="_blank" className={`rounded-xl px-4 py-2 text-sm font-semibold ${live ? "bg-sun-500 text-white" : "bg-navy-950 text-white"}`}>Join class</a>
                    )}
                    {past && s.recordingUrl && <a href={s.recordingUrl} target="_blank" className="text-sm font-medium text-azure-500">Watch recording</a>}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
