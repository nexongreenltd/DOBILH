import { db } from "@/lib/db";
import { effectivePrice } from "@/lib/utils";
import { Hero } from "@/components/landing/hero";
import { Features, AiSection, Connected, LearnAnywhere, Programs, Testimonials, About, Cta, type LandingCourse } from "@/components/landing/sections";
import { Faq } from "@/components/landing/faq";

export const revalidate = 300;

export default async function Home() {
  const [courses, learners, sessions, certificates, live] = await Promise.all([
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
      include: { category: true, instructors: { where: { isLead: true }, include: { user: { select: { name: true } } } }, _count: { select: { lessons: true } } },
    }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.classSession.count({ where: { status: { not: "CANCELLED" } } }),
    db.certificate.count({ where: { status: "VALID" } }),
    db.classSession.findFirst({ where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, include: { batch: { include: { course: true } } } }),
  ]);

  const list: LandingCourse[] = courses.map((c) => ({
    slug: c.slug, title: c.title, subtitle: c.subtitle, hue: c.coverHue, mode: c.mode, level: c.level,
    price: effectivePrice(c), originalPrice: c.price, weeks: c.durationWeeks, category: c.category?.name ?? null,
    instructor: c.instructors[0]?.user.name ?? null, lessons: c._count.lessons,
  }));
  const paid = list.filter((c) => c.price > 0);

  return (
    <main className="bg-paper text-ink">
      <Hero learners={learners} liveTitle={live ? `${live.title} — ${live.batch.course.title}` : "New classes every week"} />
      <Features />
      <AiSection />
      <Connected />
      <LearnAnywhere />
      <Programs courses={paid} freeCourse={list.find((c) => c.price === 0) ?? null} fromPrice={paid.length ? Math.min(...paid.map((c) => c.price)) : 0} />
      <Testimonials />
      <About stats={{ learners, courses: courses.length, sessions, certificates }} />
      <Faq />
      <Cta />
    </main>
  );
}
