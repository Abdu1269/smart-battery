use std::time::{Duration, Instant};

use batterybloom_core::battery::BatteryProvider;
use batterybloom_core::history::{should_record, HistoryRecord};
use chrono::Utc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::state::AppState;
use crate::tray;

pub fn start_monitor(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_tick = Instant::now();
        let mut last_history = app
            .state::<AppState>()
            .history_store
            .load()
            .ok()
            .and_then(|records| records.last().cloned());

        loop {
            let settings = app.state::<AppState>().settings_snapshot();
            let interval = Duration::from_secs(u64::from(settings.poll_interval_secs.max(15)));

            if last_tick.elapsed() > interval * 3 {
                if let Ok(mut engine) = app.state::<AppState>().engine.lock() {
                    engine.on_resume();
                }
            }
            last_tick = Instant::now();

            let result = app.state::<AppState>().battery_provider.read();
            let now = Utc::now();

            match result {
                Ok(snapshot) => {
                    let state = app.state::<AppState>();
                    state.set_last_error(None);
                    if let Ok(mut current) = state.snapshot.lock() {
                        *current = Some(snapshot.clone());
                    }
                    tray::refresh_tray(&app, Some(&snapshot));
                    let _ = app.emit("battery://snapshot", &snapshot);

                    let quiet = settings.is_quiet_now();
                    let signals = state
                        .engine
                        .lock()
                        .map(|mut engine| engine.observe(&snapshot, &settings, quiet, now))
                        .unwrap_or_default();

                    if let Some(record) = HistoryRecord::from_snapshot(&snapshot) {
                        if should_record(
                            last_history.as_ref(),
                            &record,
                            settings.history_sampling_minutes,
                        ) {
                            match state
                                .history_store
                                .append(&record, settings.history_retention_days)
                            {
                                Ok(()) => {
                                    last_history = Some(record);
                                    let _ = app.emit("history://changed", ());
                                }
                                Err(error) => log::warn!("history append failed: {error}"),
                            }
                        }
                    }

                    let window_focused = app
                        .get_webview_window("main")
                        .and_then(|window| window.is_focused().ok())
                        .unwrap_or(false);

                    for signal in signals {
                        if signal.channels.notification && !window_focused {
                            if let Err(error) = app
                                .notification()
                                .builder()
                                .title(&signal.title)
                                .body(&signal.message)
                                .show()
                            {
                                log::warn!("native notification failed: {error}");
                                let _ = app.emit(
                                    "notification://error",
                                    "The system did not deliver the notification. Check notification permissions in your system settings.",
                                );
                            }
                        }
                        if signal.channels.visual {
                            tray::flash_alert(app.clone());
                        }
                        let _ = app.emit("alert://triggered", &signal);
                    }
                }
                Err(error) => {
                    log::warn!("battery read failed: {error}");
                    let state = app.state::<AppState>();
                    state.set_last_error(Some(
                        "Battery information is temporarily unavailable. BatteryBloom will retry."
                            .into(),
                    ));
                    let snapshot = state
                        .snapshot
                        .lock()
                        .ok()
                        .and_then(|snapshot| snapshot.clone());
                    tray::refresh_tray(&app, snapshot.as_ref());
                    let _ = app.emit(
                        "monitor://error",
                        "Battery information is temporarily unavailable. BatteryBloom will retry.",
                    );
                }
            }

            tokio::time::sleep(interval).await;
        }
    });
}
