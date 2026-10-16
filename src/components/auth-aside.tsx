import { Logo } from "./logo";
import { Icon3D } from "./icon-3d";
import { BlackHole } from "./landing/black-hole";
import { InView } from "./landing/in-view";

const items = [
  { icon: "book", title: "Daily lessons", text: "Videos, PDF notes & slides after every class" },
  { icon: "calendar", title: "Live & offline classes", text: "Join online or at DoB venues across Dhaka" },
  { icon: "trophy", title: "Verified certificates", text: "Earned on progress, attendance & assessments" },
] as const;

export function AuthAside() {
  return (
    <InView className="relative hidden overflow-hidden border-r border-line bg-paper p-12 lg:flex lg:flex-col">
      <div className="rf-glow-top pointer-events-none absolute inset-0" />
      <BlackHole className="pointer-events-none absolute -bottom-[420px] left-1/2 h-[820px] w-[820px] -translate-x-1/2 opacity-90" />
      <div className="relative"><Logo /></div>
      <div className="relative mt-auto max-w-md pb-40">
        <h2 className="rf-title font-display text-4xl font-medium leading-tight tracking-[-0.03em]">Learn the skills that build tomorrow’s Bangladesh.</h2>
        <div className="mt-8 space-y-3">
          {items.map((it) => (
            <div key={it.title} className="rf-card flex items-center gap-4 p-4">
              <Icon3D name={it.icon} size={40} />
              <div>
                <div className="font-medium text-ink">{it.title}</div>
                <div className="text-sm text-ink-soft">{it.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </InView>
  );
}
