import * as React from "react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("BatteryBloom interface error", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-display text-xl font-semibold">BatteryBloom</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Interface recovery
              </p>
            </div>
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.03em]">
            Something in the window stopped unexpectedly
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your settings and history are still stored locally. Reload the window to
            restart the interface. If this keeps happening, create a diagnostics report
            after reopening BatteryBloom.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-border bg-muted/45 p-3 text-[11px] leading-5 text-muted-foreground">
            {this.state.error.message}
          </pre>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">No data was uploaded.</p>
            <Button onClick={() => window.location.reload()}>
              Reload BatteryBloom
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
