use serde::{Deserialize, Serialize};

use crate::models::{BatterySnapshot, CapabilityStatus, ChargeLimitCapability};
use crate::settings::AppSettings;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecommendationImpact {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecommendationEffort {
    Easy,
    Moderate,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RecommendationAction {
    OpenPowerSettings,
    OpenDisplaySettings,
    OpenCharging,
    OpenHelp,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub why: String,
    pub impact: RecommendationImpact,
    pub effort: RecommendationEffort,
    pub action: Option<RecommendationAction>,
    pub action_label: Option<String>,
}

#[allow(clippy::too_many_arguments)] // A flat catalog constructor keeps every recommendation field visible at the call site.
fn item(
    id: &str,
    title: &str,
    summary: &str,
    why: &str,
    impact: RecommendationImpact,
    effort: RecommendationEffort,
    action: Option<RecommendationAction>,
    action_label: Option<&str>,
) -> Recommendation {
    Recommendation {
        id: id.into(),
        title: title.into(),
        summary: summary.into(),
        why: why.into(),
        impact,
        effort,
        action,
        action_label: action_label.map(Into::into),
    }
}

pub fn recommendations(
    snapshot: &BatterySnapshot,
    charge: &ChargeLimitCapability,
    power_profiles_supported: bool,
    settings: &AppSettings,
) -> Vec<Recommendation> {
    let mut items = Vec::new();

    if power_profiles_supported {
        items.push(item(
            "power-profile",
            "Match the power profile to the moment",
            "Use Balanced for everyday work and Power Saver when you need to stretch a charge.",
            "Lower processor power limits can reduce energy use, but they may also make demanding apps slower.",
            RecommendationImpact::Medium,
            RecommendationEffort::Easy,
            Some(RecommendationAction::OpenPowerSettings),
            Some("Review power profiles"),
        ));
    }

    items.push(item(
        "brightness",
        "Turn the screen down a notch",
        "Lower the display brightness to the lowest comfortable level.",
        "Displays are often the largest single power consumer on a laptop.",
        RecommendationImpact::Medium,
        RecommendationEffort::Easy,
        Some(RecommendationAction::OpenDisplaySettings),
        Some("Open display settings"),
    ));

    items.push(item(
        "sleep-timeout",
        "Shorten idle shutdown and sleep timers",
        "Let the display turn off and the computer sleep sooner while you are away.",
        "An idle screen and awake processor can use meaningful energy even when you are not working.",
        RecommendationImpact::High,
        RecommendationEffort::Easy,
        Some(RecommendationAction::OpenDisplaySettings),
        Some("Adjust timeouts"),
    ));

    items.push(item(
        "background",
        "Review background apps and startup items",
        "Close apps you are not using and remove unnecessary startup programs.",
        "Background indexing, sync, and update checks can keep the processor awake without visible benefit.",
        RecommendationImpact::Medium,
        RecommendationEffort::Moderate,
        Some(RecommendationAction::OpenPowerSettings),
        Some("Open system settings"),
    ));

    items.push(item(
        "peripherals",
        "Disconnect unused accessories",
        "Unplug USB drives, docks, and other accessories when they are not needed.",
        "Bus-powered devices draw from the same battery, and some keep the laptop from sleeping deeply.",
        RecommendationImpact::Low,
        RecommendationEffort::Easy,
        None,
        None,
    ));

    items.push(item(
        "heat",
        "Keep the vents clear and avoid heat",
        "Use the laptop on a hard surface and keep vents unobstructed.",
        "Heat is one of the strongest environmental contributors to battery ageing. This is about long-term care, not immediate runtime.",
        RecommendationImpact::Medium,
        RecommendationEffort::Easy,
        None,
        None,
    ));

    items.push(item(
        "updates",
        "Use trusted OS and firmware updates",
        "Install updates from your operating system or device manufacturer when convenient.",
        "Power-management fixes and firmware improvements are delivered through official updates.",
        RecommendationImpact::Low,
        RecommendationEffort::Moderate,
        Some(RecommendationAction::OpenHelp),
        Some("Read update guidance"),
    ));

    match charge.status {
        CapabilityStatus::Supported => {
            items.push(item(
                "charge-limit",
                "Use a charge limit that fits your routine",
                "A hardware charge limit can avoid spending long periods at a very full battery.",
                "This device exposes a verified charge-threshold interface. A limit is a longevity preference, not a universal recommendation.",
                RecommendationImpact::Medium,
                RecommendationEffort::Easy,
                Some(RecommendationAction::OpenCharging),
                Some("Open charging settings"),
            ));
        }
        CapabilityStatus::PermissionRequired | CapabilityStatus::ReadOnly => {
            items.push(item(
                "charge-reminder",
                "Use a high-charge reminder instead of a hardware limit",
                "BatteryBloom can notify you at your chosen charging goal; it cannot change this device's thresholds without permission.",
                "A reminder helps you act at the right time without pretending that software has stopped charging.",
                RecommendationImpact::Medium,
                RecommendationEffort::Easy,
                Some(RecommendationAction::OpenCharging),
                Some("Set a reminder"),
            ));
        }
        _ => {
            items.push(item(
                "charge-reminder",
                "Set a high-charge reminder",
                "Choose a charging goal such as 80% and let BatteryBloom remind you to unplug.",
                "A percentage alert is useful even when the hardware does not expose a charge limit. It does not stop charging by itself.",
                RecommendationImpact::Medium,
                RecommendationEffort::Easy,
                Some(RecommendationAction::OpenCharging),
                Some("Set a reminder"),
            ));
        }
    }

    if snapshot
        .percent
        .is_some_and(|percent| percent >= settings.high_threshold)
        && snapshot.power_source == Some(crate::models::PowerSource::Ac)
    {
        items.push(item(
            "above-goal",
            "You are above your charging goal",
            &format!(
                "The battery is at {}%. If it suits your routine, unplug when convenient.",
                snapshot.percent.unwrap_or(settings.high_threshold)
            ),
            "Reducing time spent at a high state of charge is a common longevity preference, but battery wear is also influenced by heat, age, and usage.",
            RecommendationImpact::Medium,
            RecommendationEffort::Easy,
            Some(RecommendationAction::OpenCharging),
            Some("Review charging goal"),
        ));
    }

    items.push(item(
        "full-charges",
        "You do not need to drain the battery regularly",
        "Use the device normally and avoid routine deep discharges.",
        "Modern lithium batteries do not benefit from being emptied often. Occasional calibration should only follow the device manufacturer's instructions.",
        RecommendationImpact::Low,
        RecommendationEffort::Easy,
        Some(RecommendationAction::OpenHelp),
        Some("Learn more"),
    ));

    items
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{BatterySnapshot, BatteryState, CapabilityStatus, ChargeLimitCapability};

    fn snapshot(percent: u8, source: crate::models::PowerSource) -> BatterySnapshot {
        BatterySnapshot {
            percent: Some(percent),
            state: BatteryState::Charging,
            power_source: Some(source),
            time_remaining_secs: None,
            time_to_full_secs: None,
            design_capacity_mwh: None,
            full_charge_capacity_mwh: None,
            current_capacity_mwh: None,
            power_draw_mw: None,
            cycle_count: None,
            temperature_celsius: None,
            battery_count: 1,
            is_available: true,
            observed_at: "now".into(),
        }
    }

    fn charge(status: CapabilityStatus) -> ChargeLimitCapability {
        ChargeLimitCapability {
            status,
            minimum: Some(5),
            maximum: Some(100),
            current_start: None,
            current_end: None,
            supports_start_threshold: false,
            supports_end_threshold: false,
            reason: String::new(),
            next_step: None,
        }
    }

    #[test]
    fn permission_required_never_suggests_a_fake_limit() {
        let items = recommendations(
            &snapshot(75, crate::models::PowerSource::Battery),
            &charge(CapabilityStatus::PermissionRequired),
            false,
            &AppSettings::default(),
        );
        let reminder = items
            .iter()
            .find(|item| item.id == "charge-reminder")
            .unwrap();
        assert!(reminder.summary.contains("cannot change"));
        assert!(!items.iter().any(|item| item.id == "charge-limit"));
    }

    #[test]
    fn supported_limit_is_offered_only_when_supported() {
        let items = recommendations(
            &snapshot(75, crate::models::PowerSource::Battery),
            &charge(CapabilityStatus::Supported),
            true,
            &AppSettings::default(),
        );
        assert!(items.iter().any(|item| item.id == "charge-limit"));
        assert!(items.iter().any(|item| item.id == "power-profile"));
    }

    #[test]
    fn above_goal_advice_appears_only_on_ac_and_above_threshold() {
        let items = recommendations(
            &snapshot(85, crate::models::PowerSource::Ac),
            &charge(CapabilityStatus::Unsupported),
            false,
            &AppSettings::default(),
        );
        assert!(items.iter().any(|item| item.id == "above-goal"));
        let below = recommendations(
            &snapshot(40, crate::models::PowerSource::Battery),
            &charge(CapabilityStatus::Unsupported),
            false,
            &AppSettings::default(),
        );
        assert!(!below.iter().any(|item| item.id == "above-goal"));
    }

    #[test]
    fn advice_does_not_promise_exact_runtime() {
        let items = recommendations(
            &snapshot(50, crate::models::PowerSource::Battery),
            &charge(CapabilityStatus::Unsupported),
            true,
            &AppSettings::default(),
        );
        for item in items {
            let text = format!("{} {} {}", item.summary, item.why, item.title);
            assert!(!text.contains("extra hours"));
            assert!(!text.contains("percentage gain"));
        }
    }
}
