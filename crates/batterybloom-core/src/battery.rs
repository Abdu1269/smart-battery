use battery::units::{
    energy::watt_hour, power::watt, ratio::percent as percent_unit,
    thermodynamic_temperature::degree_celsius, time::second,
};
use battery::{Manager, State};
use chrono::Utc;
use log::warn;

use crate::error::BatteryError;
use crate::models::{
    BatterySnapshot, BatteryState, CapabilityStatus, FeatureCapability, PowerSource,
};
use crate::sysfs::SysfsPowerSupply;

pub trait BatteryProvider: Send + Sync {
    fn read(&self) -> Result<BatterySnapshot, BatteryError>;

    fn capability(&self) -> FeatureCapability {
        match self.read() {
            Ok(snapshot) if snapshot.is_available => FeatureCapability::new(
                CapabilityStatus::Supported,
                "Battery information is available from the operating system.",
                None::<String>,
            ),
            Ok(_) => FeatureCapability::new(
                CapabilityStatus::NotDetected,
                "No battery was detected. This device may be a desktop or the battery is not reporting itself.",
                Some("Battery monitoring and alerts are unavailable on this device."),
            ),
            Err(_) => FeatureCapability::new(
                CapabilityStatus::Error,
                "Battery information is temporarily unavailable.",
                Some("Try refreshing. If the problem continues, restart BatteryBloom."),
            ),
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct SystemBatteryProvider;

impl SystemBatteryProvider {
    pub fn new() -> Self {
        Self
    }
}

#[derive(Debug, Clone)]
struct RawBattery {
    percent: f32,
    energy_wh: f64,
    energy_full_wh: f64,
    energy_full_design_wh: f64,
    energy_rate_w: f64,
    state: State,
    time_to_empty_secs: Option<u64>,
    time_to_full_secs: Option<u64>,
    cycle_count: Option<u32>,
    temperature_celsius: Option<f32>,
}

impl BatteryProvider for SystemBatteryProvider {
    fn read(&self) -> Result<BatterySnapshot, BatteryError> {
        let manager = Manager::new().map_err(|error| {
            warn!("battery manager initialization failed: {error}");
            BatteryError::ReadFailed
        })?;
        let batteries = manager.batteries().map_err(|error| {
            warn!("battery enumeration failed: {error}");
            BatteryError::ReadFailed
        })?;

        let mut readings = Vec::new();
        for battery in batteries {
            match battery {
                Ok(battery) => {
                    let pct = battery.state_of_charge().get::<percent_unit>();
                    if !pct.is_finite() {
                        continue;
                    }
                    let time_to_empty = battery
                        .time_to_empty()
                        .map(|time| time.get::<second>().max(0.0) as u64)
                        .filter(|value| *value > 0);
                    let time_to_full = battery
                        .time_to_full()
                        .map(|time| time.get::<second>().max(0.0) as u64)
                        .filter(|value| *value > 0);
                    let temperature = battery
                        .temperature()
                        .map(|value| value.get::<degree_celsius>())
                        .filter(|value| value.is_finite() && *value > 0.0 && *value < 100.0);
                    let cycle_count = battery.cycle_count().filter(|value| *value > 0);
                    readings.push(RawBattery {
                        percent: pct,
                        energy_wh: battery.energy().get::<watt_hour>() as f64,
                        energy_full_wh: battery.energy_full().get::<watt_hour>() as f64,
                        energy_full_design_wh: battery.energy_full_design().get::<watt_hour>()
                            as f64,
                        energy_rate_w: battery.energy_rate().get::<watt>() as f64,
                        state: battery.state(),
                        time_to_empty_secs: time_to_empty,
                        time_to_full_secs: time_to_full,
                        cycle_count,
                        temperature_celsius: temperature,
                    });
                }
                Err(error) => warn!("a battery could not be read: {error}"),
            }
        }

        let ac_online = sysfs_ac_online();
        Ok(aggregate(readings, ac_online, Utc::now().to_rfc3339()))
    }
}

#[cfg(target_os = "linux")]
fn sysfs_ac_online() -> Option<bool> {
    SysfsPowerSupply::default().ac_online()
}

#[cfg(not(target_os = "linux"))]
fn sysfs_ac_online() -> Option<bool> {
    None
}

fn aggregate(
    readings: Vec<RawBattery>,
    ac_online: Option<bool>,
    observed_at: String,
) -> BatterySnapshot {
    if readings.is_empty() {
        let source = ac_online.map(|online| {
            if online {
                PowerSource::Ac
            } else {
                PowerSource::Battery
            }
        });
        return BatterySnapshot::unavailable(source, observed_at);
    }

    let count = readings.len() as u32;
    let total_energy: f64 = readings.iter().map(|item| item.energy_wh.max(0.0)).sum();
    let total_full: f64 = readings
        .iter()
        .map(|item| item.energy_full_wh.max(0.0))
        .sum();
    let percent = if total_full > 0.0 {
        ((total_energy / total_full) * 100.0).clamp(0.0, 100.0)
    } else {
        let average =
            readings.iter().map(|item| item.percent as f64).sum::<f64>() / readings.len() as f64;
        average.clamp(0.0, 100.0)
    };

    let state = combine_state(readings.iter().map(|item| item.state));
    let power_source = if let Some(online) = ac_online {
        Some(if online {
            PowerSource::Ac
        } else {
            PowerSource::Battery
        })
    } else {
        infer_power_source(state)
    };

    let (time_remaining_secs, time_to_full_secs) = if count == 1 {
        (
            readings[0].time_to_empty_secs,
            readings[0].time_to_full_secs,
        )
    } else {
        (None, None)
    };

    let design = readings
        .iter()
        .map(|item| item.energy_full_design_wh)
        .sum::<f64>();
    let full = readings.iter().map(|item| item.energy_full_wh).sum::<f64>();
    let power = readings
        .iter()
        .map(|item| item.energy_rate_w.max(0.0))
        .sum::<f64>();
    let cycle_count = readings.iter().filter_map(|item| item.cycle_count).max();
    let temperature = readings
        .iter()
        .filter_map(|item| item.temperature_celsius)
        .reduce(f32::max);

    BatterySnapshot {
        percent: Some(percent.round().clamp(0.0, 100.0) as u8),
        state,
        power_source,
        time_remaining_secs,
        time_to_full_secs,
        design_capacity_mwh: (design > 0.0).then_some((design * 1000.0).round() as u64),
        full_charge_capacity_mwh: (full > 0.0).then_some((full * 1000.0).round() as u64),
        current_capacity_mwh: (total_energy > 0.0)
            .then_some((total_energy * 1000.0).round() as u64),
        power_draw_mw: (power > 0.0).then_some((power * 1000.0).round() as u64),
        cycle_count,
        temperature_celsius: temperature,
        battery_count: count,
        is_available: true,
        observed_at,
    }
}

fn combine_state(states: impl Iterator<Item = State>) -> BatteryState {
    let states: Vec<State> = states.collect();
    if states.contains(&State::Charging) {
        BatteryState::Charging
    } else if states.contains(&State::Discharging) {
        BatteryState::Discharging
    } else if states.iter().all(|state| *state == State::Full) {
        BatteryState::Full
    } else if states
        .iter()
        .all(|state| matches!(state, State::Paused | State::Full))
    {
        BatteryState::NotCharging
    } else if states.contains(&State::Empty) {
        BatteryState::Discharging
    } else {
        BatteryState::Unknown
    }
}

fn infer_power_source(state: BatteryState) -> Option<PowerSource> {
    match state {
        BatteryState::Charging | BatteryState::Full | BatteryState::NotCharging => {
            Some(PowerSource::Ac)
        }
        BatteryState::Discharging => Some(PowerSource::Battery),
        BatteryState::Unknown => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reading(pct: f32, energy: f64, full: f64, state: State) -> RawBattery {
        RawBattery {
            percent: pct,
            energy_wh: energy,
            energy_full_wh: full,
            energy_full_design_wh: 90.0,
            energy_rate_w: 10.0,
            state,
            time_to_empty_secs: Some(3600),
            time_to_full_secs: None,
            cycle_count: Some(120),
            temperature_celsius: Some(31.0),
        }
    }

    #[test]
    fn no_batteries_is_an_explicit_unavailable_snapshot() {
        let snapshot = aggregate(Vec::new(), Some(false), "now".into());
        assert!(!snapshot.is_available);
        assert_eq!(snapshot.battery_count, 0);
        assert_eq!(snapshot.percent, None);
        assert_eq!(snapshot.power_source, Some(PowerSource::Battery));
    }

    #[test]
    fn aggregates_multiple_batteries_weighted_by_capacity() {
        let snapshot = aggregate(
            vec![
                reading(50.0, 30.0, 50.0, State::Discharging),
                reading(100.0, 25.0, 25.0, State::Full),
            ],
            Some(false),
            "now".into(),
        );
        assert_eq!(snapshot.percent, Some(73));
        assert_eq!(snapshot.battery_count, 2);
        assert_eq!(snapshot.time_remaining_secs, None);
        assert_eq!(snapshot.power_source, Some(PowerSource::Battery));
        assert_eq!(snapshot.state, BatteryState::Discharging);
    }

    #[test]
    fn marks_full_battery_state() {
        let snapshot = aggregate(
            vec![reading(100.0, 50.0, 50.0, State::Full)],
            Some(true),
            "now".into(),
        );
        assert_eq!(snapshot.state, BatteryState::Full);
        assert_eq!(snapshot.power_source, Some(PowerSource::Ac));
    }
}
