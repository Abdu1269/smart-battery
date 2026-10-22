use std::collections::BTreeMap;

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::models::{BatterySnapshot, PowerSource};
use crate::settings::{AlertPowerScope, AppSettings, StartupAlertPolicy};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AlertKind {
    Low,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertChannels {
    pub notification: bool,
    pub sound: bool,
    pub visual: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertSignal {
    pub kind: AlertKind,
    pub percent: u8,
    pub threshold: u8,
    pub title: String,
    pub message: String,
    pub triggered_at: String,
    pub silent: bool,
    pub channels: AlertChannels,
}

/// A deterministic alert state machine. It deliberately owns crossing,
/// re-arming, cooldown, and startup decisions so the frontend never invents
/// alert state from its own timers.
#[derive(Debug, Clone, Default)]
pub struct AlertEngine {
    initialized: bool,
    suppress_startup: bool,
    last_percent: Option<u8>,
    high_armed: bool,
    low_armed: bool,
    last_battery_count: u32,
    last_fired: BTreeMap<AlertKind, DateTime<Utc>>,
}

impl AlertEngine {
    pub fn new() -> Self {
        Self {
            high_armed: true,
            low_armed: true,
            ..Self::default()
        }
    }

    /// Used on process startup: the configured startup policy applies.
    pub fn reset_for_startup(&mut self) {
        self.initialized = false;
        self.suppress_startup = false;
        self.last_percent = None;
        self.high_armed = true;
        self.low_armed = true;
        self.last_battery_count = 0;
        self.last_fired.clear();
    }

    /// Used after settings change so a freshly saved threshold does not fire
    /// immediately. The next reading becomes a baseline; a crossing is required.
    pub fn reset_for_settings_change(&mut self) {
        self.reset_for_startup();
        self.suppress_startup = true;
    }

    /// Called after a detected suspend/resume gap. The next reading is treated
    /// as a fresh observation, using the configured startup policy.
    pub fn on_resume(&mut self) {
        self.reset_for_startup();
    }

    pub fn observe(
        &mut self,
        snapshot: &BatterySnapshot,
        settings: &AppSettings,
        quiet_now: bool,
        now: DateTime<Utc>,
    ) -> Vec<AlertSignal> {
        if !snapshot.is_available || snapshot.percent.is_none() {
            self.last_percent = None;
            return Vec::new();
        }
        let Some(percent) = snapshot.percent else {
            self.last_percent = None;
            return Vec::new();
        };

        if self.last_battery_count != 0 && snapshot.battery_count != self.last_battery_count {
            // A battery was removed or replaced. Treat the new reading as a
            // baseline instead of inventing a crossing from the old charge.
            self.on_resume();
        }
        self.last_battery_count = snapshot.battery_count;

        if !self.initialized {
            self.initialize(percent, snapshot, settings, quiet_now, now)
        } else if self.last_percent.is_none() {
            // Data was briefly unavailable. Resume from a baseline without
            // triggering an alert for a value that was already there.
            self.set_baseline_arms(percent, settings);
            self.last_percent = Some(percent);
            Vec::new()
        } else {
            self.evaluate(percent, snapshot, settings, quiet_now, now)
        }
    }

    fn initialize(
        &mut self,
        percent: u8,
        snapshot: &BatterySnapshot,
        settings: &AppSettings,
        quiet_now: bool,
        now: DateTime<Utc>,
    ) -> Vec<AlertSignal> {
        self.initialized = true;
        self.last_percent = Some(percent);
        self.set_baseline_arms(percent, settings);

        let suppress = self.suppress_startup;
        self.suppress_startup = false;

        if suppress || settings.alert_on_start == StartupAlertPolicy::CrossingOnly {
            return Vec::new();
        }

        let mut signals = Vec::new();
        if settings.high_enabled
            && percent >= settings.high_threshold
            && self.source_allowed(snapshot.power_source, settings.alert_power_scope)
        {
            self.high_armed = false;
            if let Some(signal) =
                self.trigger(AlertKind::High, percent, snapshot, settings, quiet_now, now)
            {
                signals.push(signal);
            }
        } else if settings.low_enabled
            && percent <= settings.low_threshold
            && self.source_allowed(snapshot.power_source, settings.alert_power_scope)
        {
            self.low_armed = false;
            if let Some(signal) =
                self.trigger(AlertKind::Low, percent, snapshot, settings, quiet_now, now)
            {
                signals.push(signal);
            }
        }
        signals
    }

    fn evaluate(
        &mut self,
        percent: u8,
        snapshot: &BatterySnapshot,
        settings: &AppSettings,
        quiet_now: bool,
        now: DateTime<Utc>,
    ) -> Vec<AlertSignal> {
        let previous = self.last_percent.unwrap_or(percent);
        self.rearm(percent, settings);

        let mut signals = Vec::new();

        let high_crossed = self.high_armed
            && previous < settings.high_threshold
            && percent >= settings.high_threshold;
        if high_crossed {
            self.high_armed = false;
            if settings.high_enabled
                && self.source_allowed(snapshot.power_source, settings.alert_power_scope)
            {
                if let Some(signal) =
                    self.trigger(AlertKind::High, percent, snapshot, settings, quiet_now, now)
                {
                    signals.push(signal);
                }
            }
        }

        let low_crossed = self.low_armed
            && previous > settings.low_threshold
            && percent <= settings.low_threshold;
        if low_crossed {
            self.low_armed = false;
            if settings.low_enabled
                && self.source_allowed(snapshot.power_source, settings.alert_power_scope)
            {
                if let Some(signal) =
                    self.trigger(AlertKind::Low, percent, snapshot, settings, quiet_now, now)
                {
                    signals.push(signal);
                }
            }
        }

        self.last_percent = Some(percent);
        signals
    }

    fn rearm(&mut self, percent: u8, settings: &AppSettings) {
        if percent
            <= settings
                .high_threshold
                .saturating_sub(settings.hysteresis_percent)
        {
            self.high_armed = true;
        }
        if percent
            >= settings
                .low_threshold
                .saturating_add(settings.hysteresis_percent)
        {
            self.low_armed = true;
        }
    }

    fn set_baseline_arms(&mut self, percent: u8, settings: &AppSettings) {
        self.high_armed = percent < settings.high_threshold;
        self.low_armed = percent > settings.low_threshold;
    }

    fn source_allowed(&self, source: Option<PowerSource>, scope: AlertPowerScope) -> bool {
        match (source, scope) {
            (Some(PowerSource::Ac), AlertPowerScope::Battery) => false,
            (Some(PowerSource::Battery), AlertPowerScope::Ac) => false,
            (Some(PowerSource::Unknown), _) | (None, _) => true,
            _ => true,
        }
    }

    fn trigger(
        &mut self,
        kind: AlertKind,
        percent: u8,
        _snapshot: &BatterySnapshot,
        settings: &AppSettings,
        quiet_now: bool,
        now: DateTime<Utc>,
    ) -> Option<AlertSignal> {
        if let Some(last) = self.last_fired.get(&kind) {
            let cooldown = Duration::minutes(i64::from(settings.cooldown_minutes));
            if now - *last < cooldown {
                return None;
            }
        }
        self.last_fired.insert(kind, now);

        let threshold = match kind {
            AlertKind::High => settings.high_threshold,
            AlertKind::Low => settings.low_threshold,
        };
        let (title, message) = match kind {
            AlertKind::High => (
                "Charging goal reached",
                format!(
                    "Battery reached {threshold}%. Unplug if you want to follow your charging goal."
                ),
            ),
            AlertKind::Low => (
                "Battery getting low",
                format!("Battery is at {percent}%. Consider connecting power."),
            ),
        };

        let silent = quiet_now;
        Some(AlertSignal {
            kind,
            percent,
            threshold,
            title: title.into(),
            message,
            triggered_at: now.to_rfc3339(),
            silent,
            channels: AlertChannels {
                notification: settings.notification_enabled && !silent,
                sound: settings.sound_enabled && !silent && settings.sound_volume > 0,
                visual: settings.visual_alert_enabled,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{BatterySnapshot, BatteryState};
    use chrono::TimeZone;

    fn snapshot(percent: u8, source: PowerSource) -> BatterySnapshot {
        BatterySnapshot {
            percent: Some(percent),
            state: match source {
                PowerSource::Ac => BatteryState::Charging,
                PowerSource::Battery => BatteryState::Discharging,
                PowerSource::Unknown => BatteryState::Unknown,
            },
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
            observed_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    fn at(minute: i64) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap() + Duration::minutes(minute)
    }

    fn observe(
        engine: &mut AlertEngine,
        percent: u8,
        source: PowerSource,
        minute: i64,
    ) -> Vec<AlertSignal> {
        engine.observe(
            &snapshot(percent, source),
            &AppSettings::default(),
            false,
            at(minute),
        )
    }

    #[test]
    fn high_alert_fires_only_on_crossing() {
        let mut engine = AlertEngine::new();
        assert!(observe(&mut engine, 79, PowerSource::Ac, 0).is_empty());
        let first = observe(&mut engine, 80, PowerSource::Ac, 1);
        assert_eq!(first.len(), 1);
        assert_eq!(first[0].kind, AlertKind::High);
        assert!(observe(&mut engine, 81, PowerSource::Ac, 2).is_empty());
        assert!(observe(&mut engine, 85, PowerSource::Ac, 3).is_empty());
    }

    #[test]
    fn high_alert_rearms_after_hysteresis() {
        let settings = AppSettings {
            cooldown_minutes: 0,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        engine.observe(&snapshot(80, PowerSource::Ac), &settings, false, at(0));
        assert!(engine
            .observe(&snapshot(77, PowerSource::Ac), &settings, false, at(1))
            .is_empty());
        let second = engine.observe(&snapshot(80, PowerSource::Ac), &settings, false, at(2));
        assert_eq!(second.len(), 1);
    }

    #[test]
    fn cooldown_suppresses_a_rearmed_alert() {
        let settings = AppSettings {
            cooldown_minutes: 30,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        engine.observe(&snapshot(79, PowerSource::Ac), &settings, false, at(0));
        assert_eq!(
            engine
                .observe(&snapshot(80, PowerSource::Ac), &settings, false, at(1))
                .len(),
            1
        );
        engine.observe(&snapshot(77, PowerSource::Ac), &settings, false, at(2));
        assert!(engine
            .observe(&snapshot(80, PowerSource::Ac), &settings, false, at(3))
            .is_empty());
        engine.observe(&snapshot(77, PowerSource::Ac), &settings, false, at(31));
        assert_eq!(
            engine
                .observe(&snapshot(80, PowerSource::Ac), &settings, false, at(32))
                .len(),
            1
        );
    }

    #[test]
    fn low_alert_fires_at_boundary_and_rearms() {
        let settings = AppSettings {
            cooldown_minutes: 0,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        assert!(engine
            .observe(&snapshot(21, PowerSource::Battery), &settings, false, at(0))
            .is_empty());
        assert_eq!(
            engine
                .observe(&snapshot(20, PowerSource::Battery), &settings, false, at(1))
                .len(),
            1
        );
        assert!(engine
            .observe(&snapshot(22, PowerSource::Battery), &settings, false, at(2))
            .is_empty());
        assert!(engine
            .observe(&snapshot(20, PowerSource::Battery), &settings, false, at(3))
            .is_empty());
        assert_eq!(
            engine
                .observe(&snapshot(23, PowerSource::Battery), &settings, false, at(4))
                .len(),
            0
        );
        assert_eq!(
            engine
                .observe(&snapshot(20, PowerSource::Battery), &settings, false, at(5))
                .len(),
            1
        );
    }

    #[test]
    fn crossing_only_does_not_alert_at_startup() {
        let mut engine = AlertEngine::new();
        assert!(engine
            .observe(
                &snapshot(90, PowerSource::Ac),
                &AppSettings::default(),
                false,
                at(0)
            )
            .is_empty());
        assert!(engine
            .observe(
                &snapshot(76, PowerSource::Ac),
                &AppSettings::default(),
                false,
                at(1)
            )
            .is_empty());
        assert_eq!(
            engine
                .observe(
                    &snapshot(80, PowerSource::Ac),
                    &AppSettings::default(),
                    false,
                    at(2)
                )
                .len(),
            1
        );
    }

    #[test]
    fn immediate_startup_policy_alerts_when_already_above_goal() {
        let settings = AppSettings {
            alert_on_start: StartupAlertPolicy::Immediate,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        let signals = engine.observe(&snapshot(90, PowerSource::Ac), &settings, false, at(0));
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].kind, AlertKind::High);
    }

    #[test]
    fn missing_reading_does_not_spam_when_data_returns() {
        let mut engine = AlertEngine::new();
        observe(&mut engine, 81, PowerSource::Ac, 0);
        let mut unavailable = snapshot(81, PowerSource::Ac);
        unavailable.percent = None;
        assert!(engine
            .observe(&unavailable, &AppSettings::default(), false, at(1))
            .is_empty());
        assert!(observe(&mut engine, 82, PowerSource::Ac, 2).is_empty());
    }

    #[test]
    fn abrupt_jump_across_threshold_triggers_once() {
        let mut engine = AlertEngine::new();
        observe(&mut engine, 20, PowerSource::Battery, 0);
        let signals = observe(&mut engine, 91, PowerSource::Ac, 1);
        assert_eq!(signals.len(), 1);
        assert_eq!(signals[0].kind, AlertKind::High);
        assert!(observe(&mut engine, 95, PowerSource::Ac, 2).is_empty());
    }

    #[test]
    fn resume_uses_startup_policy() {
        let mut engine = AlertEngine::new();
        observe(&mut engine, 10, PowerSource::Battery, 0);
        engine.on_resume();
        assert!(engine
            .observe(
                &snapshot(12, PowerSource::Battery),
                &AppSettings::default(),
                false,
                at(1)
            )
            .is_empty());
        assert!(engine
            .observe(
                &snapshot(23, PowerSource::Battery),
                &AppSettings::default(),
                false,
                at(2)
            )
            .is_empty());
        assert_eq!(
            engine
                .observe(
                    &snapshot(20, PowerSource::Battery),
                    &AppSettings::default(),
                    false,
                    at(3)
                )
                .len(),
            1
        );
    }

    #[test]
    fn power_scope_suppresses_alert() {
        let settings = AppSettings {
            alert_power_scope: AlertPowerScope::Battery,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        engine.observe(&snapshot(79, PowerSource::Ac), &settings, false, at(0));
        assert!(engine
            .observe(&snapshot(80, PowerSource::Ac), &settings, false, at(1))
            .is_empty());
    }

    #[test]
    fn quiet_hours_leave_visual_channel_available() {
        let mut engine = AlertEngine::new();
        engine.observe(
            &snapshot(79, PowerSource::Ac),
            &AppSettings::default(),
            true,
            at(0),
        );
        let signals = engine.observe(
            &snapshot(80, PowerSource::Ac),
            &AppSettings::default(),
            true,
            at(1),
        );
        assert_eq!(signals.len(), 1);
        assert!(signals[0].silent);
        assert!(!signals[0].channels.notification);
        assert!(!signals[0].channels.sound);
        assert!(signals[0].channels.visual);
    }

    #[test]
    fn settings_change_does_not_fire_immediately() {
        let mut engine = AlertEngine::new();
        engine.reset_for_settings_change();
        assert!(engine
            .observe(
                &snapshot(95, PowerSource::Ac),
                &AppSettings::default(),
                false,
                at(0)
            )
            .is_empty());
    }

    #[test]
    fn disabled_high_alert_is_not_emitted() {
        let settings = AppSettings {
            high_enabled: false,
            ..AppSettings::default()
        };
        let mut engine = AlertEngine::new();
        engine.observe(&snapshot(79, PowerSource::Ac), &settings, false, at(0));
        assert!(engine
            .observe(&snapshot(80, PowerSource::Ac), &settings, false, at(1))
            .is_empty());
    }

    #[test]
    fn battery_count_change_resets_crossing_baseline() {
        let mut engine = AlertEngine::new();
        observe(&mut engine, 79, PowerSource::Ac, 0);
        let mut changed = snapshot(85, PowerSource::Ac);
        changed.battery_count = 2;
        assert!(engine
            .observe(&changed, &AppSettings::default(), false, at(1))
            .is_empty());
    }
}
