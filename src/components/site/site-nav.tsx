"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import { Logo } from "../logo";
import { Icon3D } from "../icon-3d";
import { CourseCover } from "../ui";
import { cn, formatBDT } from "@/lib/utils";

export type NavCourse = { slug: string; title: string; hue: number; mode: string; price: number; category: string | null };
export type NavCategory = { slug: string; name: string; icon: string; count: number };

const LINKS = [
  { href: "/#programs", label: "Programmes" },
  { href: "/#how", label: "How it works" },
  { href: "/#assistant", label: "AI assistant" },
  { href: "/verify", label: "Verify certificate" },
];

const EASE = "ease-[cubic-bezier(.6,.6,0,1)]";

/** reflect.app header: logo left, centred pill nav, actions right; hairline + blur once scrolled. */
export function SiteNav({ courses, categories, user }: { courses: NavCourse[]; categories: NavCategory[]; user: { name: string; home: string } | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [mega, setMega] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const linkCls = `rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-300 ${EASE} hover:text-ink`;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50" onMouseLeave={() => setMega(false)}>
        <div className={cn("border-b transition-all duration-[450ms]", EASE, scrolled || mega ? "border-line bg-paper/75 backdrop-blur-xl" : "border-transparent")}>
          <nav className="relative mx-auto flex h-[72px] max-w-7xl items-center px-5 sm:px-6">
            <Logo />
            <div className="absolute left-1/2 hidden -translate-x-1/2 items-center rounded-full border border-line bg-white/60 px-1.5 py-1 backdrop-blur-md lg:flex">
              <button onMouseEnter={() => setMega(true)} onClick={() => setMega((m) => !m)} className={cn(linkCls, "flex items-center gap-1", mega && "text-ink")}>
                Courses <ChevronDown className={cn("size-3.5 transition-transform duration-[450ms]", EASE, mega && "rotate-180")} />
              </button>
              {LINKS.map((l) => (
                <Link key={l.href} href={l.href} onMouseEnter={() => setMega(false)} className={linkCls}>{l.label}</Link>
              ))}
            </div>
            <div className="ml-auto hidden items-center gap-3 lg:flex">
              {user ? (
                <Link href={user.home} className="rf-btn rf-btn-primary group">Dashboard <ArrowRight className="size-4 transition duration-[450ms] group-hover:translate-x-0.5" /></Link>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-ink transition-opacity hover:opacity-70">Log in</Link>
                  <Link href="/register" className="rf-btn rf-btn-primary">Start learning</Link>
                </>
              )}
            </div>
            <button className="ml-auto rounded-xl p-2 text-ink lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="size-6" /></button>
          </nav>
        </div>

        {/* course gallery mega-menu */}
        <div
          className={cn(
            "absolute inset-x-0 top-full mx-auto mt-2 hidden max-w-5xl origin-top overflow-hidden rounded-[20px] bg-white/95 shadow-[0_30px_80px_-30px_rgb(46_16_120/.35),inset_0_0_0_1px_rgb(13_10_31/.07)] backdrop-blur-xl transition-all duration-[450ms] lg:block",
            EASE,
            mega ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0",
          )}
        >
          <div className="grid grid-cols-[250px_1fr]">
            <div className="border-r border-line bg-paper p-4">
              <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">Tracks</div>
              {categories.map((c) => (
                <Link key={c.slug} href={`/courses?category=${c.slug}`} onClick={() => setMega(false)} className="flex items-center gap-3 rounded-xl p-2 transition-colors duration-300 hover:bg-white">
                  <Icon3D name={c.icon} size={30} />
                  <span className="flex-1 text-sm text-ink">{c.name}</span>
                  <span className="text-xs text-ink-faint">{c.count}</span>
                </Link>
              ))}
            </div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Featured programmes</div>
                <Link href="/courses" onClick={() => setMega(false)} className="flex items-center gap-1 text-sm text-lilac-500 hover:text-lilac-400">All courses <ArrowRight className="size-3.5" /></Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {courses.slice(0, 6).map((c) => (
                  <Link key={c.slug} href={`/courses/${c.slug}`} onClick={() => setMega(false)} className="rf-card group block p-1.5 hover:shadow-[inset_0_0_0_1px_#a78bfa88]">
                    <CourseCover soft hue={c.hue} title="" small className="h-16 rounded-[10px]" />
                    <div className="px-1.5 pb-1 pt-2">
                      <div className="line-clamp-1 text-[13px] font-medium text-ink">{c.title}</div>
                      <div className="mt-0.5 flex justify-between text-[11px] text-ink-faint"><span className="capitalize">{c.mode.toLowerCase()}</span><span className="font-medium text-lilac-500">{formatBDT(c.price)}</span></div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* mobile sheet */}
      <div className={cn("fixed inset-0 z-[60] bg-paper/95 p-5 backdrop-blur-xl transition-all duration-[450ms] lg:hidden", EASE, mobile ? "opacity-100" : "pointer-events-none opacity-0")}>
        <div className="flex items-center justify-between">
          <Logo />
          <button onClick={() => setMobile(false)} aria-label="Close menu" className="rounded-xl p-2 text-ink"><X className="size-6" /></button>
        </div>
        <ul className="mt-10 space-y-1">
          {[{ href: "/courses", label: "All courses" }, ...LINKS].map((l) => (
            <li key={l.href}><Link href={l.href} onClick={() => setMobile(false)} className="rf-title block py-2 font-display text-3xl font-medium">{l.label}</Link></li>
          ))}
        </ul>
        <div className="mt-8 grid grid-cols-2 gap-2">
          {categories.slice(0, 6).map((c) => (
            <Link key={c.slug} href={`/courses?category=${c.slug}`} onClick={() => setMobile(false)} className="rf-card flex items-center gap-2 p-2.5 text-sm text-ink"><Icon3D name={c.icon} size={26} /> {c.name}</Link>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          {user ? <Link href={user.home} className="rf-btn rf-btn-primary flex-1">Dashboard</Link> : <>
            <Link href="/login" className="rf-btn flex-1">Log in</Link>
            <Link href="/register" className="rf-btn rf-btn-primary flex-1">Start learning</Link>
          </>}
        </div>
      </div>
    </>
  );
}
