"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2 text-sm font-medium text-white shadow-sm">
      <Printer className="size-4" /> Print / Save as PDF
    </button>
  );
}
