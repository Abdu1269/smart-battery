use std::fs;
use std::path::PathBuf;

use batterybloom_core::battery::BatteryProvider;
use batterybloom_core::charge_control::ChargeLimitProvider;
use batterybloom_core::error::{ChargeLimitError, CommandError, SettingsError};
use batterybloom_core::history::{HistoryExportResult, HistoryRecord};
use batterybloom_core::models::{
    BatterySnapshot, ChargeLimitApplyResult, ChargeLimitCapability, ChargeLimitRequest,
    NotificationTestResult, PlatformCapabilities,
};
use batterybloom_core::power::{
    apply_power_profile as core_apply_power_profile, apply_timeout as core_apply_timeout,
    read_power_settings, undo_power_change, PowerChangeResult, PowerProfile, PowerSettings,
    TimeoutKind,
};
use batterybloom_core::recommendations::{recommendations, Recommendation};
use batterybloom_core::settings::{AppSettings, CURRENT_SCHEMA_VERSION};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;

use crate::diagnostics::{self, DiagnosticsReport};
use crate::platform;
use crate::state::AppState;
use crate::tray;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub app_version: String,
    pub snapshot: Option<BatterySnapshot>,
    pub capabilities: PlatformCapabilities,
    pub settings: AppSettings,
    pub charge_limit: ChargeLimitCapability,
    pub power_settings: PowerSettings,
    pub recommendations: Vec<Recommendation>,
    pub settings_warning: Option<String>,
    pub last_error: Option<String>,
}

#[tauri::command]
pub fn get_bootstrap(app: AppHandle, state: State<'_, AppState>) -> Bootstrap {
    let settings = state.settings_snapshot();
    let charge_limit = state.charge_provider.capability();
    let power_settings = read_power_settings();
    let snapshot = state
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());
    let recommendations = match &snapshot {
        Some(snapshot) => recommendations(
            snapshot,
            &charge_limit,
            power_settings.profile.status == batterybloom_core::models::CapabilityStatus::Supported,
            &settings,
        ),
        None => Vec::new(),
    };
    Bootstrap {
        app_version: app.package_info().version.to_string(),
        snapshot,
        capabilities: platform::platform_capabilities(&state),
        settings,
        charge_limit,
        power_settings,
        recommendations,
        settings_warning: state.settings_warning_snapshot(),
        last_error: state.last_error_snapshot(),
    }
}

#[tauri::command]
pub fn get_battery_snapshot(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatterySnapshot, CommandError> {
    let snapshot = state.battery_provider.read().map_err(|error| {
        let message = error.to_string();
        state.set_last_error(Some(message.clone()));
        CommandError::new("batteryUnavailable", message)
    })?;
    state.set_last_error(None);
    if let Ok(mut current) = state.snapshot.lock() {
        *current = Some(snapshot.clone());
    }
    tray::refresh_tray(&app, Some(&snapshot));
    let _ = app.emit("battery://snapshot", &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn get_platform_capabilities(state: State<'_, AppState>) -> PlatformCapabilities {
    platform::platform_capabilities(&state)
}

#[tauri::command]
pub fn get_charge_limit(state: State<'_, AppState>) -> ChargeLimitCapability {
    state.charge_provider.capability()
}

#[tauri::command]
pub fn get_recommendations(state: State<'_, AppState>) -> Vec<Recommendation> {
    let settings = state.settings_snapshot();
    let charge = state.charge_provider.capability();
    let power = read_power_settings();
    let snapshot = state
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());
    match snapshot {
        Some(snapshot) => recommendations(
            &snapshot,
            &charge,
            power.profile.status == batterybloom_core::models::CapabilityStatus::Supported,
            &settings,
        ),
        None => Vec::new(),
    }
}

#[tauri::command]
pub fn get_power_settings() -> PowerSettings {
    read_power_settings()
}

#[tauri::command]
pub fn get_app_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings_snapshot()
}

#[tauri::command]
pub fn save_app_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    mut settings: AppSettings,
) -> Result<AppSettings, CommandError> {
    let current = state.settings_snapshot();
    settings.schema_version = CURRENT_SCHEMA_VERSION;
    settings.charge_limit_baseline = current.charge_limit_baseline.clone();
    settings.last_charge_limit_applied_at = current.last_charge_limit_applied_at.clone();
    settings.last_power_change = current.last_power_change.clone();
    settings.validate().map_err(settings_error_to_command)?;

    let start_changed = settings.start_on_login != current.start_on_login;
    if start_changed {
        let result = if settings.start_on_login {
            app.autolaunch().enable()
        } else {
            app.autolaunch().disable()
        };
        if let Err(error) = result {
            log::warn!("autostart change failed: {error}");
            return Err(CommandError::new(
                "autostartFailed",
                "The launch-at-login setting could not be changed, so no settings were saved.",
            ));
        }
    }

    if let Err(error) = state.settings_store.save(&settings) {
        if start_changed {
            let _ = if current.start_on_login {
                app.autolaunch().enable()
            } else {
                app.autolaunch().disable()
            };
        }
        return Err(settings_error_to_command(error));
    }

    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    if let Ok(mut engine) = state.engine.lock() {
        engine.reset_for_settings_change();
    }
    if let Ok(mut warning) = state.settings_warning.lock() {
        *warning = None;
    }
    let snapshot = state
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());
    tray::refresh_tray(&app, snapshot.as_ref());
    let _ = app.emit("settings://changed", &settings);
    Ok(settings)
}

#[tauri::command]
pub fn reset_app_settings(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppSettings, CommandError> {
    let current = state.settings_snapshot();
    let defaults = AppSettings {
        onboarded: true,
        charge_limit_baseline: current.charge_limit_baseline,
        last_charge_limit_applied_at: current.last_charge_limit_applied_at,
        last_power_change: current.last_power_change,
        ..AppSettings::default()
    };
    defaults.validate().map_err(settings_error_to_command)?;

    if current.start_on_login {
        app.autolaunch().disable().map_err(|error| {
            log::warn!("could not disable autostart during reset: {error}");
            CommandError::new(
                "autostartFailed",
                "BatteryBloom could not disable launch at login, so settings were not reset.",
            )
        })?;
    }
    state
        .settings_store
        .save(&defaults)
        .map_err(settings_error_to_command)?;
    if let Ok(mut settings) = state.settings.lock() {
        *settings = defaults.clone();
    }
    if let Ok(mut engine) = state.engine.lock() {
        engine.reset_for_settings_change();
    }
    if let Ok(mut warning) = state.settings_warning.lock() {
        *warning = None;
    }
    let snapshot = state
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());
    tray::refresh_tray(&app, snapshot.as_ref());
    let _ = app.emit("settings://changed", &defaults);
    Ok(defaults)
}

#[tauri::command]
pub async fn set_charge_limit(
    app: AppHandle,
    state: State<'_, AppState>,
    request: ChargeLimitRequest,
) -> Result<ChargeLimitApplyResult, CommandError> {
    if !request.confirmed {
        return Err(CommandError::new(
            "confirmationRequired",
            "Confirm the charge-limit change before applying it.",
        ));
    }
    let capability = state.charge_provider.capability();
    match capability.status {
        batterybloom_core::models::CapabilityStatus::Supported => {}
        batterybloom_core::models::CapabilityStatus::PermissionRequired => {
            return Err(CommandError::new(
                "permissionRequired",
                "BatteryBloom does not have permission to change this laptop's charge thresholds.",
            ));
        }
        _ => {
            return Err(CommandError::new(
                "chargeLimitUnsupported",
                "This device does not expose a verified charge-threshold interface.",
            ));
        }
    }
    let Some(current_end) = capability.current_end else {
        return Err(CommandError::new(
            "chargeLimitUnreadable",
            "The current charge threshold could not be read, so nothing was changed.",
        ));
    };

    let mut settings = state.settings_snapshot();
    if settings.charge_limit_baseline.is_none() {
        settings.record_charge_limit_baseline(capability.current_start, current_end);
        state
            .settings_store
            .save(&settings)
            .map_err(settings_error_to_command)?;
        if let Ok(mut current) = state.settings.lock() {
            *current = settings.clone();
        }
    }

    let provider = state.charge_provider.clone();
    let apply_request = request.clone();
    let result = tauri::async_runtime::spawn_blocking(move || provider.apply(&apply_request))
        .await
        .map_err(|_| {
            CommandError::new(
                "applyFailed",
                "The charge-limit operation could not be completed.",
            )
        })?
        .map_err(charge_error_to_command)?;

    settings.last_charge_limit_applied_at = Some(result.applied_at.clone());
    let _ = state.settings_store.save(&settings);
    if let Ok(mut current) = state.settings.lock() {
        *current = settings;
    }
    let _ = app.emit("charge://changed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn reset_charge_limit(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ChargeLimitApplyResult, CommandError> {
    let mut settings = state.settings_snapshot();
    let Some(baseline) = settings.charge_limit_baseline.clone() else {
        return Err(CommandError::new(
            "noBaseline",
            "BatteryBloom has no saved pre-change threshold to restore.",
        ));
    };
    let provider = state.charge_provider.clone();
    let result = tauri::async_runtime::spawn_blocking(move || provider.reset(&baseline))
        .await
        .map_err(|_| {
            CommandError::new(
                "resetFailed",
                "The previous charge threshold could not be restored.",
            )
        })?
        .map_err(charge_error_to_command)?;

    settings.charge_limit_baseline = None;
    settings.last_charge_limit_applied_at = Some(result.applied_at.clone());
    let _ = state.settings_store.save(&settings);
    if let Ok(mut current) = state.settings.lock() {
        *current = settings;
    }
    let _ = app.emit("charge://changed", &result);
    Ok(result)
}

#[tauri::command]
pub async fn apply_power_profile(
    app: AppHandle,
    state: State<'_, AppState>,
    profile: PowerProfile,
) -> Result<PowerChangeResult, CommandError> {
    let result = tauri::async_runtime::spawn_blocking(move || core_apply_power_profile(profile))
        .await
        .map_err(|_| {
            CommandError::new("powerProfileFailed", "The power profile operation failed.")
        })??;
    persist_power_change(&app, &state, &result);
    Ok(result)
}

#[tauri::command]
pub async fn apply_power_timeout(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: TimeoutKind,
    seconds: u32,
) -> Result<PowerChangeResult, CommandError> {
    let result = tauri::async_runtime::spawn_blocking(move || core_apply_timeout(kind, seconds))
        .await
        .map_err(|_| CommandError::new("timeoutFailed", "The timeout operation failed."))??;
    persist_power_change(&app, &state, &result);
    Ok(result)
}

#[tauri::command]
pub async fn undo_last_power_change(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PowerChangeResult, CommandError> {
    let mut settings = state.settings_snapshot();
    let Some(change) = settings.last_power_change.clone() else {
        return Err(CommandError::new(
            "nothingToUndo",
            "There is no recent power change to undo.",
        ));
    };
    let result = tauri::async_runtime::spawn_blocking(move || undo_power_change(&change))
        .await
        .map_err(|_| CommandError::new("undoFailed", "The power change could not be undone."))??;
    settings.last_power_change = None;
    let _ = state.settings_store.save(&settings);
    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    let _ = app.emit("settings://changed", settings);
    Ok(result)
}

#[tauri::command]
pub fn get_battery_history(state: State<'_, AppState>) -> Result<Vec<HistoryRecord>, CommandError> {
    state.history_store.load().map_err(|error| {
        CommandError::new(
            "historyReadFailed",
            format!("Battery history could not be read: {error}"),
        )
    })
}

#[tauri::command]
pub fn clear_battery_history(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    state.history_store.clear().map_err(|error| {
        CommandError::new(
            "historyClearFailed",
            format!("Battery history could not be cleared: {error}"),
        )
    })?;
    let _ = app.emit("history://changed", ());
    Ok(())
}

#[tauri::command]
pub async fn export_battery_history(
    state: State<'_, AppState>,
    format: String,
    path: String,
) -> Result<HistoryExportResult, CommandError> {
    let target = validated_export_path(&path)?;
    let format = format.to_ascii_lowercase();
    if !matches!(format.as_str(), "csv" | "json") {
        return Err(CommandError::new(
            "invalidFormat",
            "Choose CSV or JSON for the history export.",
        ));
    }
    if target == state.history_store.path() {
        return Err(CommandError::new(
            "invalidPath",
            "Choose a different file name; BatteryBloom's own history file cannot be overwritten.",
        ));
    }
    let store = state.history_store.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        if format == "csv" {
            store.export_csv(&target)
        } else {
            store.export_json(&target)
        }
    })
    .await
    .map_err(|_| CommandError::new("exportFailed", "The history export failed."))?
    .map_err(|error| {
        CommandError::new(
            "exportFailed",
            format!("The history export failed: {error}"),
        )
    })?;
    Ok(result)
}

#[tauri::command]
pub fn get_diagnostics(app: AppHandle, state: State<'_, AppState>) -> DiagnosticsReport {
    diagnostics::report(&app, &state)
}

#[tauri::command]
pub fn export_diagnostics(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let report = diagnostics::report(&app, &state);
    serde_json::to_string_pretty(&report).map_err(|_| {
        CommandError::new(
            "diagnosticsFailed",
            "The diagnostics report could not be created.",
        )
    })
}

#[tauri::command]
pub fn save_diagnostics(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<String, CommandError> {
    let target = validated_export_path(&path)?;
    if target == state.history_store.path() {
        return Err(CommandError::new(
            "invalidPath",
            "Choose a different file name; BatteryBloom's own history file cannot be overwritten.",
        ));
    }
    let report = diagnostics::report(&app, &state);
    let payload = serde_json::to_string_pretty(&report).map_err(|_| {
        CommandError::new(
            "diagnosticsFailed",
            "The diagnostics report could not be created.",
        )
    })?;
    fs::write(&target, payload).map_err(|error| {
        CommandError::new(
            "diagnosticsWriteFailed",
            format!("The diagnostics file could not be written: {error}"),
        )
    })?;
    Ok(target.display().to_string())
}

#[tauri::command]
pub fn copy_diagnostics(app: AppHandle, state: State<'_, AppState>) -> Result<(), CommandError> {
    let report = diagnostics::report(&app, &state);
    let payload = serde_json::to_string_pretty(&report).map_err(|_| {
        CommandError::new(
            "diagnosticsFailed",
            "The diagnostics report could not be created.",
        )
    })?;
    app.clipboard().write_text(payload).map_err(|error| {
        CommandError::new(
            "clipboardFailed",
            format!("The diagnostics report could not be copied: {error}"),
        )
    })
}

#[tauri::command]
pub fn send_test_notification(app: AppHandle) -> Result<NotificationTestResult, CommandError> {
    app.notification()
        .builder()
        .title("BatteryBloom test notification")
        .body("If you can see this, native notifications are working.")
        .show()
        .map_err(|error| {
            CommandError::new(
                "notificationFailed",
                format!("The test notification could not be delivered: {error}"),
            )
        })?;
    Ok(NotificationTestResult {
        delivered: true,
        message: "Test notification sent. Check your notification center.".into(),
    })
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SystemSettingsTarget {
    Power,
    Display,
    Notifications,
}

#[tauri::command]
pub fn open_system_settings(
    app: AppHandle,
    target: SystemSettingsTarget,
) -> Result<(), CommandError> {
    open_platform_settings(&app, target)
}

fn persist_power_change(app: &AppHandle, state: &AppState, result: &PowerChangeResult) {
    let mut settings = state.settings_snapshot();
    settings.last_power_change = Some(result.change.clone());
    if let Err(error) = state.settings_store.save(&settings) {
        log::warn!("could not persist last power change: {error}");
    }
    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    let _ = app.emit("settings://changed", settings);
}

fn settings_error_to_command(error: SettingsError) -> CommandError {
    match error {
        SettingsError::Invalid(message) => CommandError::new("invalidSettings", message),
        _ => CommandError::new("settingsFailed", error.to_string()),
    }
}

fn charge_error_to_command(error: ChargeLimitError) -> CommandError {
    let (code, message) = match error {
        ChargeLimitError::Unsupported => (
            "chargeLimitUnsupported",
            "This device does not expose a verified charge-threshold interface.",
        ),
        ChargeLimitError::PermissionRequired => (
            "permissionRequired",
            "The charge threshold is present but not writable by BatteryBloom. No privileged command was attempted.",
        ),
        ChargeLimitError::InvalidRange => (
            "invalidRange",
            "The requested charge limit is outside the supported range.",
        ),
        ChargeLimitError::InvalidOrdering => (
            "invalidOrdering",
            "The start threshold must be lower than the end threshold.",
        ),
        ChargeLimitError::ApplyFailed => (
            "applyFailed",
            "The charge limit was not applied. The previous values were kept where possible.",
        ),
        ChargeLimitError::VerificationFailed => (
            "verificationFailed",
            "The new charge limit could not be verified. BatteryBloom attempted to restore the previous values and is not reporting success.",
        ),
        ChargeLimitError::ChangedConcurrently => (
            "changedConcurrently",
            "The charge threshold changed while BatteryBloom was working, so the request was not retried.",
        ),
    };
    CommandError::new(code, message)
}

fn validated_export_path(path: &str) -> Result<PathBuf, CommandError> {
    if path.trim().is_empty() || path.len() > 4096 {
        return Err(CommandError::new(
            "invalidPath",
            "Choose a valid destination file.",
        ));
    }
    let target = PathBuf::from(path);
    if !target.is_absolute() {
        return Err(CommandError::new(
            "invalidPath",
            "Choose an absolute destination path.",
        ));
    }
    Ok(target)
}

#[cfg(target_os = "linux")]
fn open_platform_settings(
    _app: &AppHandle,
    target: SystemSettingsTarget,
) -> Result<(), CommandError> {
    use std::process::Command;
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_lowercase();
    if desktop.contains("kde") {
        let panel = match target {
            SystemSettingsTarget::Power => "kcm_powerdevil",
            SystemSettingsTarget::Display => "kcm_kscreen",
            SystemSettingsTarget::Notifications => "kcm_notifications",
        };
        return Command::new("systemsettings")
            .arg(panel)
            .spawn()
            .map(|_| ())
            .map_err(|_| {
                CommandError::new(
                    "settingsOpenFailed",
                    "KDE System Settings could not be opened.",
                )
            });
    }

    let panel = match target {
        SystemSettingsTarget::Power => "power",
        SystemSettingsTarget::Display => "display",
        SystemSettingsTarget::Notifications => "notifications",
    };
    Command::new("gnome-control-center")
        .arg(panel)
        .spawn()
        .map(|_| ())
        .map_err(|_| {
            CommandError::new(
                "settingsOpenFailed",
                "The desktop settings app could not be opened. Open your system settings manually.",
            )
        })
}

#[cfg(target_os = "windows")]
fn open_platform_settings(
    app: &AppHandle,
    target: SystemSettingsTarget,
) -> Result<(), CommandError> {
    let url = match target {
        SystemSettingsTarget::Power => "ms-settings:batterysaver",
        SystemSettingsTarget::Display => "ms-settings:display",
        SystemSettingsTarget::Notifications => "ms-settings:notifications",
    };
    app.opener().open_url(url, None::<&str>).map_err(|error| {
        CommandError::new(
            "settingsOpenFailed",
            format!("Windows Settings could not be opened: {error}"),
        )
    })
}

#[cfg(target_os = "macos")]
fn open_platform_settings(
    app: &AppHandle,
    target: SystemSettingsTarget,
) -> Result<(), CommandError> {
    let url = match target {
        SystemSettingsTarget::Power => {
            "x-apple.systempreferences:com.apple.Battery-Settings.extension"
        }
        SystemSettingsTarget::Display => {
            "x-apple.systempreferences:com.apple.Displays-Settings.extension"
        }
        SystemSettingsTarget::Notifications => {
            "x-apple.systempreferences:com.apple.Notifications-Settings.extension"
        }
    };
    app.opener().open_url(url, None::<&str>).map_err(|error| {
        CommandError::new(
            "settingsOpenFailed",
            format!("System Settings could not be opened: {error}"),
        )
    })
}
