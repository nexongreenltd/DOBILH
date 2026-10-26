import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./session";
import { ROLE_RANK } from "./rbac";

export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "status" | "avatarColor" | "phone" | "headline">;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(user: Pick<User, "id" | "role" | "name">) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the session cookie and re-reads them from the
 * database, so role changes and suspensions take effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true, role: true, status: true, avatarColor: true, phone: true, headline: true, sessionsValidFrom: true },
  });
  if (!user || user.status === "SUSPENDED") return null;
  // Sessions issued before a password reset are no longer valid.
  const issuedAt = (session as { iat?: number }).iat ?? 0;
  if (user.sessionsValidFrom && issuedAt < Math.floor(user.sessionsValidFrom.getTime() / 1000)) return null;
  return user;
});

/** Server-side authorization guard for pages and actions. */
export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  // A validly signed cookie for a deleted or suspended user must be cleared first; otherwise
  // middleware bounces /login straight back here and the browser loops.
  if (!user) redirect((await cookies()).has(SESSION_COOKIE) ? "/api/auth/reset" : "/login");
  if (roles && !roles.includes(user.role)) redirect("/forbidden");
  return user;
}

export async function requireMinRole(min: Role) {
  const user = await requireUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[min]) redirect("/forbidden");
  return user;
}

export const requireAdmin = () => requireUser(["ADMIN", "SUPER_ADMIN"]);
export const requireSuperAdmin = () => requireUser(["SUPER_ADMIN"]);
export const requireStaffOrInstructor = () => requireUser(["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"]);

/** Instructors may only manage courses they are mapped to; admins manage all. */
export async function assertCanManageCourse(user: CurrentUser, courseId: string) {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return;
  const link = await db.courseInstructor.findUnique({ where: { courseId_userId: { courseId, userId: user.id } } });
  if (!link) redirect("/forbidden");
}
