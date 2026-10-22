import * as React from "react";
import {
  Braces,
  Clock3,
  Database,
  Download,
  FileText,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";

import { useApp } from "@/app/AppProvider";
import { HistoryChart } from "@/components/HistoryChart";
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
import { api, BackendError } from "@/lib/api";
import { filterHistory, formatClockDate, stateLabel, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type HistoryRange = "24h" | "7d" | "30d" | "all";

const RANGES: { id: HistoryRange; label: string }[] = [
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All" },
];

export function HistoryPage() {
  const { settings, history, historyError, refreshHistory, pushToast, setPage } =
    useApp();
  const [range, setRange] = React.useState<HistoryRange>("7d");
  const [clearing, setClearing] = React.useState(false);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<"csv" | "json" | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const filtered = React.useMemo(() => filterHistory(history, range), [history, range]);
  const latest = filtered[filtered.length - 1] ?? null;
  const percents = filtered.map((record) => record.percent);
  const lowest = percents.length ? Math.min(...percents) : null;
  const highest = percents.length ? Math.max(...percents) : null;
  const recentRecords = React.useMemo(
    () => [...filtered].reverse().slice(0, 8),
    [filtered],
  );

  if (!settings) {
    return null;
  }

  const refresh = async () => {
    setRefreshing(true);
    await refreshHistory();
    setRefreshing(false);
  };

  const exportHistory = async (format: "csv" | "json") => {
    setExporting(format);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const path = await save({
        title: `Export battery history as ${format.toUpperCase()}`,
        defaultPath: `batterybloom-history-${date}.${format}`,
        filters: [
          {
            name: format === "csv" ? "CSV spreadsheet" : "JSON data",
            extensions: [format],
          },
        ],
      });
      if (!path) {
        return;
      }
      const result = await api.exportHistory(format, path);
      pushToast({
        title: "History exported",
        description: `${result.records} samples saved as ${result.format.toUpperCase()}.`,
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "Export failed",
        description:
          error instanceof BackendError
            ? error.message
            : "The history file could not be written.",
        variant: "error",
      });
    } finally {
      setExporting(null);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await api.clearHistory();
      await refreshHistory();
      setClearOpen(false);
      pushToast({
        title: "History cleared",
        description: "All local battery samples were removed.",
        variant: "success",
      });
    } catch (error) {
      pushToast({
        title: "History was not cleared",
        description:
          error instanceof BackendError
            ? error.message
            : "The history file could not be cleared.",
        variant: "error",
      });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="History"
        title="Patterns, kept locally."
        description="BatteryBloom samples the values your device reports and keeps a small local record. No account, no cloud, no telemetry."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("size-4", refreshing && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Button
              onClick={() => void exportHistory("csv")}
              disabled={filtered.length === 0 || exporting !== null}
            >
              <Download className="size-4" />
              Export
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 shadow-soft"
          role="group"
          aria-label="History range"
        >
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              aria-pressed={range === item.id}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === item.id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          Stored on this device only
        </div>
      </div>

      {historyError ? (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {historyError}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Latest"
          value={latest ? `${latest.percent}%` : "—"}
          detail={latest ? timeAgo(latest.observedAt) : "No samples"}
        />
        <Metric
          label="Lowest"
          value={lowest == null ? "—" : `${lowest}%`}
          detail={`In ${rangeLabel(range)}`}
        />
        <Metric
          label="Highest"
          value={highest == null ? "—" : `${highest}%`}
          detail={`In ${rangeLabel(range)}`}
        />
        <Metric
          label="Samples"
          value={filtered.length.toLocaleString()}
          detail={
            settings.historySamplingMinutes === 1
              ? "Every minute"
              : `Every ${settings.historySamplingMinutes} minutes`
          }
        />
      </div>

      <Card className="mt-4">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Charge over time
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                {rangeLabel(range)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportHistory("csv")}
                disabled={filtered.length === 0 || exporting !== null}
              >
                <FileText className="size-3.5" />
                {exporting === "csv" ? "Preparing…" : "CSV"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportHistory("json")}
                disabled={filtered.length === 0 || exporting !== null}
              >
                <Braces className="size-3.5" />
                {exporting === "json" ? "Preparing…" : "JSON"}
              </Button>
            </div>
          </div>

          <div className="mt-4">
            {filtered.length >= 2 ? (
              <HistoryChart records={filtered} range={range} />
            ) : history.length > 0 ? (
              <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-6 text-center">
                <Database className="size-6 text-primary/70" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">No samples in this range</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Choose a longer range, or wait for BatteryBloom to collect more
                  samples.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setRange("all")}
                >
                  Show all samples
                </Button>
              </div>
            ) : (
              <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-6 text-center">
                <Clock3 className="size-6 text-primary/70" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">No history yet</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  BatteryBloom records a sample every {settings.historySamplingMinutes}{" "}
                  {settings.historySamplingMinutes === 1 ? "minute" : "minutes"} while
                  monitoring. You can adjust this in{" "}
                  <button
                    type="button"
                    onClick={() => setPage("settings")}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Settings
                  </button>
                  .
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Recent samples
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
                  What the OS reported
                </h2>
              </div>
              <Badge variant="neutral" className="normal-case">
                {filtered.length.toLocaleString()} samples
              </Badge>
            </div>

            {recentRecords.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] uppercase tracking-[0.09em] text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">When</th>
                      <th className="py-2 pr-3 font-semibold">Charge</th>
                      <th className="py-2 pr-3 font-semibold">State</th>
                      <th className="py-2 font-semibold">Power</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRecords.map((record) => (
                      <tr
                        key={record.observedAt}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                          <time dateTime={record.observedAt}>
                            {formatClockDate(record.observedAt)}
                          </time>
                        </td>
                        <td className="py-2.5 pr-3 font-semibold tabular-nums">
                          {record.percent}%
                        </td>
                        <td className="py-2.5 pr-3 text-xs">
                          {stateLabel(record.state)}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {record.powerSource === "ac"
                            ? "Plugged in"
                            : record.powerSource === "battery"
                              ? "Battery"
                              : "Unavailable"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">
                No samples in the selected range.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Local data
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">
              Your history, your call
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {settings.historyRetentionDays === 365
                ? "Samples older than one year are pruned automatically."
                : `Samples older than ${settings.historyRetentionDays} days are pruned automatically.`}{" "}
              History includes charge, state, power source, capacity, cycle count, and
              temperature when reported.
            </p>
            <div className="mt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => void refresh()}
                disabled={refreshing}
              >
                <RefreshCw className="size-4" />
                Reload from disk
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setClearOpen(true)}
                disabled={history.length === 0}
              >
                <Trash2 className="size-4" />
                Clear all history
              </Button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/55 p-3 text-[11px] leading-5 text-muted-foreground">
              <ShieldCheck
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              Exported files leave BatteryBloom's storage. Choose where they go
              carefully.
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all battery history?</DialogTitle>
            <DialogDescription>
              This removes every local sample. It cannot be undone, and BatteryBloom
              will start a new history from the next reading.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
            {history.length.toLocaleString()} samples are stored right now.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearOpen(false)}
              disabled={clearing}
            >
              Keep history
            </Button>
            <Button
              variant="destructive"
              onClick={() => void clearHistory()}
              disabled={clearing}
            >
              {clearing ? "Clearing…" : "Clear everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-border/80 bg-card p-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.03em]">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

function rangeLabel(range: HistoryRange): string {
  switch (range) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "All samples";
  }
}
