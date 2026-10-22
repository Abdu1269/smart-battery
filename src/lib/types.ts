export type BatteryState =
  "charging" | "discharging" | "full" | "notCharging" | "unknown";

export type PowerSource = "ac" | "battery" | "unknown";

export type CapabilityStatus =
  | "supported"
  | "unsupported"
  | "permissionRequired"
  | "notDetected"
  | "readOnly"
  | "error";

export interface FeatureCapability {
  status: CapabilityStatus;
  reason: string;
  nextStep?: string | null;
}

export interface ChargeLimitCapability {
  status: CapabilityStatus;
  minimum?: number | null;
  maximum?: number | null;
  currentStart?: number | null;
  currentEnd?: number | null;
  supportsStartThreshold: boolean;
  supportsEndThreshold: boolean;
  reason: string;
  nextStep?: string | null;
}

export interface BatterySnapshot {
  percent: number | null;
  state: BatteryState;
  powerSource: PowerSource | null;
  timeRemainingSecs: number | null;
  timeToFullSecs: number | null;
  designCapacityMwh: number | null;
  fullChargeCapacityMwh: number | null;
  currentCapacityMwh: number | null;
  powerDrawMw: number | null;
  cycleCount: number | null;
  temperatureCelsius: number | null;
  batteryCount: number;
  isAvailable: boolean;
  observedAt: string;
}

export interface PlatformCapabilities {
  platform: string;
  platformVersion: string | null;
  architecture: string;
  battery: FeatureCapability;
  chargeLimit: ChargeLimitCapability;
  powerProfiles: FeatureCapability;
  notifications: FeatureCapability;
  tray: FeatureCapability;
  autostart: FeatureCapability;
  history: FeatureCapability;
}

export interface ChargeLimitRequest {
  start: number | null;
  end: number;
  confirmed: boolean;
}

export interface ChargeLimitApplyResult {
  start: number | null;
  end: number;
  verified: boolean;
  appliedAt: string;
  readBackStart: number | null;
  readBackEnd: number;
  previousStart: number | null;
  previousEnd: number | null;
}

export type ThemePreference = "system" | "light" | "dark";
export type AlertPowerScope = "battery" | "ac" | "both";
export type StartupAlertPolicy = "immediate" | "crossingOnly";

export interface QuietHours {
  enabled: boolean;
  startMinutes: number;
  endMinutes: number;
}

export interface ChargeLimitBaseline {
  start: number | null;
  end: number;
  capturedAt: string;
}

export interface AppliedPowerChange {
  key: string;
  previousValue: string;
  appliedValue: string;
  appliedAt: string;
}

export interface AppSettings {
  schemaVersion: number;
  onboarded: boolean;
  lowEnabled: boolean;
  lowThreshold: number;
  highEnabled: boolean;
  highThreshold: number;
  notificationEnabled: boolean;
  soundEnabled: boolean;
  visualAlertEnabled: boolean;
  soundVolume: number;
  cooldownMinutes: number;
  hysteresisPercent: number;
  quietHours: QuietHours;
  alertOnStart: StartupAlertPolicy;
  alertPowerScope: AlertPowerScope;
  theme: ThemePreference;
  minimizeToTray: boolean;
  startOnLogin: boolean;
  launchMinimized: boolean;
  pollIntervalSecs: number;
  historyRetentionDays: number;
  historySamplingMinutes: number;
  chargeLimitBaseline?: ChargeLimitBaseline | null;
  lastChargeLimitAppliedAt?: string | null;
  lastPowerChange?: AppliedPowerChange | null;
}

export type PowerProfile = "power-saver" | "balanced" | "performance";
export type TimeoutKind = "display" | "sleep";

export interface TimeoutSetting {
  supported: boolean;
  currentSeconds: number | null;
  optionsSeconds: number[];
  reason?: string | null;
}

export interface PowerSettings {
  profile: FeatureCapability;
  currentProfile: PowerProfile | null;
  availableProfiles: PowerProfile[];
  displayTimeout: TimeoutSetting;
  sleepTimeout: TimeoutSetting;
  provider: string;
}

export interface PowerChangeResult {
  change: AppliedPowerChange;
  message: string;
}

export type RecommendationImpact = "low" | "medium" | "high";
export type RecommendationEffort = "easy" | "moderate";
export type RecommendationActionName =
  "openPowerSettings" | "openDisplaySettings" | "openCharging" | "openHelp";

export interface Recommendation {
  id: string;
  title: string;
  summary: string;
  why: string;
  impact: RecommendationImpact;
  effort: RecommendationEffort;
  action: RecommendationActionName | null;
  actionLabel: string | null;
}

export interface Bootstrap {
  appVersion: string;
  snapshot: BatterySnapshot | null;
  capabilities: PlatformCapabilities;
  settings: AppSettings;
  chargeLimit: ChargeLimitCapability;
  powerSettings: PowerSettings;
  recommendations: Recommendation[];
  settingsWarning: string | null;
  lastError: string | null;
}

export interface AlertChannels {
  notification: boolean;
  sound: boolean;
  visual: boolean;
}

export interface AlertSignal {
  kind: "low" | "high";
  percent: number;
  threshold: number;
  title: string;
  message: string;
  triggeredAt: string;
  silent: boolean;
  channels: AlertChannels;
}

export interface HistoryRecord {
  observedAt: string;
  percent: number;
  state: BatteryState;
  powerSource: PowerSource | null;
  fullChargeCapacityMwh: number | null;
  designCapacityMwh: number | null;
  cycleCount: number | null;
  temperatureCelsius: number | null;
}

export interface HistoryExportResult {
  path: string;
  format: string;
  records: number;
}

export interface DiagnosticsSettingsSummary {
  lowThreshold: number;
  highThreshold: number;
  lowAlerts: boolean;
  highAlerts: boolean;
  notifications: boolean;
  sound: boolean;
  visualAlerts: boolean;
  quietHoursEnabled: boolean;
  cooldownMinutes: number;
  hysteresisPercent: number;
  pollIntervalSecs: number;
  historyRetentionDays: number;
  historySamplingMinutes: number;
  startOnLogin: boolean;
  minimizeToTray: boolean;
  theme: string;
}

export interface DiagnosticsReport {
  generatedAt: string;
  appVersion: string;
  platform: string;
  platformVersion: string | null;
  architecture: string;
  capabilities: PlatformCapabilities;
  battery: BatterySnapshot | null;
  settings: DiagnosticsSettingsSummary;
  lastError: string | null;
  historyRecords: number;
  privacyNote: string;
}

export interface NotificationTestResult {
  delivered: boolean;
  message: string;
}

export type SystemSettingsTarget = "power" | "display" | "notifications";

export type AppPage =
  "overview" | "charging" | "power" | "history" | "settings" | "help";

export interface CommandErrorShape {
  code?: string;
  message?: string;
  detail?: string | null;
}
