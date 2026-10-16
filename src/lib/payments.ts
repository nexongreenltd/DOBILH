import "server-only";
import crypto from "crypto";
import type { Coupon, Course, PaymentMethod } from "@prisma/client";
import { db } from "./db";
import { effectivePrice, formatBDT } from "./utils";
import { notify } from "./notify";
import { audit } from "./audit";

export function invoiceNo() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

export type Quote = { original: number; discount: number; amount: number; coupon: Coupon | null; error?: string };

/** Server-side price calculation — the client never supplies the amount. */
export async function quote(course: Pick<Course, "id" | "price" | "salePrice">, userId: string, code?: string | null): Promise<Quote> {
  const original = effectivePrice(course);
  const base: Quote = { original, discount: 0, amount: original, coupon: null };
  if (!code) return base;
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  const invalid = (error: string) => ({ ...base, error });
  if (!coupon || !coupon.active) return invalid("This coupon code isn't valid.");
  if (coupon.courseId && coupon.courseId !== course.id) return invalid("This coupon doesn't apply to this course.");
  if (coupon.validFrom && coupon.validFrom > now) return invalid("This coupon isn't active yet.");
  if (coupon.validUntil && coupon.validUntil < now) return invalid("This coupon has expired.");
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return invalid("This coupon has been fully redeemed.");
  const mine = await db.couponUsage.count({ where: { couponId: coupon.id, userId } });
  if (mine >= coupon.perUserLimit) return invalid("You've already used this coupon.");
  const discount = Math.min(
    original,
    coupon.discountType === "PERCENT" ? Math.round((original * coupon.discountValue) / 100) : coupon.discountValue,
  );
  return { original, discount, amount: original - discount, coupon };
}

// ─── Gateway adapter ───────────────────────────────────────────────
// The sandbox gateway mimics a Bangladeshi provider (bKash / Nagad / SSLCommerz):
// the hosted page returns a signed callback which is verified server-side before
// enrollment is confirmed. Replace `sign`/`verifyCallback` with the provider's
// validation API (e.g. SSLCommerz validator, bKash execute/query) in production.

function sandboxSecret() {
  return process.env.PAYMENT_SANDBOX_SECRET ?? "sandbox";
}

export function signCallback(paymentId: string, amount: number, status: "SUCCESS" | "FAILED", ref: string) {
  return crypto.createHmac("sha256", sandboxSecret()).update(`${paymentId}|${amount}|${status}|${ref}`).digest("hex");
}

export function verifyCallback(paymentId: string, amount: number, status: "SUCCESS" | "FAILED", ref: string, signature: string) {
  const expected = signCallback(paymentId, amount, status, ref);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Marks a payment paid, activates the enrollment and records coupon usage — atomically. */
export async function settlePayment(paymentId: string, opts: { gatewayRef: string; method?: PaymentMethod; actorId?: string | null }) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { enrollment: { include: { course: true } } },
  });
  if (payment.status === "PAID") return payment;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date(), gatewayRef: opts.gatewayRef, ...(opts.method ? { method: opts.method } : {}) },
    });
    await tx.enrollment.update({ where: { id: payment.enrollmentId }, data: { status: "ACTIVE", enrolledAt: new Date() } });
    if (payment.couponId) {
      await tx.couponUsage.create({ data: { couponId: payment.couponId, userId: payment.userId, paymentId } });
      await tx.coupon.update({ where: { id: payment.couponId }, data: { usedCount: { increment: 1 } } });
    }
  });

  await notify(payment.userId, {
    type: "payment",
    title: "Enrollment confirmed",
    body: `Payment of ${formatBDT(payment.amount)} received for ${payment.enrollment.course.title}. Welcome aboard!`,
    link: `/dashboard/courses/${payment.enrollment.courseId}`,
  });
  await audit(opts.actorId ?? payment.userId, "payment.settle", "Payment", paymentId, {
    invoiceNo: payment.invoiceNo,
    amount: payment.amount,
    gatewayRef: opts.gatewayRef,
  });
  return payment;
}
