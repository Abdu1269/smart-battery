import type { BatteryState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BatteryOrbProps {
  percent: number | null;
  state: BatteryState;
  tone: "low" | "high" | "normal" | "none";
  charging?: boolean;
  className?: string;
}

const toneColors: Record<BatteryOrbProps["tone"], string> = {
  low: "var(--warning)",
  high: "var(--accent-strong)",
  normal: "var(--primary)",
  none: "var(--muted-strong)",
};

const stateText: Record<BatteryState, string> = {
  charging: "Charging",
  discharging: "On battery",
  full: "Fully charged",
  notCharging: "Not charging",
  unknown: "State unavailable",
};

export function BatteryOrb({
  percent,
  state,
  tone,
  charging = false,
  className,
}: BatteryOrbProps) {
  const value = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const dash = (value / 100) * circumference;
  const color = toneColors[tone];

  return (
    <div
      className={cn("relative mx-auto aspect-square w-full max-w-[290px]", className)}
      role="img"
      aria-label={
        percent == null
          ? "Battery level is not reported by the system"
          : `Battery ${percent} percent, ${stateText[state].toLowerCase()}`
      }
    >
      <div
        className={cn(
          "absolute inset-[7%] rounded-full border border-border/80 bg-card shadow-card",
          charging && "animate-breathe",
        )}
      />
      <div
        className="absolute inset-[13%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle at 34% 26%, color-mix(in srgb, ${color} 13%, transparent), transparent 62%)`,
        }}
      />
      <svg
        viewBox="0 0 240 240"
        className="absolute inset-0 size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="11"
        />
        <circle
          cx="120"
          cy="120"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
        <circle
          cx="120"
          cy="120"
          r="75"
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
          strokeDasharray="2 8"
          opacity="0.9"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <span className="font-display text-[3.25rem] font-semibold leading-none tracking-[-0.055em]">
          {percent == null ? "—" : percent}
          {percent == null ? null : (
            <span className="ml-0.5 align-top text-[1.35rem] tracking-normal text-muted-foreground">
              %
            </span>
          )}
        </span>
        <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {stateText[state]}
        </span>
      </div>
    </div>
  );
}
