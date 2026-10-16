"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@prisma/client";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";

const OPTIONS: { v: AttendanceStatus; label: string; cls: string }[] = [
  { v: "PRESENT", label: "Present", cls: "bg-brand-600 text-white" },
  { v: "LATE", label: "Late", cls: "bg-tangerine-500 text-white" },
  { v: "EXCUSED", label: "Excused", cls: "bg-violet-500 text-white" },
  { v: "ABSENT", label: "Absent", cls: "bg-sun-500 text-white" },
];

export function AttendanceGrid({ students }: { students: { id: string; name: string; email: string; avatarColor: string; status: AttendanceStatus | null }[] }) {
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | null>>(Object.fromEntries(students.map((s) => [s.id, s.status])));
  const setAll = (v: AttendanceStatus) => setMarks(Object.fromEntries(students.map((s) => [s.id, v])));
  const counts = OPTIONS.map((o) => ({ ...o, n: Object.values(marks).filter((m) => m === o.v).length }));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[#eef1f6] px-5 py-3">
        <span className="mr-2 text-[13px] text-muted-500">Mark all:</span>
        {OPTIONS.map((o) => (
          <button type="button" key={o.v} onClick={() => setAll(o.v)} className="rounded-lg bg-azure-50 px-2.5 py-1 text-xs font-medium text-azure-500 hover:bg-azure-100">{o.label}</button>
        ))}
        <span className="ml-auto flex gap-3 text-xs text-muted-500">
          {counts.map((c) => <span key={c.v}>{c.label}: <b className="text-navy-950">{c.n}</b></span>)}
        </span>
      </div>
      <ul className="divide-y divide-[#eef1f6]">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <Avatar name={s.name} color={s.avatarColor} size={32} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-navy-950">{s.name}</div>
              <div className="text-xs text-muted-500">{s.email}</div>
            </div>
            <input type="hidden" name={`s_${s.id}`} value={marks[s.id] ?? ""} />
            <div className="flex gap-1 rounded-xl bg-azure-50/60 p-1">
              {OPTIONS.map((o) => (
                <button
                  type="button"
                  key={o.v}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: o.v }))}
                  className={cn("rounded-lg px-2.5 py-1 text-xs font-medium transition", marks[s.id] === o.v ? o.cls : "text-muted-600 hover:bg-white")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
