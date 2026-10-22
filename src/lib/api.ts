import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AlertSignal,
  AppSettings,
  BatterySnapshot,
  Bootstrap,
  ChargeLimitApplyResult,
  ChargeLimitCapability,
  ChargeLimitRequest,
  CommandErrorShape,
  DiagnosticsReport,
  HistoryExportResult,
  HistoryRecord,
  NotificationTestResult,
  PlatformCapabilities,
  PowerChangeResult,
  PowerProfile,
  PowerSettings,
  SystemSettingsTarget,
  TimeoutKind,
  Recommendation,
} from "./types";

export class BackendError extends Error {
  readonly code: string;
  readonly detail: string | null;

  constructor(message: string, code = "unknown", detail: string | null = null) {
    super(message);
    this.name = "BackendError";
    this.code = code;
    this.detail = detail;
  }
}

function normalizeError(error: unknown): BackendError {
  if (error instanceof BackendError) {
    return error;
  }
  if (typeof error === "string") {
    return new BackendError(error, "backendError");
  }
  if (error && typeof error === "object") {
    const shape = error as CommandErrorShape;
    if (typeof shape.message === "string") {
      return new BackendError(
        shape.message,
        shape.code ?? "backendError",
        shape.detail ?? null,
      );
    }
  }
  return new BackendError(
    "BatteryBloom could not complete that request. Please try again.",
    "backendError",
  );
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

export const api = {
  getBootstrap: () => call<Bootstrap>("get_bootstrap"),
  getBatterySnapshot: () => call<BatterySnapshot>("get_battery_snapshot"),
  getPlatformCapabilities: () =>
    call<PlatformCapabilities>("get_platform_capabilities"),
  getChargeLimit: () => call<ChargeLimitCapability>("get_charge_limit"),
  getRecommendations: () => call<Recommendation[]>("get_recommendations"),
  getPowerSettings: () => call<PowerSettings>("get_power_settings"),
  getAppSettings: () => call<AppSettings>("get_app_settings"),
  saveAppSettings: (settings: AppSettings) =>
    call<AppSettings>("save_app_settings", { settings }),
  resetAppSettings: () => call<AppSettings>("reset_app_settings"),
  setChargeLimit: (request: ChargeLimitRequest) =>
    call<ChargeLimitApplyResult>("set_charge_limit", { request }),
  resetChargeLimit: () => call<ChargeLimitApplyResult>("reset_charge_limit"),
  applyPowerProfile: (profile: PowerProfile) =>
    call<PowerChangeResult>("apply_power_profile", { profile }),
  applyPowerTimeout: (kind: TimeoutKind, seconds: number) =>
    call<PowerChangeResult>("apply_power_timeout", { kind, seconds }),
  undoLastPowerChange: () => call<PowerChangeResult>("undo_last_power_change"),
  getHistory: () => call<HistoryRecord[]>("get_battery_history"),
  clearHistory: () => call<void>("clear_battery_history"),
  exportHistory: (format: "csv" | "json", path: string) =>
    call<HistoryExportResult>("export_battery_history", { format, path }),
  getDiagnostics: () => call<DiagnosticsReport>("get_diagnostics"),
  exportDiagnostics: () => call<string>("export_diagnostics"),
  saveDiagnostics: (path: string) => call<string>("save_diagnostics", { path }),
  copyDiagnostics: () => call<void>("copy_diagnostics"),
  sendTestNotification: () => call<NotificationTestResult>("send_test_notification"),
  openSystemSettings: (target: SystemSettingsTarget) =>
    call<void>("open_system_settings", { target }),
};

export async function subscribe<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<UnlistenFn> {
  return listen<T>(event, (event) => handler(event.payload));
}

export async function subscribeMany(
  handlers: Promise<UnlistenFn>[],
): Promise<() => void> {
  const unlisteners = await Promise.all(handlers);
  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}

export type { AlertSignal, UnlistenFn };
