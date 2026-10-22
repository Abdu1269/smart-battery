import * as React from "react";
import {
  BatteryCharging,
  BellRing,
  Check,
  ChevronRight,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { CapabilityBadge } from "@/components/CapabilityBadge";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { api, BackendError } from "@/lib/api";
import { formatClockDate, validateSettings } from "@/lib/format";
import { cn } from "@/lib/utils";

const HIGH_PRESETS = [60, 70, 80, 90];

export function ChargingPage() {
  const {
    settings,
    chargeLimit,
    snapshot,
    saveSettings,
    refreshChargeLimit,
    setPage,
    pushToast,
  } = useApp();
  const [lowEnabled, setLowEnabled] = React.useState(settings?.lowEnabled ?? true);
  const [low, setLow] = React.useState(settings?.lowThreshold ?? 20);
  const [highEnabled, setHighEnabled] = React.useState(settings?.highEnabled ?? true);
  const [high, setHigh] = React.useState(settings?.highThreshold ?? 80);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [limitOpen, setLimitOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [limitStart, setLimitStart] = React.useState(50);
  const [limitEnd, setLimitEnd] = React.useState(80);
  const [manageStart, setManageStart] = React.useState(true);
  const [limitError, setLimitError] = React.useState<string | null>(null);
  const [applyingLimit, setApplyingLimit] = React.useState(false);
  const [resettingLimit, setResettingLimit] = React.useState(false);

  React.useEffect(() => {
    if (!settings || dirty) {
      return;
    }
    setLowEnabled(settings.lowEnabled);
    setLow(settings.lowThreshold);
    setHighEnabled(settings.highEnabled);
    setHigh(settings.highThreshold);
  }, [settings, dirty]);

  if (!settings) {
    return null;
  }

  const capability = chargeLimit;
  const minimum = capability?.minimum ?? 50;
  const maximum = capability?.maximum ?? 100;
  const hardwareSupported = capability?.status === "supported";
  const baseline = settings.chargeLimitBaseline;

  const markLow = (value: number) => {
    const next = Math.min(95, Math.max(5, value));
    setLow(next);
    setHigh((current) => Math.max(current, next + 5));
    setDirty(true);
  };

  const markHigh = (value: number) => {
    const next = Math.min(100, Math.max(10, value));
    setHigh(next);
    setLow((current) => Math.min(current, next - 5));
    setDirty(true);
  };

  const saveAlerts = async () => {
    const next = {
      ...settings,
      lowEnabled,
      lowThreshold: low,
      highEnabled,
      highThreshold: high,
    };
    const errors = validateSettings(next);
    if (errors.length > 0) {
      pushToast({
        title: "Review these charging goals",
        description: errors[0],
        variant: "error",
      });
      return;
    }
    setSaving(true);
    try {
      await saveSettings(next);
      setDirty(false);
      pushToast({
        title: "Charging goals saved",
        description:
          "New crossings use these thresholds. Hardware charging behavior is unchanged unless you set a verified limit.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Charging goals were not saved",
        description:
          error instanceof BackendError ? error.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const openLimitDialog = () => {
    const currentEnd = capability?.currentEnd ?? 80;
    const currentStart = capability?.currentStart;
    setLimitEnd(Math.min(maximum, Math.max(minimum, currentEnd)));
    setManageStart(Boolean(capability?.supportsStartThreshold && currentStart != null));
    setLimitStart(
      currentStart ??
        Math.max(minimum, Math.min(80, (capability?.currentEnd ?? 80) - 20)),
    );
    setLimitError(null);
    setLimitOpen(true);
  };

  const applyLimit = async () => {
    setLimitError(null);
    const includeStart = Boolean(capability?.supportsStartThreshold && manageStart);
    if (limitEnd < minimum || limitEnd > maximum) {
      setLimitError(`End threshold must be between ${minimum}% and ${maximum}%.`);
      return;
    }
    if (includeStart) {
      if (limitStart >= limitEnd) {
        setLimitError("Start threshold must be lower than the end threshold.");
        return;
      }
      if (limitStart < minimum) {
        setLimitError(`Start threshold must be at least ${minimum}%.`);
        return;
      }
    }
    setApplyingLimit(true);
    try {
      const result = await api.setChargeLimit({
        start: includeStart ? limitStart : null,
        end: limitEnd,
        confirmed: true,
      });
      setLimitOpen(false);
      pushToast({
        title: "Charge limit verified",
        description: `The threshold read back as ${
          result.readBackStart != null ? `${result.readBackStart}–` : ""
        }${result.readBackEnd}%.`,
        variant: "success",
      });
      await refreshChargeLimit();
    } catch (error) {
      const message =
        error instanceof BackendError
          ? error.message
          : "The charge limit could not be applied.";
      setLimitError(message);
      if (error instanceof BackendError && error.code === "permissionRequired") {
        await refreshChargeLimit();
      }
    } finally {
      setApplyingLimit(false);
    }
  };

  const restoreBaseline = async () => {
    setResettingLimit(true);
    try {
      const result = await api.resetChargeLimit();
      setResetOpen(false);
      pushToast({
        title: "Previous thresholds restored",
        description: `Read back as ${
          result.readBackStart != null ? `${result.readBackStart}–` : ""
        }${result.readBackEnd}%.`,
        variant: "success",
      });
      await refreshChargeLimit();
    } catch (error) {
      pushToast({
        title: "Thresholds were not restored",
        description:
          error instanceof BackendError
            ? error.message
            : "The previous threshold could not be restored.",
        variant: "error",
      });
    } finally {
      setResettingLimit(false);
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Charging"
        title="Set a goal. Stay in charge."
        description="BatteryBloom separates two different things: reminders you control, and a hardware limit only when the device exposes a verified, writable interface."
        actions={
          hardwareSupported ? (
            <Button onClick={openLimitDialog}>
              <ShieldCheck className="size-4" />
              Set hardware limit
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setPage("help")}>
              Read platform notes
            </Button>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Hardware charge limit
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  {hardwareSupported
                    ? "A verified threshold"
                    : capability?.status === "permissionRequired"
                      ? "Detected, not writable"
                      : "Not available here"}
                </h2>
              </div>
              {capability ? <CapabilityBadge status={capability.status} /> : null}
            </div>

            {hardwareSupported ? (
              <>
                <div className="mt-5 rounded-[1.35rem] border border-primary/20 bg-accent/45 p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Current threshold
                      </p>
                      <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.045em]">
                        {capability.currentStart != null
                          ? `${capability.currentStart}–`
                          : ""}
                        {capability.currentEnd ?? "—"}
                        <span className="ml-1 text-lg text-muted-foreground">%</span>
                      </p>
                    </div>
                    <Badge variant="success">
                      <Check className="size-3" aria-hidden="true" />
                      Read-back verified
                    </Badge>
                  </div>
                  <p className="mt-3 max-w-lg text-xs leading-5 text-muted-foreground">
                    BatteryBloom writes only this device's supported threshold
                    interface. It reads the values back and never reports success before
                    verification.
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={openLimitDialog} size="sm">
                    Change threshold
                  </Button>
                  {baseline ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResetOpen(true)}
                    >
                      Restore previous values
                    </Button>
                  ) : null}
                  {settings.lastChargeLimitAppliedAt ? (
                    <span className="text-[11px] text-muted-foreground">
                      Last applied {formatClockDate(settings.lastChargeLimitAppliedAt)}
                    </span>
                  ) : null}
                </div>

                {baseline ? (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Before BatteryBloom's first change:{" "}
                    <strong className="font-semibold text-foreground">
                      {baseline.start != null ? `${baseline.start}–` : ""}
                      {baseline.end}%
                    </strong>{" "}
                    (saved {formatClockDate(baseline.capturedAt)}).
                  </p>
                ) : null}

                <p className="mt-4 flex items-start gap-2 border-t border-border/70 pt-3 text-[11px] leading-5 text-muted-foreground">
                  <Info
                    className="mt-0.5 size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  A charge limit reduces time near full charge. It is a longevity
                  preference, not a medical recommendation for every battery. Heat, age,
                  and use also matter.
                </p>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "mt-5 rounded-[1.35rem] border p-5",
                    capability?.status === "permissionRequired"
                      ? "border-warning/30 bg-warning/10"
                      : "border-border bg-background/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        capability?.status === "permissionRequired"
                          ? "bg-warning/20 text-warning-strong"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {capability?.status === "permissionRequired" ? (
                        <LockKeyhole className="size-5" aria-hidden="true" />
                      ) : (
                        <BatteryCharging className="size-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {capability?.status === "permissionRequired"
                          ? "The interface exists, but BatteryBloom cannot write it"
                          : "BatteryBloom will not pretend to control charging"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {capability?.reason ??
                          "No charge-threshold interface was found on this device."}
                      </p>
                      {capability?.nextStep ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            Next step:{" "}
                          </span>
                          {capability.nextStep}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  BatteryBloom does not ask for root, install a privileged helper, or
                  run shell commands to force a write. The high charging goal below is a
                  reminder, not a limit.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage("help")}>
                    Platform notes
                  </Button>
                  {capability?.status === "permissionRequired" ||
                  capability?.status === "readOnly" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        pushToast({
                          title: "A reminder is still useful",
                          description:
                            "Set a high charge goal and BatteryBloom will alert you when it is reached.",
                          variant: "info",
                        })
                      }
                    >
                      Use a goal instead
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Your reminders
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  Two useful signals
                </h2>
              </div>
              {snapshot?.percent != null ? (
                <Badge variant="neutral" className="normal-case">
                  Now {snapshot.percent}%
                </Badge>
              ) : null}
            </div>

            <GoalField
              title="Low charge"
              description="When the battery falls to this level."
              enabled={lowEnabled}
              onEnabledChange={(value) => {
                setLowEnabled(value);
                setDirty(true);
              }}
              value={low}
              onChange={markLow}
              min={5}
              max={95}
              tone="warning"
              icon={<BatteryCharging className="size-4" />}
            />

            <GoalField
              title="High charge goal"
              description="When the battery reaches this level. A reminder only."
              enabled={highEnabled}
              onEnabledChange={(value) => {
                setHighEnabled(value);
                setDirty(true);
              }}
              value={high}
              onChange={markHigh}
              min={10}
              max={100}
              tone="primary"
              icon={<BellRing className="size-4" />}
            />

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Quick goals
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {HIGH_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setHighEnabled(true);
                      markHigh(preset);
                    }}
                    aria-pressed={high === preset}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      high === preset
                        ? "border-primary/30 bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-muted/55 p-3.5">
              <p className="text-xs font-semibold">How reminders behave</p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-muted-foreground">
                <li>Fires once when a threshold is crossed, not on every refresh.</li>
                <li>
                  Re-arms after the battery moves {settings.hysteresisPercent}{" "}
                  percentage points back, with a {settings.cooldownMinutes}-minute
                  cooldown.
                </li>
                <li>
                  Quiet hours and channels are managed in{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setPage("settings")}
                  >
                    Settings
                  </button>
                  .
                </li>
              </ul>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-4">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {settings.notificationEnabled ? (
                  <BellRing className="size-3.5" aria-hidden="true" />
                ) : (
                  <Volume2 className="size-3.5" aria-hidden="true" />
                )}
                {settings.notificationEnabled
                  ? "Notifications on"
                  : "Notifications off"}
                {settings.soundEnabled ? " · sound on" : " · silent"}
              </div>
              <Button onClick={() => void saveAlerts()} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save goals"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5 border-dashed">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <SlidersHorizontal
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold">What this page will never do</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                It will not estimate a limit, claim a reminder stopped charging, or
                write a threshold without a supported interface and a successful
                read-back. If a write fails, it says so.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPage("help")}>
            How limits work
            <ChevronRight className="size-3.5" />
          </Button>
        </CardContent>
      </Card>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change the hardware charge limit</DialogTitle>
            <DialogDescription>
              This writes the threshold exposed by this device. BatteryBloom will read
              it back immediately and restore the previous values if verification fails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {capability?.supportsStartThreshold ? (
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 p-3.5">
                <div>
                  <p className="text-sm font-semibold">Also set start threshold</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Some devices use a start value to begin charging again.
                  </p>
                </div>
                <Switch
                  checked={manageStart}
                  onCheckedChange={setManageStart}
                  aria-label="Also set start threshold"
                />
              </div>
            ) : null}

            {manageStart && capability?.supportsStartThreshold ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="limit-start" className="text-sm font-semibold">
                    Start charging at
                  </label>
                  <span className="font-display text-xl font-semibold tabular-nums">
                    {limitStart}%
                  </span>
                </div>
                <Slider
                  id="limit-start"
                  className="mt-2"
                  min={minimum}
                  max={maximum - 1}
                  step={1}
                  value={[limitStart]}
                  onValueChange={([value]) => setLimitStart(value ?? minimum)}
                  aria-label="Charge limit start threshold"
                />
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="limit-end" className="text-sm font-semibold">
                  Stop charging at
                </label>
                <span className="font-display text-xl font-semibold tabular-nums">
                  {limitEnd}%
                </span>
              </div>
              <Slider
                id="limit-end"
                className="mt-2"
                min={minimum}
                max={maximum}
                step={1}
                value={[limitEnd]}
                onValueChange={([value]) => setLimitEnd(value ?? maximum)}
                aria-label="Charge limit end threshold"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Supported range: {minimum}–{maximum}%. Current:{" "}
                {capability?.currentStart != null ? `${capability.currentStart}–` : ""}
                {capability?.currentEnd ?? "—"}%.
              </p>
            </div>

            {limitError ? (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
              >
                {limitError}
              </div>
            ) : null}

            <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-[11px] leading-5 text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Before you apply:
              </strong>{" "}
              a hardware limit can change when the battery charges. It does not undo
              battery wear. You can restore the saved values from this page.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLimitOpen(false)}
              disabled={applyingLimit}
            >
              Cancel
            </Button>
            <Button onClick={() => void applyLimit()} disabled={applyingLimit}>
              {applyingLimit ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Applying and verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  Apply and verify
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore the previous thresholds?</DialogTitle>
            <DialogDescription>
              BatteryBloom will write back the values it captured before its first
              change, then read them back to verify.
            </DialogDescription>
          </DialogHeader>
          {baseline ? (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Saved baseline
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {baseline.start != null ? `${baseline.start}–` : ""}
                {baseline.end}%
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Captured {formatClockDate(baseline.capturedAt)}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resettingLimit}
            >
              Keep current
            </Button>
            <Button onClick={() => void restoreBaseline()} disabled={resettingLimit}>
              {resettingLimit ? "Restoring…" : "Restore previous values"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalField({
  title,
  description,
  enabled,
  onEnabledChange,
  value,
  onChange,
  min,
  max,
  tone,
  icon,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  tone: "warning" | "primary";
  icon: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="mt-4 rounded-[1.25rem] border border-border/80 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold">
            <span
              className={cn(
                tone === "warning" ? "text-warning-strong" : "text-primary",
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
            {title}
          </label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl font-semibold tabular-nums">
            {value}%
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label={`Enable ${title}`}
          />
        </div>
      </div>
      <Slider
        id={id}
        className="mt-3"
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next ?? value)}
        aria-label={`${title} threshold`}
      />
    </div>
  );
}
