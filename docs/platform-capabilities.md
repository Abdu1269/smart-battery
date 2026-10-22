# Platform capabilities

Last reviewed: 2026-10-22

This document records what BatteryBloom actually implements, what has been
exercised, and what remains unverified. A platform is not listed as supported
merely because it compiles.

## Status vocabulary

| Status          | Meaning                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ |
| **Exercised**   | The code path was run in this repository's development environment and produced real data. |
| **Implemented** | The adapter and UI exist, but the feature has not been tested on real hardware here.       |
| **Unsupported** | There is no verified adapter. BatteryBloom reports this honestly.                          |
| **Pending**     | Manual validation is required on that platform.                                            |

## Support matrix

| Feature                                 | Linux                                                                                     | Windows                  | macOS                    | Adapter                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ | ------------------------ | ---------------------------------------------------- |
| Battery percentage, state, power source | Exercised                                                                                 | Implemented, pending     | Implemented, pending     | `starship-battery`; Linux also reads sysfs AC online |
| Design/full charge capacity, power draw | Exercised when exposed                                                                    | Implemented, pending     | Implemented, pending     | `starship-battery`                                   |
| Temperature and cycle count             | Exercised as “not reported” on the reference laptop                                       | Implemented, pending     | Implemented, pending     | `starship-battery`; never estimated                  |
| Time remaining / time to full           | Exercised when exposed                                                                    | Implemented, pending     | Implemented, pending     | `starship-battery`                                   |
| Low/high alerts, hysteresis, cooldown   | Core exercised by automated tests; end-to-end manual path pending                         | Implemented, pending     | Implemented, pending     | Rust alert engine                                    |
| Native notifications                    | Implemented; manual delivery check pending                                                | Implemented, pending     | Implemented, pending     | `tauri-plugin-notification`                          |
| In-app banner and local chime           | Implemented; manual check pending                                                         | Implemented              | Implemented              | React + Web Audio                                    |
| Tray icon, menu, close-to-tray          | Registration and menu observed; close/quit pending                                        | Implemented, pending     | Implemented, pending     | Tauri tray + `tray-icon`                             |
| Launch at login                         | Implemented; not validated                                                                | Implemented, pending     | Implemented, pending     | `tauri-plugin-autostart`                             |
| Local settings and history              | Exercised in the running app                                                              | Implemented, pending     | Implemented, pending     | Versioned JSON + JSONL                               |
| History export (CSV/JSON)               | Exercised via core tests                                                                  | Exercised via core tests | Exercised via core tests | Core history store                                   |
| Power profiles                          | Implemented; end-to-end check pending                                                     | Unsupported              | Unsupported              | `powerprofilesctl`                                   |
| Display and sleep timeouts              | Implemented; end-to-end check pending                                                     | Unsupported              | Unsupported              | `gsettings`                                          |
| Hardware charge limit                   | Only when a writable sysfs threshold exists; reference laptop reports permission required | Unsupported by design    | Unsupported by design    | Linux sysfs with write + read-back                   |
| Diagnostics                             | Implemented; manual inspection pending                                                    | Implemented              | Implemented              | Tauri command + local JSON                           |

“Implemented, pending” means the code is present and CI may compile it, but no
claim of device validation is made.

## Reference Linux environment

The development and verification environment for this repository:

- Ubuntu 26.04.
- Dell XPS 15 7590.
- Battery `BAT0` exposed through `/sys/class/power_supply/BAT0`.
- Live readings during the build included 74% discharging; later runtime checks
  reported 29–33% discharging, then 20% on battery and 22% charging after the
  charger was connected. Full-charge capacity versus design capacity was
  approximately 67.7%.
- A running Linux session wrote four real history samples and displayed the
  permission-needed charge-threshold capability. This confirms the read path and
  the honest permission state; it is not a writable-threshold test.
- Cycle count and temperature were not reported by the platform.
- `/sys/class/power_supply/BAT0/charge_control_start_threshold` and
  `charge_control_end_threshold` existed and read `50` and `80`, but were owned by
  root with mode `0644`. BatteryBloom therefore reports **permission required**
  for hardware charge control.
- UPower reported a different start threshold (`75`) from sysfs (`50`).
  BatteryBloom reads the actual threshold files instead of trusting the UPower
  summary.
- `power-profiles-daemon` and GNOME power settings were available.
- A notification daemon and an AppIndicator extension were available; tray and
  notification behaviour still require manual confirmation in the running app.

## Linux details

### Battery data

- Primary metrics come from `starship-battery` through the operating system.
- AC online state comes from `/sys/class/power_supply/*/online` when available.
- Multiple batteries are aggregated by energy where the platform supplies it.
- Missing values are `null` and rendered as `—`. Temperature and cycle count are
  not inferred from age, capacity, or runtime.
- The initial live read and the monitor loop use the same provider.
- A desktop without a battery is a valid `notDetected` state, not an error and not
  a fabricated reading.

### Charge thresholds

- Only the sysfs interface is used:
  - `/sys/class/power_supply/<battery>/charge_control_end_threshold`
  - `/sys/class/power_supply/<battery>/charge_control_start_threshold` when present.
- The end threshold must exist. The start threshold is optional.
- The capability is `supported` only when every applicable file is writable.
- Before the first change, previous values are recorded in settings as a
  baseline. On reset, the baseline is written back.
- The apply sequence is: validate range and ordering, save baseline, write end,
  write start when requested, poll up to five times for exact read-back, restore
  previous values if verification fails.
- A permission failure is reported as `permissionRequired`. No `sudo`, root
  helper, Polkit escalation, or shell command is invoked.
- The minimum assumed writable range is 5–100%; the actual device may accept a
  narrower range. A failed or clamped write is reported as failed verification.

### Power profiles

- Uses `powerprofilesctl` from power-profiles-daemon.
- Available profiles are discovered from the tool; they are not assumed.
- The change is applied and read back. If the read-back does not match, the
  operation is reported as failed.
- Undo stores the previous value in local settings.

### Display and sleep timeouts

- GNOME only, using `gsettings` for:
  - `org.gnome.desktop.session idle-delay` (display)
  - `org.gnome.settings-daemon.plugins.power sleep-inactive-battery-timeout`
- Only known option values are offered. The current value is displayed even
  when it is outside the offered set, but a value outside the supported set is
  not written by the UI.
- Changes are read back and a single recent change can be undone.

### Tray, notifications, autostart

- Tray and autostart use official Tauri plugins.
- Native notifications use `tauri-plugin-notification`; the OS controls
  permission.
- Closing the window can hide it to the tray. Quit is explicit.
- The tray menu exposes status, open, charging settings, alert enable/disable,
  and quit.
- Tray icon flashing is decorative and must not be the sole signal; an in-app
  banner and system notification can also be produced.

### Runtime assumptions

- Tauri 2 with WebKitGTK 4.1 and GTK 3.
- A desktop session with a notification daemon for native notifications.
- AppIndicator support for a visible tray icon. Without it, tray behaviour may
  be unavailable even though monitoring continues.
- Standard XDG app-data and autostart directories.
- No special permissions for monitoring. Charge-threshold writes require
  explicit file-system permissions granted outside BatteryBloom.

## Windows details

Implemented:

- Battery readings through `starship-battery`.
- Low/high alert engine, local settings, history, export, diagnostics.
- Native notifications, tray, autostart, and opening `ms-settings:` panels via
  the Tauri opener plugin.
- Packaging configured for NSIS in CI.

Not implemented / unsupported:

- Hardware charge limits. BatteryBloom has no verified Windows charge-threshold
  adapter and will report unsupported rather than modify vendor drivers.
- Power profiles and display/sleep timers. Use Windows Settings.
- Per-battery AC source is inferred from the battery state because sysfs is
  Linux-only.
- No device validation has been performed. CI compilation is not a hardware
  test.

Assumptions to verify before claiming support: Windows 10/11, WebView2 runtime,
notification permission, tray visibility, startup registration, and the battery
driver's reported units.

## macOS details

Implemented:

- Battery readings through `starship-battery` (IOKit-backed upstream).
- Alerts, local settings, history, export, diagnostics.
- Native notifications, menu-bar tray, autostart, opening System Settings URLs
  via the Tauri opener plugin.
- Packaging configured for DMG in CI.

Not implemented / unsupported:

- Hardware charge limits. No verified public adapter is used.
- Power profiles and display/sleep timers. Use macOS Settings.
- AC power source is inferred from battery state because sysfs is Linux-only.
- No device validation has been performed. Signing/notarisation is not configured
  in this repository.

Assumptions to verify before claiming support: Tauri's current minimum macOS
version, menu-bar behaviour, notification permission, LaunchAgent behaviour,
and Intel vs Apple-silicon battery fields.

## Manual validation still required

- Windows laptop with a battery: data, alerts, tray, startup, notifications.
- Windows desktop without a battery: honest empty state.
- macOS laptop: data, menu bar, alerts, startup, notifications.
- Linux laptop without charge-threshold files: unsupported state.
- Linux laptop with writable thresholds: successful apply, verification, reset,
  and concurrent-change handling.
- Notifications disabled by the OS.
- Suspend/resume and long-running monitor stability.
- Screen-reader review and 200% text scaling.

The test steps are in [manual-test-plan.md](manual-test-plan.md). Do not mark a
platform supported until those steps have evidence.
