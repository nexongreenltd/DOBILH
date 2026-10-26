"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  LayoutDashboard, BookOpen, CalendarDays, ClipboardCheck, Award, Wallet, Bot, Bell, User, Users, Layers,
  Receipt, TicketPercent, BarChart3, Megaphone, ScrollText, Settings, GraduationCap, Menu, X, LogOut, Compass,
  FileCheck2, CalendarClock, Library, ShieldCheck, Sparkles, ChevronRight, Radio,
} from "lucide-react";
import { Logo } from "./logo";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";
import { logout } from "@/app/actions/auth";

type Area = "student" | "instructor" | "admin";
type NavItem = { href: string; label: string; icon: typeof BookOpen; exact?: boolean };

const NAV: Record<Area, { title?: string; items: NavItem[] }[]> = {
  student: [
    {
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/dashboard/courses", label: "My courses", icon: BookOpen },
        { href: "/dashboard/schedule", label: "Schedule", icon: CalendarDays },
        { href: "/dashboard/assessments", label: "Assessments", icon: ClipboardCheck },
        { href: "/dashboard/results", label: "Marks & feedback", icon: FileCheck2 },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/dashboard/certificates", label: "Certificates", icon: Award },
        { href: "/dashboard/payments", label: "Payments", icon: Wallet },
        { href: "/dashboard/assistant", label: "AI assistant", icon: Bot },
        { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
        { href: "/dashboard/profile", label: "Profile", icon: User },
      ],
    },
  ],
  instructor: [
    {
      items: [
        { href: "/instructor", label: "Overview", icon: LayoutDashboard, exact: true },
        { href: "/instructor/courses", label: "My courses", icon: BookOpen },
        { href: "/instructor/sessions", label: "Sessions & attendance", icon: CalendarClock },
        { href: "/instructor/assessments", label: "Assessments", icon: ClipboardCheck },
        { href: "/instructor/grading", label: "Grading queue", icon: FileCheck2 },
        { href: "/instructor/announcements", label: "Announcements", icon: Megaphone },
      ],
    },
    { title: "Account", items: [{ href: "/dashboard/profile", label: "Profile", icon: User }] },
  ],
  admin: [
    { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
    {
      title: "Academics",
      items: [
        { href: "/admin/courses", label: "Courses", icon: Library },
        { href: "/admin/batches", label: "Batches & sessions", icon: Layers },
        { href: "/admin/live", label: "Live classes", icon: Radio },
        { href: "/admin/assessments", label: "Assessments", icon: ClipboardCheck },
        { href: "/admin/certificates", label: "Certificates", icon: Award },
      ],
    },
    {
      title: "People & commerce",
      items: [
        { href: "/admin/users", label: "Users & roles", icon: Users },
        { href: "/admin/enrollments", label: "Enrollments", icon: GraduationCap },
        { href: "/admin/payments", label: "Payments", icon: Receipt },
        { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
      ],
    },
    {
      title: "Insights & ops",
      items: [
        { href: "/admin/reports", label: "Reports", icon: BarChart3 },
        { href: "/admin/ai", label: "AI assistant", icon: Bot },
        { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
        { href: "/admin/audit", label: "Audit log", icon: ScrollText },
        { href: "/admin/settings", label: "Settings", icon: Settings },
      ],
    },
  ],
};

const AREA_LABEL: Record<Area, string> = { student: "Student", instructor: "Instructor", admin: "Administration" };

export function AppShell({
  area,
  user,
  unread,
  roleLabel,
  switchLinks,
  children,
}: {
  area: Area;
  user: { name: string; email: string; avatarColor: string };
  unread: number;
  roleLabel: string;
  switchLinks: { href: string; label: string }[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <div className="px-5 pb-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-azure-50 px-2.5 py-1 text-[11px] font-semibold text-azure-500">
          <ShieldCheck className="size-3" /> {AREA_LABEL[area]}
        </span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {NAV[area].map((group, gi) => (
          <div key={gi}>
            {group.title && <div className="mb-1.5 px-3 text-[11px] font-medium text-muted-500">{group.title}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                        active ? "text-navy-950" : "text-muted-600 hover:bg-azure-50/70 hover:text-navy-950",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId={`nav-active-${area}`}
                          className="absolute inset-0 rounded-xl bg-azure-50 ring-1 ring-azure-100"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className={cn("relative size-[18px]", active ? "text-azure-500" : "text-muted-500")} />
                      <span className="relative">{item.label}</span>
                      {item.href.endsWith("notifications") && unread > 0 && (
                        <span className="relative ml-auto rounded-full bg-sun-500 px-1.5 text-[10px] font-semibold text-white">{unread}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        {switchLinks.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {switchLinks.map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                <Compass className="size-3.5" /> {l.label}
              </Link>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.name} color={user.avatarColor} size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            <div className="truncate text-xs text-slate-500">{roleLabel}</div>
          </div>
          <form action={logout}>
            <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dot-canvas min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#e8ebf1] bg-white lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl lg:hidden"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
            >
              <button className="absolute right-3 top-4 rounded-lg p-2 text-slate-500" onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#e8ebf1] bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <button className="flex size-9 items-center justify-center rounded-xl border border-[#e8ebf1] text-navy-950 hover:bg-azure-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-[18px]" />
          </button>
          <Breadcrumb pathname={pathname} area={area} />
          <div className="flex-1" />
          {area === "student" && (
            <form action="/dashboard/assistant" className="relative hidden md:block">
              <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-azure-500" />
              <input
                name="q"
                placeholder="Ask DoB AI…"
                className="h-9 w-64 rounded-xl border border-[#e8ebf1] bg-azure-50/50 pl-9 pr-3 text-sm text-navy-950 placeholder:text-muted-500 focus:border-azure-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-azure-500/10"
              />
            </form>
          )}
          <Link href="/dashboard/notifications" className="relative flex size-9 items-center justify-center rounded-xl border border-[#e8ebf1] text-navy-950 hover:bg-azure-50" aria-label="Notifications">
            <Bell className="size-[18px]" />
            {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tangerine-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">{unread}</span>}
          </Link>
          <Link href="/courses" className="hidden h-9 items-center gap-1.5 rounded-xl bg-navy-950 px-4 text-sm font-medium text-white hover:bg-navy-800 sm:flex">
            <Compass className="size-4" /> Browse courses
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({ pathname, area }: { pathname: string; area: Area }) {
  const root = area === "student" ? "/dashboard" : `/${area}`;
  const items = NAV[area].flatMap((g) => g.items);
  const match = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const deeper = match && pathname !== match.href;
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[15px]">
      <Link href={root} className="hidden text-muted-500 hover:text-navy-950 sm:inline">{AREA_LABEL[area]}</Link>
      {match && match.href !== root && (
        <>
          <ChevronRight className="hidden size-4 text-muted-500 sm:inline" />
          <Link href={match.href} className={cn("truncate", deeper ? "text-muted-500 hover:text-navy-950" : "font-semibold text-navy-950")}>{match.label}</Link>
        </>
      )}
      {(!match || match.href === root) && <span className="font-semibold text-navy-950 sm:hidden">{match?.label ?? "Overview"}</span>}
      {deeper && (
        <>
          <ChevronRight className="size-4 text-muted-500" />
          <span className="truncate font-semibold text-navy-950">Details</span>
        </>
      )}
    </div>
  );
}
