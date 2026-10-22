import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { useApp } from "@/app/AppProvider";
import { cn } from "@/lib/utils";

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className={cn(
              "animate-rise pointer-events-auto flex items-start gap-3 rounded-2xl border bg-card p-4 text-card-foreground shadow-dialog",
              toast.variant === "error"
                ? "border-destructive/35"
                : toast.variant === "success"
                  ? "border-primary/30"
                  : "border-border",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4.5 shrink-0",
                toast.variant === "error"
                  ? "text-destructive"
                  : toast.variant === "success"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-5">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {toast.description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss message"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
