"use client";

import { useActionState, useState } from "react";
import { CreditCard, ShieldCheck, TicketPercent, AlertCircle, CheckCircle2 } from "lucide-react";
import { checkout, previewCoupon } from "@/app/actions/commerce";
import { SubmitButton } from "./forms";
import { cn, formatBDT } from "@/lib/utils";

const METHODS = [
  { id: "BKASH", label: "bKash", color: "#e2136e" },
  { id: "NAGAD", label: "Nagad", color: "#f6921e" },
  { id: "ROCKET", label: "Rocket", color: "#8c3494" },
  { id: "CARD", label: "Card", color: "#071331" },
];

export function CheckoutForm({ courseId, batchId, price }: { courseId: string; batchId: string; price: number }) {
  const [couponState, couponAction] = useActionState(previewCoupon, undefined);
  const [state, action] = useActionState(checkout, undefined);
  const [code, setCode] = useState("");
  const [method, setMethod] = useState("BKASH");
  const discount = couponState?.ok ? (couponState.discount ?? 0) : 0;
  const total = Math.max(0, price - discount);

  return (
    <div className="space-y-6">
      {price > 0 && (
        <form action={couponAction} className="rounded-2xl border border-line bg-white p-5">
          <input type="hidden" name="courseId" value={courseId} />
          <label className="flex items-center gap-2 text-sm font-medium text-ink"><TicketPercent className="size-4 text-lilac-500" /> Coupon code</label>
          <div className="mt-2 flex gap-2">
            <input name="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME20" className="h-10 flex-1 rounded-xl border border-line bg-white px-3 text-ink text-sm uppercase tracking-wider focus:border-lilac-300/70 focus:outline-none focus:ring-4 focus:ring-lilac-400/20" />
            <SubmitButton variant="ghost" className="text-ink ring-1 ring-line" pendingText="Checking…">Apply</SubmitButton>
          </div>
          {couponState?.error && <p className="mt-2 flex items-center gap-1.5 text-sm text-red-700"><AlertCircle className="size-4" /> {couponState.error}</p>}
          {couponState?.ok && <p className="mt-2 flex items-center gap-1.5 text-sm text-lilac-500"><CheckCircle2 className="size-4" /> {couponState.message}</p>}
        </form>
      )}

      <form action={action} className="space-y-6">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="coupon" value={couponState?.ok ? code : ""} />
        {total > 0 && (
          <div className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><CreditCard className="size-4 text-lilac-500" /> Payment method</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((m) => (
                <label key={m.id} className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition", method === m.id ? "border-lilac-300/70 bg-lilac-500/[0.06] ring-4 ring-lilac-400/20" : "border-line hover:border-ink/15")}>
                  <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="sr-only" />
                  <span className="flex size-9 items-center justify-center rounded-lg text-xs font-bold text-ink" style={{ background: m.color }}>{m.label.slice(0, 2)}</span>
                  {m.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-line bg-white p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-ink-soft"><dt>Course price</dt><dd>{formatBDT(price)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-lilac-500"><dt>Coupon discount</dt><dd>−{formatBDT(discount)}</dd></div>}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-ink"><dt>Total</dt><dd>{total === 0 ? "Free" : formatBDT(total)}</dd></div>
          </dl>
          <SubmitButton variant="violet" size="lg" className="mt-5 w-full" pendingText="Processing…">
            {total === 0 ? "Enroll for free" : `Pay ${formatBDT(total)}`}
          </SubmitButton>
          {state?.error && <p className="mt-3 flex items-center gap-1.5 text-sm text-red-700"><AlertCircle className="size-4" /> {state.error}</p>}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint"><ShieldCheck className="size-3.5" /> Enrollment is confirmed only after the payment is verified.</p>
        </div>
      </form>
    </div>
  );
}
