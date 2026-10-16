"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  ["How do I pay for a course?", "Choose a batch on the course page and check out with bKash, Nagad, Rocket or card. Your enrollment is confirmed the moment the payment is verified."],
  ["Can I attend classes offline?", "Yes. Offline and hybrid batches meet at DoB venues in Dhaka. Each class shows its venue in your schedule, and instructors take attendance in person."],
  ["How do certificates work?", "Each course sets clear rules — typically 80% lesson completion, 70% attendance and passing all assessments. Once you qualify, your certificate is issued with a public verification link."],
  ["Are there free courses?", "Yes — Career Readiness & Professional Communication is free for everyone. Many paid programmes also run coupon discounts."],
  ["What if I miss a class?", "Online sessions are recorded where possible, and every lesson has PDF notes and slides. Your attendance record shows exactly which classes you missed."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative bg-paper px-6 pb-28 pt-24">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="rf-badge text-sm"><span className="rf-badge-text font-medium">FAQ</span></div>
          <h2 className="rf-title mt-4 font-display text-[clamp(2rem,4vw,3rem)] font-medium leading-[1.08] tracking-[-0.035em]">Questions, answered.</h2>
          <p className="mt-4 text-ink-soft">Can’t find what you need? The AI assistant and our support team are a message away.</p>
        </div>
        <div>
          {FAQS.map(([q, a], i) => (
            <div key={q} className="relative">
              <div className="rf-hairline-x absolute inset-x-0 top-0" />
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium text-ink">
                {q}
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-line transition-transform duration-[450ms] ease-[cubic-bezier(.6,.6,0,1)]", open === i && "rotate-45")}>
                  <Plus className="size-3.5" />
                </span>
              </button>
              <div className={cn("grid transition-[grid-template-rows,opacity] duration-[450ms] ease-[cubic-bezier(.6,.6,0,1)]", open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <p className="overflow-hidden pr-10 text-ink-soft"><span className="block pb-6">{a}</span></p>
              </div>
            </div>
          ))}
          <div className="rf-hairline-x" />
        </div>
      </div>
    </section>
  );
}
