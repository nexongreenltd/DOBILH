import {
  BookOpen, CalendarDays, Trophy, Rocket, Cpu, BarChart3, Palette, Briefcase, Languages, PlayCircle, Award, Users,
  ShieldCheck, Sparkles, Wallet, Bot, Target, Globe2, ClipboardCheck, GraduationCap, Bell, LineChart, MapPin, Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Glossy "clay" 3D icons: an extruded glyph (stacked depth layers) on a lit, bevelled tile
 * with specular highlight and a soft contact shadow. Pure SVG/CSS — no image assets.
 */
const ICONS = {
  book: { icon: BookOpen, hue: 158 },
  calendar: { icon: CalendarDays, hue: 200 },
  trophy: { icon: Trophy, hue: 42 },
  rocket: { icon: Rocket, hue: 8 },
  cpu: { icon: Cpu, hue: 262 },
  chart: { icon: BarChart3, hue: 190 },
  "bar-chart": { icon: BarChart3, hue: 190 },
  palette: { icon: Palette, hue: 318 },
  briefcase: { icon: Briefcase, hue: 28 },
  languages: { icon: Languages, hue: 175 },
  video: { icon: PlayCircle, hue: 352 },
  award: { icon: Award, hue: 45 },
  users: { icon: Users, hue: 220 },
  shield: { icon: ShieldCheck, hue: 150 },
  sparkles: { icon: Sparkles, hue: 280 },
  wallet: { icon: Wallet, hue: 160 },
  bot: { icon: Bot, hue: 250 },
  target: { icon: Target, hue: 352 },
  globe: { icon: Globe2, hue: 195 },
  clipboard: { icon: ClipboardCheck, hue: 140 },
  cap: { icon: GraduationCap, hue: 160 },
  bell: { icon: Bell, hue: 35 },
  growth: { icon: LineChart, hue: 165 },
  pin: { icon: MapPin, hue: 352 },
  zap: { icon: Zap, hue: 48 },
} satisfies Record<string, { icon: LucideIcon; hue: number }>;

export type Icon3DName = keyof typeof ICONS;

export function Icon3D({ name, size = 56, className, hue }: { name: Icon3DName | string; size?: number; className?: string; hue?: number }) {
  const def = ICONS[name as Icon3DName] ?? ICONS.sparkles;
  const Glyph = def.icon;
  const h = hue ?? def.hue;
  const g = size * 0.5;
  const depth = Math.max(2, Math.round(size / 18));
  return (
    <span
      className={cn("group/icon relative inline-flex shrink-0 [perspective:400px]", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* contact shadow */}
      <span
        className="absolute left-[12%] right-[12%] -bottom-[14%] h-[22%] rounded-[50%] blur-md transition-all duration-500 group-hover/icon:-bottom-[20%] group-hover/icon:opacity-60"
        style={{ background: `hsl(${h} 70% 25% / .55)` }}
      />
      <span
        className="relative flex size-full items-center justify-center transition-transform duration-500 ease-out [transform-style:preserve-3d] group-hover/icon:[transform:rotateX(14deg)_rotateY(-16deg)_translateY(-3px)]"
        style={{
          borderRadius: size * 0.3,
          background: `linear-gradient(145deg, hsl(${h} 85% 68%) 0%, hsl(${h} 75% 50%) 45%, hsl(${(h + 12) % 360} 80% 34%) 100%)`,
          boxShadow: `inset 0 ${size * 0.04}px ${size * 0.06}px hsl(${h} 100% 88% / .7), inset 0 -${size * 0.07}px ${size * 0.1}px hsl(${h} 80% 22% / .55), 0 ${size * 0.08}px ${size * 0.16}px -${size * 0.04}px hsl(${h} 70% 25% / .5)`,
        }}
      >
        {/* specular highlight */}
        <span
          className="pointer-events-none absolute left-[10%] top-[6%] h-[38%] w-[80%] rounded-[50%] opacity-70"
          style={{ background: "linear-gradient(180deg, rgb(255 255 255 / .75), rgb(255 255 255 / 0))", filter: "blur(1px)" }}
        />
        {/* extruded glyph: depth layers then lit face */}
        <span className="relative" style={{ width: g, height: g }}>
          {Array.from({ length: depth }, (_, i) => (
            <Glyph
              key={i}
              className="absolute inset-0"
              style={{ width: g, height: g, transform: `translate(${(i + 1) * 0.5}px, ${i + 1}px)`, color: `hsl(${h} 70% ${22 + i * 2}%)` }}
              strokeWidth={2.6}
            />
          ))}
          <Glyph className="absolute inset-0 drop-shadow-[0_1px_0_rgba(255,255,255,.6)]" style={{ width: g, height: g, color: "white" }} strokeWidth={2.6} />
        </span>
      </span>
    </span>
  );
}
