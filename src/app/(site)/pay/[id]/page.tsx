import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, XCircle, CheckCircle2, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { signCallback } from "@/lib/payments";
import { gatewayCallback, retryPayment } from "@/app/actions/commerce";
import { SubmitButton } from "@/components/forms";
import { formatBDT, humanize } from "@/lib/utils";

export const metadata = { title: "Secure payment" };

/** Sandbox hosted-payment page standing in for bKash / Nagad / SSLCommerz during development. */
export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const payment = await db.payment.findUnique({ where: { id }, include: { enrollment: { include: { course: true, batch: true } } } });
  if (!payment || payment.userId !== user.id) notFound();

  const ref = `TRX${payment.id.slice(-6).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

  return (
    <main className="bg-paper flex min-h-screen items-center justify-center px-6 pb-20 pt-28">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-white shadow-2xl shadow-[#2e1078]/10">
        <div className="flex items-center justify-between bg-lilac-500/80 px-6 py-4 text-white">
          <div className="flex items-center gap-2 font-semibold"><Lock className="size-4" /> DoB Secure Pay</div>
          <span className="rounded-full bg-tangerine-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Sandbox</span>
        </div>
        <div className="p-6">
          <div className="text-[13px] text-ink-faint">Paying for</div>
          <div className="font-semibold text-ink">{payment.enrollment.course.title}</div>
          <div className="text-sm text-ink-soft">{payment.enrollment.batch?.name}</div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-lilac-500/[0.06] p-3"><div className="text-[11px] text-ink-faint">Invoice</div><div className="text-sm font-medium text-ink">{payment.invoiceNo}</div></div>
            <div className="rounded-xl bg-lilac-500/[0.06] p-3"><div className="text-[11px] text-ink-faint">Method</div><div className="text-sm font-medium text-ink">{humanize(payment.method)}</div></div>
          </div>
          <div className="mt-5 flex items-end justify-between border-t border-line pt-5">
            <span className="text-ink-soft">Amount due</span>
            <span className="font-display text-3xl font-semibold text-ink">{formatBDT(payment.amount)}</span>
          </div>

          {error === "verification" && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">We couldn’t verify the payment response. No money was taken — please try again.</p>}

          {payment.status === "PENDING" ? (
            <div className="mt-6 space-y-2">
              <form action={gatewayCallback}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="status" value="SUCCESS" />
                <input type="hidden" name="method" value={payment.method} />
                <input type="hidden" name="ref" value={ref} />
                <input type="hidden" name="signature" value={signCallback(payment.id, payment.amount, "SUCCESS", ref)} />
                <SubmitButton variant="violet" size="lg" className="w-full" pendingText="Verifying payment…">Confirm payment</SubmitButton>
              </form>
              <form action={gatewayCallback}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="status" value="FAILED" />
                <input type="hidden" name="ref" value={ref} />
                <input type="hidden" name="signature" value={signCallback(payment.id, payment.amount, "FAILED", ref)} />
                <SubmitButton variant="ghost" className="w-full text-ink-soft hover:bg-lilac-500/[0.05] hover:text-white">Simulate a failed payment</SubmitButton>
              </form>
              <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-ink-faint"><ShieldCheck className="size-3.5" /> Signed callback verified server-side before enrollment.</p>
            </div>
          ) : payment.status === "PAID" ? (
            <div className="mt-6 text-center">
              <CheckCircle2 className="mx-auto size-12 text-lilac-500" />
              <div className="mt-2 font-semibold text-ink">Payment received</div>
              <Link href={`/dashboard/courses/${payment.enrollment.courseId}`} className="mt-4 inline-flex h-11 items-center rounded-xl bg-lilac-500/80 px-5 text-sm font-medium text-white">Start learning</Link>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <XCircle className="mx-auto size-12 text-sun-500" />
              <div className="mt-2 font-semibold text-ink">Payment {payment.status.toLowerCase()}</div>
              <form action={retryPayment} className="mt-4">
                <input type="hidden" name="paymentId" value={payment.id} />
                <SubmitButton>Try again</SubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
