import { BellRing, BatteryLow, ChevronRight, X } from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import type { AlertSignal } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AlertBanner({
  alert,
  onDismiss,
}: {
  alert: AlertSignal;
  onDismiss: () => void;
}) {
  const { setPage } = useApp();
  const low = alert.kind === "low";
  const Icon = low ? BatteryLow : BellRing;

  return (
    <div
      role="alert"
      className={cn(
        "animate-rise flex flex-col gap-3 rounded-[1.25rem] border p-4 shadow-card sm:flex-row sm:items-center sm:gap-4",
        low ? "border-warning/35 bg-warning/10" : "border-primary/25 bg-accent/70",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          low ? "bg-warning/20 text-warning-strong" : "bg-primary/12 text-primary",
        )}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-display text-lg font-semibold leading-tight">
            {alert.title}
          </p>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {formatTime(alert.triggeredAt)}
          </span>
        </div>
        <p className="mt-0.5 text-sm leading-5 text-muted-foreground">
          {alert.message}
          {alert.silent ? " Quiet hours are active, so sound was suppressed." : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-card/60"
          onClick={() => setPage("charging")}
        >
          Review charging
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
