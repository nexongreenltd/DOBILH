import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const bdt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatBDT(amount: number) {
  return amount === 0 ? "Free" : `৳${bdt.format(amount)}`;
}

/** Money amount — never rendered as "Free" (use for totals, revenue, refunds). */
export function formatTaka(amount: number) {
  return `৳${bdt.format(amount)}`;
}

export function formatNumber(n: number) {
  return bdt.format(n);
}

const TZ = "Asia/Dhaka";

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ, ...opts }).format(
    new Date(d),
  );
}

export function formatDateTime(d: Date | string | null | undefined) {
  return formatDate(d, { hour: "numeric", minute: "2-digit", hourCycle: "h12" });
}

export function formatTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hourCycle: "h12", timeZone: TZ }).format(new Date(d));
}

export function timeAgo(d: Date | string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const abs = Math.abs(s);
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return fmt.format(-s, "second");
  if (abs < 3600) return fmt.format(-Math.round(s / 60), "minute");
  if (abs < 86400) return fmt.format(-Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return fmt.format(-Math.round(s / 86400), "day");
  return formatDate(d);
}

/** Value for <input type="datetime-local"> in Dhaka time. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = new Date(new Date(d).getTime() + 6 * 3600 * 1000);
  return date.toISOString().slice(0, 16);
}

/** Parse a datetime-local value entered in Dhaka time (UTC+6). */
export function fromLocalInput(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(`${v}:00+06:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function pct(part: number, whole: number) {
  return whole <= 0 ? 0 : Math.round((part / whole) * 100);
}

export function effectivePrice(course: { price: number; salePrice: number | null }) {
  return course.salePrice != null && course.salePrice < course.price ? course.salePrice : course.price;
}

export function humanize(s: string) {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(form: FormData, key: string) {
  const v = str(form, key);
  return v === "" ? null : v;
}

export function int(form: FormData, key: string, fallback = 0) {
  const n = parseInt(str(form, key), 10);
  return Number.isFinite(n) ? n : fallback;
}
