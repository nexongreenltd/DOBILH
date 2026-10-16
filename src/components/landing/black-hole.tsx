import { twinkleStars } from "./stars";

/**
 * reflect.app hero "black hole", light edition: slowly rotating concentric rings with nodes
 * (100s), a counter-rotating field of twinkling stars (70s), and a glowing accretion disc.
 * Must sit inside an <InView> so the animations pause off-screen.
 */
const RINGS = [1, 0.8, 0.62, 0.46];
const STARS = twinkleStars(90, 11);

export function BlackHole({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      {/* rings — masked so they fade out below their top arc */}
      <div className="rf-anim absolute inset-0 animate-[rf-rotate_100s_linear_infinite]">
        {RINGS.map((scale, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full border border-lilac-400/40"
            style={{
              width: `${scale * 100}%`,
              height: `${scale * 100}%`,
              transform: `translate(-50%, -50%) rotate(${i * 41}deg)`,
              maskImage: "linear-gradient(180deg, #000 8%, transparent 32%)",
              WebkitMaskImage: "linear-gradient(180deg, #000 8%, transparent 32%)",
            }}
          >
            {[0, 1, 2].map((k) => (
              <span
                key={k}
                className="absolute size-[7px] rounded-full border border-lilac-400/60 bg-white"
                style={{ left: `${50 + 50 * Math.cos((k * 0.5 + 1.25) * Math.PI)}%`, top: `${50 + 50 * Math.sin((k * 0.5 + 1.25) * Math.PI)}%`, transform: "translate(-50%,-50%)" }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* twinkling stars */}
      <div
        className="rf-anim absolute inset-[8%] animate-[rf-rotate-reverse_70s_linear_infinite]"
        style={{ maskImage: "radial-gradient(50% 50% at 50% 50%, transparent 27%, #000 48%, #000c 75%, transparent 100%)", WebkitMaskImage: "radial-gradient(50% 50% at 50% 50%, transparent 27%, #000 48%, #000c 75%, transparent 100%)" }}
      >
        {STARS.map((s, i) => (
          <span
            key={i}
            className="rf-anim absolute rounded-full bg-lilac-500"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size + 1, height: s.size + 1, animation: `rf-twinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }}
          />
        ))}
      </div>
      {/* accretion disc */}
      <div className="rf-anim absolute left-1/2 top-1/2 size-[44%] -translate-x-1/2 -translate-y-1/2 animate-[rf-breathe_6s_ease-in-out_infinite]">
        <div className="absolute -inset-[30%] rounded-full bg-[radial-gradient(circle,#8b5cf655_0%,#a78bfa22_40%,transparent_70%)] blur-2xl" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,transparent_49%,#ffffff_54%,#e9ddff_57%,#b18cff_62%,#8b5cf655_68%,transparent_74%)] blur-[3px]" />
        <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_50%_70%,#5b2fd6_0%,#7c4dff_45%,#b79bff_80%,#efe7ff_100%)] shadow-[0_0_80px_16px_#c4b5fd88,inset_0_10px_40px_#ffffff66]" />
        <div className="absolute inset-[6%] rounded-full border-2 border-white/80 blur-[2px]" />
      </div>
    </div>
  );
}
