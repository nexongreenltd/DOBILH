import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

// ───────── Buttons ─────────

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap active:scale-[0.98]";
const buttonVariants = {
  primary: "bg-navy-950 text-white hover:bg-navy-800 shadow-sm shadow-navy-950/20",
  secondary: "bg-white text-navy-950 ring-1 ring-slate-200 hover:bg-azure-50 hover:ring-azure-200",
  ghost: "text-muted-600 hover:bg-azure-50 hover:text-navy-950",
  danger: "bg-sun-500 text-white hover:bg-sun-600",
  soft: "bg-azure-50 text-azure-500 hover:bg-azure-100",
  brand: "bg-brand-700 text-white hover:bg-brand-800",
  violet: "bg-lilac-500/80 text-white shadow-[inset_0_0_12px_#bf97ff70,inset_0_0_0_1px_#cfb8ff55] hover:bg-lilac-500",
  dark: "bg-ink-950 text-white hover:bg-ink-800",
};
const buttonSizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

export type ButtonVariant = keyof typeof buttonVariants;
type BtnProps = { variant?: ButtonVariant; size?: keyof typeof buttonSizes };

export function buttonClass({ variant = "primary", size = "md" }: BtnProps = {}, className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & BtnProps) {
  return <button className={buttonClass({ variant, size }, className)} {...props} />;
}

export function LinkButton({ variant, size, className, ...props }: ComponentProps<typeof Link> & BtnProps) {
  return <Link className={buttonClass({ variant, size }, className)} {...props} />;
}

// ───────── Surfaces ─────────

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-[#e8ebf1] bg-white shadow-[0_1px_2px_rgba(7,19,49,0.04),0_8px_24px_-12px_rgba(7,19,49,0.08)]", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef1f6] px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-navy-950">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-muted-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-navy-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ───────── Data display ─────────

const tones = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "slate", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green", PUBLISHED: "green", PAID: "green", PRESENT: "green", GRADED: "green", VALID: "green", COMPLETED: "blue", RUNNING: "green", LIVE: "red",
  PENDING: "amber", DRAFT: "slate", SCHEDULED: "blue", UPCOMING: "blue", SUBMITTED: "amber", IN_PROGRESS: "amber", LATE: "amber", EXCUSED: "violet",
  SUSPENDED: "red", FAILED: "red", CANCELLED: "red", REFUNDED: "violet", ABSENT: "red", REVOKED: "red", CLOSED: "slate", ARCHIVED: "slate",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "slate"}>{status.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "sun" | "gold" }) {
  const color = tone === "sun" ? "bg-sun-500" : tone === "gold" ? "bg-gold-400" : "bg-gradient-to-r from-azure-500 to-azure-400";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-azure-50", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? "#006a4e" }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function StatCard({ label, value, hint, icon, accent = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; accent?: "brand" | "sun" | "gold" | "sky" | "violet" }) {
  const chip = {
    brand: "bg-brand-50 text-brand-700",
    sun: "bg-red-50 text-sun-600",
    gold: "bg-tangerine-50 text-tangerine-500",
    sky: "bg-azure-50 text-azure-500",
    violet: "bg-violet-50 text-violet-600",
  }[accent];
  return (
    <Card className="group p-4 transition hover:border-azure-200">
      <div className="flex items-center gap-3">
        {icon && <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-[18px]", chip)}>{icon}</div>}
        <div className="text-[13px] text-muted-500">{label}</div>
      </div>
      <div className="mt-3 font-display text-[26px] font-semibold tabular-nums leading-none text-navy-950">{value}</div>
      {hint && <div className="mt-2 text-xs text-muted-500">{hint}</div>}
    </Card>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>}
      <div className="font-medium text-slate-800">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ───────── Tables ─────────

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-slate-100 bg-azure-50/60 text-xs font-medium text-muted-500">{children}</thead>;
}
export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium whitespace-nowrap", className)}>{children}</th>;
}
export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-[#eef1f6] last:border-0 hover:bg-azure-50/40", className)}>{children}</tr>;
}
export function TD({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-middle text-navy-950/80", className)}>{children}</td>;
}

// ───────── Forms ─────────

const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm shadow-slate-900/[0.02] transition focus:border-azure-500 focus:outline-none focus:ring-4 focus:ring-azure-500/10 disabled:bg-slate-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5", className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-10 pr-8", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 rounded border-slate-300 accent-azure-500" {...props} />
      {label}
    </label>
  );
}

export function Alert({ tone = "green", children }: { tone?: "green" | "red" | "amber" | "blue"; children: ReactNode }) {
  const cls = {
    green: "border-brand-200 bg-brand-50 text-brand-900",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];
  return <div className={cn("rounded-xl border px-4 py-3 text-sm", cls)}>{children}</div>;
}

/** Simple link-based tabs (server-rendered, URL as state). */
export function Tabs({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <div className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#e8ebf1] bg-white p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition",
            t.key === active ? "bg-azure-50 text-azure-500" : "text-muted-500 hover:bg-slate-50 hover:text-navy-950",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/** Collapsible inline form panel (no JS). */
export function Disclosure({ summary, children, open }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded-2xl border border-dashed border-slate-300 bg-white open:border-solid open:border-[#e8ebf1] open:shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-azure-500 [&::-webkit-details-marker]:hidden">
        <span className="flex size-5 items-center justify-center rounded-md bg-azure-50 text-azure-500 transition group-open:rotate-45">+</span>
        {summary}
      </summary>
      <div className="border-t border-[#eef1f6] px-5 py-5">{children}</div>
    </details>
  );
}

export function CourseCover({ hue, title, className, small, soft }: { hue: number; title: string; className?: string; small?: boolean; soft?: boolean }) {
  const bg = soft
    ? `radial-gradient(120% 120% at 0% 0%, hsl(${hue} 90% 93%) 0%, hsl(${(hue + 30) % 360} 85% 88%) 50%, hsl(${(hue + 70) % 360} 80% 84%) 100%)`
    : `radial-gradient(120% 120% at 0% 0%, hsl(${hue} 80% 55%) 0%, hsl(${(hue + 40) % 360} 70% 30%) 55%, hsl(${(hue + 80) % 360} 60% 12%) 100%)`;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: bg }}>
      <div className={cn("absolute inset-0 [background-size:14px_14px]", soft ? "opacity-60 [background-image:radial-gradient(rgb(255_255_255/.9)_1px,transparent_1px)]" : "opacity-30 [background-image:radial-gradient(rgb(255_255_255/.5)_1px,transparent_1px)]")} />
      <div className={cn("absolute -right-8 -bottom-10 size-40 rounded-full border-[18px]", soft ? "border-white/50" : "border-white/15")} />
      <div className={cn("absolute right-10 top-6 size-10 rotate-12 rounded-xl border-4", soft ? "border-white/60" : "border-white/20")} />
      {!small && <div className={cn("absolute bottom-3 left-4 right-16 line-clamp-2 font-display text-sm font-semibold", soft ? "text-ink/80" : "text-white/90")}>{title}</div>}
    </div>
  );
}

// ───────── jimo-style detail primitives ─────────

const chipTones = {
  green: "bg-brand-50 text-brand-700",
  azure: "bg-azure-50 text-azure-500",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-tangerine-50 text-tangerine-500",
  red: "bg-red-50 text-sun-600",
  slate: "bg-slate-100 text-muted-600",
};
export type ChipTone = keyof typeof chipTones;

export function IconChip({ children, tone = "azure", size = 32 }: { children: ReactNode; tone?: ChipTone; size?: number }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px] [&>svg]:size-[55%]", chipTones[tone])}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

/** Small muted label stacked over a value, with an optional pastel icon chip. */
export function InfoTile({ icon, tone, label, value, className }: { icon?: ReactNode; tone?: ChipTone; label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-[#e8ebf1] bg-white px-3 py-2.5", className)}>
      {icon && <IconChip tone={tone}>{icon}</IconChip>}
      <div className="min-w-0">
        <div className="text-[11px] text-muted-500">{label}</div>
        <div className="truncate text-sm font-medium text-navy-950">{value}</div>
      </div>
    </div>
  );
}

/** Tinted group panel (jimo "rules" block). */
export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-[#e8ebf1] bg-azure-50/60 p-3", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="text-[13px] text-muted-500">{title}</div>
          {action}
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function AddLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-azure-500 hover:bg-azure-50">
      <span className="text-base leading-none">+</span> {children}
    </Link>
  );
}
