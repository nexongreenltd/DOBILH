"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

/** Countdown that auto-submits the enclosing quiz form when time runs out. */
export function QuizTimer({ endsAt, formId }: { endsAt: number; formId: string }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, endsAt - Date.now());
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [endsAt, formId]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-semibold", left < 60000 ? "bg-red-50 text-red-600" : "bg-azure-50 text-azure-500")}>
      <Timer className="size-4" /> {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}
