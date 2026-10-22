/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";

import {
  api,
  BackendError,
  subscribe,
  subscribeMany,
  type AlertSignal,
} from "@/lib/api";
import { applyThemeClass, playAlertChime } from "@/lib/presentation";
import type {
  AppPage,
  AppSettings,
  BatterySnapshot,
  Bootstrap,
  ChargeLimitCapability,
  HistoryRecord,
  PlatformCapabilities,
  PowerSettings,
  Recommendation,
  SystemSettingsTarget,
} from "@/lib/types";
import { resolveTheme } from "@/lib/format";

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: "info" | "success" | "error";
}

interface AppContextValue {
  loading: boolean;
  fatalError: string | null;
  appVersion: string;
  page: AppPage;
  setPage: (page: AppPage) => void;
  snapshot: BatterySnapshot | null;
  settings: AppSettings | null;
  capabilities: PlatformCapabilities | null;
  chargeLimit: ChargeLimitCapability | null;
  powerSettings: PowerSettings | null;
  recommendations: Recommendation[];
  history: HistoryRecord[];
  historyError: string | null;
  settingsWarning: string | null;
  dismissSettingsWarning: () => void;
  lastError: string | null;
  dismissLastError: () => void;
  alertBanner: AlertSignal | null;
  dismissAlertBanner: () => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: number) => void;
  reload: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  refreshChargeLimit: () => Promise<void>;
  refreshPowerSettings: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  ensureNotificationPermission: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  openSystemSettings: (target: SystemSettingsTarget) => Promise<void>;
}

const AppContext = React.createContext<AppContextValue | null>(null);

const PAGES: AppPage[] = [
  "overview",
  "charging",
  "power",
  "history",
  "settings",
  "help",
];

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [fatalError, setFatalError] = React.useState<string | null>(null);
  const [appVersion, setAppVersion] = React.useState("0.1.0");
  const [page, setPageState] = React.useState<AppPage>("overview");
  const [snapshot, setSnapshot] = React.useState<BatterySnapshot | null>(null);
  const [settings, setSettings] = React.useState<AppSettings | null>(null);
  const [capabilities, setCapabilities] = React.useState<PlatformCapabilities | null>(
    null,
  );
  const [chargeLimit, setChargeLimit] = React.useState<ChargeLimitCapability | null>(
    null,
  );
  const [powerSettings, setPowerSettings] = React.useState<PowerSettings | null>(null);
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([]);
  const [history, setHistory] = React.useState<HistoryRecord[]>([]);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [settingsWarning, setSettingsWarning] = React.useState<string | null>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [alertBanner, setAlertBanner] = React.useState<AlertSignal | null>(null);
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const settingsRef = React.useRef<AppSettings | null>(null);
  const toastId = React.useRef(0);
  const notificationErrorShown = React.useRef(false);

  React.useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const setPage = React.useCallback((next: AppPage) => {
    setPageState(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const pushToast = React.useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = (toastId.current += 1);
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(
      () => setToasts((current) => current.filter((item) => item.id !== id)),
      toast.variant === "error" ? 9000 : 5500,
    );
  }, []);

  const dismissToast = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const applyBootstrap = React.useCallback((bootstrap: Bootstrap) => {
    setAppVersion(bootstrap.appVersion);
    setSnapshot(bootstrap.snapshot);
    setSettings(bootstrap.settings);
    setCapabilities(bootstrap.capabilities);
    setChargeLimit(bootstrap.chargeLimit);
    setPowerSettings(bootstrap.powerSettings);
    setRecommendations(bootstrap.recommendations);
    setSettingsWarning(bootstrap.settingsWarning);
    setLastError(bootstrap.lastError);
  }, []);

  const refreshHistory = React.useCallback(async () => {
    try {
      const records = await api.getHistory();
      setHistory(records);
      setHistoryError(null);
    } catch (error) {
      const message =
        error instanceof BackendError
          ? error.message
          : "Battery history could not be read.";
      setHistoryError(message);
    }
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setFatalError(null);
    try {
      const bootstrap = await api.getBootstrap();
      applyBootstrap(bootstrap);
      await refreshHistory();
    } catch (error) {
      setFatalError(
        error instanceof BackendError
          ? error.message
          : "BatteryBloom could not start its desktop service.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyBootstrap, refreshHistory]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    if (!settings) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyThemeClass(resolveTheme(settings.theme, media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings]);

  const refreshRecommendations = React.useCallback(async () => {
    try {
      setRecommendations(await api.getRecommendations());
    } catch (error) {
      console.warn("recommendations refresh failed", error);
    }
  }, []);

  const refreshSnapshot = React.useCallback(async () => {
    try {
      const next = await api.getBatterySnapshot();
      setSnapshot(next);
      setLastError(null);
    } catch (error) {
      pushToast({
        title: "Battery reading unavailable",
        description:
          error instanceof BackendError
            ? error.message
            : "BatteryBloom will retry automatically.",
        variant: "error",
      });
    }
  }, [pushToast]);

  const refreshChargeLimit = React.useCallback(async () => {
    try {
      setChargeLimit(await api.getChargeLimit());
    } catch (error) {
      console.warn("charge limit refresh failed", error);
    }
  }, []);

  const refreshPowerSettings = React.useCallback(async () => {
    try {
      setPowerSettings(await api.getPowerSettings());
    } catch (error) {
      console.warn("power settings refresh failed", error);
    }
  }, []);

  React.useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const remove = await subscribeMany([
        subscribe<BatterySnapshot>("battery://snapshot", (next) => {
          setSnapshot(next);
          setLastError(null);
        }),
        subscribe<AlertSignal>("alert://triggered", (alert) => {
          if (alert.channels.visual) {
            setAlertBanner(alert);
          }
          if (alert.channels.sound) {
            playAlertChime(settingsRef.current?.soundVolume ?? 65);
          }
        }),
        subscribe<AppSettings>("settings://changed", (next) => {
          setSettings(next);
          void refreshRecommendations();
        }),
        subscribe<string>("monitor://error", (message) => {
          setLastError(message);
        }),
        subscribe<string>("notification://error", (message) => {
          if (!notificationErrorShown.current) {
            notificationErrorShown.current = true;
            pushToast({
              title: "Notification not delivered",
              description: message,
              variant: "error",
            });
          }
        }),
        subscribe<string>("nav://go", (next) => {
          if (PAGES.includes(next as AppPage)) {
            setPage(next as AppPage);
          }
        }),
        subscribe("charge://changed", () => {
          void refreshChargeLimit();
        }),
        subscribe("history://changed", () => {
          void refreshHistory();
        }),
      ]);
      if (disposed) {
        remove();
      } else {
        cleanup = remove;
      }
    })().catch((error) => {
      console.warn("event subscription failed", error);
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [pushToast, refreshChargeLimit, refreshHistory, refreshRecommendations, setPage]);

  const saveSettings = React.useCallback(
    async (next: AppSettings) => {
      const saved = await api.saveAppSettings(next);
      setSettings(saved);
      setSettingsWarning(null);
      await refreshRecommendations();
      return saved;
    },
    [refreshRecommendations],
  );

  const resetSettings = React.useCallback(async () => {
    const saved = await api.resetAppSettings();
    setSettings(saved);
    setSettingsWarning(null);
    await refreshRecommendations();
    return saved;
  }, [refreshRecommendations]);

  const ensureNotificationPermission = React.useCallback(async () => {
    try {
      if (await isPermissionGranted()) {
        return true;
      }
      const permission = await requestPermission();
      const granted = permission === "granted";
      if (!granted) {
        pushToast({
          title: "Notifications are blocked",
          description:
            "You can still use in-app alerts, or enable notifications in your system settings.",
          variant: "info",
        });
      }
      return granted;
    } catch (error) {
      pushToast({
        title: "Notification permission could not be checked",
        description:
          error instanceof Error
            ? error.message
            : "Use your system settings to allow notifications.",
        variant: "error",
      });
      return false;
    }
  }, [pushToast]);

  const sendTestNotification = React.useCallback(async () => {
    try {
      const result = await api.sendTestNotification();
      pushToast({
        title: "Test notification sent",
        description: result.message,
        variant: "success",
      });
      return true;
    } catch (error) {
      pushToast({
        title: "Test notification failed",
        description:
          error instanceof BackendError
            ? error.message
            : "Native notifications are not available.",
        variant: "error",
      });
      return false;
    }
  }, [pushToast]);

  const openSystemSettings = React.useCallback(
    async (target: SystemSettingsTarget) => {
      try {
        await api.openSystemSettings(target);
      } catch (error) {
        pushToast({
          title: "Settings could not be opened",
          description:
            error instanceof BackendError
              ? error.message
              : "Open your system settings manually.",
          variant: "error",
        });
      }
    },
    [pushToast],
  );

  const dismissSettingsWarning = React.useCallback(() => setSettingsWarning(null), []);
  const dismissLastError = React.useCallback(() => setLastError(null), []);
  const dismissAlertBanner = React.useCallback(() => setAlertBanner(null), []);

  const value = React.useMemo<AppContextValue>(
    () => ({
      loading,
      fatalError,
      appVersion,
      page,
      setPage,
      snapshot,
      settings,
      capabilities,
      chargeLimit,
      powerSettings,
      recommendations,
      history,
      historyError,
      settingsWarning,
      dismissSettingsWarning,
      lastError,
      dismissLastError,
      alertBanner,
      dismissAlertBanner,
      toasts,
      pushToast,
      dismissToast,
      reload,
      refreshSnapshot,
      refreshRecommendations,
      refreshChargeLimit,
      refreshPowerSettings,
      refreshHistory,
      saveSettings,
      resetSettings,
      ensureNotificationPermission,
      sendTestNotification,
      openSystemSettings,
    }),
    [
      loading,
      fatalError,
      appVersion,
      page,
      setPage,
      snapshot,
      settings,
      capabilities,
      chargeLimit,
      powerSettings,
      recommendations,
      history,
      historyError,
      settingsWarning,
      dismissSettingsWarning,
      lastError,
      dismissLastError,
      alertBanner,
      dismissAlertBanner,
      toasts,
      pushToast,
      dismissToast,
      reload,
      refreshSnapshot,
      refreshRecommendations,
      refreshChargeLimit,
      refreshPowerSettings,
      refreshHistory,
      saveSettings,
      resetSettings,
      ensureNotificationPermission,
      sendTestNotification,
      openSystemSettings,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = React.useContext(AppContext);
  if (!value) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return value;
}
