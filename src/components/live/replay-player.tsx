"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, MessageSquare, Radio } from "lucide-react";
import { completeLessonFromReplay } from "@/app/actions/student";
import { cn } from "@/lib/utils";

type Line = { id: string; kind: "CHAT" | "QUESTION"; body: string; offsetSec: number; answered: boolean; name: string };

const clock = (sec: number) => `${Math.floor(sec / 3600) ? `${Math.floor(sec / 3600)}:` : ""}${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/**
 * Live-class replay: streams (no download), resumes where you left off, completes the lesson once
 * 80% has been watched, and shows the class chat/Q&A as a transcript you can click to jump to.
 */
export function ReplayPlayer({ src, materialId, lessonId, completed, transcript, recordedOn }: { src: string; materialId: string; lessonId: string; completed: boolean; transcript: Line[]; recordedOn: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const watched = useRef(new Set<number>());
  const sent = useRef(completed);
  const [time, setTime] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "QUESTION">("ALL");
  const key = `dob-replay-pos-${materialId}`;

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const restore = () => {
      try {
        const pos = Number(localStorage.getItem(key));
        if (pos > 5 && pos < v.duration - 10) v.currentTime = pos;
      } catch {
        /* storage unavailable */
      }
    };
    v.addEventListener("loadedmetadata", restore, { once: true });
    return () => v.removeEventListener("loadedmetadata", restore);
  }, [key]);

  const onTime = () => {
    const v = video.current;
    if (!v) return;
    setTime(v.currentTime);
    watched.current.add(Math.floor(v.currentTime / 5));
    try {
      localStorage.setItem(key, String(Math.floor(v.currentTime)));
    } catch {
      /* storage unavailable */
    }
    if (!sent.current && v.duration && Number.isFinite(v.duration)) {
      const coverage = (watched.current.size * 5) / v.duration;
      if (coverage >= 0.8) {
        sent.current = true;
        void completeLessonFromReplay(lessonId);
      }
    }
  };

  const lines = transcript.filter((l) => filter === "ALL" || l.kind === "QUESTION");
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="overflow-hidden rounded-2xl border border-[#e8ebf1] bg-navy-950 shadow-lg">
        <video
          ref={video}
          src={src}
          controls
          controlsList="nodownload"
          playsInline
          preload="metadata"
          onTimeUpdate={onTime}
          onContextMenu={(e) => e.preventDefault()}
          className="aspect-video w-full bg-black"
        />
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 text-xs text-muted-600">
          <Radio className="size-3.5 text-azure-500" /> Live class replay · recorded {recordedOn}
        </div>
      </div>
      {transcript.length > 0 && (
        <div className="flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-[#e8ebf1] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f6] px-4 py-3">
            <span className="text-sm font-semibold text-navy-950">Class chat</span>
            <div className="flex gap-1 rounded-lg bg-azure-50/70 p-0.5 text-xs">
              {(["ALL", "QUESTION"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2 py-1 font-medium", filter === f ? "bg-white text-navy-950 shadow-sm" : "text-muted-500")}>
                  {f === "ALL" ? "All" : "Q&A"}
                </button>
              ))}
            </div>
          </div>
          <ol className="flex-1 space-y-1 overflow-y-auto p-2">
            {lines.map((l) => {
              const active = time >= l.offsetSec && time < l.offsetSec + 8;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => {
                      if (video.current) {
                        video.current.currentTime = l.offsetSec;
                        void video.current.play().catch(() => {});
                      }
                    }}
                    className={cn("flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-azure-50/60", active && "bg-azure-50")}
                  >
                    <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-azure-500">{clock(l.offsetSec)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[11px] text-muted-500">
                        {l.kind === "QUESTION" ? <HelpCircle className="size-3 text-tangerine-500" /> : <MessageSquare className="size-3" />} {l.name}
                        {l.answered && <span className="text-brand-700">· answered</span>}
                      </span>
                      <span className="block break-words text-navy-950/90">{l.body}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
