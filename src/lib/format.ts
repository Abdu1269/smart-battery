import type {
  AppSettings,
  BatteryState,
  HistoryRecord,
  PowerProfile,
  PowerSource,
  ThemePreference,
} from "./types";

const minuteFormatter = new Intl.NumberFormat();
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? "—" : minuteFormatter.format(value);
}

export function formatCapacity(mwh: number | null | undefined): string {
  if (mwh == null || mwh <= 0) {
    return "—";
  }
  const wh = mwh / 1000;
  return `${wh >= 100 ? wh.toFixed(0) : wh.toFixed(1)} Wh`;
}

export function formatPower(mw: number | null | undefined): string {
  if (mw == null || mw <= 0) {
    return "—";
  }
  return `${(mw / 1000).toFixed(1)} W`;
}

export function formatTemperature(celsius: number | null | undefined): string {
  return celsius == null ? "—" : `${celsius.toFixed(1)}°C`;
}

export function formatDurationCompact(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) {
    return "—";
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours ? `${days} d ${remainingHours} h` : `${days} d`;
  }
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function formatDuration(
  seconds: number | null | undefined,
  fallback = "Not reported",
): string {
  return seconds == null || seconds <= 0 ? fallback : formatDurationCompact(seconds);
}

export function formatClockDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return dateTimeFormatter.format(date);
}

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : timeFormatter.format(date);
}

export function formatShortDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function timeAgo(value: string | null | undefined, now = Date.now()): string {
  if (!value) {
    return "Not read yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not read yet";
  }
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 10) {
    return "Just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : formatClockDate(value);
}

export function minutesToTime(minutes: number): string {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function stateLabel(state: BatteryState): string {
  switch (state) {
    case "charging":
      return "Charging";
    case "discharging":
      return "On battery";
    case "full":
      return "Fully charged";
    case "notCharging":
      return "Not charging";
    default:
      return "State unavailable";
  }
}

export function powerSourceLabel(source: PowerSource | null): string {
  switch (source) {
    case "ac":
      return "Plugged in";
    case "battery":
      return "Battery power";
    default:
      return "Source unavailable";
  }
}

export function profileLabel(profile: PowerProfile): string {
  switch (profile) {
    case "power-saver":
      return "Power saver";
    case "balanced":
      return "Balanced";
    case "performance":
      return "Performance";
  }
}

export function profileDescription(profile: PowerProfile): string {
  switch (profile) {
    case "power-saver":
      return "Favours lower energy use. Good for long, light work.";
    case "balanced":
      return "A sensible default for everyday work.";
    case "performance":
      return "Keeps more performance available. Usually uses more energy.";
  }
}

export function healthPercent(
  fullChargeCapacityMwh: number | null | undefined,
  designCapacityMwh: number | null | undefined,
): number | null {
  if (
    fullChargeCapacityMwh == null ||
    designCapacityMwh == null ||
    fullChargeCapacityMwh <= 0 ||
    designCapacityMwh <= 0
  ) {
    return null;
  }
  const ratio = (fullChargeCapacityMwh / designCapacityMwh) * 100;
  return Number.isFinite(ratio) ? ratio : null;
}

export function formatHealth(
  fullChargeCapacityMwh: number | null | undefined,
  designCapacityMwh: number | null | undefined,
): string {
  const value = healthPercent(fullChargeCapacityMwh, designCapacityMwh);
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

export function formatSecondsOption(seconds: number): string {
  if (seconds === 0) {
    return "Never";
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function alertLevel(
  percent: number | null | undefined,
  settings: Pick<
    AppSettings,
    "lowEnabled" | "lowThreshold" | "highEnabled" | "highThreshold"
  >,
): "low" | "high" | "normal" | "none" {
  if (percent == null) {
    return "none";
  }
  if (settings.lowEnabled && percent <= settings.lowThreshold) {
    return "low";
  }
  if (settings.highEnabled && percent >= settings.highThreshold) {
    return "high";
  }
  return "normal";
}

export function isFresh(
  observedAt: string | null | undefined,
  pollIntervalSecs: number,
  now = Date.now(),
): boolean {
  if (!observedAt) {
    return false;
  }
  const date = new Date(observedAt);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return now - date.getTime() < Math.max(90_000, pollIntervalSecs * 3_000);
}

export function validateSettings(settings: AppSettings): string[] {
  const errors: string[] = [];
  if (settings.lowThreshold < 5 || settings.lowThreshold > 100) {
    errors.push("Low threshold must be between 5% and 100%.");
  }
  if (settings.highThreshold < 5 || settings.highThreshold > 100) {
    errors.push("High threshold must be between 5% and 100%.");
  }
  if (settings.lowThreshold >= settings.highThreshold) {
    errors.push("Low threshold must be lower than high threshold.");
  }
  if (settings.hysteresisPercent < 1 || settings.hysteresisPercent > 20) {
    errors.push("Hysteresis must be between 1 and 20 percentage points.");
  }
  if (
    settings.hysteresisPercent >=
    Math.max(1, settings.highThreshold - settings.lowThreshold)
  ) {
    errors.push(
      "Hysteresis must be smaller than the gap between low and high thresholds.",
    );
  }
  if (settings.cooldownMinutes < 0 || settings.cooldownMinutes > 240) {
    errors.push("Cooldown must be between 0 and 240 minutes.");
  }
  if (
    settings.quietHours.startMinutes < 0 ||
    settings.quietHours.startMinutes >= 1440 ||
    settings.quietHours.endMinutes < 0 ||
    settings.quietHours.endMinutes >= 1440
  ) {
    errors.push("Quiet hours must use valid times.");
  }
  if (
    settings.quietHours.enabled &&
    settings.quietHours.startMinutes === settings.quietHours.endMinutes
  ) {
    errors.push("Quiet hours must start and end at different times.");
  }
  if (settings.pollIntervalSecs < 15 || settings.pollIntervalSecs > 300) {
    errors.push("Refresh interval must be between 15 and 300 seconds.");
  }
  return errors;
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): "light" | "dark" {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }
  return preference;
}

export function downsampleHistory(
  records: HistoryRecord[],
  maxPoints = 120,
): HistoryRecord[] {
  if (records.length <= maxPoints) {
    return records;
  }
  const step = (records.length - 1) / (maxPoints - 1);
  const sampled: HistoryRecord[] = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const record = records[Math.round(index * step)];
    if (record && sampled[sampled.length - 1] !== record) {
      sampled.push(record);
    }
  }
  return sampled;
}

export function filterHistory(
  records: HistoryRecord[],
  range: "24h" | "7d" | "30d" | "all",
  now = Date.now(),
): HistoryRecord[] {
  if (range === "all") {
    return records;
  }
  const windowMs =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const time = new Date(record.observedAt).getTime();
    return Number.isFinite(time) && now - time <= windowMs;
  });
}

export function historyRangeLabel(range: "24h" | "7d" | "30d" | "all"): string {
  return range === "all" ? "All samples" : range;
}

export function percentTone(percent: number | null, settings: AppSettings): string {
  const level = alertLevel(percent, settings);
  if (level === "low") {
    return "text-[var(--warning-strong)]";
  }
  if (level === "high") {
    return "text-[var(--accent-strong)]";
  }
  return "text-[var(--primary)]";
}

export function isReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
