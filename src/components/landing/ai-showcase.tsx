"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RotateCcw, CornerDownLeft, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * reflect.app "Click to see magic" AI panel: idle → prompt menu → answer streams in with a
 * hue-rotating rainbow sweep that settles into plain text. Re-run replays it.
 */
const PROMPTS = [
  { label: "When is my next class?", answer: "Your next class is Class 8: Testing and quality — tomorrow at 8:00 PM, online. The Join button appears in Schedule 15 minutes before it starts." },
  { label: "সার্টিফিকেট পেতে কী লাগবে?", answer: "৮০% লেসন সম্পন্ন, ৭০% ক্লাসে উপস্থিতি এবং সব প্রকাশিত অ্যাসেসমেন্টে পাস করলেই সার্টিফিকেট পাবেন। আপনি এখন ৭৫% লেসন শেষ করেছেন।" },
  { label: "What’s due this week?", answer: "Quiz 2 (10 marks, two attempts) is due Friday at 11:59 PM. Your React assignment is already submitted and awaiting a grade." },
];

type Phase = "idle" | "menu" | "answer";

export function AiShowcase() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pick, setPick] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = (i: number) => {
    setPick(i);
    setPhase("answer");
    setTyped("");
    setDone(false);
    if (timer.current) clearInterval(timer.current);
    const full = PROMPTS[i]!.answer;
    let n = 0;
    timer.current = setInterval(() => {
      n += 2;
      setTyped(full.slice(0, n));
      if (n >= full.length) {
        clearInterval(timer.current!);
        setTimeout(() => setDone(true), 900);
      }
    }, 22);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  return (
    <div className="relative mx-auto w-full max-w-[580px]">
      <div className="rf-card relative rounded-[20px] p-2">
        <span className="rf-starlight right-14 top-0" />
        <span className="rf-starlight bottom-0 left-14 [&::before]:[animation-delay:2.5s]" />
        <div className="rounded-[14px] bg-gradient-to-b from-white to-paper px-6 py-5 ring-1 ring-line sm:px-8 sm:py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="text-[15px] font-medium text-ink">How do I make the most of my course?</div>
            {phase === "idle" && (
              <button onClick={() => setPhase("menu")} className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium">
                <Sparkles className="size-4 text-lilac-400" />
                <span className="rf-rainbow">Click to see magic</span>
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li className="flex gap-3"><span className="mt-2 size-1 shrink-0 rounded-full bg-ink-faint" />Ask the assistant anything about your classes, deadlines or certificate.</li>
          </ul>

          {phase === "menu" && (
            <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-[0_12px_32px_-16px_rgb(46_16_120/.35)] ring-1 ring-line [animation:rf-pop_.45s_cubic-bezier(.6,.6,0,1)]">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[13px] text-ink-faint"><Sparkles className="size-3.5 text-lilac-400" /> Ask DoB AI…</div>
              {PROMPTS.map((p, i) => (
                <button key={p.label} onClick={() => run(i)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-ink transition-colors duration-300 hover:bg-lilac-500/[0.06]">
                  {p.label}
                  <CornerDownLeft className="size-3.5 text-ink-faint" />
                </button>
              ))}
            </div>
          )}

          {phase === "answer" && (
            <div className="mt-4 rounded-xl bg-white p-4 ring-1 ring-line">
              <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-faint"><Sparkles className="size-3.5 text-lilac-400" /> {PROMPTS[pick]!.label}</div>
              <p className={cn("min-h-[64px] text-sm leading-relaxed transition-[color] duration-700", done ? "text-ink" : "rf-rainbow")}>{typed}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-ink-soft">
                <button onClick={() => run(pick)} className="flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ring-line hover:bg-paper"><RotateCcw className="size-3" /> Re-run <kbd className="rounded bg-paper px-1 text-[10px]">R</kbd></button>
                <button onClick={() => setPhase("menu")} className="flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ring-line hover:bg-paper"><CornerDownLeft className="size-3" /> Ask another</button>
                <span className="flex items-center gap-1.5 rounded-md px-2 py-1 ring-1 ring-line">{done ? <Check className="size-3 text-lilac-500" /> : <Copy className="size-3" />} {done ? "Grounded in your course" : "Writing…"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
