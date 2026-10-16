import type { ReactNode } from "react";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { AppShell } from "./app-shell";

type Area = "student" | "instructor" | "admin";

const AREA_ROLES: Record<Area, Role[]> = {
  student: ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"],
  instructor: ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"],
  admin: ["ADMIN", "SUPER_ADMIN"],
};

export async function Shell({ area, children }: { area: Area; children: ReactNode }) {
  const user = await requireUser(AREA_ROLES[area]);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const links: { href: string; label: string }[] = [];
  if (area !== "admin" && (user.role === "ADMIN" || user.role === "SUPER_ADMIN")) links.push({ href: "/admin", label: "Admin console" });
  if (area !== "instructor" && user.role !== "STUDENT") links.push({ href: "/instructor", label: "Instructor workspace" });
  if (area !== "student") links.push({ href: "/dashboard", label: "Learner view" });
  return (
    <AppShell area={area} user={user} unread={unread} roleLabel={ROLE_LABEL[user.role]} switchLinks={links}>
      {children}
    </AppShell>
  );
}
