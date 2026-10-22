use batterybloom_core::battery::BatteryProvider;
use batterybloom_core::charge_control::ChargeLimitProvider;
use batterybloom_core::models::{CapabilityStatus, FeatureCapability, PlatformCapabilities};

use crate::state::AppState;

pub fn platform_capabilities(state: &AppState) -> PlatformCapabilities {
    let charge = state.charge_provider.capability();
    let battery = state.battery_provider.capability();
    let power = batterybloom_core::power::read_power_settings();
    PlatformCapabilities {
        platform: std::env::consts::OS.into(),
        platform_version: platform_version(),
        architecture: std::env::consts::ARCH.into(),
        battery,
        charge_limit: charge,
        power_profiles: power.profile,
        notifications: FeatureCapability::new(
            CapabilityStatus::Supported,
            "Native notifications are provided by the operating system. Notification permissions are controlled by your system.",
            Some("Use the test notification after granting permission."),
        ),
        tray: FeatureCapability::supported(
            "BatteryBloom can keep a tray icon while the window is closed.",
        ),
        autostart: FeatureCapability::supported(
            "BatteryBloom can launch with your desktop session on supported systems.",
        ),
        history: FeatureCapability::supported(
            "Battery history is stored only on this computer and can be cleared at any time.",
        ),
    }
}

pub(crate) fn platform_version() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        let content = std::fs::read_to_string("/etc/os-release").ok()?;
        content.lines().find_map(|line| {
            line.strip_prefix("PRETTY_NAME=")
                .map(|value| value.trim_matches('"').to_string())
                .filter(|value| !value.is_empty())
        })
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}
