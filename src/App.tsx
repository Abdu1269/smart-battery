import { lazy, Suspense } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { AppProvider, useApp } from "@/app/AppProvider";
import { AppShell } from "@/components/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { Onboarding } from "@/components/Onboarding";
import { Toaster } from "@/components/Toaster";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AppPage } from "@/lib/types";

const ChargingPage = lazy(() =>
  import("@/pages/ChargingPage").then((module) => ({
    default: module.ChargingPage,
  })),
);
const HelpPage = lazy(() =>
  import("@/pages/HelpPage").then((module) => ({ default: module.HelpPage })),
);
const HistoryPage = lazy(() =>
  import("@/pages/HistoryPage").then((module) => ({
    default: module.HistoryPage,
  })),
);
const OverviewPage = lazy(() =>
  import("@/pages/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
const PowerPage = lazy(() =>
  import("@/pages/PowerPage").then((module) => ({ default: module.PowerPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

export default function App() {
  return (
    <AppProvider>
      <TooltipProvider delayDuration={300}>
        <Root />
      </TooltipProvider>
    </AppProvider>
  );
}

function Root() {
  const { loading, fatalError, settings, page } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  if (fatalError) {
    return <FatalScreen message={fatalError} />;
  }

  if (!settings) {
    return <LoadingScreen />;
  }

  if (!settings.onboarded) {
    return (
      <>
        <Onboarding />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <AppShell>
        <Suspense fallback={<PageLoading />}>
          <Page page={page} />
        </Suspense>
      </AppShell>
      <Toaster />
    </>
  );
}

function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 pt-3 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-[1.35rem] bg-muted/80" />
        <div className="h-56 animate-pulse rounded-[1.35rem] bg-muted/60" />
      </div>
    </div>
  );
}

function Page({ page }: { page: AppPage }) {
  switch (page) {
    case "charging":
      return <ChargingPage />;
    case "power":
      return <PowerPage />;
    case "history":
      return <HistoryPage />;
    case "settings":
      return <SettingsPage />;
    case "help":
      return <HelpPage />;
    default:
      return <OverviewPage />;
  }
}

function LoadingScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      aria-busy="true"
      aria-label="BatteryBloom is starting"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
          <BrandMark />
          <div className="text-left">
            <p className="font-display text-lg font-semibold leading-tight">
              BatteryBloom
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Reading local battery data
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-2" aria-hidden="true">
          <div className="mx-auto h-2.5 w-48 animate-pulse rounded-full bg-muted" />
          <div className="mx-auto h-2.5 w-32 animate-pulse rounded-full bg-muted/70" />
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          This stays on your computer.
        </p>
      </div>
    </div>
  );
}

function FatalScreen({ message }: { message: string }) {
  const { reload } = useApp();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="font-display text-xl font-semibold">BatteryBloom</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Desktop service unavailable
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4">
          <AlertTriangle
            className="mt-0.5 size-5 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div>
            <h1 className="font-display text-xl font-semibold">
              The desktop service did not start
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{message}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              If you are seeing this in a browser rather than the desktop app, start
              BatteryBloom with <code>pnpm tauri dev</code> or open the installed
              application. No battery data is invented when the service is unavailable.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            Local only · no account required
          </p>
          <Button onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
