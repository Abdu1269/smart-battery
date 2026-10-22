import * as React from "react";
import {
  ArrowRight,
  BatteryCharging,
  BatteryLow,
  BellRing,
  ChevronRight,
  CircleAlert,
  Clock3,
  Gauge,
  Leaf,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Zap,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { BatteryOrb } from "@/components/BatteryOrb";
import { CapabilityBadge } from "@/components/CapabilityBadge";
import { HistoryChart } from "@/components/HistoryChart";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  alertLevel,
  filterHistory,
  formatCapacity,
  formatDuration,
  formatHealth,
  formatTemperature,
  isFresh,
  powerSourceLabel,
  profileLabel,
  timeAgo,
} from "@/lib/format";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/useNow";

export function OverviewPage() {
  const {
    snapshot,
    settings,
    chargeLimit,
    powerSettings,
    recommendations,
    history,
    setPage,
    refreshSnapshot,
    pushToast,
  } = useApp();
  const now = useNow();
  const [refreshing, setRefreshing] = React.useState(false);

  if (!settings) {
    return null;
  }

  const level = alertLevel(snapshot?.percent, settings);
  const fresh = isFresh(snapshot?.observedAt, settings.pollIntervalSecs, now);
  const recentHistory = filterHistory(history, "24h", now);
  const greeting = getGreeting(new Date(now).getHours());

  const refresh = async () => {
    setRefreshing(true);
    await refreshSnapshot();
    setRefreshing(false);
  };

  const handleAction = (recommendation: Recommendation) => {
    switch (recommendation.action) {
      case "openCharging":
        setPage("charging");
        break;
      case "openPowerSettings":
      case "openDisplaySettings":
        setPage("power");
        break;
      case "openHelp":
        setPage("help");
        break;
      default:
        pushToast({
          title: recommendation.title,
          description: recommendation.summary,
          variant: "info",
        });
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow={new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(new Date(now))}
        title={`${greeting}. Here is your battery.`}
        description="A quiet snapshot of what your device reports right now — plus small, sensible next steps."
        actions={
          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("size-4", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            {refreshing ? "Reading…" : "Refresh"}
          </Button>
        }
      />

      {!snapshot || !snapshot.isAvailable ? (
        <Card className="mb-5 border-dashed">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BatteryLow className="size-6" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-xl font-semibold">
                No battery was detected
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                This can happen on a desktop, in a virtual machine, or when the
                operating system has not exposed a battery. BatteryBloom will keep
                checking and will not invent readings.
              </p>
            </div>
            <Button variant="outline" onClick={() => void refresh()}>
              Check again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.4fr]">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full border border-primary/10"
            aria-hidden="true"
          />
          <CardContent className="p-5 pt-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" className="normal-case">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      fresh ? "bg-primary" : "bg-warning",
                    )}
                    aria-hidden="true"
                  />
                  {fresh ? "Live reading" : "Waiting for a new reading"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(snapshot?.observedAt, now)}
                </span>
              </div>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
                On-device
              </span>
            </div>

            <BatteryOrb
              className="mt-5"
              percent={snapshot?.percent ?? null}
              state={snapshot?.state ?? "unknown"}
              tone={level === "none" ? "none" : level}
              charging={snapshot?.state === "charging"}
            />

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Badge
                variant={snapshot?.powerSource === "ac" ? "default" : "neutral"}
                className="normal-case"
              >
                <Plug className="size-3" aria-hidden="true" />
                {powerSourceLabel(snapshot?.powerSource ?? null)}
              </Badge>
              <Badge variant="outline" className="normal-case">
                {snapshot?.batteryCount === 1
                  ? "1 battery"
                  : `${snapshot?.batteryCount ?? 0} batteries`}
              </Badge>
            </div>

            {level === "high" ? (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-accent/65 p-3.5 text-sm leading-5">
                <p className="font-semibold text-accent-foreground">
                  Your charging goal is reached
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {settings.highThreshold}% reminder · unplug when it suits you. This is
                  not a hardware limit.
                </p>
              </div>
            ) : level === "low" ? (
              <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-3.5 text-sm leading-5">
                <p className="font-semibold text-warning-strong">
                  The battery is below your low reminder
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Find a charger when convenient.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid min-w-0 gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              icon={Clock3}
              label={snapshot?.state === "charging" ? "Until full" : "Time left"}
              value={formatDuration(
                snapshot?.state === "charging"
                  ? snapshot?.timeToFullSecs
                  : snapshot?.timeRemainingSecs,
                "Not reported",
              )}
              hint="OS estimate"
            />
            <Stat
              icon={BatteryCharging}
              label="Capacity vs design"
              value={formatHealth(
                snapshot?.fullChargeCapacityMwh,
                snapshot?.designCapacityMwh,
              )}
              hint="A ratio, not a grade"
            />
            <Stat
              icon={Gauge}
              label="Power draw"
              value={
                snapshot?.powerDrawMw == null
                  ? "—"
                  : `${(snapshot.powerDrawMw / 1000).toFixed(1)} W`
              }
              hint="If reported"
            />
            <Stat
              icon={Thermometer}
              label="Temperature"
              value={formatTemperature(snapshot?.temperatureCelsius)}
              hint="If reported"
            />
            <Stat
              icon={RefreshCw}
              label="Cycle count"
              value={
                snapshot?.cycleCount == null
                  ? "Not reported"
                  : String(snapshot.cycleCount)
              }
              hint="OS/firmware"
            />
            <Stat
              icon={Zap}
              label="Full charge"
              value={formatCapacity(snapshot?.fullChargeCapacityMwh)}
              hint="Current capacity"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPage("charging")}
              className="group rounded-[1.35rem] border border-border/80 bg-card p-4 text-left shadow-card transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-primary">
                  <BellRing className="size-4" aria-hidden="true" />
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                Charging reminders
              </p>
              <p className="mt-1 font-display text-xl font-semibold">
                {settings.lowThreshold}% / {settings.highThreshold}%
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Low and high goals. Alerts are deduplicated.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPage("charging")}
              className="group rounded-[1.35rem] border border-border/80 bg-card p-4 text-left shadow-card transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-foreground">
                  <BatteryCharging className="size-4" aria-hidden="true" />
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                Hardware charge limit
                {chargeLimit ? <CapabilityBadge status={chargeLimit.status} /> : null}
              </p>
              <p className="mt-1 font-display text-xl font-semibold">
                {chargeLimit?.status === "supported" && chargeLimit.currentEnd != null
                  ? `${chargeLimit.currentStart != null ? `${chargeLimit.currentStart}–` : ""}${chargeLimit.currentEnd}%`
                  : "Not available"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {chargeLimit?.status === "permissionRequired"
                  ? "Detected, but not writable. No privilege escalation."
                  : "Only shown when a verified interface exists."}
              </p>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Last 24 hours
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  Charge rhythm
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPage("history")}>
                Open history
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
            {recentHistory.length >= 2 ? (
              <div className="mt-4">
                <HistoryChart records={recentHistory} range="24h" />
              </div>
            ) : (
              <div className="mt-4 flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-6 text-center">
                <Leaf className="size-6 text-primary/70" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">History is still growing</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  BatteryBloom samples every {settings.historySamplingMinutes} minutes
                  while it runs. The chart appears after two samples.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Small next steps
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  Guidance, not guilt
                </h2>
              </div>
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
            </div>

            <div className="mt-4 space-y-3">
              {recommendations.slice(0, 3).map((recommendation) => (
                <RecommendationRow
                  key={recommendation.id}
                  recommendation={recommendation}
                  onAction={() => handleAction(recommendation)}
                />
              ))}
              {recommendations.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                  Guidance appears after BatteryBloom reads a battery.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          <Summary
            icon={<BatteryCharging className="size-4" />}
            title="Charge limit"
            value={
              chargeLimit?.status === "supported"
                ? "Verified interface"
                : chargeLimit?.status === "permissionRequired"
                  ? "Permission needed"
                  : "Unavailable"
            }
            description={
              chargeLimit?.status === "supported"
                ? "BatteryBloom can read and write the threshold, and verifies the read-back."
                : "A reminder is still useful. BatteryBloom will not claim the charger was limited."
            }
            onClick={() => setPage("charging")}
          />
          <Summary
            icon={<Zap className="size-4" />}
            title="Power profile"
            value={
              powerSettings?.currentProfile
                ? profileLabel(powerSettings.currentProfile)
                : "Not controllable"
            }
            description={
              powerSettings?.profile.reason ??
              "Use the power controls your system exposes."
            }
            onClick={() => setPage("power")}
          />
          <Summary
            icon={<CircleAlert className="size-4" />}
            title="Readings"
            value={snapshot ? "From this device" : "Unavailable"}
            description="BatteryBloom never fills missing values with estimates. “—” means the system did not report a value."
            onClick={() => setPage("help")}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/80 bg-card p-4 shadow-card">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden={true} />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
        {value}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function RecommendationRow({
  recommendation,
  onAction,
}: {
  recommendation: Recommendation;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/75 bg-background/45 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{recommendation.title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {recommendation.summary}
          </p>
        </div>
        <Badge
          variant={recommendation.impact === "high" ? "success" : "neutral"}
          className="shrink-0 normal-case"
        >
          {recommendation.impact}
        </Badge>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {recommendation.effort} effort
        </span>
        {recommendation.actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {recommendation.actionLabel}
            <ArrowRight className="size-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Summary({
  icon,
  title,
  value,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="text-primary" aria-hidden="true">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-1.5 font-display text-xl font-semibold tracking-[-0.02em]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function getGreeting(hour: number) {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}
