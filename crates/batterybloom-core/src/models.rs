use serde::{Deserialize, Serialize};

/// Current battery state as reported by the platform.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BatteryState {
    Charging,
    Discharging,
    Full,
    NotCharging,
    Unknown,
}

/// Where the device is currently drawing power from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PowerSource {
    Ac,
    Battery,
    Unknown,
}

/// A typed capability state. The frontend relies on these values instead of
/// scattering operating-system checks throughout the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CapabilityStatus {
    Supported,
    Unsupported,
    PermissionRequired,
    NotDetected,
    ReadOnly,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FeatureCapability {
    pub status: CapabilityStatus,
    pub reason: String,
    pub next_step: Option<String>,
}

impl FeatureCapability {
    pub fn new(
        status: CapabilityStatus,
        reason: impl Into<String>,
        next_step: Option<impl Into<String>>,
    ) -> Self {
        Self {
            status,
            reason: reason.into(),
            next_step: next_step.map(Into::into),
        }
    }

    pub fn supported(reason: impl Into<String>) -> Self {
        Self::new(CapabilityStatus::Supported, reason, None::<String>)
    }
}

/// A complete, serialization-safe snapshot. `None` always means "the platform
/// did not supply this value", never zero or an invented estimate.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BatterySnapshot {
    pub percent: Option<u8>,
    pub state: BatteryState,
    pub power_source: Option<PowerSource>,
    pub time_remaining_secs: Option<u64>,
    pub time_to_full_secs: Option<u64>,
    pub design_capacity_mwh: Option<u64>,
    pub full_charge_capacity_mwh: Option<u64>,
    pub current_capacity_mwh: Option<u64>,
    pub power_draw_mw: Option<u64>,
    pub cycle_count: Option<u32>,
    pub temperature_celsius: Option<f32>,
    pub battery_count: u32,
    pub is_available: bool,
    pub observed_at: String,
}

impl BatterySnapshot {
    pub fn unavailable(power_source: Option<PowerSource>, observed_at: String) -> Self {
        Self {
            percent: None,
            state: BatteryState::Unknown,
            power_source,
            time_remaining_secs: None,
            time_to_full_secs: None,
            design_capacity_mwh: None,
            full_charge_capacity_mwh: None,
            current_capacity_mwh: None,
            power_draw_mw: None,
            cycle_count: None,
            temperature_celsius: None,
            battery_count: 0,
            is_available: false,
            observed_at,
        }
    }

    pub fn is_on_ac(&self) -> bool {
        matches!(
            self.power_source,
            Some(PowerSource::Ac) | Some(PowerSource::Unknown)
        ) && matches!(
            self.state,
            BatteryState::Charging | BatteryState::Full | BatteryState::NotCharging
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChargeLimitCapability {
    pub status: CapabilityStatus,
    pub minimum: Option<u8>,
    pub maximum: Option<u8>,
    pub current_start: Option<u8>,
    pub current_end: Option<u8>,
    pub supports_start_threshold: bool,
    pub supports_end_threshold: bool,
    pub reason: String,
    pub next_step: Option<String>,
}

impl ChargeLimitCapability {
    pub fn unsupported(reason: impl Into<String>, next_step: Option<impl Into<String>>) -> Self {
        Self {
            status: CapabilityStatus::Unsupported,
            minimum: None,
            maximum: None,
            current_start: None,
            current_end: None,
            supports_start_threshold: false,
            supports_end_threshold: false,
            reason: reason.into(),
            next_step: next_step.map(Into::into),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCapabilities {
    pub platform: String,
    pub platform_version: Option<String>,
    pub architecture: String,
    pub battery: FeatureCapability,
    pub charge_limit: ChargeLimitCapability,
    pub power_profiles: FeatureCapability,
    pub notifications: FeatureCapability,
    pub tray: FeatureCapability,
    pub autostart: FeatureCapability,
    pub history: FeatureCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChargeLimitRequest {
    pub start: Option<u8>,
    pub end: u8,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChargeLimitApplyResult {
    pub start: Option<u8>,
    pub end: u8,
    pub verified: bool,
    pub applied_at: String,
    pub read_back_start: Option<u8>,
    pub read_back_end: u8,
    pub previous_start: Option<u8>,
    pub previous_end: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NotificationTestResult {
    pub delivered: bool,
    pub message: String,
}
