"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { invoiceNo, quote, settlePayment, verifyCallback } from "@/lib/payments";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { str } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";
import type { PaymentMethod } from "@prisma/client";

const METHODS: PaymentMethod[] = ["BKASH", "NAGAD", "ROCKET", "CARD"];

/** Re-quotes a coupon for the checkout page preview (amount is always recomputed server-side at checkout). */
type CouponResult = { ok?: boolean; error?: string; message?: string; discount?: number; amount?: number } | undefined;

export async function previewCoupon(_: CouponResult, form: FormData): Promise<CouponResult> {
  const user = await requireUser();
  const course = await db.course.findUnique({ where: { id: str(form, "courseId") } });
  if (!course) return { error: "Course not found." };
  const q = await quote(course, user.id, str(form, "coupon"));
  if (q.error) return { error: q.error };
  return { ok: true, message: `Coupon applied — you save ৳${q.discount.toLocaleString("en-IN")}.`, discount: q.discount, amount: q.amount };
}

export async function checkout(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const course = await db.course.findUnique({ where: { id: str(form, "courseId") } });
  if (!course || course.status !== "PUBLISHED") return { error: "This course isn't available for enrollment." };

  const batchId = str(form, "batchId");
  const batch = await db.batch.findFirst({
    where: { id: batchId, courseId: course.id, status: { in: ["UPCOMING", "RUNNING"] } },
    include: { _count: { select: { enrollments: { where: { status: { in: ["ACTIVE", "COMPLETED", "PENDING"] } } } } } },
  });
  if (!batch) return { error: "Please choose an open batch." };

  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
  if (existing && (existing.status === "ACTIVE" || existing.status === "COMPLETED")) redirect(`/dashboard/courses/${course.id}`);
  const takenByOthers = batch._count.enrollments - (existing?.batchId === batch.id ? 1 : 0);
  if (takenByOthers >= batch.capacity) return { error: "This batch is full. Please choose another batch." };

  const q = await quote(course, user.id, str(form, "coupon") || null);
  if (q.error) return { error: q.error };

  const methodRaw = str(form, "method") as PaymentMethod;
  const method: PaymentMethod = q.amount === 0 ? "FREE" : METHODS.includes(methodRaw) ? methodRaw : "BKASH";

  const enrollment = existing
    ? await db.enrollment.update({ where: { id: existing.id }, data: { batchId: batch.id, status: "PENDING" } })
    : await db.enrollment.create({ data: { userId: user.id, courseId: course.id, batchId: batch.id, status: "PENDING" } });

  // Supersede any stale pending payment for this enrollment.
  await db.payment.updateMany({ where: { enrollmentId: enrollment.id, status: "PENDING" }, data: { status: "CANCELLED" } });

  const payment = await db.payment.create({
    data: {
      invoiceNo: invoiceNo(),
      enrollmentId: enrollment.id,
      userId: user.id,
      originalAmount: q.original,
      discount: q.discount,
      amount: q.amount,
      method,
      gateway: q.amount === 0 ? "free" : "sandbox",
      couponId: q.coupon?.id ?? null,
    },
  });
  await audit(user.id, "checkout.create", "Payment", payment.id, { courseId: course.id, amount: q.amount });

  if (q.amount === 0) {
    await settlePayment(payment.id, { gatewayRef: `FREE-${payment.invoiceNo}`, method: "FREE" });
    redirect(`/dashboard/courses/${course.id}?welcome=1`);
  }
  redirect(`/pay/${payment.id}`);
}

/**
 * Sandbox gateway callback. The hosted payment page posts the provider's signed result;
 * we verify the signature and amount server-side before confirming the enrollment.
 */
export async function gatewayCallback(form: FormData) {
  const user = await requireUser();
  const paymentId = str(form, "paymentId");
  const status = str(form, "status") === "SUCCESS" ? "SUCCESS" : "FAILED";
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { enrollment: true } });
  if (!payment || payment.userId !== user.id) redirect("/dashboard/payments");
  if (payment.status !== "PENDING") redirect(`/pay/${payment.id}`);

  // The (sandbox) provider page posts ref + HMAC signature; tampering with amount/status/ref fails here.
  const ref = str(form, "ref");
  const signature = str(form, "signature");
  if (!ref || !verifyCallback(payment.id, payment.amount, status, ref, signature)) {
    await audit(user.id, "payment.verify_failed", "Payment", payment.id);
    redirect(`/pay/${payment.id}?error=verification`);
  }

  if (status === "SUCCESS") {
    const method = str(form, "method") as PaymentMethod;
    await settlePayment(payment.id, { gatewayRef: ref, method: METHODS.includes(method) ? method : undefined });
    redirect(`/dashboard/courses/${payment.enrollment.courseId}?welcome=1`);
  }
  await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", gatewayRef: ref } });
  await notify(user.id, { type: "payment", title: "Payment failed", body: `Payment ${payment.invoiceNo} didn't go through. You can try again from Payments.`, link: "/dashboard/payments" });
  redirect(`/pay/${payment.id}`);
}

/** Restart payment for a failed/cancelled attempt. */
export async function retryPayment(form: FormData) {
  const user = await requireUser();
  const old = await db.payment.findUnique({ where: { id: str(form, "paymentId") }, include: { enrollment: true } });
  if (!old || old.userId !== user.id || old.status === "PAID") redirect("/dashboard/payments");
  if (old.status === "PENDING") redirect(`/pay/${old.id}`);
  const fresh = await db.payment.create({
    data: {
      invoiceNo: invoiceNo(),
      enrollmentId: old.enrollmentId,
      userId: user.id,
      originalAmount: old.originalAmount,
      discount: old.discount,
      amount: old.amount,
      method: old.method,
      couponId: old.couponId,
    },
  });
  await db.enrollment.update({ where: { id: old.enrollmentId }, data: { status: "PENDING" } });
  revalidatePath("/dashboard/payments");
  redirect(`/pay/${fresh.id}`);
}

export async function cancelPendingEnrollment(form: FormData) {
  const user = await requireUser();
  const payment = await db.payment.findUnique({ where: { id: str(form, "paymentId") } });
  if (!payment || payment.userId !== user.id || payment.status !== "PENDING") redirect("/dashboard/payments");
  await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
  await db.enrollment.update({ where: { id: payment.enrollmentId }, data: { status: "CANCELLED" } });
  redirect("/dashboard/payments");
}
