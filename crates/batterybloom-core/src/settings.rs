use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;
use log::warn;
use serde::{Deserialize, Serialize};

use crate::error::SettingsError;

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum AlertPowerScope {
    Battery,
    Ac,
    #[default]
    Both,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum StartupAlertPolicy {
    Immediate,
    #[default]
    CrossingOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuietHours {
    pub enabled: bool,
    pub start_minutes: u16,
    pub end_minutes: u16,
}

impl Default for QuietHours {
    fn default() -> Self {
        Self {
            enabled: false,
            start_minutes: 22 * 60,
            end_minutes: 7 * 60,
        }
    }
}

impl QuietHours {
    pub fn contains(&self, minute_of_day: u16) -> bool {
        if !self.enabled || self.start_minutes == self.end_minutes {
            return false;
        }
        if self.start_minutes < self.end_minutes {
            minute_of_day >= self.start_minutes && minute_of_day < self.end_minutes
        } else {
            minute_of_day >= self.start_minutes || minute_of_day < self.end_minutes
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChargeLimitBaseline {
    pub start: Option<u8>,
    pub end: u8,
    pub captured_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppliedPowerChange {
    pub key: String,
    pub previous_value: String,
    pub applied_value: String,
    pub applied_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub schema_version: u32,
    pub onboarded: bool,
    pub low_enabled: bool,
    pub low_threshold: u8,
    pub high_enabled: bool,
    pub high_threshold: u8,
    pub notification_enabled: bool,
    pub sound_enabled: bool,
    pub visual_alert_enabled: bool,
    pub sound_volume: u8,
    pub cooldown_minutes: u16,
    pub hysteresis_percent: u8,
    pub quiet_hours: QuietHours,
    pub alert_on_start: StartupAlertPolicy,
    pub alert_power_scope: AlertPowerScope,
    pub theme: ThemePreference,
    pub minimize_to_tray: bool,
    pub start_on_login: bool,
    pub launch_minimized: bool,
    pub poll_interval_secs: u32,
    pub history_retention_days: u16,
    pub history_sampling_minutes: u16,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub charge_limit_baseline: Option<ChargeLimitBaseline>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_charge_limit_applied_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_power_change: Option<AppliedPowerChange>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            onboarded: false,
            low_enabled: true,
            low_threshold: 20,
            high_enabled: true,
            high_threshold: 80,
            notification_enabled: true,
            sound_enabled: true,
            visual_alert_enabled: true,
            sound_volume: 65,
            cooldown_minutes: 30,
            hysteresis_percent: 3,
            quiet_hours: QuietHours::default(),
            alert_on_start: StartupAlertPolicy::CrossingOnly,
            alert_power_scope: AlertPowerScope::Both,
            theme: ThemePreference::System,
            minimize_to_tray: true,
            start_on_login: false,
            launch_minimized: false,
            poll_interval_secs: 30,
            history_retention_days: 90,
            history_sampling_minutes: 5,
            charge_limit_baseline: None,
            last_charge_limit_applied_at: None,
            last_power_change: None,
        }
    }
}

impl AppSettings {
    pub fn validate(&self) -> Result<(), SettingsError> {
        if !(5..=100).contains(&self.low_threshold) {
            return Err(SettingsError::Invalid(
                "The low charge threshold must be between 5% and 100%.".into(),
            ));
        }
        if !(5..=100).contains(&self.high_threshold) {
            return Err(SettingsError::Invalid(
                "The high charge threshold must be between 5% and 100%.".into(),
            ));
        }
        if self.low_threshold >= self.high_threshold {
            return Err(SettingsError::Invalid(
                "The low threshold must be lower than the high threshold.".into(),
            ));
        }
        if !(1..=20).contains(&self.hysteresis_percent) {
            return Err(SettingsError::Invalid(
                "Hysteresis must be between 1 and 20 percentage points.".into(),
            ));
        }
        if self.hysteresis_percent
            >= self
                .high_threshold
                .saturating_sub(self.low_threshold)
                .max(1)
        {
            return Err(SettingsError::Invalid(
                "Hysteresis must be smaller than the gap between the low and high thresholds."
                    .into(),
            ));
        }
        if self.cooldown_minutes > 240 {
            return Err(SettingsError::Invalid(
                "The alert cooldown must be 240 minutes or less.".into(),
            ));
        }
        if self.sound_volume > 100 {
            return Err(SettingsError::Invalid(
                "Sound volume must be between 0 and 100.".into(),
            ));
        }
        if self.quiet_hours.start_minutes >= 24 * 60 || self.quiet_hours.end_minutes >= 24 * 60 {
            return Err(SettingsError::Invalid(
                "Quiet hours must use a valid time of day.".into(),
            ));
        }
        if self.quiet_hours.enabled
            && self.quiet_hours.start_minutes == self.quiet_hours.end_minutes
        {
            return Err(SettingsError::Invalid(
                "Quiet hours must have different start and end times.".into(),
            ));
        }
        if !(15..=300).contains(&self.poll_interval_secs) {
            return Err(SettingsError::Invalid(
                "The polling interval must be between 15 and 300 seconds.".into(),
            ));
        }
        if !matches!(self.history_retention_days, 7 | 30 | 90 | 365) {
            return Err(SettingsError::Invalid(
                "History retention must be 7, 30, 90, or 365 days.".into(),
            ));
        }
        if !matches!(self.history_sampling_minutes, 1 | 5 | 15 | 30) {
            return Err(SettingsError::Invalid(
                "History sampling must be 1, 5, 15, or 30 minutes.".into(),
            ));
        }
        if let Some(baseline) = &self.charge_limit_baseline {
            if !(5..=100).contains(&baseline.end) {
                return Err(SettingsError::Invalid(
                    "The saved charge-limit baseline is invalid.".into(),
                ));
            }
            if let Some(start) = baseline.start {
                if start >= baseline.end {
                    return Err(SettingsError::Invalid(
                        "The saved charge-limit baseline is invalid.".into(),
                    ));
                }
            }
        }
        Ok(())
    }

    pub fn is_quiet_now(&self) -> bool {
        let now = chrono::Local::now();
        use chrono::Timelike;
        self.quiet_hours
            .contains((now.hour() * 60 + now.minute()) as u16)
    }

    pub fn record_charge_limit_baseline(&mut self, start: Option<u8>, end: u8) {
        if self.charge_limit_baseline.is_none() {
            self.charge_limit_baseline = Some(ChargeLimitBaseline {
                start,
                end,
                captured_at: Utc::now().to_rfc3339(),
            });
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsLoad {
    pub settings: AppSettings,
    pub warning: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> SettingsLoad {
        let raw = match fs::read_to_string(&self.path) {
            Ok(raw) => raw,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return SettingsLoad {
                    settings: AppSettings::default(),
                    warning: None,
                };
            }
            Err(error) => {
                warn!("settings could not be read: {error}");
                return SettingsLoad {
                    settings: AppSettings::default(),
                    warning: Some("Settings could not be read. Defaults are in use.".into()),
                };
            }
        };

        match serde_json::from_str::<AppSettings>(&raw) {
            Ok(mut settings) => {
                if settings.schema_version > CURRENT_SCHEMA_VERSION {
                    return SettingsLoad {
                        settings: AppSettings::default(),
                        warning: Some(
                            "Settings were created by a newer version of BatteryBloom. Defaults are in use."
                                .into(),
                        ),
                    };
                }

                let mut warning = None;
                if settings.schema_version < CURRENT_SCHEMA_VERSION {
                    settings.schema_version = CURRENT_SCHEMA_VERSION;
                    warning = Some("Settings were upgraded to the current format.".into());
                }

                if let Err(error) = settings.validate() {
                    warn!("stored settings were invalid: {error}");
                    return SettingsLoad {
                        settings: AppSettings::default(),
                        warning: Some("Stored settings were invalid. Defaults are in use.".into()),
                    };
                }
                SettingsLoad { settings, warning }
            }
            Err(error) => {
                warn!("settings file was malformed: {error}");
                let backup = self.path.with_file_name(format!(
                    "{}.corrupt-{}",
                    self.path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("settings.json"),
                    Utc::now().timestamp()
                ));
                if fs::rename(&self.path, &backup).is_ok() {
                    warn!("malformed settings were moved to {}", backup.display());
                }
                SettingsLoad {
                    settings: AppSettings::default(),
                    warning: Some(
                        "Settings could not be decoded and were reset. A backup was kept.".into(),
                    ),
                }
            }
        }
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), SettingsError> {
        settings.validate()?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|_| SettingsError::WriteFailed)?;
        }
        let payload =
            serde_json::to_vec_pretty(settings).map_err(|_| SettingsError::WriteFailed)?;
        let temp = self.path.with_extension("json.tmp");
        {
            let mut file = fs::File::create(&temp).map_err(|_| SettingsError::WriteFailed)?;
            file.write_all(&payload)
                .map_err(|_| SettingsError::WriteFailed)?;
            file.sync_all().map_err(|_| SettingsError::WriteFailed)?;
        }
        if fs::rename(&temp, &self.path).is_err() {
            // Windows does not replace an existing file with rename().
            let _ = fs::remove_file(&self.path);
            fs::rename(&temp, &self.path).map_err(|_| SettingsError::WriteFailed)?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        let settings = AppSettings::default();
        settings.validate().unwrap();
        assert_eq!(settings.low_threshold, 20);
        assert_eq!(settings.high_threshold, 80);
    }

    #[test]
    fn rejects_inverted_thresholds() {
        let settings = AppSettings {
            low_threshold: 85,
            ..AppSettings::default()
        };
        assert!(settings.validate().is_err());
    }

    #[test]
    fn rejects_excessive_hysteresis() {
        let settings = AppSettings {
            hysteresis_percent: 20,
            low_threshold: 50,
            high_threshold: 60,
            ..AppSettings::default()
        };
        assert!(settings.validate().is_err());
    }

    #[test]
    fn quiet_hours_cross_midnight() {
        let quiet = QuietHours {
            enabled: true,
            start_minutes: 22 * 60,
            end_minutes: 7 * 60,
        };
        assert!(quiet.contains(23 * 60));
        assert!(quiet.contains(6 * 60));
        assert!(!quiet.contains(12 * 60));
        assert!(!QuietHours {
            enabled: false,
            ..quiet
        }
        .contains(23 * 60));
    }

    #[test]
    fn persists_and_reloads_settings() {
        let dir = tempfile::tempdir().unwrap();
        let store = SettingsStore::new(dir.path().join("settings.json"));
        let settings = AppSettings {
            low_threshold: 25,
            high_threshold: 75,
            ..AppSettings::default()
        };
        store.save(&settings).unwrap();
        let loaded = store.load();
        assert_eq!(loaded.settings.low_threshold, 25);
        assert!(loaded.warning.is_none());
    }

    #[test]
    fn migrates_missing_fields_and_old_schema() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(
            &path,
            r#"{"schemaVersion":0,"lowThreshold":18,"highThreshold":82}"#,
        )
        .unwrap();
        let loaded = SettingsStore::new(&path).load();
        assert_eq!(loaded.settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(loaded.settings.low_threshold, 18);
        assert_eq!(loaded.settings.sound_volume, 65);
        assert!(loaded.warning.is_some());
    }

    #[test]
    fn malformed_settings_are_backed_up() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, "not json").unwrap();
        let loaded = SettingsStore::new(&path).load();
        assert!(loaded.warning.is_some());
        assert!(!path.exists());
        let backups = fs::read_dir(dir.path())
            .unwrap()
            .flatten()
            .filter(|entry| entry.file_name().to_string_lossy().contains(".corrupt-"))
            .count();
        assert_eq!(backups, 1);
    }

    #[test]
    fn future_schema_is_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, r#"{"schemaVersion":99}"#).unwrap();
        let loaded = SettingsStore::new(&path).load();
        assert!(loaded.warning.is_some());
        assert_eq!(loaded.settings.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(path.exists());
    }
}
