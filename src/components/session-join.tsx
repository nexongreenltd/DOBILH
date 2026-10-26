import Link from "next/link";
import { PlayCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type JoinSession = {
  id: string;
  mode: string;
  hosting: string;
  status: string;
  liveUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  recordingStatus: string;
  lessonId: string | null;
  recordingUrl?: string | null;
  batch: { courseId: string };
};

/**
 * The one join/replay control for a class session, wherever it’s listed:
 * DoB Live → in-app classroom (waiting room opens 15 min early); external → meeting link;
 * after the class → replay lesson (or external recording).
 */
export function SessionJoin({ s, size = "sm", earlyMinutes = 15 }: { s: JoinSession; size?: "sm" | "md"; earlyMinutes?: number }) {
  if (s.mode !== "ONLINE" || s.status === "CANCELLED") return null;
  const now = Date.now();
  const cls = cn("inline-flex items-center gap-1.5 rounded-lg font-semibold", size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs");
  const live = s.status === "LIVE";
  const ended = s.status === "COMPLETED" || s.endsAt.getTime() < now;

  if (ended && !live) {
    if (s.recordingStatus === "READY" && s.lessonId)
      return <Link href={`/dashboard/courses/${s.batch.courseId}?lesson=${s.lessonId}`} className={cn(cls, "bg-lilac-500/10 text-lilac-500 hover:bg-lilac-500/15")}><PlayCircle className="size-3.5" /> Watch replay</Link>;
    if (s.recordingStatus === "PROCESSING") return <span className={cn(cls, "bg-slate-100 font-medium text-muted-600")}>Replay processing…</span>;
    if (s.recordingUrl) return <a href={s.recordingUrl} target="_blank" className={cn(cls, "bg-lilac-500/10 text-lilac-500")}><PlayCircle className="size-3.5" /> Recording</a>;
    return null;
  }

  const open = live || now >= s.startsAt.getTime() - earlyMinutes * 60000;
  if (!open) return null;
  const label = live ? "Join live" : s.hosting === "PLATFORM" ? "Enter waiting room" : "Join";
  const style = live ? "bg-sun-500 text-white hover:bg-sun-600" : "bg-navy-950 text-white hover:bg-navy-800";
  return s.hosting === "PLATFORM" ? (
    <Link href={`/live/${s.id}`} className={cn(cls, style)}>{live && <Radio className="size-3.5" />} {label}</Link>
  ) : s.liveUrl ? (
    <a href={s.liveUrl} target="_blank" rel="noopener" className={cn(cls, style)}>{label}</a>
  ) : null;
}
