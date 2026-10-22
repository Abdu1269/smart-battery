use std::process::{Command, Output};

use log::warn;
use serde::{Deserialize, Serialize};

use crate::error::CommandError;
use crate::models::{CapabilityStatus, FeatureCapability};
use crate::settings::AppliedPowerChange;

const DISPLAY_OPTIONS: &[u32] = &[60, 120, 300, 600, 900, 1800];
const SLEEP_OPTIONS: &[u32] = &[300, 600, 900, 1800, 3600, 7200];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PowerProfile {
    PowerSaver,
    Balanced,
    Performance,
}

impl PowerProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PowerSaver => "power-saver",
            Self::Balanced => "balanced",
            Self::Performance => "performance",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "power-saver" => Some(Self::PowerSaver),
            "balanced" => Some(Self::Balanced),
            "performance" => Some(Self::Performance),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimeoutKind {
    Display,
    Sleep,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TimeoutSetting {
    pub supported: bool,
    pub current_seconds: Option<u32>,
    pub options_seconds: Vec<u32>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PowerSettings {
    pub profile: FeatureCapability,
    pub current_profile: Option<PowerProfile>,
    pub available_profiles: Vec<PowerProfile>,
    pub display_timeout: TimeoutSetting,
    pub sleep_timeout: TimeoutSetting,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PowerChangeResult {
    pub change: AppliedPowerChange,
    pub message: String,
}

pub fn read_power_settings() -> PowerSettings {
    let profile = read_profile();
    let gnome = gnome_settings_available();
    let display_current = if gnome {
        read_gsettings("org.gnome.desktop.session", "idle-delay")
            .and_then(|value| value.parse::<u32>().ok())
    } else {
        None
    };
    let sleep_current = if gnome {
        read_gsettings(
            "org.gnome.settings-daemon.plugins.power",
            "sleep-inactive-battery-timeout",
        )
        .and_then(|value| value.parse::<u32>().ok())
    } else {
        None
    };

    let profile_capability = match &profile {
        Ok((current, _available)) => FeatureCapability::new(
            CapabilityStatus::Supported,
            format!("Power Profiles is available. Current profile: {current}."),
            None::<String>,
        ),
        Err(reason) => FeatureCapability::new(
            CapabilityStatus::Unsupported,
            reason.clone(),
            Some("Use your desktop's power settings to choose a profile."),
        ),
    };

    PowerSettings {
        profile: profile_capability,
        current_profile: profile
            .as_ref()
            .ok()
            .and_then(|(current, _)| PowerProfile::parse(current)),
        available_profiles: profile
            .as_ref()
            .map(|(_, available)| available.clone())
            .unwrap_or_default(),
        display_timeout: TimeoutSetting {
            supported: gnome,
            current_seconds: display_current,
            options_seconds: DISPLAY_OPTIONS.to_vec(),
            reason: (!gnome).then(|| {
                "Display timeout is only changed here on a supported GNOME desktop.".into()
            }),
        },
        sleep_timeout: TimeoutSetting {
            supported: gnome,
            current_seconds: sleep_current,
            options_seconds: SLEEP_OPTIONS.to_vec(),
            reason: (!gnome)
                .then(|| "Sleep timeout is only changed here on a supported GNOME desktop.".into()),
        },
        provider: if profile.is_ok() {
            "power-profiles-daemon".into()
        } else if gnome {
            "GNOME Settings".into()
        } else {
            "System settings".into()
        },
    }
}

pub fn apply_power_profile(profile: PowerProfile) -> Result<PowerChangeResult, CommandError> {
    let (previous, available) = read_profile().map_err(|_| {
        CommandError::new(
            "powerProfilesUnavailable",
            "Power profiles are not available on this system.",
        )
    })?;
    if !available.contains(&profile) {
        return Err(CommandError::new(
            "powerProfileUnsupported",
            "That power profile is not available on this device.",
        ));
    }
    let Some(previous_profile) = PowerProfile::parse(&previous) else {
        return Err(CommandError::new(
            "powerProfileUnknown",
            "The current power profile could not be read, so it was not changed.",
        ));
    };
    if previous_profile == profile {
        return Ok(PowerChangeResult {
            change: AppliedPowerChange {
                key: "profile".into(),
                previous_value: previous.clone(),
                applied_value: profile.as_str().into(),
                applied_at: chrono::Utc::now().to_rfc3339(),
            },
            message: format!("The {} profile is already active.", profile.as_str()),
        });
    }
    run_checked(Command::new("powerprofilesctl").args(["set", profile.as_str()])).map_err(
        |_| {
            CommandError::new(
                "powerProfileApplyFailed",
                "The power profile could not be changed.",
            )
        },
    )?;
    let read_back = read_profile()
        .map(|(current, _)| current)
        .unwrap_or_default();
    if read_back != profile.as_str() {
        return Err(CommandError::new(
            "powerProfileVerifyFailed",
            "The power profile change could not be verified, so it was not reported as successful.",
        ));
    }
    Ok(PowerChangeResult {
        change: AppliedPowerChange {
            key: "profile".into(),
            previous_value: previous,
            applied_value: profile.as_str().into(),
            applied_at: chrono::Utc::now().to_rfc3339(),
        },
        message: format!("Power profile changed to {}.", profile.as_str()),
    })
}

pub fn apply_timeout(kind: TimeoutKind, seconds: u32) -> Result<PowerChangeResult, CommandError> {
    if !gnome_settings_available() {
        return Err(CommandError::new(
            "timeoutUnsupported",
            "Timeout changes are not supported on this desktop.",
        ));
    }
    let (schema, key, options, label) = match kind {
        TimeoutKind::Display => (
            "org.gnome.desktop.session",
            "idle-delay",
            DISPLAY_OPTIONS,
            "Display timeout",
        ),
        TimeoutKind::Sleep => (
            "org.gnome.settings-daemon.plugins.power",
            "sleep-inactive-battery-timeout",
            SLEEP_OPTIONS,
            "Battery sleep timeout",
        ),
    };
    if !options.contains(&seconds) {
        return Err(CommandError::new(
            "timeoutInvalid",
            "That timeout is not one of the supported values.",
        ));
    }
    let previous = read_gsettings(schema, key).ok_or_else(|| {
        CommandError::new(
            "timeoutUnreadable",
            "The current timeout could not be read, so it was not changed.",
        )
    })?;
    let previous_seconds = previous.parse::<u32>().unwrap_or(0);
    let value_type = if kind == TimeoutKind::Display {
        "uint32"
    } else {
        "int32"
    };
    run_checked(Command::new("gsettings").args([
        "set",
        schema,
        key,
        value_type,
        &seconds.to_string(),
    ]))
    .map_err(|_| CommandError::new("timeoutApplyFailed", "The timeout could not be changed."))?;
    let read_back = read_gsettings(schema, key)
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(u32::MAX);
    if read_back != seconds {
        return Err(CommandError::new(
            "timeoutVerifyFailed",
            "The timeout change could not be verified, so it was not reported as successful.",
        ));
    }
    Ok(PowerChangeResult {
        change: AppliedPowerChange {
            key: if kind == TimeoutKind::Display {
                "displayTimeout"
            } else {
                "sleepTimeout"
            }
            .into(),
            previous_value: previous_seconds.to_string(),
            applied_value: seconds.to_string(),
            applied_at: chrono::Utc::now().to_rfc3339(),
        },
        message: format!("{label} changed to {}.", format_seconds(seconds)),
    })
}

pub fn undo_power_change(change: &AppliedPowerChange) -> Result<PowerChangeResult, CommandError> {
    match change.key.as_str() {
        "profile" => {
            let previous = PowerProfile::parse(&change.previous_value).ok_or_else(|| {
                CommandError::new(
                    "undoUnavailable",
                    "The previous power profile is no longer valid.",
                )
            })?;
            apply_power_profile(previous)
        }
        "displayTimeout" => {
            let seconds = change.previous_value.parse::<u32>().map_err(|_| {
                CommandError::new("undoUnavailable", "The previous timeout is not valid.")
            })?;
            apply_timeout(TimeoutKind::Display, seconds)
        }
        "sleepTimeout" => {
            let seconds = change.previous_value.parse::<u32>().map_err(|_| {
                CommandError::new("undoUnavailable", "The previous timeout is not valid.")
            })?;
            apply_timeout(TimeoutKind::Sleep, seconds)
        }
        _ => Err(CommandError::new(
            "undoUnavailable",
            "This setting cannot be undone by BatteryBloom.",
        )),
    }
}

pub fn format_seconds(seconds: u32) -> String {
    if seconds == 0 {
        return "Never".into();
    }
    if seconds.is_multiple_of(3600) {
        let hours = seconds / 3600;
        return if hours == 1 {
            "1 hour".into()
        } else {
            format!("{hours} hours")
        };
    }
    let minutes = seconds / 60;
    if minutes == 1 {
        "1 minute".into()
    } else {
        format!("{minutes} minutes")
    }
}

fn read_profile() -> Result<(String, Vec<PowerProfile>), String> {
    let output = Command::new("powerprofilesctl")
        .arg("list")
        .output()
        .map_err(|_| "Power Profiles is not installed or not running.".to_string())?;
    if !output.status.success() {
        return Err("Power Profiles did not return a usable profile list.".into());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let available = parse_profile_list(&text);
    if available.is_empty() {
        return Err("No power profiles are available.".into());
    }
    let current_output = Command::new("powerprofilesctl")
        .arg("get")
        .output()
        .map_err(|_| "The current power profile could not be read.".to_string())?;
    if !current_output.status.success() {
        return Err("The current power profile could not be read.".into());
    }
    let current = String::from_utf8_lossy(&current_output.stdout)
        .trim()
        .to_string();
    if PowerProfile::parse(&current).is_none() {
        return Err("The current power profile is not recognized.".into());
    }
    Ok((current, available))
}

fn parse_profile_list(text: &str) -> Vec<PowerProfile> {
    let mut profiles = Vec::new();
    for line in text.lines() {
        let name = line
            .trim()
            .trim_start_matches('*')
            .trim()
            .trim_end_matches(':')
            .trim();
        if let Some(profile) = PowerProfile::parse(name) {
            if !profiles.contains(&profile) {
                profiles.push(profile);
            }
        }
    }
    profiles
}

fn gnome_settings_available() -> bool {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .or_else(|_| std::env::var("DESKTOP_SESSION"))
        .unwrap_or_default()
        .to_lowercase();
    let is_gnome = desktop.contains("gnome") || desktop.contains("ubuntu");
    is_gnome && command_exists("gsettings")
}

fn command_exists(name: &str) -> bool {
    let Some(path) = std::env::var_os("PATH") else {
        return false;
    };
    std::env::split_paths(&path).any(|directory| directory.join(name).is_file())
}

fn read_gsettings(schema: &str, key: &str) -> Option<String> {
    let output = Command::new("gsettings")
        .args(["get", schema, key])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.split_whitespace().last().map(ToOwned::to_owned)
}

fn run_checked(command: &mut Command) -> Result<Output, ()> {
    let output = command.output().map_err(|error| {
        warn!("power command failed to start: {error}");
    })?;
    if output.status.success() {
        Ok(output)
    } else {
        warn!(
            "power command exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        );
        Err(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_power_profiles_ctl_output() {
        let text = "  performance:\n    CpuDriver:\tintel_pstate\n\n* balanced:\n  power-saver:\n";
        assert_eq!(
            parse_profile_list(text),
            vec![
                PowerProfile::Performance,
                PowerProfile::Balanced,
                PowerProfile::PowerSaver
            ]
        );
    }

    #[test]
    fn formats_durations() {
        assert_eq!(format_seconds(300), "5 minutes");
        assert_eq!(format_seconds(3600), "1 hour");
        assert_eq!(format_seconds(7200), "2 hours");
        assert_eq!(format_seconds(0), "Never");
    }

    #[test]
    fn rejects_unknown_profiles() {
        assert!(PowerProfile::parse("turbo").is_none());
    }

    #[test]
    fn timeout_options_are_bounded() {
        assert!(DISPLAY_OPTIONS.contains(&300));
        assert!(SLEEP_OPTIONS.contains(&900));
        assert!(!DISPLAY_OPTIONS.contains(&5));
    }
}
