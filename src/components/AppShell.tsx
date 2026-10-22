import * as React from "react";
import {
  BatteryCharging,
  CircleHelp,
  Gauge,
  History,
  Info,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { AlertBanner } from "@/components/AlertBanner";
import { BrandLockup } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "overview" as const, label: "Overview", icon: Gauge },
  { id: "charging" as const, label: "Charging", icon: BatteryCharging },
  { id: "power" as const, label: "Power", icon: Zap },
  { id: "history" as const, label: "History", icon: History },
  { id: "settings" as const, label: "Settings", icon: Settings2 },
  { id: "help" as const, label: "Help", icon: CircleHelp },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    page,
    setPage,
    appVersion,
    alertBanner,
    dismissAlertBanner,
    settingsWarning,
    dismissSettingsWarning,
    lastError,
    dismissLastError,
  } = useApp();

  return (
    <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[248px_minmax(0,1fr)] lg:overflow-hidden">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-dialog transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-border/70 bg-card/45 backdrop-blur-sm lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 pb-7 pt-6">
          <BrandLockup />
        </div>

        <nav aria-label="Primary" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setPage(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[1.15rem] shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                    {active ? (
                      <span
                        className="ml-auto size-1.5 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4">
          <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
              Local only
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              No account, telemetry, or cloud sync.
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground/80">
              BatteryBloom {appVersion}
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col lg:h-screen lg:overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <BrandLockup compact />
            <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Local only
            </span>
          </div>
          <nav aria-label="Primary" className="overflow-x-auto px-2 pb-2">
            <ul className="flex min-w-max items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setPage(item.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 lg:overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
            <div className="mb-5 space-y-3">
              {alertBanner ? (
                <AlertBanner alert={alertBanner} onDismiss={dismissAlertBanner} />
              ) : null}
              {settingsWarning ? (
                <Notice
                  tone="warning"
                  icon={TriangleAlert}
                  title="Your settings file needed attention"
                  description={settingsWarning}
                  onDismiss={dismissSettingsWarning}
                />
              ) : null}
              {lastError ? (
                <Notice
                  tone="warning"
                  icon={Info}
                  title="Battery data paused"
                  description={lastError}
                  onDismiss={dismissLastError}
                />
              ) : null}
            </div>

            {children}

            <footer className="mt-10 flex flex-col gap-2 border-t border-border/70 pt-5 text-[11px] leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                BatteryBloom reports only data supplied by your device. Nothing is
                uploaded.
              </p>
              <p>Version {appVersion}</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  title,
  description,
  onDismiss,
}: {
  tone: "warning" | "info";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3.5",
        tone === "warning"
          ? "border-warning/30 bg-warning/10"
          : "border-border bg-card",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" ? "text-warning-strong" : "text-muted-foreground",
        )}
        aria-hidden={true}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={onDismiss}
        aria-label={`Dismiss: ${title}`}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
