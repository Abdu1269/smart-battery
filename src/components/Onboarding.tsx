import * as React from "react";
import {
  ArrowLeft,
  BellRing,
  BatteryCharging,
  Check,
  ChevronRight,
  Leaf,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { BatteryOrb } from "@/components/BatteryOrb";
import { BrandLockup } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { alertLevel, formatHealth, stateLabel, validateSettings } from "@/lib/format";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Welcome", "Charging goals", "Alerts & tray"];

export function Onboarding() {
  const {
    settings,
    snapshot,
    saveSettings,
    ensureNotificationPermission,
    sendTestNotification,
    pushToast,
  } = useApp();
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<AppSettings | null>(settings);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = React.useState<boolean | null>(
    null,
  );

  React.useEffect(() => {
    if (settings && !draft) {
      setDraft(settings);
    }
  }, [draft, settings]);

  if (!settings || !draft) {
    return null;
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const setLow = (value: number) => {
    const next = Math.min(95, Math.max(5, value));
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        lowThreshold: next,
        highThreshold: Math.max(current.highThreshold, next + 5),
      };
    });
  };

  const setHigh = (value: number) => {
    const next = Math.min(100, Math.max(10, value));
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        highThreshold: next,
        lowThreshold: Math.min(current.lowThreshold, next - 5),
      };
    });
  };

  const requestPermission = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionGranted(granted);
    update("notificationEnabled", granted);
    return granted;
  };

  const testNotification = async () => {
    const granted = await ensureNotificationPermission();
    setPermissionGranted(granted);
    if (granted) {
      update("notificationEnabled", true);
      await sendTestNotification();
    }
  };

  const next = () => {
    if (step === 1) {
      const validation = validateSettings(draft);
      setErrors(validation);
      if (validation.length > 0) {
        return;
      }
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const finish = async (skip = false) => {
    const validation = validateSettings(draft);
    if (!skip && validation.length > 0) {
      setErrors(validation);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      let nextSettings: AppSettings = {
        ...draft,
        onboarded: true,
      };
      if (!skip && nextSettings.notificationEnabled) {
        const granted = await ensureNotificationPermission();
        setPermissionGranted(granted);
        if (!granted) {
          nextSettings = { ...nextSettings, notificationEnabled: false };
        }
      }
      await saveSettings(nextSettings);
      pushToast({
        title: "BatteryBloom is ready",
        description:
          "Monitoring runs in the tray. You can change every choice in Settings.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Setup could not be saved",
        description:
          error instanceof Error ? error.message : "Review your choices and try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const level = alertLevel(snapshot?.percent, draft);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-28 -top-28 size-96 rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full border border-primary/10" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <BrandLockup />
          <button
            type="button"
            onClick={() => void finish(true)}
            disabled={saving}
            className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            Skip for now
          </button>
        </header>

        <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
          {STEPS.map((label, index) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-[10px] font-bold",
                    index < step
                      ? "border-primary bg-primary text-primary-foreground"
                      : index === step
                        ? "border-primary bg-card text-primary"
                        : "border-border bg-card/60 text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {index < step ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-semibold sm:inline",
                    index === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span className="h-px w-5 bg-border sm:w-10" aria-hidden="true" />
              ) : null}
            </React.Fragment>
          ))}
        </div>

        <div className="mt-6 grid flex-1 items-stretch gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <section className="relative hidden overflow-hidden rounded-[2rem] border border-border/70 bg-[#173a2c] p-8 text-[#eef7f0] shadow-card lg:flex lg:flex-col">
            <div className="absolute -bottom-16 -right-14 size-64 rounded-full border border-white/10" />
            <div className="absolute -bottom-5 right-6 size-40 rounded-full border border-white/10" />
            <div className="relative flex-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/75">
                <Leaf className="size-3.5" aria-hidden="true" />
                Thoughtful by design
              </span>
              <h1 className="mt-7 text-balance font-display text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.04em]">
                A calmer way to care for your battery.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/65">
                No invented health scores. No fake savings. BatteryBloom uses the values
                your device actually exposes, and says so when a value is unavailable.
              </p>
            </div>
            <div className="relative mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Private from the start</p>
                  <p className="text-xs text-white/55">
                    Settings and history stay on this computer.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <Card className="flex min-w-0 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col p-5 sm:p-8">
              <div aria-live="polite" className="sr-only">
                Step {step + 1} of {STEPS.length}: {STEPS[step]}
              </div>

              {step === 0 ? (
                <div className="animate-rise flex flex-1 flex-col">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step one
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em]">
                    Your battery, as reported.
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    BatteryBloom reads the battery and power controls your operating
                    system exposes. It does not estimate missing values or claim a
                    charge limit worked without reading it back.
                  </p>

                  <div className="mt-6 grid items-center gap-5 rounded-[1.5rem] border border-border/80 bg-background/55 p-5 sm:grid-cols-[1fr_1.15fr] sm:p-6">
                    <BatteryOrb
                      percent={snapshot?.percent ?? null}
                      state={snapshot?.state ?? "unknown"}
                      tone={level === "none" ? "none" : level}
                      charging={snapshot?.state === "charging"}
                      className="max-w-[180px]"
                    />
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                          Current state
                        </p>
                        <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
                          {snapshot
                            ? stateLabel(snapshot.state)
                            : "Battery not detected"}
                        </p>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            Capacity vs design
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {formatHealth(
                              snapshot?.fullChargeCapacityMwh,
                              snapshot?.designCapacityMwh,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                            Power source
                          </dt>
                          <dd className="mt-1 font-semibold">
                            {snapshot?.powerSource === "ac"
                              ? "Plugged in"
                              : snapshot?.powerSource === "battery"
                                ? "Battery"
                                : "Unavailable"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-between">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MonitorSmartphone className="size-4" aria-hidden="true" />
                      Works from the tray while you get on with your day.
                    </p>
                    <Button onClick={next}>
                      Get started
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="animate-rise flex flex-1 flex-col">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step two
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em]">
                    Choose two gentle goals.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    These are reminders, not hardware limits. BatteryBloom alerts once
                    when a threshold is crossed, then waits for the battery to recover
                    before reminding again.
                  </p>

                  <div className="mt-6 space-y-6">
                    <div className="rounded-[1.35rem] border border-border/80 bg-background/45 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <BatteryCharging
                              className="size-4 text-warning-strong"
                              aria-hidden="true"
                            />
                            <label
                              htmlFor="onboarding-low"
                              className="text-sm font-semibold"
                            >
                              Low charge reminder
                            </label>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            A heads-up before you run out of time.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-2xl font-semibold tabular-nums">
                            {draft.lowThreshold}%
                          </span>
                          <Switch
                            checked={draft.lowEnabled}
                            onCheckedChange={(value) => update("lowEnabled", value)}
                            aria-label="Enable low charge reminder"
                          />
                        </div>
                      </div>
                      <Slider
                        id="onboarding-low"
                        className="mt-4"
                        min={5}
                        max={95}
                        step={1}
                        value={[draft.lowThreshold]}
                        onValueChange={([value]) => setLow(value ?? 20)}
                        aria-label="Low charge threshold"
                      />
                    </div>

                    <div className="rounded-[1.35rem] border border-border/80 bg-background/45 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Leaf className="size-4 text-primary" aria-hidden="true" />
                            <label
                              htmlFor="onboarding-high"
                              className="text-sm font-semibold"
                            >
                              High charge goal
                            </label>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            A reminder to unplug — it does not stop charging.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-2xl font-semibold tabular-nums">
                            {draft.highThreshold}%
                          </span>
                          <Switch
                            checked={draft.highEnabled}
                            onCheckedChange={(value) => update("highEnabled", value)}
                            aria-label="Enable high charge goal"
                          />
                        </div>
                      </div>
                      <Slider
                        id="onboarding-high"
                        className="mt-4"
                        min={10}
                        max={100}
                        step={1}
                        value={[draft.highThreshold]}
                        onValueChange={([value]) => setHigh(value ?? 80)}
                        aria-label="High charge goal"
                      />
                    </div>
                  </div>

                  {errors.length > 0 ? (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
                    >
                      {errors[0]}
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <Button variant="ghost" onClick={() => setStep(0)}>
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                    <Button onClick={next}>
                      Continue
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="animate-rise flex flex-1 flex-col">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Step three
                  </p>
                  <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.035em]">
                    Decide how you want to hear from us.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Alerts are deduplicated and never repeat endlessly. You can quiet
                    them at night.
                  </p>

                  <div className="mt-6 space-y-3">
                    <SettingLine
                      title="Native notifications"
                      description="The operating system controls notification permission."
                      checked={draft.notificationEnabled}
                      onCheckedChange={(value) => {
                        update("notificationEnabled", value);
                        if (value) {
                          void requestPermission();
                        }
                      }}
                      icon={<BellRing className="size-4" />}
                    >
                      {draft.notificationEnabled ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                          {permissionGranted === true ? (
                            <span className="text-xs font-medium text-primary">
                              Permission granted
                            </span>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void testNotification()}
                          >
                            Send a test
                          </Button>
                        </div>
                      ) : null}
                    </SettingLine>

                    <SettingLine
                      title="In-app banner"
                      description="A visible reminder while BatteryBloom is open."
                      checked={draft.visualAlertEnabled}
                      onCheckedChange={(value) => update("visualAlertEnabled", value)}
                    />

                    <SettingLine
                      title="Alert sound"
                      description="A soft two-note chime, played locally."
                      checked={draft.soundEnabled}
                      onCheckedChange={(value) => update("soundEnabled", value)}
                    >
                      {draft.soundEnabled ? (
                        <div className="mt-3 flex items-center gap-3 border-t border-border/70 pt-3">
                          <span className="text-xs text-muted-foreground">Volume</span>
                          <Slider
                            className="max-w-[180px]"
                            min={0}
                            max={100}
                            step={5}
                            value={[draft.soundVolume]}
                            onValueChange={([value]) =>
                              update("soundVolume", value ?? 65)
                            }
                            aria-label="Alert sound volume"
                          />
                          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                            {draft.soundVolume}%
                          </span>
                        </div>
                      ) : null}
                    </SettingLine>

                    <SettingLine
                      title="Keep running in the tray"
                      description="Closing the window keeps monitoring active."
                      checked={draft.minimizeToTray}
                      onCheckedChange={(value) => update("minimizeToTray", value)}
                    />

                    <SettingLine
                      title="Start when I sign in"
                      description="Adds BatteryBloom to your desktop autostart."
                      checked={draft.startOnLogin}
                      onCheckedChange={(value) => update("startOnLogin", value)}
                    />
                  </div>

                  <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
                    <ShieldCheck
                      className="mt-0.5 size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    BatteryBloom never runs privileged commands and never uploads
                    battery data. Notification permission can be changed in your system
                    settings.
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      <ArrowLeft className="size-4" />
                      Back
                    </Button>
                    <Button onClick={() => void finish()} disabled={saving}>
                      {saving ? "Finishing…" : "Finish setup"}
                      {saving ? null : <Check className="size-4" />}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
          BatteryBloom is a local utility. It does not create an account or send
          telemetry.
        </p>
      </div>
    </div>
  );
}

function SettingLine({
  title,
  description,
  checked,
  onCheckedChange,
  icon,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {icon ? (
              <span className="text-muted-foreground" aria-hidden="true">
                {icon}
              </span>
            ) : null}
            {title}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label={title}
        />
      </div>
      {children}
    </div>
  );
}
