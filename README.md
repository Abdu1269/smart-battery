# BatteryBloom

A calm, local-first battery companion for laptops. BatteryBloom shows the values
your device actually reports, sends configurable low and high charge reminders,
applies a hardware charge limit only through a verified and writable system
interface, and keeps a small local history.

Built with **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Tailwind CSS 4**,
and shadcn-style Radix primitives. It has no account, telemetry, advertising, or
cloud sync.

## Status

BatteryBloom is an early `0.1.0` desktop release. Linux is the only platform
tested on real hardware in this repository. On 2026-10-22, a production build was
launched without a development server and displayed live readings (20% on
battery, then 22% charging after AC was connected) and the honest
permission-required charge-threshold state. Windows and macOS code paths are
implemented where possible but have **not** been validated on real devices. See
[docs/platform-capabilities.md](docs/platform-capabilities.md) for the honest
support matrix.

## What it does

- **Live battery dashboard** with charge, power source, time estimates, capacity
  ratio, power draw, temperature, and cycle count when reported.
- **Low and high charge reminders** with edge-triggered state, hysteresis,
  cooldown, quiet hours, power-source scope, native notifications, in-app
  banners, and a locally generated chime.
- **Verified hardware charge limit** on Linux laptops that expose writable sysfs
  charge thresholds. BatteryBloom saves the previous values, writes the new
  ones, reads them back, and reports success only after verification.
- **Power guidance** using power-profiles-daemon where available; GNOME display
  and sleep timeout changes are supported with undo.
- **Local history** with charting, 24-hour/7-day/30-day/all ranges, CSV and JSON
  export, retention limits, and one-click clearing.
- **Tray monitoring** with a compact status menu, close-to-tray behaviour, opt-in
  launch at login, and alert flashing.
- **Diagnostics on demand** with a privacy-limited JSON report that omits serial
  numbers, usernames, hostnames, and file paths.
- **Calm Energy interface** with dark mode, reduced-motion support, keyboard
  navigation, responsive layouts, and no colour-only status.

## What it will not do

- It will not invent battery health, runtime, savings, temperature, cycle count,
  or a successful charge limit.
- It will not ask for `sudo`, install a privileged helper, or run a shell command
  to force a charge-threshold write.
- It will not claim a reminder stopped charging. A high-charge reminder is not a
  hardware limit.
- It will not upload battery data or include analytics.

## Requirements

- Node.js 22 or newer
- pnpm 11 (`corepack enable` is recommended)
- Rust 1.90 or newer
- Tauri 2 native prerequisites for your platform

On Ubuntu 24.04 / Debian bookworm, the Linux build dependencies are:

```bash
sudo apt-get install -y \
  build-essential curl wget file pkg-config \
  libwebkit2gtk-4.1-dev libgtk-3-dev libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for
Windows, macOS, and other Linux distributions.

## Development

```bash
pnpm install
pnpm tauri dev
```

The first launch shows a three-step setup. BatteryBloom then keeps monitoring
from the tray while the window is closed, unless that behaviour is disabled.

### Checks

```bash
pnpm lint          # ESLint, zero warnings allowed
pnpm typecheck     # TypeScript
pnpm test          # Vitest + Testing Library
pnpm build         # Type-check and production frontend bundle

cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The Rust workspace contains a pure, platform-light core crate and a thin Tauri
application:

```text
crates/batterybloom-core/   battery model, alerts, settings, history, adapters
src-tauri/                  Tauri commands, tray, monitor loop, diagnostics
src/                        React interface, state provider, typed API
docs/                       capability, security, testing, release documents
```

### Production build

```bash
pnpm tauri build
```

On Linux, build the packaged installers you intend to ship with explicit
targets (the default target set is platform-specific):

```bash
pnpm tauri build --bundles deb,appimage   # Linux
pnpm tauri build --bundles nsis           # Windows
pnpm tauri build --bundles dmg            # macOS
```

Signing and notarisation are release configuration steps, not source defaults.
No signing credentials or updater keys belong in this repository. See
[docs/release-checklist.md](docs/release-checklist.md).

## Permissions and system access

BatteryBloom requests only what the feature needs:

| Access                                    | Why                                    | Control                                                           |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Battery and power data                    | Live readings and history              | Operating-system APIs; read-only                                  |
| Notifications                             | Native charge reminders                | OS notification permission; can be disabled in Settings           |
| Autostart                                 | Optional launch at login               | Off by default; toggled in Settings                               |
| Tray                                      | Background monitoring and quick status | Close-to-tray can be disabled                                     |
| Linux charge thresholds                   | Optional hardware charge limit         | Direct write to exposed sysfs files only; no privilege escalation |
| Settings and history files                | Local persistence                      | Stored in the app-data directory; clearable in the app            |
| `gnome-control-center` / `systemsettings` | Open a system settings panel           | Hard-coded panel arguments; no shell                              |

On Linux the current development laptop exposes `/sys/class/power_supply/BAT0`
charge thresholds as root-owned files. BatteryBloom reads `50–80%` but reports
`permission required` instead of attempting an unprivileged write or elevating
itself. The high-charge reminder remains available.

## Privacy

- Settings: `settings.json` in the Tauri app-data directory.
- History: `history.jsonl` in the same directory.
- Logs: Tauri log plugin output in the app log directory.
- Diagnostics are generated only when requested and contain no serial number,
  username, hostname, file path, or account identifier.
- There is no network client in the application and no update feed configured.

The full threat model is in [docs/security.md](docs/security.md).

## Platform support at a glance

| Area                     | Linux                               | Windows                                     | macOS                                       |
| ------------------------ | ----------------------------------- | ------------------------------------------- | ------------------------------------------- |
| Battery readings         | Implemented and exercised           | Implemented, not device-validated           | Implemented, not device-validated           |
| Alerts and local history | Implemented and tested              | Implemented, not device-validated           | Implemented, not device-validated           |
| Tray and autostart       | Implemented                         | Implemented via Tauri plugin, not validated | Implemented via Tauri plugin, not validated |
| Power profiles           | power-profiles-daemon when present  | Not implemented                             | Not implemented                             |
| Display/sleep timeouts   | GNOME `gsettings`                   | Not implemented                             | Not implemented                             |
| Hardware charge limit    | Writable, verified Linux sysfs only | Unsupported by design                       | Unsupported by design                       |

A successful compile is not hardware validation. See the detailed matrix and
pending manual tests in
[docs/platform-capabilities.md](docs/platform-capabilities.md) and
[docs/manual-test-plan.md](docs/manual-test-plan.md).

## Troubleshooting

**A debug window says “connection refused”.** Debug builds load the Vite URL.
Start them with `pnpm tauri dev`, not a bare `cargo run`. Production builds and
AppImage/DEB packages use the embedded frontend and do not need a dev server.

**No battery detected.** Desktops, virtual machines, and some firmware modes do
not expose a battery. BatteryBloom retries without inventing values.

**Charge limit says “permission needed”.** The threshold exists but is not
writable by your user. BatteryBloom deliberately does not escalate. Use a
vendor-supported battery tool or the high-charge reminder.

**A power profile is unavailable.** BatteryBloom only offers power controls it
can read and verify. Use your desktop's power settings.

**Notifications do not appear.** Check the OS notification permission, Do Not
Disturb, and the app's test notification. In-app banners and sound are separate
channels.

**History is empty.** Samples are written while monitoring at the configured
interval. Two samples are needed before a chart is drawn.

**Something looks wrong.** Open **Settings → View diagnostics**, then save the
JSON report. It contains no identifiers or paths by default.

## Documentation

- [Platform capabilities](docs/platform-capabilities.md)
- [Security and privacy](docs/security.md)
- [Manual test plan](docs/manual-test-plan.md)
- [Release checklist](docs/release-checklist.md)

## License

MIT. See [LICENSE](LICENSE).
