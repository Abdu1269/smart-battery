import * as React from "react";
import {
  BellRing,
  Check,
  ClipboardCopy,
  Download,
  History,
  Info,
  Laptop,
  Moon,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Volume2,
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";

import { useApp } from "@/app/AppProvider";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { api, BackendError } from "@/lib/api";
import { minutesToTime, timeToMinutes, validateSettings } from "@/lib/format";
import { playAlertChime } from "@/lib/presentation";
import type {
  AlertPowerScope,
  AppSettings,
  DiagnosticsReport,
  StartupAlertPolicy,
  ThemePreference,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COOLDOWNS = [0, 5, 10, 15, 30, 60, 120];
const POLL_INTERVALS = [15, 30, 60, 120, 300];
const RETENTIONS = [7, 30, 90, 180, 365];
const SAMPLING = [1, 5, 15, 30, 60];

export function SettingsPage() {
  const {
    settings,
    capabilities,
    appVersion,
    saveSettings,
    resetSettings,
    ensureNotificationPermission,
    sendTestNotification,
    openSystemSettings,
    setPage,
    pushToast,
  } = useApp();
  const [draft, setDraft] = React.useState<AppSettings | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const [diagnostics, setDiagnostics] = React.useState<DiagnosticsReport | null>(null);
  const [diagError, setDiagError] = React.useState<string | null>(null);
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [diagSaving, setDiagSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings && !dirty) {
      setDraft(settings);
    }
  }, [settings, dirty]);

  if (!settings || !draft) {
    return null;
  }

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setDirty(true);
    setErrors([]);
  };

  const updateQuietHours = (
    key: "enabled" | "startMinutes" | "endMinutes",
    value: boolean | number,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            quietHours: { ...current.quietHours, [key]: value },
          }
        : current,
    );
    setDirty(true);
    setErrors([]);
  };

  const updateLow = (value: number) => {
    const next = Math.min(95, Math.max(5, value));
    setDraft((current) =>
      current
        ? {
            ...current,
            lowThreshold: next,
            highThreshold: Math.max(current.highThreshold, next + 5),
          }
        : current,
    );
    setDirty(true);
    setErrors([]);
  };

  const updateHigh = (value: number) => {
    const next = Math.min(100, Math.max(10, value));
    setDraft((current) =>
      current
        ? {
            ...current,
            highThreshold: next,
            lowThreshold: Math.min(current.lowThreshold, next - 5),
          }
        : current,
    );
    setDirty(true);
    setErrors([]);
  };

  const toggleNotifications = async (checked: boolean) => {
    update("notificationEnabled", checked);
    if (!checked) {
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      setDraft((current) =>
        current ? { ...current, notificationEnabled: false } : current,
      );
    } else {
      pushToast({
        title: "Notifications allowed",
        description: "Use the test button to check delivery.",
        variant: "success",
      });
    }
  };

  const testNotification = async () => {
    const granted = await ensureNotificationPermission();
    if (granted) {
      await sendTestNotification();
    }
  };

  const saveAll = async () => {
    const validation = validateSettings(draft);
    setErrors(validation);
    if (validation.length > 0) {
      return;
    }
    setSaving(true);
    try {
      let next = draft;
      if (next.notificationEnabled) {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          next = { ...next, notificationEnabled: false };
          setDraft(next);
        }
      }
      const saved = await saveSettings(next);
      setDraft(saved);
      setDirty(false);
      pushToast({
        title: "Settings saved",
        description:
          "Your local preferences were updated. Monitoring uses them from the next refresh.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Settings were not saved",
        description:
          error instanceof BackendError
            ? error.message
            : "Review your settings and try again.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraft(settings);
    setDirty(false);
    setErrors([]);
  };

  const reset = async () => {
    setResetting(true);
    try {
      const saved = await resetSettings();
      setDraft(saved);
      setDirty(false);
      setErrors([]);
      setResetOpen(false);
      pushToast({
        title: "Settings reset",
        description:
          "Defaults restored. Saved charge-limit baselines were kept so you can still undo a hardware change.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Settings were not reset",
        description:
          error instanceof BackendError
            ? error.message
            : "The default settings could not be saved.",
        variant: "error",
      });
    } finally {
      setResetting(false);
    }
  };

  const openDiagnostics = async () => {
    setDiagOpen(true);
    setDiagLoading(true);
    setDiagError(null);
    try {
      setDiagnostics(await api.getDiagnostics());
    } catch (error) {
      setDiagError(
        error instanceof BackendError
          ? error.message
          : "The diagnostics report could not be created.",
      );
    } finally {
      setDiagLoading(false);
    }
  };

  const copyDiagnostics = async () => {
    try {
      await api.copyDiagnostics();
      pushToast({
        title: "Diagnostics copied",
        description: "A privacy-limited report is on your clipboard.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Copy failed",
        description:
          error instanceof BackendError
            ? error.message
            : "The report could not be copied.",
        variant: "error",
      });
    }
  };

  const saveDiagnostics = async () => {
    setDiagSaving(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const path = await save({
        title: "Save BatteryBloom diagnostics",
        defaultPath: `batterybloom-diagnostics-${date}.json`,
        filters: [{ name: "JSON data", extensions: ["json"] }],
      });
      if (!path) {
        return;
      }
      await api.saveDiagnostics(path);
      pushToast({
        title: "Diagnostics saved",
        description: "The report does not contain an account or serial number.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Diagnostics were not saved",
        description:
          error instanceof BackendError
            ? error.message
            : "The report could not be written.",
        variant: "error",
      });
    } finally {
      setDiagSaving(false);
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Settings"
        title="Make it yours."
        description="Every setting is local. Changes take effect after you save, except notification permission, which the system controls."
        actions={
          <Badge variant={dirty ? "warning" : "success"} className="normal-case">
            {dirty ? "Unsaved changes" : "All changes saved"}
          </Badge>
        }
      />

      {errors.length > 0 ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="text-sm font-semibold text-destructive">
            A few settings need attention
          </p>
          <ul className="mt-1.5 list-inside list-disc text-xs leading-5 text-destructive">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsSection
          icon={<BellRing className="size-4" />}
          title="Alerts"
          description="Low and high goals are separate. Both are reminders, never hardware claims."
        >
          <ThresholdControl
            id="settings-low"
            title="Low charge"
            description="Alert when the battery falls to this level."
            enabled={draft.lowEnabled}
            onEnabledChange={(value) => update("lowEnabled", value)}
            value={draft.lowThreshold}
            onChange={updateLow}
            min={5}
            max={95}
          />
          <ThresholdControl
            id="settings-high"
            title="High charge goal"
            description="Alert when the battery reaches this level. This does not stop charging."
            enabled={draft.highEnabled}
            onEnabledChange={(value) => update("highEnabled", value)}
            value={draft.highThreshold}
            onChange={updateHigh}
            min={10}
            max={100}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Hysteresis"
              hint="How far the battery must move back before an alert re-arms."
            >
              <div className="flex items-center gap-3">
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[draft.hysteresisPercent]}
                  onValueChange={([value]) => update("hysteresisPercent", value ?? 5)}
                  aria-label="Alert hysteresis"
                />
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                  {draft.hysteresisPercent} pp
                </span>
              </div>
            </Field>
            <Field
              label="Cooldown"
              hint="Minimum time between repeat alerts of the same kind."
            >
              <Select
                value={draft.cooldownMinutes}
                onChange={(event) =>
                  update("cooldownMinutes", Number(event.target.value))
                }
                aria-label="Alert cooldown"
              >
                {COOLDOWNS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? "No cooldown" : `${minutes} minutes`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Apply alerts when" hint="Power-source scope.">
              <Select
                value={draft.alertPowerScope}
                onChange={(event) =>
                  update("alertPowerScope", event.target.value as AlertPowerScope)
                }
                aria-label="Alert power scope"
              >
                <option value="both">Either power source</option>
                <option value="battery">On battery only</option>
                <option value="ac">Plugged in only</option>
              </Select>
            </Field>
            <Field
              label="On startup"
              hint="Avoid repeating a low alert just because the app started."
            >
              <Select
                value={draft.alertOnStart}
                onChange={(event) =>
                  update("alertOnStart", event.target.value as StartupAlertPolicy)
                }
                aria-label="Alert startup policy"
              >
                <option value="crossingOnly">Only when a threshold is crossed</option>
                <option value="immediate">Alert for the current state</option>
              </Select>
            </Field>
          </div>

          <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Quiet hours</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Native notifications and sound can pause while visual alerts remain.
                </p>
              </div>
              <Switch
                checked={draft.quietHours.enabled}
                onCheckedChange={(value) => updateQuietHours("enabled", value)}
                aria-label="Enable quiet hours"
              />
            </div>
            {draft.quietHours.enabled ? (
              <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/70 pt-3">
                <label className="text-xs font-medium">
                  From
                  <Input
                    type="time"
                    className="mt-1 w-32"
                    value={minutesToTime(draft.quietHours.startMinutes)}
                    onChange={(event) =>
                      updateQuietHours(
                        "startMinutes",
                        timeToMinutes(event.target.value),
                      )
                    }
                  />
                </label>
                <label className="text-xs font-medium">
                  To
                  <Input
                    type="time"
                    className="mt-1 w-32"
                    value={minutesToTime(draft.quietHours.endMinutes)}
                    onChange={(event) =>
                      updateQuietHours("endMinutes", timeToMinutes(event.target.value))
                    }
                  />
                </label>
                <p className="pb-2 text-[11px] text-muted-foreground">
                  Uses this computer's local time.
                </p>
              </div>
            ) : null}
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Volume2 className="size-4" />}
          title="How alerts arrive"
          description="Choose any combination. BatteryBloom deduplicates events at the source."
        >
          <ToggleRow
            title="Native notifications"
            description="Sent by the operating system when BatteryBloom is not focused."
            checked={draft.notificationEnabled}
            onCheckedChange={(value) => void toggleNotifications(value)}
          />
          <ToggleRow
            title="In-app banner"
            description="A calm reminder at the top of the window."
            checked={draft.visualAlertEnabled}
            onCheckedChange={(value) => update("visualAlertEnabled", value)}
          />
          <ToggleRow
            title="Alert sound"
            description="A soft two-note chime generated locally."
            checked={draft.soundEnabled}
            onCheckedChange={(value) => update("soundEnabled", value)}
          />
          <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="sound-volume">
                Sound volume
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {draft.soundVolume}%
              </span>
            </div>
            <Slider
              id="sound-volume"
              className="mt-3"
              min={0}
              max={100}
              step={5}
              value={[draft.soundVolume]}
              onValueChange={([value]) => update("soundVolume", value ?? 65)}
              disabled={!draft.soundEnabled}
              aria-label="Alert sound volume"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playAlertChime(draft.soundVolume)}
                disabled={!draft.soundEnabled || draft.soundVolume === 0}
              >
                <Play className="size-3.5" />
                Preview chime
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void testNotification()}
                disabled={!draft.notificationEnabled}
              >
                <BellRing className="size-3.5" />
                Send test notification
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Native notification permission is controlled by your OS.{" "}
              <button
                type="button"
                className="font-semibold text-primary underline-offset-4 hover:underline"
                onClick={() => void openSystemSettings("notifications")}
              >
                Open notification settings
              </button>
              .
            </p>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Laptop className="size-4" />}
          title="Background & startup"
          description="Monitoring runs from the tray without an account or cloud service."
        >
          <ToggleRow
            title="Minimize to tray instead of closing"
            description="Closing the window keeps monitoring active. Quit from the tray menu."
            checked={draft.minimizeToTray}
            onCheckedChange={(value) => update("minimizeToTray", value)}
          />
          <ToggleRow
            title="Start when I sign in"
            description="Uses your desktop's autostart mechanism."
            checked={draft.startOnLogin}
            onCheckedChange={(value) => update("startOnLogin", value)}
          />
          {draft.startOnLogin ? (
            <ToggleRow
              title="Start hidden"
              description="Open to the tray when started at login."
              checked={draft.launchMinimized}
              onCheckedChange={(value) => update("launchMinimized", value)}
            />
          ) : null}
          {capabilities?.autostart.reason ? (
            <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              {capabilities.autostart.reason}
            </p>
          ) : null}
          <Field
            label="Refresh battery every"
            hint="Shorter intervals react faster but read the system more often."
          >
            <Select
              value={draft.pollIntervalSecs}
              onChange={(event) =>
                update("pollIntervalSecs", Number(event.target.value))
              }
              aria-label="Battery refresh interval"
            >
              {POLL_INTERVALS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds < 60
                    ? `${seconds} seconds`
                    : `${seconds / 60} minute${seconds === 60 ? "" : "s"}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Theme" hint="System follows your desktop appearance.">
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Theme"
            >
              {(
                [
                  { id: "system", label: "System", icon: Laptop },
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dark", label: "Dark", icon: Moon },
                ] as { id: ThemePreference; label: string; icon: typeof Sun }[]
              ).map((option) => {
                const Icon = option.icon;
                const selected = draft.theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update("theme", option.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary/40 bg-accent text-accent-foreground"
                        : "border-border bg-background/50 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Field>
        </SettingsSection>

        <SettingsSection
          icon={<History className="size-4" />}
          title="History"
          description="A compact local trail of what the battery reported."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Keep history for"
              hint="Older samples are pruned automatically."
            >
              <Select
                value={draft.historyRetentionDays}
                onChange={(event) =>
                  update("historyRetentionDays", Number(event.target.value))
                }
                aria-label="History retention"
              >
                {RETENTIONS.map((days) => (
                  <option key={days} value={days}>
                    {days === 365 ? "1 year" : `${days} days`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Sample every" hint="History is written locally as JSONL.">
              <Select
                value={draft.historySamplingMinutes}
                onChange={(event) =>
                  update("historySamplingMinutes", Number(event.target.value))
                }
                aria-label="History sampling interval"
              >
                {SAMPLING.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 1 ? "1 minute" : `${minutes} minutes`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            BatteryBloom currently has {""}
            <button
              type="button"
              onClick={() => setPage("history")}
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              battery history
            </button>{" "}
            available to review, export, or clear.
          </p>
        </SettingsSection>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <SettingsSection
          icon={<ShieldCheck className="size-4" />}
          title="Data & privacy"
          description="BatteryBloom has no account, telemetry, cloud sync, or advertising."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                Stored locally
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Settings and history live in BatteryBloom's local app-data folder. No
                battery data is sent over the network.
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                Diagnostics on demand
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Create a privacy-limited report with battery values, capabilities, and
                settings. No serial number, username, hostname, or file path.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void openDiagnostics()}>
              <Settings2 className="size-3.5" />
              View diagnostics
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void copyDiagnostics()}>
              <ClipboardCopy className="size-3.5" />
              Copy report
            </Button>
          </div>
          <div className="flex flex-col gap-3 rounded-[1.15rem] border border-destructive/20 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-destructive">
                Reset all settings
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Restore defaults, including startup and alert choices. Saved
                charge-limit baselines are kept.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </SettingsSection>

        <SettingsSection
          icon={<Info className="size-4" />}
          title="About BatteryBloom"
          description="A deliberately small utility for understanding battery care."
        >
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-semibold">{appVersion}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
              <dt className="text-muted-foreground">Platform</dt>
              <dd className="font-semibold">
                {capabilities
                  ? `${capabilities.platform} · ${capabilities.architecture}`
                  : "Unknown"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Battery source</dt>
              <dd className="text-right font-semibold">
                {capabilities?.battery.status === "supported"
                  ? "System battery API"
                  : (capabilities?.battery.status ?? "Unknown")}
              </dd>
            </div>
          </dl>
          <div className="rounded-xl bg-muted/55 p-3 text-[11px] leading-5 text-muted-foreground">
            Hardware charge limits are supported only where a writable, verifiable
            interface exists. Windows and macOS builds have not been validated on real
            hardware for this project.
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage("help")}>
            Read the honest limitations
          </Button>
        </SettingsSection>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t border-border/80 bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {dirty
              ? "You have unsaved changes."
              : "BatteryBloom is using the settings shown here."}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={revert} disabled={!dirty || saving}>
              Revert
            </Button>
            <Button onClick={() => void saveAll()} disabled={!dirty || saving}>
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <Check className="size-4" />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset BatteryBloom settings?</DialogTitle>
            <DialogDescription>
              Alerts, theme, startup, monitoring, and history preferences return to
              their defaults. Local history is not deleted. Saved hardware charge-limit
              baselines stay so a change can still be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void reset()}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Reset settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Diagnostics report</DialogTitle>
            <DialogDescription>
              This report contains battery values, capabilities, and settings. It does
              not include identifiers or file paths.
            </DialogDescription>
          </DialogHeader>
          {diagLoading ? (
            <div className="rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              Building report…
            </div>
          ) : diagError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {diagError}
            </div>
          ) : diagnostics ? (
            <pre className="max-h-[48vh] overflow-auto rounded-xl border border-border bg-muted/45 p-4 text-[11px] leading-5">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => void copyDiagnostics()}>
              <ClipboardCopy className="size-4" />
              Copy
            </Button>
            <Button onClick={() => void saveDiagnostics()} disabled={diagSaving}>
              <Download className="size-4" />
              {diagSaving ? "Saving…" : "Save JSON"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
            aria-hidden="true"
          >
            {icon}
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{hint}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

function ThresholdControl({
  id,
  title,
  description,
  enabled,
  onEnabledChange,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="rounded-[1.15rem] border border-border/80 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="text-sm font-semibold">
            {title}
          </label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-semibold tabular-nums">
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
