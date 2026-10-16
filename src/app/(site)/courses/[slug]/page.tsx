import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Clock, Globe2, Layers, MapPin, PlayCircle, Lock, FileText, Presentation, Link2, CalendarDays, Users, Award, ArrowRight, BarChart3 } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Avatar, CourseCover } from "@/components/ui";
import { Icon3D } from "@/components/icon-3d";
import { effectivePrice, formatBDT, formatDate, humanize } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await db.course.findUnique({ where: { slug }, select: { title: true, subtitle: true } });
  return c ? { title: c.title, description: c.subtitle ?? undefined } : {};
}

const MAT_ICON = { VIDEO: PlayCircle, PDF: FileText, SLIDE: Presentation, LINK: Link2, FILE: FileText };

export default async function CourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const course = await db.course.findUnique({
    where: { slug },
    include: {
      category: true,
      instructors: { include: { user: true }, orderBy: { isLead: "desc" } },
      lessons: { orderBy: { orderNo: "asc" }, include: { materials: { where: { visibility: { not: "HIDDEN" } }, orderBy: { orderNo: "asc" } } } },
      batches: {
        where: { status: { in: ["UPCOMING", "RUNNING"] } },
        orderBy: { startDate: "asc" },
        include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "PENDING", "COMPLETED"] } } } } } },
      },
      _count: { select: { enrollments: true, assessments: true } },
    },
  });
  const isStaff = user && user.role !== "STUDENT";
  if (!course || (course.status !== "PUBLISHED" && !isStaff)) notFound();

  const enrollment = user ? await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } }) : null;
  const enrolled = enrollment && (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED");
  const price = effectivePrice(course);
  const totalMin = course.lessons.reduce((s, l) => s + l.durationMin, 0);

  return (
    <main className="bg-paper pb-24">
      {/* Header band */}
      <section className="relative overflow-hidden bg-paper pb-20 pt-32 text-ink">
        <div className="rf-glow-top absolute inset-0 opacity-50" />
        <div className="absolute -left-20 top-10 size-96 rounded-full blur-[120px]" style={{ background: `hsl(${course.coverHue} 70% 40% / .45)` }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              <Link href="/courses" className="hover:text-ink">Courses</Link>
              <span>/</span>
              {course.category && <Link href={`/courses?category=${course.category.slug}`} className="hover:text-ink">{course.category.name}</Link>}
            </div>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{course.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-soft">{course.subtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              {[
                [Layers, humanize(course.mode)],
                [BarChart3, humanize(course.level)],
                [Clock, `${course.durationWeeks} weeks · ${Math.round(totalMin / 60)}h content`],
                [Globe2, course.language],
                [Users, `${course._count.enrollments} enrolled`],
              ].map(([I, t], i) => {
                const Ico = I as typeof Clock;
                return (
                  <span key={i} className="rf-card inline-flex items-center gap-2 rounded-full px-3.5 py-1.5">
                    <Ico className="size-4 text-lilac-500" /> {t as string}
                  </span>
                );
              })}
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {course.instructors.map((i) => <Avatar key={i.userId} name={i.user.name} color={i.user.avatarColor} size={36} />)}
              </div>
              <div className="text-sm text-ink-soft">Taught by <span className="font-medium text-ink">{course.instructors.map((i) => i.user.name).join(" & ")}</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8 pt-10">
          <section className="rounded-3xl border border-line bg-white p-8">
            <h2 className="font-display text-2xl font-semibold text-ink">What you’ll learn</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {course.outcomes.map((o) => (
                <li key={o} className="flex gap-3 text-ink-soft">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-lilac-500/20 text-lilac-500"><Check className="size-3" /></span>
                  {o}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-line bg-white p-8">
            <h2 className="font-display text-2xl font-semibold text-ink">About this course</h2>
            <p className="mt-4 leading-relaxed text-ink-soft">{course.description}</p>
            {course.requirements.length > 0 && (
              <>
                <h3 className="mt-6 font-semibold text-ink">Requirements</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">{course.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
              </>
            )}
          </section>

          <section className="rounded-3xl border border-line bg-white p-8">
            <div className="flex items-end justify-between">
              <h2 className="font-display text-2xl font-semibold text-ink">Curriculum</h2>
              <span className="text-sm text-ink-faint">{course.lessons.length} lessons · {course._count.assessments} assessments</span>
            </div>
            <ol className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {course.lessons.map((l) => (
                <li key={l.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-paper [&::-webkit-details-marker]:hidden">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper text-sm font-semibold text-ink-soft">{l.orderNo}</span>
                      <span className="flex-1 font-medium text-ink">{l.title}</span>
                      {l.isPreview && <span className="rounded-full bg-lilac-500/15 px-2 py-0.5 text-[11px] font-semibold text-lilac-500">Preview</span>}
                      <span className="text-xs text-ink-faint">{l.durationMin} min</span>
                    </summary>
                    <div className="space-y-2 bg-white px-5 pb-4 pl-[4.25rem] pt-1">
                      {l.summary && <p className="text-sm text-ink-faint">{l.summary}</p>}
                      {l.materials.map((m) => {
                        const I = MAT_ICON[m.type];
                        const open = m.visibility === "PUBLIC" || l.isPreview;
                        return (
                          <div key={m.id} className="flex items-center gap-2 text-sm text-ink-soft">
                            <I className="size-4 text-ink-faint" /> {m.title}
                            {!open && !enrolled && <Lock className="size-3.5 text-ink-faint/60" />}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-3xl border border-line bg-white p-8">
            <h2 className="font-display text-2xl font-semibold text-ink">Your instructors</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {course.instructors.map((i) => (
                <div key={i.userId} className="flex gap-4 rounded-2xl bg-paper p-5">
                  <Avatar name={i.user.name} color={i.user.avatarColor} size={52} />
                  <div>
                    <div className="font-semibold text-ink">{i.user.name}</div>
                    <div className="text-sm text-lilac-500">{i.user.headline}</div>
                    {i.user.bio && <p className="mt-2 text-sm text-ink-faint">{i.user.bio}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center gap-6 rounded-3xl border border-line bg-gradient-to-br from-white/[0.02] to-lilac-500/10 p-8">
            <Icon3D name="award" size={72} />
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Earn a verified certificate</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Complete {course.certMinProgress}% of lessons, attend {course.certMinAttendance}% of classes
                {course.certRequirePass ? " and pass every assessment" : ""}. Each certificate has a public verification link.
              </p>
            </div>
          </section>
        </div>

        {/* Sticky enroll card */}
        <aside className="lg:-mt-48">
          <div className="sticky top-24 overflow-hidden rounded-3xl border border-line bg-white shadow-2xl shadow-[#2e1078]/10">
            <CourseCover soft hue={course.coverHue} title={course.title} className="h-48" />
            <div className="p-6">
              <div className="flex items-end gap-2">
                <span className="font-display text-3xl font-semibold text-ink">{formatBDT(price)}</span>
                {price < course.price && <span className="pb-1 text-ink-faint line-through">{formatBDT(course.price)}</span>}
              </div>
              {enrolled ? (
                <Link href={`/dashboard/courses/${course.id}`} className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl bg-lilac-500/80 font-semibold text-white hover:bg-lilac-500">
                  Continue learning <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <h3 className="mt-6 text-sm font-semibold text-ink">Choose a batch</h3>
                  <div className="mt-3 space-y-2">
                    {course.batches.length === 0 && <p className="text-sm text-ink-faint">No open batches right now — check back soon.</p>}
                    {course.batches.map((b) => {
                      const left = b.capacity - b._count.enrollments;
                      return (
                        <Link
                          key={b.id}
                          href={left > 0 ? `/checkout/${course.slug}?batch=${b.id}` : "#"}
                          aria-disabled={left <= 0}
                          className="group block rounded-2xl border border-line p-4 transition hover:border-lilac-300/60 hover:bg-lilac-500/[0.05] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-ink">{b.name}</span>
                            <ArrowRight className="size-4 text-ink-faint/60 transition group-hover:translate-x-0.5 group-hover:text-lilac-500" />
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-ink-faint">
                            <div className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Starts {formatDate(b.startDate)} · {b.scheduleText}</div>
                            {b.venue && <div className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {b.venue}</div>}
                            <div className={left <= 5 ? "font-medium text-sun-600" : ""}>{left > 0 ? `${left} seats left` : "Batch full"}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                  {enrollment?.status === "PENDING" && (
                    <Link href="/dashboard/payments" className="mt-4 block rounded-xl bg-amber-50 p-3 text-center text-sm text-amber-800">You have a pending payment for this course →</Link>
                  )}
                </>
              )}
              <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm text-ink-soft">
                <li className="flex items-center gap-2.5"><PlayCircle className="size-4 text-lilac-500" /> Live classes &amp; recordings</li>
                <li className="flex items-center gap-2.5"><FileText className="size-4 text-lilac-500" /> Daily PDF notes &amp; slides</li>
                <li className="flex items-center gap-2.5"><Award className="size-4 text-lilac-500" /> Verified certificate</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
