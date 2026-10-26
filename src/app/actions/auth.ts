"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import crypto from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { renderEmail, sendEmail } from "@/lib/email";
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
  const user = await requireUser();
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
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await audit(user.id, "user.password_change", "User", user.id);
  return { ok: true, message: "Password updated." };
}

// ───────── password reset ─────────

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Emails a one-time reset link. Always answers the same way so it can't be used to discover accounts. */
export async function requestPasswordReset(_: ActionResult, form: FormData): Promise<ActionResult> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  const done: ActionResult = { ok: true, message: "If an account exists for that email, a reset link is on its way. It expires in 30 minutes." };
  if (!rateLimit(`reset:${await clientKey()}`, 5, 60 * 60 * 1000).ok || !rateLimit(`reset:${email}`, 3, 60 * 60 * 1000).ok) return done;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status === "SUSPENDED") return done;
  const token = crypto.randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  await sendEmail({
    to: user.email,
    subject: "Reset your DoB Hub password",
    ...renderEmail({
      name: user.name,
      title: "Reset your password",
      body: "Someone (hopefully you) asked to reset the password for this account. The link works once and expires in 30 minutes. If you didn't ask for this, you can ignore this email.",
      cta: { label: "Choose a new password", path: `/reset-password?token=${token}` },
    }),
  });
  await audit(user.id, "user.password_reset_request", "User", user.id);
  return done;
}

export async function resetPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8 || password.length > 100) return { error: "Password must be at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  if (!rateLimit(`reset-use:${await clientKey()}`, 10, 60 * 60 * 1000).ok) return { error: "Too many attempts. Try again later." };

  const reset = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || reset.user.status === "SUSPENDED") {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }
  const now = new Date();
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password), sessionsValidFrom: now } }),
    db.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  await audit(reset.userId, "user.password_reset", "User", reset.userId);
  await destroySession();
  redirect("/login?reset=1");
}
