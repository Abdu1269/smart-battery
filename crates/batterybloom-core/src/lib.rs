//! Core battery, alert, settings, and history logic for BatteryBloom.
//!
//! This crate intentionally has no Tauri dependency so that deterministic
//! tests can run without a desktop webview toolchain.

pub mod alerts;
pub mod battery;
pub mod charge_control;
pub mod error;
pub mod history;
pub mod models;
pub mod power;
pub mod recommendations;
pub mod settings;
pub mod sysfs;

pub use alerts::{AlertEngine, AlertKind, AlertSignal};
pub use battery::{BatteryProvider, SystemBatteryProvider};
pub use charge_control::{ChargeLimitProvider, LinuxChargeLimitProvider};
pub use history::{HistoryRecord, HistoryStore};
pub use models::*;
pub use settings::{AppSettings, SettingsStore};
