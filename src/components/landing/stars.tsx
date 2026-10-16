/** Deterministic star fields (SSR-safe) — positions rounded so server and client markup match. */
function prng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Box-shadow dot layer for rising-star fields (reflect `.rising-stars`). */
export function starShadow(count: number, w: number, h: number, seed: number, color = "#8b5cf6") {
  const r = prng(seed);
  return Array.from({ length: count }, () => `${Math.round(r() * w)}px ${Math.round(r() * h)}px ${color}`).join(",");
}

export function RisingStars({ className, width = 1400, height = 600, seed = 3, color }: { className?: string; width?: number; height?: number; seed?: number; color?: string }) {
  const layers = [
    { n: 70, d: 90, s: 1 },
    { n: 40, d: 130, s: 1.5 },
    { n: 20, d: 180, s: 2 },
  ];
  return (
    <div className={`rf-rising ${className ?? ""}`} aria-hidden>
      {layers.map((l, i) => (
        <i
          key={i}
          style={{
            width: l.s,
            height: l.s,
            boxShadow: starShadow(l.n, width, height + 1000, seed + i * 11, color),
            animationDuration: `${l.d}s`,
          }}
        />
      ))}
    </div>
  );
}

export function twinkleStars(count: number, seed: number, inner = 26, spread = 24) {
  const r = prng(seed);
  return Array.from({ length: count }, () => {
    const a = r() * Math.PI * 2;
    const rad = inner + r() * spread;
    return {
      left: (50 + Math.cos(a) * rad).toFixed(2),
      top: (50 + Math.sin(a) * rad).toFixed(2),
      size: r() < 0.2 ? 2 : 1,
      delay: (r() * 6).toFixed(2),
      dur: (3 + r() * 4).toFixed(2),
    };
  });
}
