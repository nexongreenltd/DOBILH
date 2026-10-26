"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CourseLevel, CourseMode, CourseStatus, BatchStatus, Role, UserStatus, DiscountType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, requireSuperAdmin, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notify";
import { settlePayment, invoiceNo } from "@/lib/payments";
import { certificateEligibility, issueCertificate } from "@/lib/learning";
import { setSetting } from "@/lib/settings";
import { str, optStr, int, slugify, fromLocalInput } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

const PRIVILEGED: Role[] = ["ADMIN", "SUPER_ADMIN"];

// ───────── Users & roles ─────────

const userSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.enum(["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"]),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
});

export async function createUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = userSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (PRIVILEGED.includes(parsed.data.role) && actor.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can create administrators." };
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return { error: "A user with this email already exists." };
  const user = await db.user.create({
    data: { name: parsed.data.name, email, role: parsed.data.role, phone: optStr(form, "phone"), headline: optStr(form, "headline"), passwordHash: await hashPassword(parsed.data.password) },
  });
  await audit(actor.id, "user.create", "User", user.id, { role: user.role });
  revalidatePath("/admin/users");
  return { ok: true, message: `${user.name} created.` };
}

export async function updateUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const target = await db.user.findUnique({ where: { id: str(form, "userId") } });
  if (!target) return { error: "User not found." };
  const role = str(form, "role") as Role;
  const status = str(form, "status") as UserStatus;
  const touchesPrivilege = PRIVILEGED.includes(target.role) || PRIVILEGED.includes(role);
  if (touchesPrivilege && actor.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can change administrator accounts." };
  if (target.id === actor.id && (role !== target.role || status !== "ACTIVE")) return { error: "You can't change your own role or suspend yourself." };
  await db.user.update({
    where: { id: target.id },
    data: { name: str(form, "name") || target.name, role, status, phone: optStr(form, "phone"), headline: optStr(form, "headline") },
  });
  await audit(actor.id, "user.update", "User", target.id, { from: { role: target.role, status: target.status }, to: { role, status } });
  revalidatePath(`/admin/users/${target.id}`);
  return { ok: true, message: "User updated." };
}

export async function resetUserPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const target = await db.user.findUnique({ where: { id: str(form, "userId") } });
  if (!target) return { error: "User not found." };
  if (PRIVILEGED.includes(target.role) && actor.role !== "SUPER_ADMIN") return { error: "Only a Super Admin can reset administrator passwords." };
  const pw = str(form, "password");
  if (pw.length < 8) return { error: "Password must be at least 8 characters." };
  await db.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(pw) } });
  await audit(actor.id, "user.password_reset", "User", target.id);
  return { ok: true, message: "Password reset. Share it with the user securely." };
}

// ───────── Courses ─────────

const courseSchema = z.object({
  title: z.string().trim().min(3),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10, "Add a fuller description."),
  mode: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  price: z.coerce.number().int().min(0),
  durationWeeks: z.coerce.number().int().min(1).max(104),
});

function lines(v: string) {
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function createCourse(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = courseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  let slug = slugify(parsed.data.title);
  if (await db.course.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
  const course = await db.course.create({
    data: {
      ...parsed.data,
      mode: parsed.data.mode as CourseMode,
      level: parsed.data.level as CourseLevel,
      slug,
      categoryId: optStr(form, "categoryId"),
      coverHue: Math.floor(Math.random() * 360),
      outcomes: lines(str(form, "outcomes")),
      requirements: lines(str(form, "requirements")),
    },
  });
  const instructorId = optStr(form, "instructorId");
  if (instructorId) await db.courseInstructor.create({ data: { courseId: course.id, userId: instructorId, isLead: true } });
  await audit(actor.id, "course.create", "Course", course.id, { title: course.title });
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const course = await db.course.findUnique({ where: { id: str(form, "courseId") } });
  if (!course) return { error: "Course not found." };
  const parsed = courseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const salePrice = optStr(form, "salePrice");
  const sale = salePrice ? parseInt(salePrice, 10) : null;
  if (sale != null && (isNaN(sale) || sale >= parsed.data.price)) return { error: "Sale price must be lower than the regular price." };
  await db.course.update({
    where: { id: course.id },
    data: {
      ...parsed.data,
      mode: parsed.data.mode as CourseMode,
      level: parsed.data.level as CourseLevel,
      salePrice: sale,
      categoryId: optStr(form, "categoryId"),
      language: str(form, "language") || course.language,
      coverHue: int(form, "coverHue", course.coverHue),
      featured: form.get("featured") === "on",
      outcomes: lines(str(form, "outcomes")),
      requirements: lines(str(form, "requirements")),
      certMinProgress: int(form, "certMinProgress", course.certMinProgress),
      certMinAttendance: int(form, "certMinAttendance", course.certMinAttendance),
      certRequirePass: form.get("certRequirePass") === "on",
    },
  });
  await audit(actor.id, "course.update", "Course", course.id, { price: parsed.data.price, salePrice: sale });
  revalidatePath(`/admin/courses/${course.id}`);
  return { ok: true, message: "Course saved." };
}

export async function setCourseStatus(form: FormData) {
  const actor = await requireAdmin();
  const status = str(form, "status") as CourseStatus;
  if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) return;
  const course = await db.course.update({ where: { id: str(form, "courseId") }, data: { status } });
  await audit(actor.id, `course.${status.toLowerCase()}`, "Course", course.id);
  revalidatePath(`/admin/courses/${course.id}`);
  revalidatePath("/admin/courses");
}

export async function addInstructor(form: FormData) {
  const actor = await requireAdmin();
  const courseId = str(form, "courseId");
  const userId = str(form, "userId");
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || u.role === "STUDENT") return;
  await db.courseInstructor.upsert({ where: { courseId_userId: { courseId, userId } }, create: { courseId, userId, isLead: form.get("isLead") === "on" }, update: { isLead: form.get("isLead") === "on" } });
  await notify(userId, { type: "announcement", title: "You’ve been assigned to a course", body: "Open your instructor workspace to start building lessons.", link: `/instructor/courses/${courseId}` });
  await audit(actor.id, "course.instructor_add", "Course", courseId, { userId });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function removeInstructor(form: FormData) {
  const actor = await requireAdmin();
  const courseId = str(form, "courseId");
  const userId = str(form, "userId");
  await db.courseInstructor.deleteMany({ where: { courseId, userId } });
  await audit(actor.id, "course.instructor_remove", "Course", courseId, { userId });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createCategory(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const name = str(form, "name");
  if (name.length < 2) return { error: "Enter a category name." };
  if (await db.category.findUnique({ where: { name } })) return { error: "That category already exists." };
  const c = await db.category.create({ data: { name, slug: slugify(name), icon: str(form, "icon") || "sparkles" } });
  await audit(actor.id, "category.create", "Category", c.id);
  revalidatePath("/admin/courses");
  return { ok: true, message: "Category added." };
}

// ───────── Batches ─────────

export async function saveBatch(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const courseId = str(form, "courseId");
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) return { error: "Choose a course." };
  const startDate = fromLocalInput(`${str(form, "startDate")}T00:00`);
  const endDate = fromLocalInput(`${str(form, "endDate")}T23:59`);
  if (!startDate || !endDate || endDate < startDate) return { error: "Enter a valid start and end date." };
  const data = {
    courseId,
    name: str(form, "name") || "New batch",
    mode: (str(form, "mode") as CourseMode) || course.mode,
    startDate,
    endDate,
    scheduleText: optStr(form, "scheduleText"),
    venue: optStr(form, "venue"),
    capacity: int(form, "capacity", 40),
    status: (str(form, "status") as BatchStatus) || "UPCOMING",
  };
  const batchId = optStr(form, "batchId");
  if (batchId) {
    await db.batch.update({ where: { id: batchId }, data });
    await audit(actor.id, "batch.update", "Batch", batchId);
  } else {
    const count = await db.batch.count();
    const code = `${course.slug.split("-").slice(0, 3).map((w) => w[0]).join("").toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
    const b = await db.batch.create({ data: { ...data, code } });
    await audit(actor.id, "batch.create", "Batch", b.id, { courseId });
  }
  revalidatePath("/admin/batches");
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true, message: batchId ? "Batch updated." : "Batch created." };
}

// ───────── Enrollments & payments ─────────

export async function manualEnroll(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const student = await db.user.findUnique({ where: { email } });
  if (!student) return { error: "No user with that email." };
  const batch = await db.batch.findUnique({ where: { id: str(form, "batchId") }, include: { course: true } });
  if (!batch) return { error: "Choose a batch." };
  const amount = int(form, "amount", 0);
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId: student.id, courseId: batch.courseId } } });
  if (existing && existing.status === "ACTIVE") return { error: "This learner is already enrolled." };
  const enrollment = existing
    ? await db.enrollment.update({ where: { id: existing.id }, data: { batchId: batch.id, status: "PENDING" } })
    : await db.enrollment.create({ data: { userId: student.id, courseId: batch.courseId, batchId: batch.id, status: "PENDING" } });
  const payment = await db.payment.create({
    data: { invoiceNo: invoiceNo(), enrollmentId: enrollment.id, userId: student.id, originalAmount: amount, amount, method: amount ? "MANUAL" : "FREE", gateway: "manual", note: optStr(form, "note") },
  });
  await settlePayment(payment.id, { gatewayRef: `MANUAL-${actor.id.slice(-6)}`, actorId: actor.id });
  await audit(actor.id, "enrollment.manual", "Enrollment", enrollment.id, { amount });
  revalidatePath("/admin/enrollments");
  return { ok: true, message: `${student.name} enrolled in ${batch.course.title}.` };
}

export async function updateEnrollment(form: FormData) {
  const actor = await requireAdmin();
  const e = await db.enrollment.findUnique({ where: { id: str(form, "enrollmentId") } });
  if (!e) return;
  const action = str(form, "action");
  if (action === "cancel") await db.enrollment.update({ where: { id: e.id }, data: { status: "CANCELLED" } });
  if (action === "activate") await db.enrollment.update({ where: { id: e.id }, data: { status: "ACTIVE" } });
  if (action === "move") {
    const batchId = str(form, "batchId");
    const b = await db.batch.findFirst({ where: { id: batchId, courseId: e.courseId } });
    if (b) await db.enrollment.update({ where: { id: e.id }, data: { batchId } });
  }
  await audit(actor.id, `enrollment.${action}`, "Enrollment", e.id);
  revalidatePath("/admin/enrollments");
}

export async function adminPaymentAction(form: FormData) {
  const actor = await requireAdmin();
  const p = await db.payment.findUnique({ where: { id: str(form, "paymentId") }, include: { enrollment: { include: { course: true } } } });
  if (!p) return;
  const action = str(form, "action");
  if (action === "verify" && p.status === "PENDING") {
    await settlePayment(p.id, { gatewayRef: optStr(form, "ref") ?? `VERIFIED-${Date.now().toString(36).toUpperCase()}`, actorId: actor.id });
  }
  if (action === "refund" && p.status === "PAID") {
    await db.$transaction([
      db.payment.update({ where: { id: p.id }, data: { status: "REFUNDED", note: optStr(form, "note") ?? "Refunded by admin" } }),
      db.enrollment.update({ where: { id: p.enrollmentId }, data: { status: "CANCELLED" } }),
    ]);
    await notify(p.userId, { type: "payment", title: "Refund processed", body: `Your payment ${p.invoiceNo} for ${p.enrollment.course.title} has been refunded.`, link: "/dashboard/payments", email: true });
    await audit(actor.id, "payment.refund", "Payment", p.id, { amount: p.amount });
  }
  if (action === "cancel" && p.status === "PENDING") {
    await db.payment.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
    await audit(actor.id, "payment.cancel", "Payment", p.id);
  }
  revalidatePath("/admin/payments");
}

// ───────── Coupons ─────────

export async function createCoupon(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const code = str(form, "code").toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { error: "Codes are 3–24 letters, numbers, - or _." };
  if (await db.coupon.findUnique({ where: { code } })) return { error: "That code already exists." };
  const type = str(form, "discountType") as DiscountType;
  const value = int(form, "discountValue", 0);
  if (value <= 0 || (type === "PERCENT" && value > 100)) return { error: "Enter a valid discount value." };
  const c = await db.coupon.create({
    data: {
      code, description: optStr(form, "description"), discountType: type, discountValue: value, courseId: optStr(form, "courseId"),
      maxUses: optStr(form, "maxUses") ? int(form, "maxUses") : null, perUserLimit: int(form, "perUserLimit", 1),
      validFrom: fromLocalInput(str(form, "validFrom")), validUntil: fromLocalInput(str(form, "validUntil")),
    },
  });
  await audit(actor.id, "coupon.create", "Coupon", c.id, { code });
  revalidatePath("/admin/coupons");
  return { ok: true, message: `Coupon ${code} created.` };
}

export async function toggleCoupon(form: FormData) {
  const actor = await requireAdmin();
  const c = await db.coupon.findUnique({ where: { id: str(form, "couponId") } });
  if (!c) return;
  await db.coupon.update({ where: { id: c.id }, data: { active: !c.active } });
  await audit(actor.id, c.active ? "coupon.disable" : "coupon.enable", "Coupon", c.id);
  revalidatePath("/admin/coupons");
}

// ───────── Certificates ─────────

export async function adminIssueCertificate(form: FormData) {
  const actor = await requireAdmin();
  const enrollment = await db.enrollment.findUnique({ where: { id: str(form, "enrollmentId") } });
  if (!enrollment) return;
  const force = str(form, "force") === "1";
  if (!force) {
    const elig = await certificateEligibility(enrollment.userId, enrollment.courseId);
    if (!elig?.eligible) redirect("/admin/certificates?error=not-eligible");
  }
  await issueCertificate(enrollment.id, actor.id);
  if (force) await audit(actor.id, "certificate.override", "Enrollment", enrollment.id);
  revalidatePath("/admin/certificates");
}

export async function revokeCertificate(form: FormData) {
  const actor = await requireAdmin();
  const c = await db.certificate.findUnique({ where: { id: str(form, "certificateId") } });
  if (!c) return;
  const reason = str(form, "reason") || "Revoked by administrator";
  await db.certificate.update({ where: { id: c.id }, data: { status: c.status === "VALID" ? "REVOKED" : "VALID", revokedReason: c.status === "VALID" ? reason : null } });
  await audit(actor.id, c.status === "VALID" ? "certificate.revoke" : "certificate.restore", "Certificate", c.id, { reason });
  revalidatePath("/admin/certificates");
}

// ───────── AI assistant ─────────

export async function saveKnowledge(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const question = str(form, "question");
  const answer = str(form, "answer");
  if (!question || !answer) return { error: "Question and answer are required." };
  const data = {
    question,
    answer,
    courseId: optStr(form, "courseId"),
    keywords: str(form, "keywords").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
    status: str(form, "status") === "DRAFT" ? ("DRAFT" as const) : ("ACTIVE" as const),
  };
  const id = optStr(form, "id");
  if (id) await db.aiKnowledge.update({ where: { id }, data });
  else await db.aiKnowledge.create({ data });
  const fromMessage = optStr(form, "fromMessageId");
  if (fromMessage) await db.aiMessage.update({ where: { id: fromMessage }, data: { reviewedAt: new Date() } });
  await audit(actor.id, id ? "ai.knowledge_update" : "ai.knowledge_create", "AiKnowledge", id);
  revalidatePath("/admin/ai");
  return { ok: true, message: "Knowledge saved." };
}

export async function deleteKnowledge(form: FormData) {
  const actor = await requireAdmin();
  const id = str(form, "id");
  await db.aiKnowledge.delete({ where: { id } });
  await audit(actor.id, "ai.knowledge_delete", "AiKnowledge", id);
  revalidatePath("/admin/ai");
}

export async function dismissReview(form: FormData) {
  await requireAdmin();
  await db.aiMessage.update({ where: { id: str(form, "id") }, data: { reviewedAt: new Date() } });
  revalidatePath("/admin/ai");
}

export async function toggleAi(form: FormData) {
  const actor = await requireAdmin();
  const key = str(form, "key") === "aiGenerative" ? "aiGenerative" : "aiEnabled";
  const value = str(form, "value") === "true";
  await setSetting(key, value);
  await audit(actor.id, "settings.update", "Setting", key, { value });
  revalidatePath("/admin/ai");
}

// ───────── Announcements ─────────

export async function platformAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const title = str(form, "title");
  const body = str(form, "body");
  if (!title || !body) return { error: "Add a title and message." };
  const audience = str(form, "audience");
  const courseId = optStr(form, "courseId");
  let ids: string[];
  if (courseId) {
    ids = (await db.enrollment.findMany({ where: { courseId, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { userId: true } })).map((e) => e.userId);
    await db.announcement.create({ data: { authorId: actor.id, courseId, title, body } });
  } else {
    const roles: Role[] = audience === "instructors" ? ["INSTRUCTOR"] : audience === "everyone" ? ["STUDENT", "INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] : ["STUDENT"];
    ids = (await db.user.findMany({ where: { role: { in: roles }, status: "ACTIVE" }, select: { id: true } })).map((u) => u.id);
    await db.announcement.create({ data: { authorId: actor.id, title, body } });
  }
  await notifyMany(ids, { type: "announcement", title, body: body.slice(0, 160), link: "/dashboard/notifications", email: form.get("sendEmail") === "on" });
  await audit(actor.id, "announcement.platform", "Announcement", null, { audience, courseId, recipients: ids.length });
  revalidatePath("/admin/announcements");
  return { ok: true, message: `Sent to ${ids.length} people.` };
}

// ───────── Settings (Super Admin) ─────────

export async function saveSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireSuperAdmin();
  await setSetting("siteName", str(form, "siteName"));
  await setSetting("supportEmail", str(form, "supportEmail"));
  await setSetting("supportPhone", str(form, "supportPhone"));
  await setSetting("certificateSignatory", str(form, "certificateSignatory"));
  await setSetting("certificateSignatoryTitle", str(form, "certificateSignatoryTitle"));
  await setSetting("allowSelfRegistration", form.get("allowSelfRegistration") === "on");
  await setSetting("aiEnabled", form.get("aiEnabled") === "on");
  await setSetting("aiGenerative", form.get("aiGenerative") === "on");
  // Live class policy
  const clamp = (k: string, min: number, max: number, d: number) => Math.min(max, Math.max(min, int(form, k, d)));
  await setSetting("liveHostEarlyMinutes", clamp("liveHostEarlyMinutes", 0, 240, 30));
  await setSetting("liveJoinEarlyMinutes", clamp("liveJoinEarlyMinutes", 0, 120, 15));
  await setSetting("liveLateAfterMinutes", clamp("liveLateAfterMinutes", 0, 120, 10));
  await setSetting("livePresentPercent", clamp("livePresentPercent", 1, 100, 60));
  await setSetting("replayRetentionDays", clamp("replayRetentionDays", 0, 3650, 90));
  await setSetting("replayScope", str(form, "replayScope") === "COURSE" ? "COURSE" : "BATCH");
  await setSetting("liveRecordingEnabled", form.get("liveRecordingEnabled") === "on");
  await setSetting("liveChatEnabled", form.get("liveChatEnabled") === "on");
  const instructions = str(form, "paymentInstructions").slice(0, 1000);
  if (instructions) await setSetting("paymentInstructions", instructions);
  await audit(actor.id, "settings.update", "Setting", null);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved." };
}

// ───────── Live classes ─────────

/** Hide or re-show a published class replay without deleting it. */
export async function toggleReplay(form: FormData) {
  const actor = await requireAdmin();
  const m = await db.material.findUnique({ where: { id: str(form, "materialId") } });
  if (!m) return;
  const visibility = m.visibility === "HIDDEN" ? "ENROLLED" : "HIDDEN";
  await db.material.update({ where: { id: m.id }, data: { visibility } });
  await audit(actor.id, visibility === "HIDDEN" ? "live.replay_hide" : "live.replay_show", "Material", m.id);
  revalidatePath("/admin/live");
}
