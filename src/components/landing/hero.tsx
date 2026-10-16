import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { BlackHole } from "./black-hole";
import { HeroVideo } from "./hero-video";
import { InView } from "./in-view";

/**
 * reflect.app-style hero: static copy (no entrance animation — the motion is ambient),
 * a slow-rotating black hole rising behind the product frame, and its glow spilling over the frame edge.
 */
export function Hero({ learners, liveTitle }: { learners: number; liveTitle: string }) {
  return (
    <section className="relative overflow-hidden bg-paper pb-10 pt-36 sm:pt-40">
      <div className="rf-glow-top pointer-events-none absolute left-1/2 top-[-173px] h-[900px] w-[1440px] -translate-x-1/2" />
      <div className="relative z-20 mx-auto max-w-4xl px-6 text-center">
        <Link href="/courses" className="rf-badge mx-auto text-sm">
          <Sparkles className="size-3.5 text-lilac-400" />
          <span className="rf-badge-text font-medium">New batches enrolling — online, offline &amp; hybrid</span>
        </Link>
        <h1 className="rf-title mx-auto mt-5 max-w-4xl pb-2 font-display text-[clamp(2.6rem,6.4vw,4.75rem)] font-medium leading-[1.05] tracking-[-0.032em]">
          Learn today. Build tomorrow’s Bangladesh.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-ink-soft">
          Industry-led courses with live and in-person classes, daily notes and slides, real assessments and verified certificates.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/courses" className="rf-btn rf-btn-primary group">
            Explore courses <ArrowRight className="size-4 transition duration-[450ms] group-hover:translate-x-0.5" />
          </Link>
          <Link href="/register" className="rf-btn">Create a free account</Link>
        </div>
        <p className="mt-5 text-sm text-ink-faint">{learners.toLocaleString()} learners enrolled · Pay with bKash, Nagad or card</p>
      </div>

      <InView className="relative mx-auto mt-52 max-w-6xl px-4 sm:mt-60">
        <BlackHole className="pointer-events-none absolute left-1/2 top-[-430px] z-0 h-[900px] w-[900px] -translate-x-1/2" />
        {/* glow spilling over the top edge of the frame */}
        <div className="pointer-events-none absolute left-1/2 top-[-60px] z-20 h-[150px] w-[680px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(50%_50%_at_50%_50%,#ffffffcc_0%,#c4a8ff88_30%,#8b5cf633_55%,transparent_75%)] blur-xl" />
        <div className="rf-frame relative z-10">
          <div className="rf-starlight left-[12%] top-0 z-10" />
          <HeroVideo />
        </div>
        <div className="rf-card absolute -bottom-6 left-8 z-20 hidden items-center gap-3 px-4 py-3 md:flex">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lilac-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-lilac-500" />
          </span>
          <div className="text-left">
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Next live class</div>
            <div className="max-w-xs truncate text-sm font-medium text-ink">{liveTitle}</div>
          </div>
        </div>
      </InView>
    </section>
  );
}
