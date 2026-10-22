mod commands;
mod diagnostics;
mod monitor;
mod platform;
mod state;
mod tray;

use std::fs;

use batterybloom_core::battery::{BatteryProvider, SystemBatteryProvider};
use batterybloom_core::history::HistoryStore;
use batterybloom_core::settings::SettingsStore;
use tauri::{Manager, WindowEvent};

use crate::state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main(app);
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg("--minimized")
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(1_000_000)
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let app_handle = app.handle().clone();
            let data_dir = app.path().app_data_dir().map_err(|error| {
                std::io::Error::other(format!("app data directory unavailable: {error}"))
            })?;
            fs::create_dir_all(&data_dir).map_err(|error| {
                std::io::Error::other(format!("app data directory could not be created: {error}"))
            })?;

            let settings_store = SettingsStore::new(data_dir.join("settings.json"));
            let settings_load = settings_store.load();
            let settings = settings_load.settings.clone();
            let settings_warning = settings_load.warning.clone();
            let history_store = HistoryStore::new(data_dir.join("history.jsonl"));

            let battery_provider = SystemBatteryProvider::new();
            let snapshot = match battery_provider.read() {
                Ok(snapshot) => Some(snapshot),
                Err(error) => {
                    log::warn!("initial battery read failed: {error}");
                    None
                }
            };

            let state = AppState::new(
                settings_store,
                history_store,
                settings.clone(),
                settings_warning,
                snapshot,
            );
            app.manage(state);
            let tray_available = match tray::build_tray(&app_handle) {
                Ok(()) => true,
                Err(error) => {
                    log::warn!("tray icon could not be created: {error}");
                    false
                }
            };

            let start_minimized = tray_available
                && settings.launch_minimized
                && std::env::args().any(|argument| argument == "--minimized");
            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            } else if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            if let Some(window) = app.get_webview_window("main") {
                let app_for_event = app_handle.clone();
                let window_for_event = window.clone();
                window.on_window_event(move |event| {
                    let WindowEvent::CloseRequested { api, .. } = event else {
                        return;
                    };
                    let state = app_for_event.state::<AppState>();
                    let minimize = state.settings_snapshot().minimize_to_tray;
                    if minimize
                        && tray_available
                        && !state.exiting.load(std::sync::atomic::Ordering::SeqCst)
                    {
                        api.prevent_close();
                        let _ = window_for_event.hide();
                    } else {
                        state
                            .exiting
                            .store(true, std::sync::atomic::Ordering::SeqCst);
                        api.prevent_close();
                        app_for_event.exit(0);
                    }
                });
            }

            monitor::start_monitor(app_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_bootstrap,
            commands::get_battery_snapshot,
            commands::get_platform_capabilities,
            commands::get_charge_limit,
            commands::get_recommendations,
            commands::get_power_settings,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::reset_app_settings,
            commands::set_charge_limit,
            commands::reset_charge_limit,
            commands::apply_power_profile,
            commands::apply_power_timeout,
            commands::undo_last_power_change,
            commands::get_battery_history,
            commands::clear_battery_history,
            commands::export_battery_history,
            commands::get_diagnostics,
            commands::export_diagnostics,
            commands::save_diagnostics,
            commands::copy_diagnostics,
            commands::send_test_notification,
            commands::open_system_settings,
        ])
        .run(tauri::generate_context!())
        .expect("BatteryBloom could not start");
}
