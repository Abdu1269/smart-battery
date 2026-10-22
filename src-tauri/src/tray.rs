use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::Duration;

use batterybloom_core::models::{BatterySnapshot, BatteryState, PowerSource};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::state::AppState;

pub struct TrayState {
    status: MenuItem<Wry>,
    alerts: CheckMenuItem<Wry>,
    previous_alerts: Mutex<Option<(bool, bool)>>,
}

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let settings = app.state::<AppState>().settings_snapshot();
    let snapshot = app
        .state::<AppState>()
        .snapshot
        .lock()
        .ok()
        .and_then(|snapshot| snapshot.clone());

    let status = MenuItem::with_id(
        app,
        "tray-status",
        status_label(snapshot.as_ref()),
        false,
        None::<&str>,
    )?;
    let open = MenuItem::with_id(app, "tray-open", "Open BatteryBloom", true, None::<&str>)?;
    let charging = MenuItem::with_id(
        app,
        "tray-charging",
        "Charging settings…",
        true,
        None::<&str>,
    )?;
    let alerts = CheckMenuItem::with_id(
        app,
        "tray-alerts",
        "Charging alerts",
        true,
        settings.low_enabled || settings.high_enabled,
        None::<&str>,
    )?;
    let separator_one = PredefinedMenuItem::separator(app)?;
    let separator_two = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray-quit", "Quit BatteryBloom", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &status,
            &separator_one,
            &open,
            &charging,
            &alerts,
            &separator_two,
            &quit,
        ],
    )?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-normal.png"))?;
    TrayIconBuilder::with_id("main")
        .icon(icon)
        .tooltip("BatteryBloom")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray-open" => show_main(app),
            "tray-charging" => {
                show_main(app);
                let _ = app.emit("nav://go", "charging");
            }
            "tray-alerts" => toggle_alerts(app),
            "tray-quit" => {
                if let Some(state) = app.try_state::<AppState>() {
                    state.exiting.store(true, Ordering::SeqCst);
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;

    app.manage(TrayState {
        status,
        alerts,
        previous_alerts: Mutex::new(None),
    });
    Ok(())
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn refresh_tray(app: &AppHandle, snapshot: Option<&BatterySnapshot>) {
    let Some(tray_state) = app.try_state::<TrayState>() else {
        return;
    };
    let settings = app.state::<AppState>().settings_snapshot();
    let label = status_label(snapshot);
    let _ = tray_state.status.set_text(label.clone());
    let _ = tray_state
        .alerts
        .set_checked(settings.low_enabled || settings.high_enabled);
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(format!("BatteryBloom — {label}")));
    }
}

pub fn flash_alert(app: AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    if state
        .tray_flashing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return;
    }

    tauri::async_runtime::spawn(async move {
        for _ in 0..4 {
            if let Some(tray) = app.tray_by_id("main") {
                if let Ok(image) = Image::from_bytes(include_bytes!("../icons/tray-alert.png")) {
                    let _ = tray.set_icon(Some(image));
                }
            }
            tokio::time::sleep(Duration::from_millis(420)).await;
            if let Some(tray) = app.tray_by_id("main") {
                if let Ok(image) = Image::from_bytes(include_bytes!("../icons/tray-normal.png")) {
                    let _ = tray.set_icon(Some(image));
                }
            }
            tokio::time::sleep(Duration::from_millis(360)).await;
        }
        if let Some(tray) = app.tray_by_id("main") {
            if let Ok(image) = Image::from_bytes(include_bytes!("../icons/tray-normal.png")) {
                let _ = tray.set_icon(Some(image));
            }
        }
        if let Some(state) = app.try_state::<AppState>() {
            state.tray_flashing.store(false, Ordering::SeqCst);
        }
    });
}

fn toggle_alerts(app: &AppHandle) {
    let state = app.state::<AppState>();
    let mut settings = state.settings_snapshot();
    let enabled = settings.low_enabled || settings.high_enabled;
    if enabled {
        if let Some(tray) = app.try_state::<TrayState>() {
            if let Ok(mut previous) = tray.previous_alerts.lock() {
                *previous = Some((settings.low_enabled, settings.high_enabled));
            }
        }
        settings.low_enabled = false;
        settings.high_enabled = false;
    } else {
        let restored = app
            .try_state::<TrayState>()
            .and_then(|tray| {
                tray.previous_alerts
                    .lock()
                    .ok()
                    .and_then(|mut previous| previous.take())
            })
            .unwrap_or((true, true));
        settings.low_enabled = restored.0;
        settings.high_enabled = restored.1;
    }
    if let Err(error) = state.settings_store.save(&settings) {
        log::warn!("could not save tray alert toggle: {error}");
        return;
    }
    if let Ok(mut current) = state.settings.lock() {
        *current = settings.clone();
    }
    if let Ok(mut engine) = state.engine.lock() {
        engine.reset_for_settings_change();
    }
    refresh_tray(
        app,
        state
            .snapshot
            .lock()
            .ok()
            .and_then(|value| value.clone())
            .as_ref(),
    );
    let _ = app.emit("settings://changed", settings);
}

fn status_label(snapshot: Option<&BatterySnapshot>) -> String {
    let Some(snapshot) = snapshot else {
        return "Battery not detected".into();
    };
    let Some(percent) = snapshot.percent else {
        return "Battery not detected".into();
    };
    let state = match snapshot.state {
        BatteryState::Charging => {
            if let Some(seconds) = snapshot.time_to_full_secs {
                format!("Charging · {} until full", duration_label(seconds))
            } else {
                "Charging".into()
            }
        }
        BatteryState::Discharging => match snapshot.time_remaining_secs {
            Some(seconds) => format!("{} remaining", duration_label(seconds)),
            None => "On battery".into(),
        },
        BatteryState::Full => "Fully charged".into(),
        BatteryState::NotCharging => match snapshot.power_source {
            Some(PowerSource::Ac) => "Plugged in · not charging".into(),
            _ => "Not charging".into(),
        },
        BatteryState::Unknown => "Battery state unavailable".into(),
    };
    format!("Battery {percent}% · {state}")
}

fn duration_label(seconds: u64) -> String {
    let minutes = seconds / 60;
    if minutes < 60 {
        return format!("{}m", minutes.max(1));
    }
    let hours = minutes / 60;
    let minutes = minutes % 60;
    if minutes == 0 {
        format!("{hours}h")
    } else {
        format!("{hours}h {minutes}m")
    }
}
