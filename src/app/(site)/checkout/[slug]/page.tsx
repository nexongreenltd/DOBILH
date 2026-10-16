import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Layers } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CheckoutForm } from "@/components/checkout-form";
import { CourseCover } from "@/components/ui";
import { effectivePrice, formatDate, humanize } from "@/lib/utils";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ batch?: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const { batch: batchId } = await searchParams;
  const course = await db.course.findUnique({ where: { slug }, include: { batches: { where: { status: { in: ["UPCOMING", "RUNNING"] } }, orderBy: { startDate: "asc" } } } });
  if (!course || course.status !== "PUBLISHED") notFound();
  const enrollment = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (enrollment && (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED")) redirect(`/dashboard/courses/${course.id}`);
  const batch = course.batches.find((b) => b.id === batchId) ?? course.batches[0];
  if (!batch) redirect(`/courses/${slug}`);

  return (
    <main className="bg-paper min-h-screen pb-24 pt-28">
      <div className="mx-auto grid max-w-5xl gap-8 px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="text-[13px] text-ink-faint">Checkout</div>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink">Complete your enrollment</h1>
          <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-white">
            <CourseCover soft hue={course.coverHue} title={course.title} className="h-40" />
            <div className="space-y-3 p-6">
              <h2 className="font-display text-xl font-semibold text-ink">{course.title}</h2>
              <div className="space-y-2 text-sm text-ink-soft">
                <div className="flex items-center gap-2"><Layers className="size-4 text-lilac-500" /> {batch.name} · {humanize(batch.mode)}</div>
                <div className="flex items-center gap-2"><CalendarDays className="size-4 text-lilac-500" /> {formatDate(batch.startDate)} – {formatDate(batch.endDate)} · {batch.scheduleText}</div>
                {batch.venue && <div className="flex items-center gap-2"><MapPin className="size-4 text-lilac-500" /> {batch.venue}</div>}
              </div>
              {course.batches.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {course.batches.map((b) => (
                    <a key={b.id} href={`?batch=${b.id}`} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${b.id === batch.id ? "bg-lilac-500/80 text-white" : "bg-lilac-500/[0.06] text-lilac-500"}`}>{b.name}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:pt-16">
          <CheckoutForm courseId={course.id} batchId={batch.id} price={effectivePrice(course)} />
        </div>
      </div>
    </main>
  );
}
