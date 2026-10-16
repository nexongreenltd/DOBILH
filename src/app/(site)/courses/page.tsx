import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search, SlidersHorizontal } from "lucide-react";
import { db } from "@/lib/db";
import { CourseCard } from "@/components/course-card";
import { Icon3D } from "@/components/icon-3d";
import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Courses" };

type SP = { q?: string; category?: string; mode?: string; level?: string; price?: string; sort?: string };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (sp.q) where.OR = [{ title: { contains: sp.q, mode: "insensitive" } }, { subtitle: { contains: sp.q, mode: "insensitive" } }, { description: { contains: sp.q, mode: "insensitive" } }];
  if (sp.category) where.category = { slug: sp.category };
  if (sp.mode && ["ONLINE", "OFFLINE", "HYBRID"].includes(sp.mode)) where.mode = sp.mode as Prisma.EnumCourseModeFilter["equals"];
  if (sp.level && ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(sp.level)) where.level = sp.level as Prisma.EnumCourseLevelFilter["equals"];
  if (sp.price === "free") where.price = 0;
  if (sp.price === "paid") where.price = { gt: 0 };

  const orderBy: Prisma.CourseOrderByWithRelationInput[] =
    sp.sort === "price-asc" ? [{ price: "asc" }] : sp.sort === "price-desc" ? [{ price: "desc" }] : sp.sort === "new" ? [{ createdAt: "desc" }] : [{ featured: "desc" }, { createdAt: "asc" }];

  const [courses, categories] = await Promise.all([
    db.course.findMany({
      where,
      orderBy,
      include: {
        category: true,
        instructors: { include: { user: { select: { name: true } } }, orderBy: { isLead: "desc" } },
        _count: { select: { lessons: true, enrollments: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const href = (patch: Partial<SP>) => {
    const next = { ...sp, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/courses${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition", active ? "bg-lilac-500/80 text-white" : "bg-white text-ink-soft ring-1 ring-line hover:ring-lilac-300");

  return (
    <main className="min-h-screen bg-paper pb-24 pt-28">
      <section className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-[32px] bg-paper px-8 py-14 text-ink sm:px-12">
          <div className="rf-glow-top absolute inset-0 opacity-60" />
          <div className="absolute -right-20 -top-20 size-80 rounded-full bg-lilac-500/30 blur-[100px]" />
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Find your next course</h1>
              <p className="mt-3 max-w-lg text-ink-soft">Online, offline and hybrid programmes taught by practitioners — with live classes, daily resources and certificates.</p>
            </div>
            <form action="/courses" className="relative w-full max-w-md">
              {Object.entries(sp).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-ink-soft" />
              <input name="q" defaultValue={sp.q} placeholder="Search courses, skills, topics…" className="h-14 w-full rounded-2xl border border-line bg-white pl-12 pr-4 text-ink placeholder:text-ink-faint backdrop-blur focus:border-lilac-300 focus:outline-none" />
            </form>
          </div>
          <div className="relative mt-10 flex gap-3 overflow-x-auto pb-1">
            <Link href={href({ category: undefined })} className={cn("rf-card flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-sm transition", !sp.category ? "ring-2 ring-lilac-300" : "hover:bg-white")}>
              <Icon3D name="sparkles" size={30} /> All tracks
            </Link>
            {categories.map((c) => (
              <Link key={c.id} href={href({ category: c.slug })} className={cn("rf-card flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-sm transition", sp.category === c.slug ? "ring-2 ring-lilac-300" : "hover:bg-white")}>
                <Icon3D name={c.icon} size={30} /> {c.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="mr-1 size-4 text-ink-faint" />
          {[["", "All modes"], ["ONLINE", "Online"], ["OFFLINE", "Offline"], ["HYBRID", "Hybrid"]].map(([v, l]) => (
            <Link key={l} href={href({ mode: v || undefined })} className={chip((sp.mode ?? "") === v)}>{l}</Link>
          ))}
          <span className="mx-2 h-5 w-px bg-slate-200" />
          {[["", "Any price"], ["free", "Free"], ["paid", "Paid"]].map(([v, l]) => (
            <Link key={l} href={href({ price: v || undefined })} className={chip((sp.price ?? "") === v)}>{l}</Link>
          ))}
          <span className="mx-2 h-5 w-px bg-slate-200" />
          {[["", "Any level"], ["BEGINNER", "Beginner"], ["INTERMEDIATE", "Intermediate"], ["ADVANCED", "Advanced"]].map(([v, l]) => (
            <Link key={l} href={href({ level: v || undefined })} className={chip((sp.level ?? "") === v)}>{l}</Link>
          ))}
          <div className="ml-auto flex items-center gap-2 text-sm text-ink-faint">
            Sort:
            {[["", "Featured"], ["new", "Newest"], ["price-asc", "Price ↑"], ["price-desc", "Price ↓"]].map(([v, l]) => (
              <Link key={l} href={href({ sort: v || undefined })} className={cn("rounded-lg px-2 py-1", (sp.sort ?? "") === v ? "bg-white font-medium text-ink shadow-sm" : "hover:text-ink")}>{l}</Link>
            ))}
          </div>
        </div>

        <div className="mt-3 text-sm text-ink-faint">{courses.length} course{courses.length === 1 ? "" : "s"}{sp.q ? ` matching “${sp.q}”` : ""}</div>
        {courses.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-line bg-white">
            <EmptyState icon={<Search className="size-5" />} title="No courses match these filters" description="Try a different search or clear a filter." action={<Link href="/courses" className="text-sm font-medium text-lilac-500">Clear filters</Link>} />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => <CourseCard key={c.id} c={c} />)}
          </div>
        )}
      </section>
    </main>
  );
}
