import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Clock, Wifi, Building2, Shuffle, MessageCircleQuestion, CalendarClock, ListChecks, Languages, UserCheck, Award } from "lucide-react";
import { Icon3D } from "../icon-3d";
import { CourseCover } from "../ui";
import { LogoMark } from "../logo";
import { InView } from "./in-view";
import { RisingStars, twinkleStars } from "./stars";
import { AiShowcase } from "./ai-showcase";
import { cn, formatBDT } from "@/lib/utils";

export type LandingCourse = {
  slug: string;
  title: string;
  subtitle: string | null;
  hue: number;
  mode: string;
  level: string;
  price: number;
  originalPrice: number;
  weeks: number;
  category: string | null;
  instructor: string | null;
  lessons: number;
};

function SectionHeader({ badge, title, sub, className }: { badge: string; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative z-10 mx-auto max-w-3xl px-6 text-center", className)}>
      <div className="rf-badge mx-auto text-sm">
        <span className="rf-badge-text font-medium">{badge}</span>
      </div>
      <h2 className="rf-title mt-4 pb-1 font-display text-[clamp(2rem,4.4vw,3.4rem)] font-medium leading-[1.08] tracking-[-0.035em]">{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">{sub}</p>}
    </div>
  );
}

/** Hairline grid of items with reflect's vertical tick marks and hover wash. */
function HairGrid({ items, cols }: { items: { icon: ReactNode; title: string; text: string }[]; cols: 2 | 3 | 4 }) {
  const lg = cols === 4 ? "lg:grid-cols-4" : cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  return (
    <div className={cn("relative mx-auto grid max-w-6xl grid-cols-1 sm:grid-cols-2", lg)}>
      <div className="rf-hairline-x absolute inset-x-0 top-0" />
      <div className="rf-hairline-x absolute inset-x-0 bottom-0" />
      {items.map((f) => (
        <div key={f.title} className="group relative overflow-hidden px-8 pb-9 pt-7">
          <div className="rf-hairline-y absolute bottom-0 left-0 top-0" />
          <span className="absolute left-0 top-[86px] h-4 w-px bg-ink/30 transition-all duration-[450ms] ease-[cubic-bezier(.6,.6,0,1)] group-hover:h-7 group-hover:bg-lilac-500" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-lilac-500/[0.05] opacity-0 transition-opacity duration-[450ms] ease-[cubic-bezier(.6,.6,0,1)] group-hover:opacity-100" />
          <div className="relative">{f.icon}</div>
          <h3 className="relative mt-5 font-medium text-ink">{f.title}</h3>
          <p className="relative mt-1 text-[15px] leading-relaxed text-ink-soft">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

// ───────── Features ─────────

export function Features() {
  const items = [
    { i: "video", t: "Live & recorded lessons", d: "Join live classes or watch on demand." },
    { i: "book", t: "Daily PDFs & slides", d: "Notes and slides after every class." },
    { i: "pin", t: "Offline & hybrid batches", d: "Learn in person at DoB venues in Dhaka." },
    { i: "clipboard", t: "Quizzes & assessments", d: "Auto-graded quizzes, assignments and exams." },
    { i: "growth", t: "Progress tracking", d: "Lessons, attendance and marks in one view." },
    { i: "award", t: "Verified certificates", d: "Rule-based, with a public verification link." },
    { i: "wallet", t: "bKash, Nagad & card", d: "Secure checkout and instant enrollment." },
    { i: "bot", t: "AI learning assistant", d: "Answers about your course, in Bangla or English." },
  ];
  return (
    <section className="relative bg-paper px-0 pb-12 pt-10">
      <HairGrid cols={4} items={items.map((f) => ({ icon: <Icon3D name={f.i} size={36} />, title: f.t, text: f.d }))} />
    </section>
  );
}

// ───────── AI ─────────

export function AiSection() {
  return (
    <section id="assistant" className="relative overflow-hidden bg-paper pb-16 pt-20">
      <SectionHeader
        badge="AI learning assistant"
        title="Learn with an AI assistant"
        sub="Ask about your schedule, deadlines and certificate rules. Answers are grounded in curated knowledge and your live course data — and anything it can’t answer goes to the learning team."
      />
      <InView className="relative mt-14 h-[560px] overflow-hidden px-6">
        {/* light column behind the card, landing on a perspective floor (reflect AI stage) */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-[340px] w-[300px] -translate-x-1/2 bg-gradient-to-b from-lilac-400/0 via-lilac-400/20 to-lilac-400/45 [mask-image:linear-gradient(90deg,transparent,#000_25%,#000_75%,transparent)]" />
        <div className="pointer-events-none absolute inset-x-0 top-[330px] h-[230px] [perspective:520px]">
          <div
            className="absolute left-1/2 top-0 h-[700px] w-[1600px] -translate-x-1/2 origin-top [transform:rotateX(64deg)]"
            style={{
              backgroundImage: "linear-gradient(rgb(113 47 255 / 0.2) 1px, transparent 1px), linear-gradient(90deg, rgb(113 47 255 / 0.2) 1px, transparent 1px)",
              backgroundSize: "96px 96px",
              maskImage: "radial-gradient(40% 55% at 50% 0%, #000 25%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(40% 55% at 50% 0%, #000 25%, transparent 80%)",
            }}
          />
          <div className="absolute left-1/2 top-0 h-[700px] w-[1600px] -translate-x-1/2 origin-top [transform:rotateX(64deg)]">
            <div className="absolute left-1/2 top-0 h-[420px] w-[520px] -translate-x-1/2 bg-[radial-gradient(closest-side_at_50%_0%,#8b5cf677,#8b5cf600)]" />
          </div>
        </div>
        <RisingStars className="left-1/2 top-0 h-[330px] w-[700px] -translate-x-1/2 [mask-image:linear-gradient(to_top,#000,transparent)]" width={700} height={330} seed={21} />
        <div className="relative pt-24"><AiShowcase /></div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper to-transparent" />
      </InView>
      <div className="mt-10">
        <h3 className="rf-title mx-auto max-w-2xl px-6 text-center font-display text-[clamp(1.6rem,3vw,2.3rem)] font-medium tracking-[-0.03em]">What can you do with DoB AI?</h3>
        <div className="mt-12">
          <HairGrid
            cols={3}
            items={[
              { icon: <CalendarClock className="size-6 text-ink" strokeWidth={1.5} />, title: "Know your schedule", text: "Next class, venue and live link in one answer." },
              { icon: <ListChecks className="size-6 text-ink" strokeWidth={1.5} />, title: "Track what’s due", text: "Quizzes, assignments and deadlines this week." },
              { icon: <Award className="size-6 text-ink" strokeWidth={1.5} />, title: "Certificate guidance", text: "See exactly what’s left to qualify." },
              { icon: <Languages className="size-6 text-ink" strokeWidth={1.5} />, title: "Bangla or English", text: "Replies in the language you ask in." },
              { icon: <MessageCircleQuestion className="size-6 text-ink" strokeWidth={1.5} />, title: "Platform help", text: "Payments, refunds, attendance and more." },
              { icon: <UserCheck className="size-6 text-ink" strokeWidth={1.5} />, title: "Human follow-up", text: "Unanswered questions reach the team." },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

// ───────── Connected learning (light beam + animated cards) ─────────

export function Connected() {
  const nodes = [
    { x: 60, y: 150, label: "Enrolled", delay: 0 },
    { x: 170, y: 70, label: "Class 7", delay: 0.8 },
    { x: 290, y: 140, label: "Quiz 2 · 9/10", delay: 1.6 },
    { x: 390, y: 60, label: "Certificate", delay: 2.4 },
  ];
  const rows = [
    ["7:00 PM", "Class 8 · Testing & quality", "Online"],
    ["Fri 10:00", "Pitch clinic", "Banani Hub"],
    ["Sat 7:00", "Capstone sprint", "Dhanmondi Lab"],
    ["Sun 8:00", "Data storytelling", "Online"],
  ];
  return (
    <section id="how" className="relative overflow-hidden bg-paper pb-16">
      <InView className="relative h-[460px] [mask-image:linear-gradient(180deg,#000_45%,transparent_92%)]">
        <svg viewBox="0 0 900 460" preserveAspectRatio="none" className="absolute left-1/2 top-0 h-full w-[900px] -translate-x-1/2" aria-hidden>
          <defs>
            <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c4b5fd" stopOpacity="0" />
              <stop offset="0.45" stopColor="#a78bfa" stopOpacity="0.28" />
              <stop offset="1" stopColor="#7c3aed" stopOpacity="0.42" />
            </linearGradient>
            <radialGradient id="beamcore" cx="0.5" cy="1" r="0.6">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M450 0 C 455 230, 560 400, 900 460 L 0 460 C 340 400, 445 230, 450 0 Z" fill="url(#beam)" />
          <path d="M450 120 C 452 280, 520 400, 640 460 L 260 460 C 380 400, 448 280, 450 120 Z" fill="url(#beamcore)" />
        </svg>
        <RisingStars className="inset-x-0 bottom-0 h-[360px] [mask-image:linear-gradient(to_top,#000,transparent)]" width={1600} height={360} seed={33} />
      </InView>
      <div className="-mt-28">
        <SectionHeader badge="Your learning, connected" title="Every class builds on the last" sub="Lessons, attendance, assessments and certificates are linked — so your dashboard always shows exactly where you stand and what’s next." />
      </div>
      <InView className="relative mx-auto mt-14 grid max-w-5xl gap-0 px-6 md:grid-cols-2">
        <div className="rf-hairline-x absolute inset-x-6 top-0" />
        <div className="rf-hairline-x absolute inset-x-6 bottom-0" />
        <div className="relative p-8">
          <div className="rf-hairline-y absolute bottom-0 left-0 top-0" />
          <div className="relative h-[210px] overflow-hidden rounded-xl [background-image:radial-gradient(rgb(13_10_31/.12)_1px,transparent_1px)] [background-size:18px_18px]">
            <svg viewBox="0 0 450 210" className="absolute inset-0 size-full" aria-hidden>
              <path
                d={`M${nodes.map((n) => `${n.x} ${n.y}`).join(" L")}`}
                pathLength={1}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth="1.5"
                strokeDasharray="1"
                className="rf-anim [animation:rf-draw_3.2s_cubic-bezier(.6,.6,0,1)_infinite_alternate]"
                style={{ strokeDashoffset: 1 }}
              />
            </svg>
            {nodes.map((n) => (
              <div key={n.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(n.x / 450) * 100}%`, top: `${(n.y / 210) * 100}%` }}>
                <span className="rf-anim absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lilac-400 [animation:rf-pulse-ring_2.4s_ease-out_infinite]" style={{ animationDelay: `${n.delay}s` }} />
                <span className="relative block size-5 rounded-full bg-gradient-to-b from-white to-lilac-200 shadow-[0_0_14px_#a78bfa,inset_0_0_0_1px_#a78bfa]" />
                <span className="absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded-md bg-white px-1.5 py-0.5 text-[11px] text-ink-soft shadow-sm ring-1 ring-line">{n.label}</span>
              </div>
            ))}
          </div>
          <Icon3D name="growth" size={32} className="mt-6" />
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft"><span className="font-medium text-ink">Progress, connected.</span> Every lesson, class and quiz moves you toward your certificate automatically.</p>
        </div>
        <div className="relative p-8">
          <div className="rf-hairline-y absolute bottom-0 left-0 top-0" />
          <div className="rf-hairline-y absolute bottom-0 right-0 top-0" />
          <div className="relative h-[210px] overflow-hidden rounded-xl">
            <div className="space-y-2 pt-3">
              {rows.map(([t, title, where], i) => (
                <div key={title} className={cn("flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-[13px] ring-1 ring-line", i === 0 ? "translate-x-0" : i % 2 ? "translate-x-6" : "translate-x-3")}>
                  <span className={cn("size-2 rounded-full", i === 0 ? "bg-lilac-500" : "bg-ink-faint/40")} />
                  <span className="w-16 text-ink-faint">{t}</span>
                  <span className="flex-1 truncate font-medium text-ink">{title}</span>
                  <span className="text-ink-faint">{where}</span>
                </div>
              ))}
            </div>
            <div className="rf-anim absolute right-6 top-2 size-28 rounded-full bg-white/30 shadow-[inset_0_0_0_1px_rgb(13_10_31/.12),inset_0_8px_20px_rgb(255_255_255/.9),0_10px_30px_-10px_rgb(46_16_120/.35)] backdrop-blur-[1px] backdrop-saturate-150 [animation:rf-lens_9s_cubic-bezier(.6,.6,0,1)_infinite]" />
          </div>
          <Icon3D name="bell" size={32} className="mt-6" />
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft"><span className="font-medium text-ink">Never miss a class.</span> Reminders, live links and venues for every online and in-person session.</p>
        </div>
      </InView>
    </section>
  );
}

// ───────── Radar: learn anywhere ─────────

export function LearnAnywhere() {
  const pins = [
    { label: "Online · live", a: 200, r: 0.82, d: 0 },
    { label: "Dhanmondi Lab", a: 235, r: 0.56, d: 2.5 },
    { label: "Banani Hub", a: 300, r: 0.7, d: 5 },
    { label: "Mirpur Centre", a: 335, r: 0.45, d: 7.5 },
  ];
  const stars = twinkleStars(40, 77, 10, 40);
  return (
    <section className="relative overflow-hidden bg-paper pb-16 pt-6">
      <InView className="relative mx-auto h-[380px] max-w-[900px] overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-[760px] translate-y-1/2 overflow-hidden rounded-full">
          {[1, 0.78, 0.56, 0.34].map((s) => (
            <div key={s} className="absolute left-1/2 top-1/2 rounded-full border border-lilac-400/30" style={{ width: `${s * 100}%`, height: `${s * 100}%`, transform: "translate(-50%,-50%)" }} />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="absolute left-1/2 top-1/2 h-px w-1/2 origin-left bg-gradient-to-r from-lilac-400/30 to-transparent" style={{ transform: `rotate(${180 + i * 15}deg)` }} />
          ))}
          <div className="rf-anim absolute inset-0 rounded-full [animation:rf-radar_10s_linear_infinite]" style={{ background: "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, #8b5cf622 330deg, #8b5cf680 359deg, transparent 360deg)" }} />
          {stars.map((s, i) => (
            <span key={i} className="rf-anim absolute size-1 rounded-full bg-lilac-400" style={{ left: `${s.left}%`, top: `${s.top}%`, animation: `rf-twinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />
          ))}
        </div>
        {pins.map((p) => {
          const rad = (p.a * Math.PI) / 180;
          const x = 50 + Math.cos(rad) * p.r * 50;
          const y = 100 + Math.sin(rad) * p.r * 100;
          return (
            <div key={p.label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x.toFixed(2)}%`, top: `${y.toFixed(2)}%` }}>
              <span className="rf-anim absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lilac-400/50 [animation:rf-pulse-ring_10s_ease-out_infinite]" style={{ animationDelay: `${p.d}s` }} />
              <span className="relative block size-2.5 rounded-full bg-lilac-500 shadow-[0_0_10px_#8b5cf6]" />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink-soft shadow-sm ring-1 ring-line">{p.label}</span>
            </div>
          );
        })}
        <div className="rf-hairline-x absolute -inset-x-40 bottom-0" />
      </InView>
      <div className="relative z-10 -mt-10 flex justify-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-white shadow-[0_0_0_8px_rgb(139_92_246/.08),0_0_40px_#a78bfa88]">
          <LogoMark size={48} />
        </div>
      </div>
      <div className="mt-10">
        <SectionHeader badge="Online, offline & hybrid" title="Learn from anywhere" sub="Join live from home, learn hands-on at DoB venues across Dhaka, or mix both — the same lessons, attendance and certificate." />
      </div>
      <div className="mt-14">
        <HairGrid
          cols={3}
          items={[
            { icon: <Wifi className="size-6 text-ink" strokeWidth={1.5} />, title: "Online", text: "Live classes with recordings, notes and slides after each session." },
            { icon: <Building2 className="size-6 text-ink" strokeWidth={1.5} />, title: "Offline", text: "Mentors in the room and per-session attendance at DoB venues." },
            { icon: <Shuffle className="size-6 text-ink" strokeWidth={1.5} />, title: "Hybrid", text: "Weekend labs in person, weekday sessions online — one schedule." },
          ]}
        />
      </div>
    </section>
  );
}

// ───────── Programmes (reflect pricing: glowing sphere) ─────────

export function Programs({ courses, freeCourse, fromPrice }: { courses: LandingCourse[]; freeCourse: LandingCourse | null; fromPrice: number }) {
  return (
    <section id="programs" className="relative overflow-hidden bg-paper pb-16 pt-16">
      <SectionHeader badge="Programmes" title="Choose your path." />
      <InView className="relative mx-auto mt-14 max-w-5xl px-6">
        {/* glowing sphere (reflect pricing) */}
        <div className="pointer-events-none absolute left-1/2 top-[40px] size-[720px] -translate-x-1/2 overflow-hidden rounded-full">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_105%,#a78bfa99_0%,#c4b5fd55_30%,#ede9fe33_55%,transparent_72%)]" />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_-50px_90px_-30px_#8b5cf6,inset_0_-8px_20px_-4px_#ffffff,inset_0_-2px_0_#c4b5fd]" />
          {[0.94, 0.78, 0.6, 0.42, 0.24].map((w) => (
            <div key={w} className="absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-[50%] border-x border-lilac-400/25" style={{ width: `${w * 100}%` }} />
          ))}
          <RisingStars className="inset-0 [mask-image:linear-gradient(to_top,#000_20%,transparent_75%)]" width={720} height={720} seed={51} />
          <div className="absolute inset-0 bg-gradient-to-b from-paper via-paper/40 to-transparent" />
        </div>
        <div className="relative grid gap-0 md:grid-cols-2">
          <div className="relative px-6 pb-10 pt-4 text-center">
            <div className="text-[15px] text-ink">Start free</div>
            <div className="rf-gradient mt-4 font-display text-[64px] font-medium leading-none tracking-[-0.04em]">Free</div>
            <p className="mt-4 text-ink-soft">{freeCourse?.title ?? "Career readiness course"}</p>
            <Link href={freeCourse ? `/courses/${freeCourse.slug}` : "/courses?price=free"} className="rf-btn rf-btn-primary mt-7">Start the free course</Link>
          </div>
          <div className="relative px-6 pb-10 pt-4 text-center">
            <div className="rf-hairline-y absolute bottom-6 left-0 top-6 hidden md:block" />
            <div className="text-[15px] text-ink">Professional programmes</div>
            <div className="rf-gradient mt-4 pt-3 font-display text-[40px] font-medium leading-none tracking-[-0.03em]">From {formatBDT(fromPrice)}</div>
            <p className="mt-4 text-ink-soft">Online, offline and hybrid batches with certificates.</p>
            <Link href="/courses" className="rf-btn mt-7">Browse all courses</Link>
          </div>
        </div>
        <p className="relative mt-4 text-center text-sm text-ink-faint">Pay securely with bKash, Nagad, Rocket or card. Coupons applied at checkout.</p>
        <div className="relative mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, 6).map((c) => (
            <Link key={c.slug} href={`/courses/${c.slug}`} className="rf-card group block overflow-hidden p-1.5 hover:shadow-[inset_0_0_0_1px_#a78bfa88,0_20px_40px_-20px_rgb(46_16_120/.35)]">
              <CourseCover hue={c.hue} title="" small soft className="h-32 rounded-[11px] transition-transform duration-[900ms] ease-[cubic-bezier(.6,.6,0,1)] group-hover:scale-[1.02]" />
              <div className="px-3 pb-3 pt-3">
                <div className="rf-badge-text text-xs font-medium">{c.category}</div>
                <div className="mt-1 font-medium leading-snug text-ink">{c.title}</div>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-faint">
                  <span className="flex items-center gap-3"><span className="capitalize">{c.mode.toLowerCase()}</span><span className="flex items-center gap-1"><Clock className="size-3" />{c.weeks}w</span></span>
                  <span className="text-sm font-medium text-ink">{c.originalPrice > c.price && <span className="mr-1.5 text-xs font-normal text-ink-faint line-through">{formatBDT(c.originalPrice)}</span>}{formatBDT(c.price)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </InView>
    </section>
  );
}

// ───────── Wall of love (two slow rows, edges faded) ─────────

// Placeholder testimonials for the demo — replace with real, consented learner quotes before launch.
const QUOTES = [
  { n: "Ayesha Siddiqua", r: "Frontend Developer", q: "The daily notes and live sessions kept me on track. I landed my first developer job two weeks after my certificate." },
  { n: "Imran Kabir", r: "Founder, AgriLink", q: "The bootcamp pushed us to talk to real farmers. Our MVP changed completely." },
  { n: "Mehjabin Akter", r: "Data Analyst", q: "Switching between online and in-person classes let me learn while working full time." },
  { n: "Nafis Iqbal", r: "UI Designer", q: "Instructor feedback on every assignment was detailed and kind. I finally have a portfolio I’m proud of." },
  { n: "Tasnim Ferdous", r: "Marketing Executive", q: "The AI assistant answered my questions at midnight before deadlines — and it always knew my schedule." },
  { n: "Rifat Mahmud", r: "Student, BUET", q: "The free career course was a game-changer for interviews. Clear, practical and very Bangladesh-specific." },
  { n: "Lamia Sultana", r: "Product Analyst", q: "Attendance, marks and progress in one place meant I always knew exactly where I stood." },
  { n: "Zubair Alam", r: "Junior Data Scientist", q: "The Python for data module was the most practical course I’ve taken." },
];

function Quote({ t }: { t: (typeof QUOTES)[number] }) {
  return (
    <figure className="rf-card w-[420px] shrink-0 p-6">
      <figcaption className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-orchid-300 via-lilac-300 to-periwinkle-300 text-xs font-semibold text-white">{t.n.split(" ").map((p) => p[0]).join("")}</span>
        <span>
          <span className="block text-[15px] font-medium text-ink">{t.n}</span>
          <span className="block text-[13px] text-ink-faint">{t.r}</span>
        </span>
      </figcaption>
      <blockquote className="mt-4 text-[15px] leading-relaxed text-ink-soft">{t.q}</blockquote>
    </figure>
  );
}

export function Testimonials() {
  const a = QUOTES.slice(0, 4);
  const b = QUOTES.slice(4);
  return (
    <section className="relative overflow-hidden bg-paper pb-16 pt-16">
      <SectionHeader badge="Wall of love" title="Loved by learners" sub="Here’s what people are saying about learning with DoB." />
      <InView className="mt-14 space-y-6 [mask-image:linear-gradient(90deg,transparent,#000_22%,#000_78%,transparent)]">
        <div className="rf-anim flex w-max gap-6 [animation:rf-row_90s_linear_infinite]">{[...a, ...a, ...a, ...a].map((t, i) => <Quote key={i} t={t} />)}</div>
        <div className="rf-anim flex w-max gap-6 [animation:rf-row_110s_linear_infinite_reverse]">{[...b, ...b, ...b, ...b].map((t, i) => <Quote key={i} t={t} />)}</div>
      </InView>
    </section>
  );
}

// ───────── About (globe with rotating border) ─────────

export function About({ stats }: { stats: { learners: number; courses: number; sessions: number; certificates: number } }) {
  return (
    <section id="mission" className="relative overflow-hidden bg-paper pb-4 pt-16">
      <SectionHeader badge="About" title="We’re Dreams of Bangladesh" sub="Talent is everywhere in Bangladesh — opportunity isn’t. The Innovation & Learning Hub brings practical, industry-led learning to every learner, in the classroom and online." />
      <InView className="relative mx-auto mt-16 h-[420px] max-w-5xl overflow-hidden">
        <div className="absolute left-1/2 top-0 size-[760px] -translate-x-1/2">
          <div className="absolute inset-0 rounded-full [background-image:radial-gradient(rgb(113_47_255/.28)_1.2px,transparent_1.3px)] [background-size:14px_14px] [mask-image:radial-gradient(circle_at_50%_40%,#000_35%,transparent_70%)]" />
          <div
            className="rf-anim absolute inset-0 rounded-full p-px [animation:rf-rotate_30s_linear_infinite]"
            style={{ background: "conic-gradient(from 0deg, transparent 0deg, #8b5cf6 60deg, transparent 140deg, transparent 220deg, #60a5fa 290deg, transparent 360deg)", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
          />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_30px_80px_-30px_#c4b5fd]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
        <div className="absolute inset-x-0 top-[120px] mx-auto grid max-w-3xl grid-cols-2 gap-y-10 px-6 sm:grid-cols-4">
          {[
            [stats.learners, "Learners"],
            [stats.courses, "Programmes"],
            [stats.sessions, "Classes held"],
            [stats.certificates, "Certificates"],
          ].map(([v, l]) => (
            <div key={l as string} className="text-center">
              <div className="rf-title font-display text-5xl font-medium tracking-tight">{(v as number).toLocaleString()}</div>
              <div className="mt-1 text-sm text-ink-faint">{l as string}</div>
            </div>
          ))}
        </div>
      </InView>
    </section>
  );
}

// ───────── CTA with horizon glow ─────────

export function Cta() {
  return (
    <section className="relative overflow-hidden bg-paper pt-16">
      <SectionHeader badge="Get started" title="Learn today with DoB" sub="Never miss a class, a deadline or a chance to grow." />
      <div className="relative z-10 mt-8 flex flex-wrap justify-center gap-3 px-6">
        <Link href="/register" className="rf-btn rf-btn-primary">Create a free account <ArrowRight className="size-4" /></Link>
        <Link href="/courses" className="rf-btn">Browse courses</Link>
      </div>
      <InView className="relative mt-10 h-[300px] overflow-hidden">
        <RisingStars className="inset-0 [mask-image:linear-gradient(to_top,#000,transparent)]" width={1600} height={300} seed={91} />
        <div className="absolute bottom-0 left-1/2 h-[220px] w-[1500px] -translate-x-1/2 translate-y-1/2 rounded-[50%] bg-[radial-gradient(50%_50%_at_50%_50%,#a78bfa66,transparent_70%)] blur-2xl" />
        <div className="rf-anim absolute bottom-0 left-1/2 size-[520px] -translate-x-1/2 translate-y-1/2 animate-[rf-breathe_7s_ease-in-out_infinite]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_48%,#ffffff_53%,#e9ddff_56%,#b18cff_62%,#8b5cf655_68%,transparent_74%)] blur-[2px]" />
          <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_50%_30%,#5b2fd6_0%,#7c4dff_45%,#b79bff_80%,#efe7ff_100%)] shadow-[0_0_80px_16px_#c4b5fd88]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-lilac-400/70 to-transparent" />
      </InView>
    </section>
  );
}

