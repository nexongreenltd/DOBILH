"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";

/** jimo-style onboarding tour card, shown once per browser. */
export function WelcomeTour({ storageKey, name, steps }: { storageKey: string; name: string; steps: { title: string; body: string }[] }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* storage unavailable — skip the tour */
    }
  }, [storageKey]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
  };
  const step = steps[i]!;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-5 right-5 z-40 w-[340px] rounded-2xl border border-[#e8ebf1] bg-white p-5 shadow-2xl shadow-navy-950/15"
        >
          <button onClick={close} className="absolute right-3 top-3 rounded-lg p-1 text-muted-500 hover:bg-azure-50" aria-label="Close tour">
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-3">
            <Avatar name="DoB Team" color="#071331" size={36} />
            <div>
              <div className="text-sm font-semibold text-navy-950">DoB Innovation &amp; Learning Hub</div>
              <div className="text-xs text-muted-500">Learning team · your guide</div>
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {steps.map((_, k) => (
              <span key={k} className={cn("h-1 rounded-full transition-all", k === i ? "w-5 bg-azure-500" : "w-1.5 bg-slate-200")} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
              <div className="mt-3 font-semibold text-navy-950">{i === 0 ? `Hi ${name.split(" ")[0]}! ${step.title}` : step.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-600">{step.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 flex items-center justify-between">
            <button onClick={close} className="text-sm text-muted-500 hover:text-navy-950">Skip</button>
            <button
              onClick={() => (i < steps.length - 1 ? setI(i + 1) : close())}
              className="rounded-xl bg-navy-950 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
            >
              {i < steps.length - 1 ? "Next" : "Get started"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
