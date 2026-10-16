import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { getSettings } from "@/lib/settings";
import { effectivePrice } from "@/lib/utils";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, courses, categories, settings] = await Promise.all([
    getCurrentUser(),
    db.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
      take: 6,
      include: { category: true },
    }),
    db.category.findMany({ include: { _count: { select: { courses: { where: { status: "PUBLISHED" } } } } }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  return (
    <>
      <SiteNav
        user={user ? { name: user.name, home: homeFor(user.role) } : null}
        courses={courses.map((c) => ({ slug: c.slug, title: c.title, hue: c.coverHue, mode: c.mode, price: effectivePrice(c), category: c.category?.name ?? null }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon, count: c._count.courses }))}
      />
      {children}
      <SiteFooter supportEmail={settings.supportEmail} supportPhone={settings.supportPhone} />
    </>
  );
}
