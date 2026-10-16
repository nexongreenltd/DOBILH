"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Like reflect.app's `*-visible` classes: ambient CSS animations inside only run while the
 * block is on screen (`.rf-run` un-pauses `.rf-anim` / `.rf-rising`). Saves battery off-screen.
 */
export function InView({ className, children, once = false, ...props }: ComponentProps<"div"> & { once?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setOn(e!.isIntersecting);
      if (e!.isIntersecting && once) io.disconnect();
    }, { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [once]);
  return (
    <div ref={ref} className={cn(className, on && "rf-run")} {...props}>
      {children}
    </div>
  );
}
