import type { Role } from "@prisma/client";

export const ROLE_RANK: Record<Role, number> = {
  STUDENT: 0,
  INSTRUCTOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: "Student",
  INSTRUCTOR: "Instructor",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export function isStaff(role: Role) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Where each role lands after signing in. */
export function homeFor(role: Role) {
  if (isStaff(role)) return "/admin";
  if (role === "INSTRUCTOR") return "/instructor";
  return "/dashboard";
}

/** Route prefixes and the roles allowed through them. Enforced in middleware and again server-side. */
export const ROUTE_RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN", "SUPER_ADMIN"] },
  { prefix: "/instructor", roles: ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/dashboard", roles: ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/checkout", roles: ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/pay", roles: ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
  { prefix: "/live", roles: ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] },
];
