import Link from "next/link";
import { spawnSync } from "child_process";
import { Radio, Film, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { liveConfig } from "@/lib/live";
import { getSettings } from "@/lib/settings";
import { forceEndLive, retryRecording } from "@/app/actions/instructor";
import { toggleReplay } from "@/app/actions/admin";
import { SubmitButton } from "@/components/forms";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, TD, TH, THead, TR } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Live classes" };

const REC_TONE = { NONE: "slate", RECORDING: "red", PROCESSING: "amber", READY: "green", FAILED: "red" } as const;

export default async function AdminLive() {
  await requireAdmin();
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  const [live, upcoming, recordings, settings] = await Promise.all([
    db.classSession.findMany({ where: { status: "LIVE", hosting: "PLATFORM" }, include: { batch: { include: { course: true } }, presence: true }, orderBy: { liveStartedAt: "asc" } }),
    db.classSession.findMany({ where: { hosting: "PLATFORM", mode: "ONLINE", status: "SCHEDULED", startsAt: { gte: now, lte: week } }, include: { batch: { include: { course: true } } }, orderBy: { startsAt: "asc" }, take: 20 }),
    db.classSession.findMany({
      where: { hosting: "PLATFORM", liveEndedAt: { not: null } },
      include: { batch: { include: { course: true } }, recordingMaterial: true, recordingFile: true, _count: { select: { presence: true, chat: true } } },
      orderBy: { liveEndedAt: "desc" },
      take: 30,
    }),
    getSettings(),
  ]);
  const cfg = liveConfig();
  const ffmpeg = spawnSync(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]).status === 0;
  const watching = (p: { lastSeenAt: Date; isHost: boolean }[]) => p.filter((x) => !x.isHost && now.getTime() - x.lastSeenAt.getTime() < 90_000).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Live classes" description="DoB Live — monitor classes in progress, upcoming streams and published replays." actions={<Link href="/admin/settings" className="text-sm font-medium text-azure-500 hover:underline">Live class policy →</Link>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Live now" value={live.length} icon={<Radio />} accent="sun" />
        <StatCard label="Next 7 days" value={upcoming.length} icon={<CalendarClock />} accent="sky" />
        <StatCard label="Replays published" value={recordings.filter((r) => r.recordingStatus === "READY").length} icon={<Film />} accent="violet" />
        <Card className="space-y-2 p-4 text-sm">
          <div className="text-[13px] text-muted-500">Streaming setup</div>
          <div className="flex items-center gap-2">{cfg ? <CheckCircle2 className="size-4 text-brand-600" /> : <AlertTriangle className="size-4 text-tangerine-500" />} LiveKit {cfg ? "connected" : "not configured"}</div>
          <div className="flex items-center gap-2">{ffmpeg ? <CheckCircle2 className="size-4 text-brand-600" /> : <AlertTriangle className="size-4 text-tangerine-500" />} ffmpeg {ffmpeg ? "available" : "missing — replays publish as WebM"}</div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Live now" />
        {live.length === 0 ? <EmptyState icon={<Radio className="size-5" />} title="No classes are live right now" /> : (
          <Table>
            <THead><tr><TH>Class</TH><TH>Started</TH><TH>Watching</TH><TH /></tr></THead>
            <tbody>
              {live.map((s) => (
                <TR key={s.id}>
                  <TD><div className="font-medium text-navy-950">{s.title}</div><div className="text-xs text-muted-500">{s.batch.course.title} · {s.batch.code}</div></TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDateTime(s.liveStartedAt)}</TD>
                  <TD><Badge tone="red">● {watching(s.presence)} learners</Badge></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/live/${s.id}`} className="rounded-lg bg-navy-950 px-3 py-1.5 text-xs font-semibold text-white">Join as moderator</Link>
                      <form action={forceEndLive}><input type="hidden" name="sessionId" value={s.id} /><SubmitButton size="sm" variant="ghost" confirm="End this class for everyone?">End</SubmitButton></form>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Upcoming DoB Live classes" />
        {upcoming.length === 0 ? <EmptyState title="Nothing scheduled in the next 7 days" /> : (
          <Table>
            <THead><tr><TH>Class</TH><TH>Starts</TH><TH /></tr></THead>
            <tbody>
              {upcoming.map((s) => (
                <TR key={s.id}>
                  <TD><div className="font-medium text-navy-950">{s.title}</div><div className="text-xs text-muted-500">{s.batch.course.title} · {s.batch.code}</div></TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDateTime(s.startsAt)}</TD>
                  <TD className="text-right"><Link href={`/instructor/sessions/${s.id}`} className="text-sm font-medium text-azure-500">Details</Link></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Recordings" description={`Replays stay available ${settings.replayRetentionDays ? `${settings.replayRetentionDays} days` : "while learners are enrolled"} · visible to ${settings.replayScope === "BATCH" ? "the class’s batch" : "the whole course"}.`} />
        {recordings.length === 0 ? <EmptyState icon={<Film className="size-5" />} title="No live classes have ended yet" /> : (
          <Table>
            <THead><tr><TH>Class</TH><TH>Ended</TH><TH>Length</TH><TH>Joined · chat</TH><TH>Recording</TH><TH /></tr></THead>
            <tbody>
              {recordings.map((s) => (
                <TR key={s.id}>
                  <TD><div className="font-medium text-navy-950">{s.title}</div><div className="text-xs text-muted-500">{s.batch.course.title} · {s.batch.code}</div></TD>
                  <TD className="whitespace-nowrap text-muted-600">{formatDateTime(s.liveEndedAt)}</TD>
                  <TD className="tabular-nums">{s.recordingSeconds ? `${Math.round(s.recordingSeconds / 60)} min` : "—"}</TD>
                  <TD className="text-muted-600">{s._count.presence} · {s._count.chat}</TD>
                  <TD>
                    <Badge tone={REC_TONE[s.recordingStatus]}>{s.recordingStatus.toLowerCase()}</Badge>
                    {s.recordingFile && <div className="mt-1 text-xs text-muted-500">{(s.recordingFile.size / 1048576).toFixed(1)} MB</div>}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      {s.recordingStatus === "FAILED" && <form action={retryRecording}><input type="hidden" name="sessionId" value={s.id} /><SubmitButton size="sm" variant="secondary">Retry</SubmitButton></form>}
                      {s.recordingMaterial && (
                        <form action={toggleReplay}>
                          <input type="hidden" name="materialId" value={s.recordingMaterial.id} />
                          <SubmitButton size="sm" variant="ghost">{s.recordingMaterial.visibility === "HIDDEN" ? "Show replay" : "Hide replay"}</SubmitButton>
                        </form>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
