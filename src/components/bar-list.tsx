import { cn } from "@/lib/utils";

/** Horizontal single-series bars rendered in HTML: label + value in text ink, bar carries magnitude. */
export function BarList({ rows, format = (v) => String(v), max, className }: { rows: { label: string; value: number; hint?: string }[]; format?: (v: number) => string; max?: number; className?: string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("space-y-3", className)}>
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${format(r.value)}${r.hint ? ` · ${r.hint}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-navy-950">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-600">{format(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-azure-50">
            <div className="h-full rounded-full bg-azure-500 transition-all duration-700 group-hover:bg-azure-600" style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
