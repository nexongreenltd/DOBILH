"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EASE = "ease-[cubic-bezier(.6,.6,0,1)]";

/**
 * reflect.app-style hero film: a muted preview loops inside the product frame; the glass play
 * button opens the full promo (with sound) in a modal that scales in from 0.95.
 */
export function HeroVideo() {
  const [open, setOpen] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Respect reduced-motion: keep the poster still instead of looping.
  useEffect(() => {
    const v = preview.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.removeAttribute("autoplay");
      v.pause();
    }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    film.current?.pause();
    preview.current?.play().catch(() => {});
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    preview.current?.pause();
    const v = film.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      <div className="group relative aspect-video overflow-hidden rounded-[16px] bg-paper ring-1 ring-line">
        <video
          ref={preview}
          className="absolute inset-0 size-full object-cover"
          src="/media/dob-ilh-promo-loop.mp4"
          poster="/media/dob-ilh-promo-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink/25" />
        <button
          ref={trigger}
          onClick={() => setOpen(true)}
          className={cn("absolute inset-0 flex items-center justify-center focus-visible:outline-none")}
          aria-label="Play the DoB Innovation & Learning Hub tour video (1 minute)"
        >
          <span
            className={cn(
              "relative flex size-20 items-center justify-center rounded-full bg-white/40 shadow-[0_20px_50px_-15px_rgb(46_16_120/.6),inset_0_0_0_1px_rgb(255_255_255/.6)] backdrop-blur-xl transition-transform duration-500",
              EASE,
              "group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-lilac-400/50",
            )}
          >
            <span className="absolute inset-[6px] rounded-full bg-gradient-to-b from-white to-lilac-50 shadow-[inset_0_1px_0_#fff]" />
            <Play className="relative ml-1 size-7 fill-lilac-500 text-lilac-500" />
          </span>
        </button>
        <div className="pointer-events-none absolute left-4 top-4 hidden rounded-full sm:block bg-white/80 px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-sm ring-1 ring-white backdrop-blur">
          Watch the 1-minute tour
        </div>
      </div>

      {mounted &&
        createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DoB Innovation & Learning Hub tour video"
        aria-hidden={!open}
        onClick={close}
        className={cn(
          "fixed inset-0 z-[70] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-md transition-opacity duration-500 sm:p-10",
          EASE,
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn("relative w-full max-w-6xl transition-transform duration-500", EASE, open ? "scale-100" : "scale-95")}
        >
          <div className="rf-frame bg-white/80">
            <video
              ref={film}
              className="aspect-video w-full rounded-[16px] bg-ink"
              src={open ? "/media/dob-ilh-promo.mp4" : undefined}
              poster="/media/dob-ilh-promo-poster.jpg"
              controls
              playsInline
              preload="none"
            />
          </div>
          <button
            onClick={close}
            className="absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg transition hover:bg-white sm:-right-12 sm:top-0"
            aria-label="Close video"
            tabIndex={open ? 0 : -1}
          >
            <X className="size-5" />
          </button>
        </div>
      </div>,
          document.body,
        )}
    </>
  );
}
