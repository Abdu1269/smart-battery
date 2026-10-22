# Security and privacy

BatteryBloom is a local desktop utility. It reads battery state and a small set
of documented power controls. It does not create an account, contact a server,
run arbitrary shell commands, or escalate privileges.

Last reviewed: 2026-10-22

## Assets and trust boundaries

| Asset                      | Location                                         | Trust                                      |
| -------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Battery and power readings | OS APIs / sysfs                                  | Read-only input, treated as untrusted text |
| Settings                   | Tauri app-data `settings.json`                   | Local, user-controlled                     |
| History                    | Tauri app-data `history.jsonl`                   | Local, user-controlled                     |
| Diagnostics                | Generated on demand; copied or saved by the user | Local export                               |
| Native notifications       | OS notification service                          | User-controlled permission                 |
| Autostart entry            | OS session configuration                         | Explicit opt-in toggle                     |
| Charge thresholds          | Linux sysfs                                      | OS-mediated, narrowly scoped write         |
| Power profiles/timeouts    | `powerprofilesctl`, `gsettings`                  | Documented OS command with fixed arguments |

The React webview and Rust backend communicate through Tauri commands and typed
events. The backend validates inputs; the webview is not treated as a source of
trusted file paths.

## Network behaviour

- No HTTP client, telemetry, analytics, crash reporting, account, advertising, or
  cloud sync is included.
- No updater feed is configured.
- The Content Security Policy restricts scripts and connections to the local
  application. Fonts and images are local.
- The only network-capable dependencies are transitive Tauri/webview packages;
  BatteryBloom does not call a remote service.

If network features are added later, they must be documented, opt-in, and
covered by a new threat review.

## Privilege and command execution

- BatteryBloom never invokes `sudo`, `pkexec`, a shell (`sh -c`, `bash -c`), or an
  arbitrary user-provided command.
- Charge limits are written only when the relevant sysfs threshold files are
  already writable by the current user. Otherwise the capability is reported as
  `permissionRequired`.
- No privileged helper, daemon, or setuid binary is installed.
- The only external processes are fixed-argument helpers:
  - `powerprofilesctl` for supported profile changes.
  - `gsettings` for GNOME display/sleep timeouts.
  - `gnome-control-center` or KDE `systemsettings` to open a settings panel.
  - The Tauri opener plugin for fixed `ms-settings:` / `x-apple.systempreferences:`
    URLs on Windows/macOS.
- Command output is parsed and validated. A non-zero exit or unverifiable
  read-back is surfaced as failure, not success.

## Charge-limit write safety

1. Confirm the user explicitly requested the operation.
2. Read the current capability and current values.
3. Validate range (5–100) and start/end ordering.
4. Save the pre-change baseline locally before the first write.
5. Write the end threshold, then the optional start threshold.
6. Poll the files for exact read-back up to five times.
7. If verification fails, attempt to restore the previous end and start values.
8. Report failure unless the exact values are read back.
9. Refuse to retry automatically if the value changed concurrently.

Residual risk: a successful sysfs write changes firmware/driver behaviour beyond
BatteryBloom. The baseline and restore action reduce, but do not eliminate, the
risk of a device-specific driver quirk.

## File-system handling

- Settings are written atomically (temporary file + rename) with a versioned
  schema. Malformed settings are backed up rather than silently discarded.
- History is append-only JSONL with a bounded retention period.
- Export paths must be absolute and non-empty. BatteryBloom refuses to overwrite
  its own live history file.
- Diagnostics are serialized from an explicit allow-list of fields:
  - app version and platform;
  - battery values and capabilities;
  - alert, history, startup, and theme settings;
  - last error text and record count.
- Diagnostics omit serial numbers, usernames, hostnames, account identifiers,
  and file paths. Error strings are curated where possible; an OS error may still
  contain a device path. Review a report before sharing it.
- The clipboard is written only when the user chooses **Copy report**.

## Logging

- Tauri logging is local. It may include platform error text needed for
  troubleshooting.
- Battery readings, settings, and monitor errors are not sent anywhere.
- Log files are subject to the OS user's file permissions and can be removed by
  the user.

## Notifications and autostart

- Notification permission is requested through the operating system when the
  user enables native notifications or asks for a test.
- Denied permission leaves in-app banners and the local chime available.
- Launch at login is off by default. Enabling it writes an OS autostart entry
  through the official Tauri plugin. Disabling removes it.
- Autostart failure aborts the settings save and is reported to the user.

## Webview and IPC

- The frontend runs with a restrictive CSP. Remote scripts are not permitted.
- Tauri capabilities for the main window are limited to core defaults,
  notification defaults, and the dialog save command.
- Every command validates its payload on the Rust side, including charge-limit
  confirmation, path shape, format choice, and settings ranges.
- Rust errors returned to the UI use stable codes and user-facing messages; raw
  internal errors are not used as success states.

Residual risk: a compromised local webview could invoke exposed Tauri commands.
The exposed command set is intentionally narrow and cannot execute arbitrary
programs. Keep the OS, WebView2/WebKitGTK, and dependencies updated.

## Supply chain

- Frontend dependencies are pinned in `pnpm-lock.yaml`.
- Rust dependencies are pinned in `Cargo.lock`.
- Official Tauri plugins are preferred over custom platform code.
- Run `pnpm audit` and `cargo audit` as release checks; review findings rather
  than blindly updating.
- Release builds should be produced from a clean checkout in CI, with signing
  keys supplied only through CI secrets.

## Privacy summary

BatteryBloom stores only what it needs locally. It does not know your identity,
does not build a profile, and does not transmit battery or usage data. The
current design has no server component to breach.

## Reporting a security issue

Do not open a public issue containing exploit details or a full diagnostics file.
Contact the maintainers privately through the repository's security contact and
include the affected version, platform, reproduction steps, and impact. Remove
personal data from logs and reports first.

## Security review checklist

- [ ] No shell execution with user-controlled strings.
- [ ] No privilege escalation path.
- [ ] Charge-limit read-back verified before success.
- [ ] Settings schema validated before persistence.
- [ ] Export paths validated; no live-history overwrite.
- [ ] Diagnostics contain no identifiers by default.
- [ ] CSP and Tauri capabilities remain minimal.
- [ ] Notification and autostart permissions are user-controlled.
- [ ] Dependencies reviewed and locked.
- [ ] No signing keys or secrets in the repository.
