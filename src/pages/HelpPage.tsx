import {
  BatteryCharging,
  BellRing,
  CircleHelp,
  Database,
  Gauge,
  Info,
  Keyboard,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  Thermometer,
  Zap,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { CapabilityBadge } from "@/components/CapabilityBadge";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function HelpPage() {
  const {
    capabilities,
    chargeLimit,
    powerSettings,
    appVersion,
    setPage,
    openSystemSettings,
  } = useApp();

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="Help"
        title="Battery care without the folklore."
        description="What BatteryBloom knows, what it does not know, and how to read the difference. Short answers, no manufactured urgency."
        actions={
          <Button variant="outline" onClick={() => setPage("settings")}>
            Open settings
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-accent/35">
          <CardContent className="p-5">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-semibold">Real data only</h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              Missing values show as “—”. BatteryBloom does not estimate health,
              savings, runtime, or a successful charge limit.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <LockKeyhole className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-semibold">
              No privileged helper
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              If a threshold is root-owned, BatteryBloom reports “permission needed”. It
              never asks for sudo or runs a shell to force a write.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Database className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-semibold">
              Local by default
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              No telemetry, account, ads, or cloud sync. Diagnostics are created on
              demand and omit identifiers and file paths.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
                <BatteryCharging className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
                  What a charge limit really is
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  A firmware or operating-system threshold, not a notification.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <p>
                Some laptops expose a start and stop threshold through a supported
                system interface. When that interface is writable, BatteryBloom writes
                the values, reads them back, and only then reports success. Before its
                first change it saves the previous values so they can be restored.
              </p>
              <p>
                Many laptops do not expose this. Some expose it read-only, or only to a
                privileged process. BatteryBloom shows that state plainly. A high-charge
                reminder is still useful: it tells you when to unplug, without
                pretending software stopped charging.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/50 p-3">
              <span className="text-xs font-semibold">This device:</span>
              {chargeLimit ? (
                <CapabilityBadge status={chargeLimit.status} />
              ) : (
                <Badge variant="neutral" className="normal-case">
                  Unknown
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {chargeLimit?.reason ?? "No charge interface information."}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
                <BellRing className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
                  How alerts behave
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  One crossing, one alert, then a quiet re-arm.
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                Low and high alerts are edge-triggered. BatteryBloom does not repeat an
                alert on every refresh.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                Hysteresis moves the re-arm point away from the threshold so a battery
                hovering at 80% does not create a stream of alerts.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />A
                cooldown provides a second guard. Quiet hours can silence native
                notifications and sound while keeping the event visible.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                Alerts are visual, audible, and optionally native. You choose which
                channels are active.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-primary">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
                Guidance worth keeping
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Battery ageing is real, but it is not a moral test. These are practical
                defaults, not rules.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tip
              icon={<Thermometer className="size-4" />}
              title="Avoid sustained heat"
              text="Heat is one of the strongest environmental factors in battery ageing. Keep vents clear and avoid leaving the laptop in a hot car."
            />
            <Tip
              icon={<BatteryCharging className="size-4" />}
              title="Reduce time at 100%"
              text="If your routine makes it easy, a lower charge limit or an unplug reminder can reduce time spent at a high state of charge."
            />
            <Tip
              icon={<Leaf className="size-4" />}
              title="Do not drain it for fun"
              text="Modern lithium batteries do not need routine full discharges. Occasional calibration should follow the device maker's instructions."
            />
            <Tip
              icon={<Gauge className="size-4" />}
              title="Treat capacity ratio carefully"
              text="Full-charge capacity divided by design capacity is a ratio. It is not a diagnosis, a grade, or a guarantee of remaining life."
            />
            <Tip
              icon={<Zap className="size-4" />}
              title="Match power to the task"
              text="Power saver can help light work last longer. Performance mode has a cost. Neither one repairs battery wear."
            />
            <Tip
              icon={<ShieldCheck className="size-4" />}
              title="Prefer official updates"
              text="Power-management fixes and firmware updates come from your OS and device manufacturer. BatteryBloom does not install them."
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              Platform support, honestly
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Built with Tauri for Linux, Windows, and macOS. Only Linux has been run on
              real hardware in this project.
            </p>
            <div className="mt-4 space-y-2.5 text-xs leading-5">
              <SupportRow
                label="Battery readings"
                value="Linux verified · Windows/macOS unvalidated"
              />
              <SupportRow
                label="Low/high alerts & history"
                value="Cross-platform implementation"
              />
              <SupportRow
                label="Power profiles"
                value={`${
                  powerSettings?.profile.status === "supported"
                    ? "power-profiles-daemon available here"
                    : "Not available on this desktop"
                } · Windows/macOS not implemented`}
              />
              <SupportRow
                label="Display & sleep timeouts"
                value="GNOME only · Windows/macOS not implemented"
              />
              <SupportRow
                label="Hardware charge limit"
                value="Linux sysfs only · verified write + read-back"
              />
              <SupportRow
                label="Tray & autostart"
                value="Tauri plugins · Linux verified, others unvalidated"
              />
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/10 p-3 text-[11px] leading-5 text-muted-foreground">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-warning-strong"
                aria-hidden="true"
              />
              A build compiling is not the same as a feature working on a device.
              BatteryBloom does not claim Windows or macOS validation without a
              real-device test.
            </div>
            {capabilities ? (
              <p className="mt-3 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                Current platform: {capabilities.platform}{" "}
                {capabilities.platformVersion
                  ? `· ${capabilities.platformVersion}`
                  : ""}{" "}
                · {capabilities.architecture}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.025em]">
              If something is not working
            </h2>
            <div className="mt-4 divide-y divide-border/70">
              <Faq
                question="Battery not detected"
                answer="Check that you are on a laptop with an exposed battery. Virtual machines and some firmware modes do not provide one. BatteryBloom will keep retrying and will never show a made-up percentage."
              />
              <Faq
                question="A charge limit says permission needed"
                answer="The threshold exists but is not writable by your user. BatteryBloom will not escalate privileges. Use your manufacturer's supported tool or keep using a high-charge reminder."
              />
              <Faq
                question="Notifications are silent"
                answer="Check your OS notification permission and Do Not Disturb state. Use Settings → Send test notification. In-app banners and sound are separate channels."
              />
              <Faq
                question="History is empty"
                answer="Samples are written while BatteryBloom monitors, at the interval in Settings. A brand-new install needs at least two samples to draw a chart."
              />
              <Faq
                question="Power controls are unavailable"
                answer="BatteryBloom only offers controls it can read and change. On many desktops that means opening system settings rather than imitating a control that is not there."
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openSystemSettings("notifications")}
              >
                Notification settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void openSystemSettings("power")}
              >
                System power settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Keyboard className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold">
                Keyboard & accessibility
              </h2>
            </div>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
              <li>Tab and Shift+Tab move through every control.</li>
              <li>Enter or Space activates buttons and switches.</li>
              <li>Escape closes dialogs and returns focus.</li>
              <li>System reduced-motion preferences are respected.</li>
              <li>Status is never conveyed by color alone.</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <CircleHelp className="size-4 text-primary" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold">About this build</h2>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              BatteryBloom {appVersion}. A local utility for understanding battery state
              and making gentler power choices. It is not a repair tool, a warranty
              service, or a substitute for manufacturer guidance.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setPage("settings")}
            >
              Diagnostics & settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tip({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border/75 bg-background/45 p-4">
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function SupportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2.5 last:border-0 last:pb-0">
      <span className="shrink-0 font-semibold">{label}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {question}
        <span
          className="text-muted-foreground transition-transform group-open:rotate-45"
          aria-hidden="true"
        >
          +
        </span>
      </summary>
      <p className="mt-2 pr-6 text-xs leading-5 text-muted-foreground">{answer}</p>
    </details>
  );
}
