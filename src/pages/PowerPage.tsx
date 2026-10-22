import * as React from "react";
import {
  ArrowRight,
  ChevronRight,
  Gauge,
  Leaf,
  Monitor,
  RefreshCw,
  RotateCcw,
  Rocket,
  ShieldCheck,
  TimerReset,
  Zap,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { CapabilityBadge } from "@/components/CapabilityBadge";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api, BackendError } from "@/lib/api";
import {
  formatClockDate,
  formatDuration,
  formatSecondsOption,
  powerSourceLabel,
  profileDescription,
  profileLabel,
  stateLabel,
} from "@/lib/format";
import type { PowerProfile, Recommendation, TimeoutKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const PROFILE_ICONS: Record<
  PowerProfile,
  React.ComponentType<{ className?: string }>
> = {
  "power-saver": Leaf,
  balanced: Gauge,
  performance: Rocket,
};

export function PowerPage() {
  const {
    settings,
    snapshot,
    powerSettings,
    recommendations,
    refreshPowerSettings,
    refreshRecommendations,
    setPage,
    openSystemSettings,
    pushToast,
  } = useApp();
  const [profileChoice, setProfileChoice] = React.useState<PowerProfile | null>(
    powerSettings?.currentProfile ?? null,
  );
  const [displayChoice, setDisplayChoice] = React.useState<number | null>(
    powerSettings?.displayTimeout.currentSeconds ?? null,
  );
  const [sleepChoice, setSleepChoice] = React.useState<number | null>(
    powerSettings?.sleepTimeout.currentSeconds ?? null,
  );
  const [applyingProfile, setApplyingProfile] = React.useState(false);
  const [applyingTimers, setApplyingTimers] = React.useState(false);
  const [undoing, setUndoing] = React.useState(false);

  React.useEffect(() => {
    setProfileChoice(powerSettings?.currentProfile ?? null);
  }, [powerSettings?.currentProfile]);

  React.useEffect(() => {
    setDisplayChoice(powerSettings?.displayTimeout.currentSeconds ?? null);
  }, [powerSettings?.displayTimeout.currentSeconds]);

  React.useEffect(() => {
    setSleepChoice(powerSettings?.sleepTimeout.currentSeconds ?? null);
  }, [powerSettings?.sleepTimeout.currentSeconds]);

  if (!settings || !powerSettings) {
    return null;
  }

  const profileSupported = powerSettings.profile.status === "supported";
  const profileDirty =
    profileChoice != null && profileChoice !== powerSettings.currentProfile;
  const displayOptions = withCurrent(
    powerSettings.displayTimeout.optionsSeconds,
    powerSettings.displayTimeout.currentSeconds,
  );
  const sleepOptions = withCurrent(
    powerSettings.sleepTimeout.optionsSeconds,
    powerSettings.sleepTimeout.currentSeconds,
  );
  const displayDirty =
    displayChoice != null &&
    displayChoice !== powerSettings.displayTimeout.currentSeconds &&
    powerSettings.displayTimeout.optionsSeconds.includes(displayChoice);
  const sleepDirty =
    sleepChoice != null &&
    sleepChoice !== powerSettings.sleepTimeout.currentSeconds &&
    powerSettings.sleepTimeout.optionsSeconds.includes(sleepChoice);

  const applyProfile = async () => {
    if (!profileChoice) {
      return;
    }
    setApplyingProfile(true);
    try {
      const result = await api.applyPowerProfile(profileChoice);
      pushToast({
        title: "Power profile updated",
        description: result.message,
        variant: "success",
      });
      await refreshPowerSettings();
      await refreshRecommendations();
    } catch (error) {
      pushToast({
        title: "Power profile was not changed",
        description:
          error instanceof BackendError
            ? error.message
            : "The power profile operation failed.",
        variant: "error",
      });
    } finally {
      setApplyingProfile(false);
    }
  };

  const applyTimers = async () => {
    setApplyingTimers(true);
    try {
      const messages: string[] = [];
      if (displayDirty && displayChoice != null) {
        const result = await api.applyPowerTimeout(
          "display" satisfies TimeoutKind,
          displayChoice,
        );
        messages.push(result.message);
      }
      if (sleepDirty && sleepChoice != null) {
        const result = await api.applyPowerTimeout(
          "sleep" satisfies TimeoutKind,
          sleepChoice,
        );
        messages.push(result.message);
      }
      pushToast({
        title: "Timeouts updated",
        description: messages.join(" "),
        variant: "success",
      });
      await refreshPowerSettings();
      await refreshRecommendations();
    } catch (error) {
      pushToast({
        title: "Timeouts were not changed",
        description:
          error instanceof BackendError
            ? error.message
            : "The timeout operation failed.",
        variant: "error",
      });
    } finally {
      setApplyingTimers(false);
    }
  };

  const undo = async () => {
    setUndoing(true);
    try {
      const result = await api.undoLastPowerChange();
      pushToast({
        title: "Power change undone",
        description: result.message,
        variant: "success",
      });
      await refreshPowerSettings();
      await refreshRecommendations();
    } catch (error) {
      pushToast({
        title: "The change was not undone",
        description:
          error instanceof BackendError
            ? error.message
            : "The previous power setting could not be restored.",
        variant: "error",
      });
    } finally {
      setUndoing(false);
    }
  };

  const handleRecommendation = (recommendation: Recommendation) => {
    switch (recommendation.action) {
      case "openCharging":
        setPage("charging");
        break;
      case "openHelp":
        setPage("help");
        break;
      case "openDisplaySettings":
        void openSystemSettings("display");
        break;
      case "openPowerSettings":
        void openSystemSettings("power");
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
        eyebrow="Power"
        title="Use only the energy you need."
        description="Change a power profile or timeout only when your system exposes a real, readable control. BatteryBloom verifies each change before calling it successful."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void openSystemSettings("display")}
            >
              <Monitor className="size-4" />
              Display settings
            </Button>
            <Button onClick={() => void openSystemSettings("power")}>
              <Zap className="size-4" />
              System power settings
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Power profile
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  {powerSettings.currentProfile
                    ? profileLabel(powerSettings.currentProfile)
                    : "Profile not readable"}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Provided by {powerSettings.provider}. A profile changes system power
                  behaviour, not battery capacity.
                </p>
              </div>
              <CapabilityBadge status={powerSettings.profile.status} />
            </div>

            {!profileSupported ? (
              <div className="mt-5 rounded-[1.35rem] border border-border bg-background/50 p-5">
                <p className="text-sm font-semibold">No supported profile control</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {powerSettings.profile.reason}
                </p>
                {powerSettings.profile.nextStep ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {powerSettings.profile.nextStep}
                  </p>
                ) : null}
                <Button
                  className="mt-4"
                  variant="outline"
                  size="sm"
                  onClick={() => void openSystemSettings("power")}
                >
                  Open system settings
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div
                  role="radiogroup"
                  aria-label="Power profile"
                  className="mt-5 grid gap-3 sm:grid-cols-3"
                >
                  {powerSettings.availableProfiles.map((profile) => {
                    const Icon = PROFILE_ICONS[profile];
                    const selected = profileChoice === profile;
                    const current = powerSettings.currentProfile === profile;
                    return (
                      <button
                        key={profile}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setProfileChoice(profile)}
                        className={cn(
                          "relative rounded-[1.3rem] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary/40 bg-accent/65"
                            : "border-border bg-background/45 hover:border-primary/25 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-full",
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-4" />
                          </span>
                          {current ? (
                            <Badge variant="success" className="normal-case">
                              Active
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm font-semibold">
                          {profileLabel(profile)}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {profileDescription(profile)}
                        </p>
                        {selected ? (
                          <span
                            className="absolute right-4 top-4 size-2 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {profileDirty
                      ? "The new profile will be verified after it is applied."
                      : "Your current profile is already selected."}
                  </p>
                  <Button
                    onClick={() => void applyProfile()}
                    disabled={!profileDirty || applyingProfile}
                  >
                    {applyingProfile ? (
                      <>
                        <RefreshCw className="size-4 animate-spin" />
                        Applying…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-4" />
                        Apply profile
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {settings.lastPowerChange ? (
              <div className="mt-4 rounded-[1.25rem] border border-border/80 bg-muted/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <RotateCcw className="size-3.5 text-primary" aria-hidden="true" />
                      Recent change can be undone
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {describeChange(
                        settings.lastPowerChange.key,
                        settings.lastPowerChange.previousValue,
                        settings.lastPowerChange.appliedValue,
                      )}{" "}
                      · {formatClockDate(settings.lastPowerChange.appliedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void undo()}
                    disabled={undoing}
                  >
                    {undoing ? "Undoing…" : "Undo last change"}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Right now
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  {snapshot?.percent != null
                    ? `${snapshot.percent}% battery`
                    : "Battery unavailable"}
                </h2>
              </div>
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
                <Zap className="size-4" aria-hidden="true" />
              </span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <dt className="text-muted-foreground">Power source</dt>
                <dd className="font-semibold">
                  {powerSourceLabel(snapshot?.powerSource ?? null)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                <dt className="text-muted-foreground">State</dt>
                <dd className="font-semibold">
                  {snapshot ? stateLabel(snapshot.state) : "Unavailable"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Time estimate</dt>
                <dd className="font-semibold">
                  {formatDuration(
                    snapshot?.state === "charging"
                      ? snapshot?.timeToFullSecs
                      : snapshot?.timeRemainingSecs,
                    "Not reported",
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-5 rounded-xl bg-accent/50 p-3 text-[11px] leading-5 text-muted-foreground">
              BatteryBloom does not change screen brightness. Use the display controls
              for that so the result is visible and reversible.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Idle timers
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  Let rest happen sooner
                </h2>
              </div>
              <TimerReset className="size-5 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Timeout changes are only offered on a supported GNOME desktop. The sleep
              value applies while on battery.
            </p>

            <div className="mt-5 space-y-4">
              <TimeoutField
                label="Turn the display off"
                kind="display"
                setting={powerSettings.displayTimeout}
                value={displayChoice}
                options={displayOptions}
                onChange={setDisplayChoice}
              />
              <TimeoutField
                label="Put the computer to sleep"
                kind="sleep"
                setting={powerSettings.sleepTimeout}
                value={sleepChoice}
                options={sleepOptions}
                onChange={setSleepChoice}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
              <p className="text-[11px] text-muted-foreground">
                Each change is read back before it is reported.
              </p>
              <Button
                onClick={() => void applyTimers()}
                disabled={(!displayDirty && !sleepDirty) || applyingTimers}
              >
                {applyingTimers ? "Applying…" : "Apply timeout changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Practical guidance
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  Lower energy, gently
                </h2>
              </div>
              <Leaf className="size-5 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-4 space-y-3">
              {recommendations.slice(0, 4).map((recommendation) => (
                <div
                  key={recommendation.id}
                  className="rounded-2xl border border-border/75 bg-background/45 p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold leading-5">
                      {recommendation.title}
                    </p>
                    <Badge variant="neutral" className="shrink-0 normal-case">
                      {recommendation.impact} impact
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {recommendation.summary}
                  </p>
                  {recommendation.actionLabel ? (
                    <button
                      type="button"
                      onClick={() => handleRecommendation(recommendation)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {recommendation.actionLabel}
                      <ChevronRight className="size-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TimeoutField({
  label,
  kind,
  setting,
  value,
  options,
  onChange,
}: {
  label: string;
  kind: TimeoutKind;
  setting: {
    supported: boolean;
    reason?: string | null;
    currentSeconds: number | null;
  };
  value: number | null;
  options: number[];
  onChange: (value: number) => void;
}) {
  const id = React.useId();
  if (!setting.supported) {
    return (
      <div className="rounded-xl border border-border bg-background/45 p-3.5">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {setting.reason ?? "This timeout is not available on this desktop."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        <span className="text-[11px] text-muted-foreground">
          Current:{" "}
          {setting.currentSeconds == null
            ? "not reported"
            : formatSecondsOption(setting.currentSeconds)}
        </span>
      </div>
      <Select
        id={id}
        className="mt-2"
        value={value ?? ""}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label} timeout`}
        data-kind={kind}
      >
        {value == null ? (
          <option value="" disabled>
            Current value unavailable
          </option>
        ) : null}
        {options.map((seconds) => (
          <option key={seconds} value={seconds}>
            {formatSecondsOption(seconds)}
          </option>
        ))}
      </Select>
    </div>
  );
}

function withCurrent(options: number[], current: number | null): number[] {
  if (current == null || options.includes(current)) {
    return options;
  }
  return [...options, current].sort((left, right) => left - right);
}

function describeChange(key: string, previous: string, applied: string) {
  if (key === "profile") {
    const previousLabel = profileValue(previous);
    const appliedLabel = profileValue(applied);
    return `Power profile: ${previousLabel} → ${appliedLabel}`;
  }
  if (key === "displayTimeout" || key === "sleepTimeout") {
    const label = key === "displayTimeout" ? "Display timeout" : "Sleep timeout";
    return `${label}: ${formatSecondsOption(Number(previous))} → ${formatSecondsOption(
      Number(applied),
    )}`;
  }
  return `${key}: ${previous} → ${applied}`;
}

function profileValue(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
