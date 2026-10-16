"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import type { ActionResult } from "@/lib/action";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const email = parsed.data.email.toLowerCase();

  const rl = rateLimit(`login:${await clientKey()}:${email}`, 8, 10 * 60 * 1000);
  if (!rl.ok) return { error: `Too many attempts. Try again in ${Math.ceil(rl.retryAfter / 60)} min.` };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Email or password is incorrect." };
  }
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Please contact support." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user);
  redirect(safeNext(form.get("next")) ?? homeFor(user.role));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z.string().trim().email("Enter a valid email."),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?880|0)1[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number.")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
});

const COLORS = ["#006a4e", "#0e7490", "#7c3aed", "#c2410c", "#be123c", "#1d4ed8", "#047857", "#a16207"];

export async function register(_: ActionResult, form: FormData): Promise<ActionResult> {
  const settings = await getSettings();
  if (!settings.allowSelfRegistration) return { error: "Registration is currently closed." };

  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  const rl = rateLimit(`register:${await clientKey()}`, 5, 60 * 60 * 1000);
  if (!rl.ok) return { error: "Too many sign-ups from this network. Please try again later." };

  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists." };

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone || null,
      passwordHash: await hashPassword(parsed.data.password),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  });
  await notify(user.id, {
    type: "welcome",
    title: "Welcome to DoB Innovation & Learning Hub",
    body: "Browse the catalogue and enroll in your first course to get started.",
    link: "/courses",
  });
  await audit(user.id, "user.register", "User", user.id);
  await createSession(user);
  redirect(safeNext(form.get("next")) ?? "/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
});

export async function updateProfile(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      headline: parsed.data.headline || null,
      bio: parsed.data.bio || null,
    },
  });
  return { ok: true, message: "Profile saved." };
}

export async function changePassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(user.id, "user.password_change", "User", user.id);
  return { ok: true, message: "Password updated." };
}
