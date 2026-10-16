import Link from "next/link";
import { Clock, Users, BookOpen } from "lucide-react";
import { CourseCover } from "./ui";
import { effectivePrice, formatBDT } from "@/lib/utils";

export type CardCourse = {
  slug: string;
  title: string;
  subtitle: string | null;
  coverHue: number;
  mode: string;
  level: string;
  price: number;
  salePrice: number | null;
  durationWeeks: number;
  category: { name: string } | null;
  instructors: { user: { name: string } }[];
  _count: { lessons: number; enrollments: number };
};

export function CourseCard({ c }: { c: CardCourse }) {
  const price = effectivePrice(c);
  return (
    <Link
      href={`/courses/${c.slug}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#2e1078]/10"
    >
      <div className="relative h-44 overflow-hidden">
        <CourseCover soft hue={c.coverHue} title={c.title} className="absolute inset-0 transition duration-700 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold capitalize text-ink backdrop-blur">{c.mode.toLowerCase()}</span>
          {price === 0 && <span className="rounded-full bg-lilac-300 px-2.5 py-1 text-[11px] font-semibold text-void">Free</span>}
          {c.salePrice != null && c.salePrice < c.price && (
            <span className="rounded-full bg-sun-500 px-2.5 py-1 text-[11px] font-semibold text-white">-{Math.round(100 - (c.salePrice / c.price) * 100)}%</span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-lilac-500">{c.category?.name}</div>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug text-ink group-hover:text-lilac-500">{c.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-faint">{c.subtitle}</p>
        {c.instructors[0] && <div className="mt-3 text-xs text-ink-faint">by {c.instructors.map((i) => i.user.name).join(", ")}</div>}
        <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-xs text-ink-faint">
          <div className="flex gap-3">
            <span className="flex items-center gap-1"><Clock className="size-3.5" />{c.durationWeeks}w</span>
            <span className="flex items-center gap-1"><BookOpen className="size-3.5" />{c._count.lessons}</span>
            <span className="flex items-center gap-1"><Users className="size-3.5" />{c._count.enrollments}</span>
          </div>
          <div className="text-right">
            {c.salePrice != null && c.salePrice < c.price && <span className="mr-1.5 text-ink-faint line-through">{formatBDT(c.price)}</span>}
            <span className="font-display text-base font-semibold text-ink">{formatBDT(price)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
