import { describe, expect, it } from "vitest";

import {
  alertLevel,
  downsampleHistory,
  filterHistory,
  formatCapacity,
  formatDurationCompact,
  formatHealth,
  formatSecondsOption,
  healthPercent,
  isFresh,
  minutesToTime,
  resolveTheme,
  timeToMinutes,
  validateSettings,
} from "@/lib/format";
import type { AppSettings, HistoryRecord } from "@/lib/types";

const baseSettings: AppSettings = {
  schemaVersion: 1,
  onboarded: true,
  lowEnabled: true,
  lowThreshold: 20,
  highEnabled: true,
  highThreshold: 80,
  notificationEnabled: true,
  soundEnabled: true,
  visualAlertEnabled: true,
  soundVolume: 65,
  cooldownMinutes: 15,
  hysteresisPercent: 5,
  quietHours: { enabled: false, startMinutes: 1320, endMinutes: 420 },
  alertOnStart: "crossingOnly",
  alertPowerScope: "both",
  theme: "system",
  minimizeToTray: true,
  startOnLogin: false,
  launchMinimized: false,
  pollIntervalSecs: 30,
  historyRetentionDays: 30,
  historySamplingMinutes: 5,
};

function record(percent: number, observedAt: string): HistoryRecord {
  return {
    observedAt,
    percent,
    state: "discharging",
    powerSource: "battery",
    fullChargeCapacityMwh: 67_700,
    designCapacityMwh: 100_000,
    cycleCount: 245,
    temperatureCelsius: 31.5,
  };
}

describe("capacity and duration formatting", () => {
  it("reports the capacity ratio with one decimal", () => {
    expect(healthPercent(67_700, 100_000)).toBeCloseTo(67.7);
    expect(formatHealth(67_700, 100_000)).toBe("67.7%");
  });

  it("does not invent a ratio when a value is missing", () => {
    expect(healthPercent(null, 100_000)).toBeNull();
    expect(healthPercent(0, 100_000)).toBeNull();
    expect(formatHealth(undefined, 100_000)).toBe("—");
  });

  it("formats capacity in watt-hours", () => {
    expect(formatCapacity(67_700)).toBe("67.7 Wh");
    expect(formatCapacity(0)).toBe("—");
    expect(formatCapacity(null)).toBe("—");
  });

  it("formats durations compactly without fake zeroes", () => {
    expect(formatDurationCompact(5400)).toBe("1 h 30 min");
    expect(formatDurationCompact(3600)).toBe("1 h");
    expect(formatDurationCompact(7200)).toBe("2 h");
    expect(formatDurationCompact(45)).toBe("1 min");
    expect(formatDurationCompact(null)).toBe("—");
    expect(formatDurationCompact(0)).toBe("—");
  });

  it("formats supported timeout choices", () => {
    expect(formatSecondsOption(0)).toBe("Never");
    expect(formatSecondsOption(60)).toBe("1 minute");
    expect(formatSecondsOption(1800)).toBe("30 minutes");
    expect(formatSecondsOption(7200)).toBe("2 hours");
  });
});

describe("alert thresholds", () => {
  it("returns low at or below the low goal", () => {
    expect(alertLevel(20, baseSettings)).toBe("low");
    expect(alertLevel(19, baseSettings)).toBe("low");
    expect(alertLevel(21, baseSettings)).toBe("normal");
  });

  it("returns high at or above the high goal", () => {
    expect(alertLevel(80, baseSettings)).toBe("high");
    expect(alertLevel(79, baseSettings)).toBe("normal");
  });

  it("ignores disabled goals and missing readings", () => {
    expect(alertLevel(5, { ...baseSettings, lowEnabled: false })).toBe("normal");
    expect(alertLevel(null, baseSettings)).toBe("none");
  });

  it("rejects inverted thresholds", () => {
    const errors = validateSettings({
      ...baseSettings,
      lowThreshold: 80,
      highThreshold: 20,
    });
    expect(errors).toContain("Low threshold must be lower than high threshold.");
  });

  it("rejects hysteresis wider than the threshold gap", () => {
    const errors = validateSettings({
      ...baseSettings,
      lowThreshold: 20,
      highThreshold: 25,
      hysteresisPercent: 6,
    });
    expect(errors.join(" ")).toMatch(/Hysteresis/);
  });

  it("accepts sensible quiet hours that cross midnight", () => {
    expect(
      validateSettings({
        ...baseSettings,
        quietHours: {
          enabled: true,
          startMinutes: 22 * 60,
          endMinutes: 7 * 60,
        },
      }),
    ).toEqual([]);
  });

  it("rejects empty quiet-hour ranges", () => {
    const errors = validateSettings({
      ...baseSettings,
      quietHours: {
        enabled: true,
        startMinutes: 600,
        endMinutes: 600,
      },
    });
    expect(errors.join(" ")).toMatch(/Quiet hours/);
  });
});

describe("time and theme helpers", () => {
  it("round-trips local minutes to HH:MM", () => {
    expect(minutesToTime(510)).toBe("08:30");
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(1440)).toBe("00:00");
  });

  it("resolves system theme against the media preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("marks stale readings as not fresh", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    expect(isFresh("2026-01-01T11:59:30Z", 30, now)).toBe(true);
    expect(isFresh("2026-01-01T11:00:00Z", 30, now)).toBe(false);
    expect(isFresh(null, 30, now)).toBe(false);
  });
});

describe("history helpers", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  const records = [
    record(90, "2026-01-10T11:00:00Z"),
    record(80, "2026-01-09T12:00:00Z"),
    record(70, "2026-01-05T12:00:00Z"),
    record(60, "2025-12-20T12:00:00Z"),
  ];

  it("filters by the chosen local time window", () => {
    expect(filterHistory(records, "24h", now)).toHaveLength(2);
    expect(filterHistory(records, "7d", now)).toHaveLength(3);
    expect(filterHistory(records, "30d", now)).toHaveLength(4);
  });

  it("downsamples without dropping the final sample", () => {
    const long = Array.from({ length: 20 }, (_, index) =>
      record(index * 5, new Date(now + index * 60_000).toISOString()),
    );
    const sampled = downsampleHistory(long, 5);
    expect(sampled).toHaveLength(5);
    expect(sampled[0]).toEqual(long[0]);
    expect(sampled[sampled.length - 1]).toEqual(long[long.length - 1]);
  });

  it("returns the same list when it is already small", () => {
    expect(downsampleHistory(records, 20)).toBe(records);
  });
});
