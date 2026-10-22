use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use batterybloom_core::alerts::AlertEngine;
use batterybloom_core::battery::SystemBatteryProvider;
use batterybloom_core::charge_control::PlatformChargeLimitProvider;
use batterybloom_core::history::HistoryStore;
use batterybloom_core::models::BatterySnapshot;
use batterybloom_core::settings::{AppSettings, SettingsStore};

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub settings_store: SettingsStore,
    pub history_store: HistoryStore,
    pub engine: Mutex<AlertEngine>,
    pub snapshot: Mutex<Option<BatterySnapshot>>,
    pub last_error: Mutex<Option<String>>,
    pub settings_warning: Mutex<Option<String>>,
    pub battery_provider: SystemBatteryProvider,
    pub charge_provider: PlatformChargeLimitProvider,
    pub exiting: AtomicBool,
    pub tray_flashing: AtomicBool,
}

impl AppState {
    pub fn new(
        settings_store: SettingsStore,
        history_store: HistoryStore,
        settings: AppSettings,
        settings_warning: Option<String>,
        snapshot: Option<BatterySnapshot>,
    ) -> Self {
        Self {
            settings: Mutex::new(settings),
            settings_store,
            history_store,
            engine: Mutex::new(AlertEngine::new()),
            snapshot: Mutex::new(snapshot),
            last_error: Mutex::new(None),
            settings_warning: Mutex::new(settings_warning),
            battery_provider: SystemBatteryProvider::new(),
            charge_provider: PlatformChargeLimitProvider::default(),
            exiting: AtomicBool::new(false),
            tray_flashing: AtomicBool::new(false),
        }
    }

    pub fn settings_snapshot(&self) -> AppSettings {
        self.settings
            .lock()
            .map(|settings| settings.clone())
            .unwrap_or_default()
    }

    pub fn set_last_error(&self, message: Option<String>) {
        if let Ok(mut error) = self.last_error.lock() {
            *error = message;
        }
    }

    pub fn last_error_snapshot(&self) -> Option<String> {
        self.last_error.lock().ok().and_then(|error| error.clone())
    }

    pub fn settings_warning_snapshot(&self) -> Option<String> {
        self.settings_warning
            .lock()
            .ok()
            .and_then(|warning| warning.clone())
    }
}
