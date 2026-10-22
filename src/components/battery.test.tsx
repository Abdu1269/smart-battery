import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BatteryOrb } from "@/components/BatteryOrb";
import { HistoryChart } from "@/components/HistoryChart";
import type { HistoryRecord } from "@/lib/types";

function record(percent: number, observedAt: string): HistoryRecord {
  return {
    observedAt,
    percent,
    state: "discharging",
    powerSource: "battery",
    fullChargeCapacityMwh: null,
    designCapacityMwh: null,
    cycleCount: null,
    temperatureCelsius: null,
  };
}

describe("BatteryOrb", () => {
  it("announces the real percentage and state", () => {
    render(<BatteryOrb percent={74} state="discharging" tone="normal" />);
    expect(
      screen.getByRole("img", {
        name: "Battery 74 percent, on battery",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("74")).toBeInTheDocument();
  });

  it("does not display a fabricated value when the battery is unavailable", () => {
    render(<BatteryOrb percent={null} state="unknown" tone="none" />);
    expect(
      screen.getByRole("img", {
        name: "Battery level is not reported by the system",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("HistoryChart", () => {
  it("provides a text alternative with real sample values", () => {
    render(
      <HistoryChart
        records={[
          record(55, "2026-01-01T10:00:00Z"),
          record(70, "2026-01-01T11:00:00Z"),
          record(65, "2026-01-01T12:00:00Z"),
        ]}
        range="24h"
      />,
    );
    expect(
      screen.getByRole("img", { name: /Battery charge over time/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lowest 55%, highest 70%, latest 65%/)).toBeInTheDocument();
  });
});
