use batterybloom_core::models::{BatterySnapshot, PlatformCapabilities};
use chrono::Utc;
use serde::Serialize;
use tauri::AppHandle;

use crate::platform;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSummary {
    pub low_threshold: u8,
    pub high_threshold: u8,
    pub low_alerts: bool,
    pub high_alerts: bool,
    pub notifications: bool,
    pub sound: bool,
    pub visual_alerts: bool,
    pub quiet_hours_enabled: bool,
    pub cooldown_minutes: u16,
    pub hysteresis_percent: u8,
    pub poll_interval_secs: u32,
    pub history_retention_days: u16,
    pub history_sampling_minutes: u16,
    pub start_on_login: bool,
    pub minimize_to_tray: bool,
    pub theme: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub generated_at: String,
    pub app_version: String,
    pub platform: String,
    pub platform_version: Option<String>,
    pub architecture: String,
    pub capabilities: PlatformCapabilities,
    pub battery: Option<BatterySnapshot>,
    pub settings: SettingsSummary,
    pub last_error: Option<String>,
    pub history_records: usize,
    pub privacy_note: String,
}

pub fn report(app: &AppHandle, state: &AppState) -> DiagnosticsReport {
    let settings = state.settings_snapshot();
    let snapshot = state
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());
    let history_records = state
        .history_store
        .load()
        .map(|records| records.len())
        .unwrap_or(0);

    DiagnosticsReport {
        generated_at: Utc::now().to_rfc3339(),
        app_version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.into(),
        platform_version: platform::platform_version(),
        architecture: std::env::consts::ARCH.into(),
        capabilities: platform::platform_capabilities(state),
        battery: snapshot,
        settings: SettingsSummary {
            low_threshold: settings.low_threshold,
            high_threshold: settings.high_threshold,
            low_alerts: settings.low_enabled,
            high_alerts: settings.high_enabled,
            notifications: settings.notification_enabled,
            sound: settings.sound_enabled,
            visual_alerts: settings.visual_alert_enabled,
            quiet_hours_enabled: settings.quiet_hours.enabled,
            cooldown_minutes: settings.cooldown_minutes,
            hysteresis_percent: settings.hysteresis_percent,
            poll_interval_secs: settings.poll_interval_secs,
            history_retention_days: settings.history_retention_days,
            history_sampling_minutes: settings.history_sampling_minutes,
            start_on_login: settings.start_on_login,
            minimize_to_tray: settings.minimize_to_tray,
            theme: format!("{:?}", settings.theme),
        },
        last_error: state.last_error_snapshot(),
        history_records,
        privacy_note: "This report contains battery and settings data only. It does not include a serial number, username, hostname, file path, or account identifier.".into(),
    }
}
