import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * DoB Innovation & Learning Hub — "Rising Dream" mark: a sun rising from an open book
 * (learning → the dreams of Bangladesh), circled by a tilted orbit carrying a four-point
 * spark (innovation), on the brand-violet tile. `size` picks the cut: ≥40 px gets gloss + spine detail, 24–39 px a
 * bolder orbit, below 24 px the favicon cut (sun + book only).
 */
export function LogoMark({ className, size = 36, variant = "violet" }: { className?: string; size?: number; variant?: "violet" | "heritage" | "ink" }) {
  const id = useId().replace(/:/g, "");
  const tile = variant === "heritage" ? ["#1FC08F", "#058A63", "#005A42"] : variant === "ink" ? ["#0d0a1f", "#0d0a1f", "#0d0a1f"] : ["#A47BFF", "#7140F8", "#4E22D6"];
  const sun = variant === "heritage" ? ["#FF5A6B", "#E01F36"] : ["#FFFFFF", "#E9DEFF"];
  const spine = variant === "heritage" ? "#058A63" : variant === "ink" ? "#0d0a1f" : "#6B3AF4";
  const moon = variant === "heritage" ? "#FDE68A" : variant === "ink" ? "#FFFFFF" : "#FFC9F5";

  if (size < 24) {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
        <defs>
          <linearGradient id={`${id}t`} x1="6" y1="2" x2="44" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={tile[0]} />
            <stop offset="1" stopColor={tile[2]} />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill={`url(#${id}t)`} />
        <circle cx="24" cy="19" r="9" fill={sun[1] === "#E9DEFF" ? "#FFFFFF" : sun[1]} />
        <path d="M7 32 C14 28.5 20 29 24 33 C28 29 34 28.5 41 32 V39 C34 36 28 36.5 24 40.5 C20 36.5 14 36 7 39 Z" fill="#FFFFFF" />
      </svg>
    );
  }

  const detailed = size >= 40;
  const stroke = detailed ? 1.5 : 1.9;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}t`} x1="6" y1="2" x2="44" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={tile[0]} />
          <stop offset="0.55" stopColor={tile[1]} />
          <stop offset="1" stopColor={tile[2]} />
        </linearGradient>
        <radialGradient id={`${id}s`} cx="22" cy="18" r="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={sun[0]} />
          <stop offset="1" stopColor={sun[1]} />
        </radialGradient>
        <linearGradient id={`${id}h`} x1="24" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <rect x="-10" y="21" width="68" height="40" transform="rotate(-20 24 21)" />
        </clipPath>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id}t)`} />
      {detailed && variant !== "ink" && <rect width="48" height="24" rx="14" fill={`url(#${id}h)`} />}
      {detailed && <rect x="0.5" y="0.5" width="47" height="47" rx="13.5" fill="none" stroke="#FFFFFF" strokeOpacity="0.22" />}
      <ellipse cx="24" cy="21" rx="15.5" ry="5.6" transform="rotate(-20 24 21)" fill="none" stroke="#FFFFFF" strokeOpacity="0.42" strokeWidth={stroke} />
      <circle cx="24" cy="21" r={detailed ? 7 : 7.2} fill={`url(#${id}s)`} />
      <ellipse cx="24" cy="21" rx="15.5" ry="5.6" transform="rotate(-20 24 21)" fill="none" stroke="#FFFFFF" strokeWidth={stroke} clipPath={`url(#${id}c)`} />
      <path
        d={
          detailed
            ? "M37.2 15.7 C37.55 18.25 38.05 18.75 40.6 19.1 C38.05 19.45 37.55 19.95 37.2 22.5 C36.85 19.95 36.35 19.45 33.8 19.1 C36.35 18.75 36.85 18.25 37.2 15.7 Z"
            : "M37.2 15.1 C37.6 18.1 38.2 18.7 41.2 19.1 C38.2 19.5 37.6 20.1 37.2 23.1 C36.8 20.1 36.2 19.5 33.2 19.1 C36.2 18.7 36.8 18.1 37.2 15.1 Z"
        }
        fill={moon}
        stroke={detailed ? "#FFFFFF" : "none"}
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <path d="M9 32.5 C15 29.6 20.6 30 24 33.2 C27.4 30 33 29.6 39 32.5 V37.6 C33 35 27.4 35.3 24 38.6 C20.6 35.3 15 35 9 37.6 Z" fill="#FFFFFF" />
      {detailed && <path d="M24 33.4 V38.4" stroke={spine} strokeWidth="1.1" strokeLinecap="round" />}
    </svg>
  );
}

/** Compact lockup used in navigation: mark + "DoB" over the small-caps full name. */
export function Logo({ dark, className }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="DoB Innovation & Learning Hub — home">
      <LogoMark size={36} />
      <span className="leading-none">
        <span className={cn("block font-display text-[18px] font-semibold tracking-[-0.035em]", dark ? "text-white" : "text-ink")}>DoB</span>
        <span className={cn("mt-1 block text-[9.5px] font-semibold uppercase tracking-[0.14em]", dark ? "text-lilac-200" : "text-lilac-500")}>
          Innovation &amp; Learning Hub
        </span>
      </span>
    </Link>
  );
}

/** Primary horizontal lockup: mark | DoB | Innovation & / Learning Hub — for certificates and print. */
export function LogoLockup({ className, markSize = 44 }: { className?: string; markSize?: number }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={markSize} />
      <span className="font-display text-[34px] font-semibold leading-none tracking-[-0.045em] text-ink">DoB</span>
      <span aria-hidden className="h-8 w-px bg-ink/15" />
      <span className="font-display text-[13px] font-medium leading-[1.15] tracking-[-0.01em] text-ink">
        Innovation &amp;
        <span className="block text-lilac-500">Learning Hub</span>
      </span>
    </div>
  );
}
