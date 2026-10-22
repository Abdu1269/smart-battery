# Project Brief: BatteryBloom

## Cross-Platform Battery Health, Charging Alerts, and Power Assistant

You are a senior Rust/Tauri engineer, desktop UX designer, and systems
programmer. Build a polished, reliable desktop application for
**Windows, Linux, and macOS** that helps users protect battery
longevity, monitor battery condition, configure safe power-saving
options, and receive useful charging alerts.

Working product name: **BatteryBloom**. Keep the name, package
identifiers, and visual identity easy to change.

Do not stop at a mockup. Inspect the existing repository, identify the
current stack and conventions, then implement a working, testable
application in small, complete phases. If the repository is empty,
scaffold it cleanly. Make reasonable decisions without asking questions
unless a genuine blocker exists.

------------------------------------------------------------------------

# 1. Product vision

Create a lightweight, trustworthy battery companion with four core
goals:

1.  **Protect battery longevity** with charging-limit support when the
    hardware and OS permit it.
2.  **Help users act at the right time** with configurable low/high
    charge alerts, sound, native notifications, and a visible flashing
    indicator.
3.  **Make battery and power information understandable**, not
    intimidating.
4.  **Recommend and optionally apply safe power optimizations** with
    clear explanations, previews, and undo wherever possible.

The app should feel premium, calm, accessible, and dependable. Avoid
generic AI-generated dashboard aesthetics, excessive gradients, clutter,
fake metrics, decorative charts, and controls that do not work.

## Critical product truth

A percentage alert is not the same as a hardware charging limit.

-   A **high-charge alert** can tell the user to unplug at 80%, but
    cannot itself stop charging.
-   A **low-charge alert** can tell the user to plug in at 20%, but
    cannot ensure the user acts.
-   A **hardware charge limit** must use a supported operating-system,
    firmware, vendor, or hardware interface.
-   Support differs by laptop model, firmware, OS version, and
    permissions.
-   Never claim a charge limit is active unless the platform adapter has
    verified that it was applied and, where possible, read it back.
-   Never silently run privileged commands, change firmware, disable
    thermal protections, or promise a battery-lifespan improvement that
    cannot be substantiated.

When charge-limit control is unavailable, clearly show **"Alerts only
--- charge limit control is not supported on this device"** and explain
the available alternative.

------------------------------------------------------------------------

# 2. Target platforms and architecture

## Stack

-   Rust for native logic and platform integrations.
-   Tauri 2 for the desktop shell.
-   TypeScript for frontend code.
-   React for the UI.
-   Tailwind CSS and shadcn/ui where compatible with the repository.
-   Use the repository's existing package manager and conventions. If
    starting fresh, choose a well-supported, reproducible setup.
-   Use a small charting library only if real historical data makes a
    chart useful.
-   Use SQLite only if local history needs a relational store; otherwise
    prefer a lightweight local store.
-   Use Tauri's official plugins where suitable, with minimal
    permissions.
-   Keep the app local-first. No account, telemetry, cloud service, or
    network connection should be required for core features.

Use a modular architecture. The frontend must not directly execute shell
commands or access arbitrary filesystem paths. All native functionality
goes through typed, validated Tauri commands and narrow Rust services.

## Suggested Rust modules

-   `battery`: current battery state and supported metrics.
-   `charge_control`: capability discovery and charge-limit adapters.
-   `alerts`: threshold state machine, deduplication, cooldowns, and
    notification routing.
-   `power_profiles`: inspect and apply supported power modes/settings.
-   `recommendations`: rule-based tips with explanations.
-   `history`: optional local time-series records and health snapshots.
-   `platform`: OS detection, capabilities, permissions, and adapters.
-   `settings`: validation, migration, persistence, and reset.
-   `diagnostics`: non-sensitive troubleshooting and exportable
    diagnostics.

Keep platform-specific code behind traits, for example:

-   `BatteryProvider`
-   `ChargeLimitProvider`
-   `PowerProfileProvider`
-   `NotificationProvider`

Return typed capability information rather than scattering OS checks
throughout the UI.

------------------------------------------------------------------------

# 3. Cross-platform capability strategy

Create a **capability matrix** at runtime. Do not assume that a feature
is supported merely because the operating system supports batteries.

Each feature should have a status such as:

-   `supported`
-   `unsupported`
-   `permission_required`
-   `not_detected`
-   `error`
-   `read_only`

Expose a concise reason and a recommended next step. The UI must adapt
to the actual capability.

## Windows

-   Read available battery information through a stable Windows API or a
    maintained Rust crate after evaluating its maturity and licensing.
-   Use documented OS power APIs or safe, well-understood system
    interfaces for supported settings.
-   Distinguish Windows low/critical battery warning settings from
    actual charging limits.
-   Some laptops expose charge limits only through firmware or
    manufacturer-specific utilities. Do not imply a universal Windows
    API exists for all models.
-   Do not modify hidden power settings without a clear explanation, a
    preview, validation, and an undo path.
-   Do not depend on a vendor utility being installed. If a
    vendor-specific adapter is added, detect the exact supported
    device/interface and report its status.

## Linux

-   Prefer available kernel interfaces and well-established system
    services.
-   Inspect `/sys/class/power_supply/` for battery and AC-adapter
    information where available.
-   Detect charge thresholds only when actual writable threshold files
    or a supported vendor interface exist. Common examples may include
    `charge_control_start_threshold` and `charge_control_end_threshold`,
    but availability varies by kernel, driver, and hardware.
-   Integrate with supported power-management services only when
    installed and available.
-   Never assume all distributions use the same desktop environment or
    power daemon.
-   Do not write to privileged sysfs files from the GUI process. If a
    privileged helper is genuinely needed, design it as a narrow,
    auditable, opt-in component with explicit authorization and strict
    input validation.
-   Gracefully handle missing files, read-only interfaces, permissions,
    hot-plugging, and suspend/resume.

## macOS

-   Use documented system information and supported APIs where possible.
-   Do not assume macOS provides a universal public API for arbitrary
    third-party apps to set a battery charge ceiling.
-   Some battery health or charging behavior may be managed by the OS
    itself or by device-specific support.
-   If charge-limit control cannot be safely and reliably implemented
    using a supported interface, provide monitoring and alerts rather
    than shell-script hacks or unsupported private APIs.
-   Clearly distinguish information read from the system from estimates
    or recommendations.

## Platform support policy

Maintain a document such as `docs/platform-capabilities.md` listing each
feature, adapter, minimum OS assumptions, permission needs, and manual
test status.

Do not report a platform as fully supported until it has been tested on
that platform. If the development environment only provides one OS,
implement the other adapters carefully, add mocked tests, and document
which real-device tests remain outstanding.

------------------------------------------------------------------------

# 4. Core features

## A. Live battery dashboard

Build a welcoming dashboard showing only metrics that are genuinely
available:

-   Current charge percentage.
-   Charging, discharging, full, or connected-to-power state.
-   Estimated remaining time or time to full only when the OS supplies a
    meaningful estimate.
-   Battery health/capacity information when available.
-   Cycle count when available.
-   Power source and adapter status when available.
-   Active charge-limit capability and current configured limit, when
    supported.
-   Last successful refresh and data availability state.

Do not fabricate health, cycle count, wattage, or time estimates. Show
"Not available on this device" when appropriate.

Use a beautiful, large battery visualization with a restrained state
color, a clear percentage, and accessible labels. The screen should make
the next useful action obvious.

## B. Charging goals and alerts

Allow users to configure:

-   Low-charge threshold, default **20%**.
-   High-charge threshold, default **80%**.
-   Enable/disable each alert independently.
-   Native desktop notification.
-   Sound alert.
-   Flashing in-app/tray visual indicator.
-   Repeat/cooldown behavior.
-   Quiet hours and sound volume where the OS supports it.
-   Whether alerts should be enabled on battery, AC power, or both.

Validation: - Accept integer thresholds from 5--100. - Require low
threshold to be lower than high threshold. - Prevent duplicate alerts
from repeated polling. - Trigger when crossing the threshold, not
continuously while the value stays on the same side. - Add a re-arm
rule: after a high alert, re-arm only after charge falls below the high
threshold by a configurable hysteresis amount; use the equivalent rule
for low alerts. - Handle charging/discharging direction changes,
sleep/resume, battery replacement, multiple batteries, missing readings,
and abrupt percentage changes. - If the app starts while already
above/below a threshold, offer a setting for whether to alert
immediately or wait for the next crossing. - Never play sound repeatedly
or flash forever. Use a bounded, accessible animation with a clear
stop/dismiss control. - Respect system notification settings and
reduced-motion preferences.

For a high alert, the message might say: "Battery reached 80%. Unplug if
you want to follow your charging goal." Do not say that charging has
stopped unless the hardware adapter confirms it.

For a low alert: "Battery is at 20%. Consider connecting power."

## C. Actual charge-limit control

Create a dedicated **Charging** page with:

-   A prominent capability badge: Hardware control supported / Alerts
    only / Permission required / Temporarily unavailable.
-   A target slider or preset buttons such as 60%, 70%, 80%, 90%, and
    100%, constrained to the supported hardware range.
-   Optional start and stop thresholds only when the hardware exposes
    both.
-   Current configured threshold, read-back verification, and last
    applied time.
-   An explicit Apply button and a confirmation step before changing
    hardware settings.
-   A reset-to-device-default option only if the original value can be
    read and restoration is reliable.
-   Clear error messages and a safe fallback to alert-only mode.

Important: - Never simulate a real charge limit by merely displaying the
target. - Never repeatedly invoke a command that stops charging by
disconnecting power or manipulating unrelated settings. - Never disable
charging, thermal safeguards, or battery firmware protections. - Never
assume 80% is universally optimal. Present it as a common
user-selectable longevity preference, not a guarantee. - If supported
interfaces disappear or read-back fails, mark the setting as unknown and
notify the user rather than claiming success. - Test device removal,
unsupported interfaces, invalid ranges, and permission failures.

## D. Power-saving recommendations

Create a **Power** page with practical, evidence-based tips grouped by
impact and effort:

-   Reduce screen brightness when comfortable.
-   Shorten screen-off and sleep timers.
-   Use the operating system's built-in battery saver or energy-saving
    mode.
-   Prefer balanced/efficient power profiles when available.
-   Review high-energy applications using OS-provided information when
    accessible.
-   Reduce unnecessary background sync and startup apps.
-   Turn off unused Bluetooth, Wi-Fi, keyboard lighting, or peripherals
    when appropriate.
-   Disconnect unnecessary USB accessories.
-   Keep vents clear and avoid excessive heat.
-   Install OS and firmware updates from trusted official sources.
-   Avoid routinely keeping the device at extreme charge levels for long
    periods when a charge limit is supported and suits the user's usage.
-   Explain that occasional full charges may be useful for certain
    workflows or calibration procedures only when recommended by the
    device manufacturer; do not promote routine deep discharges.
-   Explain that battery wear is normal and depends on temperature,
    charge level, age, usage, and device design.

Each recommendation should contain: - What it does. - Why it may help. -
Expected impact: Low / Medium / High, only when defensible. - Effort:
Easy / Moderate. - A platform-aware "Open system settings" action where
a reliable destination is known. - An optional "Apply" action only if a
supported API exists. - A reversible change record if the app applies a
setting.

Do not promise exact extra hours or percentage gains unless a
trustworthy measurement supports the claim. Never use shame-based
language.

## E. Power profile and system settings helper

Where supported, provide a simple, safe interface for:

-   Battery saver / energy saver.
-   Balanced or efficiency-focused power profile.
-   Display timeout.
-   Sleep timeout.
-   Low battery warning level and system low-battery behavior when a
    documented API permits it.

Before changing anything: 1. Show the current value. 2. Explain the
proposed value and its consequences. 3. Ask for confirmation. 4. Apply
the change through a documented platform adapter. 5. Read back the
result. 6. Offer undo when the previous value was captured reliably.

For unsupported settings, show a direct route to the appropriate system
settings rather than pretending the app can control them.

Never change critical shutdown behavior or disable OS warnings by
default. Do not require administrator privileges for normal monitoring
and alerts.

## F. Battery health and history

If meaningful data is available, record a small local history:

-   Charge percentage.
-   Charging/discharging status.
-   Power source.
-   Full-charge capacity and design capacity, if supplied.
-   Cycle count, if supplied.
-   Battery temperature only when a trustworthy supported sensor exposes
    it.

Show useful trends without overinterpreting sparse data. If capacity
data is available, a rough capacity ratio can be displayed as an
estimate, with an explanation that vendor-reported values can vary and
are not a definitive battery diagnosis.

History controls: - Choose a retention period. - Clear history. - Export
a CSV or JSON report. - Keep data local by default. - Avoid storing
serial numbers or personally identifying hardware data unless absolutely
necessary and explicitly requested.

## G. Tray and background behavior

The app should remain useful when its main window is closed:

-   Tray/menu-bar icon with charge percentage or a simple battery state.
-   Menu actions: Open dashboard, enable/disable alerts, open charging
    settings, quit.
-   Start on login as an explicit opt-in.
-   Minimize-to-tray behavior configurable in settings.
-   Continue threshold monitoring while the process is running.
-   Handle sleep/resume and system shutdown gracefully.
-   Use a modest polling interval and platform event subscriptions when
    reliable.
-   Avoid aggressive polling that wastes power. Prefer event-driven
    updates where possible; otherwise use a reasonable interval (for
    example, 30--60 seconds) and adapt when plugged in, idle, or
    suspended.
-   Explain that alerts cannot fire while the app is fully quit or the
    OS prevents background execution.
-   Do not run a hidden permanent service without user consent.

## H. Diagnostics and help

Provide: - A system capability report. - Clear explanations for
unsupported features. - A "Copy diagnostics" button with sensitive
identifiers omitted by default. - A simple self-test for sound,
notification, and visual alert. - A help page with practical FAQs and
official OS/vendor support links. - A feedback route that does not
automatically upload diagnostics.

------------------------------------------------------------------------

# 5. UX and visual design direction

## Design concept

Create a distinctive, polished visual system named **Calm Energy**:
warm, modern, nature-inspired, and technical without looking sterile.

Use: - Warm off-white or softly tinted neutral surfaces in light mode. -
Deep ink/charcoal surfaces in dark mode. - A confident forest/emerald
green as the primary action color. - Muted teal or sky-blue for
informational states. - Warm amber for warnings. - Red only for
genuinely urgent states. - Strong contrast and restrained borders. -
Generous whitespace, consistent spacing, excellent typography, and
precise iconography. - Subtle transitions, not constant motion. - A
clear type scale and accessible hit targets. - A cohesive icon set such
as Lucide.

Avoid: - Excessive glassmorphism. - Neon gradients. - Rainbow
dashboards. - Huge empty hero areas inside a utility app. - Fake charts
or invented data. - Overuse of cards inside cards. - Unnecessary
gamification, streaks, badges, or guilt-inducing battery scores. -
Flashing effects that could be distracting or inaccessible.

## Navigation

Use a compact sidebar on larger windows and a responsive layout for
smaller windows:

1.  Overview
2.  Charging
3.  Power
4.  Battery Health
5.  Tips
6.  Settings

The first-run experience should: - Detect OS and available
capabilities. - Explain that charging-limit support depends on the
device. - Suggest default 20% low and 80% high alerts. - Let users test
a notification and sound. - Offer optional start-on-login. - Avoid
requesting elevated permissions before a specific feature requires them.

## Required states

Design and implement: - First launch/loading. - Normal battery data. -
Charging and discharging. - Battery fully charged. - No battery detected
(desktop PCs). - Battery data temporarily unavailable. - Charge control
unsupported. - Permission required. - Apply in progress. - Apply
succeeded with read-back verification. - Apply failed. - Empty
history. - Reduced-motion mode. - Light and dark themes. - Small window
and keyboard-only navigation.

All controls must work. Do not leave dead buttons, placeholder charts,
or fake toggles in the finished app.

------------------------------------------------------------------------

# 6. Accessibility and localization

-   Meet WCAG AA contrast where practical.
-   Use semantic labels and keyboard navigation.
-   Provide visible focus indicators.
-   Never communicate status by color alone.
-   Support reduced motion.
-   Allow alerts to be tested and dismissed.
-   Do not rely exclusively on sound or flashing.
-   Prepare strings for localization; start with English.
-   Use clear, concise, nontechnical language in the UI.

------------------------------------------------------------------------

# 7. Security, privacy, and reliability

-   Use Rust for privileged/platform-sensitive operations.
-   Validate all inputs at the Rust command boundary, not only in the
    frontend.
-   Keep Tauri capabilities and permissions minimal.
-   Avoid broad shell permissions.
-   Never interpolate user input into shell commands.
-   Prefer direct APIs and structured process arguments over shell
    command strings.
-   If any helper needs elevated privileges, make its scope narrow and
    auditable, document installation/uninstallation, and request
    authorization only when needed.
-   Do not collect telemetry by default.
-   Do not send battery data to a server.
-   Protect settings from corruption with versioned schemas and
    migrations.
-   Log actionable errors without secrets or hardware identifiers.
-   Use bounded retries and sensible timeouts.
-   Recover from suspend/resume and disappearing battery devices.
-   Ensure errors do not crash the tray monitor.
-   Make all configuration changes explicit and reversible where
    possible.

------------------------------------------------------------------------

# 8. Data models and interfaces

Design typed structures similar to these, adapting them to the chosen
implementation:

``` rust
struct BatterySnapshot {
    percent: Option<u8>,
    state: BatteryState,
    power_source: Option<PowerSource>,
    time_remaining_secs: Option<u64>,
    time_to_full_secs: Option<u64>,
    design_capacity_mwh: Option<u64>,
    full_charge_capacity_mwh: Option<u64>,
    cycle_count: Option<u32>,
    temperature_celsius: Option<f32>,
    observed_at: String,
}

enum BatteryState {
    Charging,
    Discharging,
    Full,
    NotCharging,
    Unknown,
}

enum CapabilityStatus {
    Supported,
    Unsupported,
    PermissionRequired,
    NotDetected,
    ReadOnly,
    Error,
}

struct ChargeLimitCapability {
    status: CapabilityStatus,
    minimum: Option<u8>,
    maximum: Option<u8>,
    current_limit: Option<u8>,
    supports_start_threshold: bool,
    supports_end_threshold: bool,
    explanation: String,
}
```

Use serialization-safe representations and handle unknown enum values
robustly. Do not expose internal platform errors directly to users;
translate them into useful messages while retaining sanitized diagnostic
details.

Create a frontend-facing API with explicit commands such as: -
`get_battery_snapshot` - `get_platform_capabilities` -
`get_charge_limit` - `set_charge_limit` - `get_power_settings` -
`apply_power_setting` - `get_app_settings` - `save_app_settings` -
`get_battery_history` - `clear_battery_history` - `export_diagnostics` -
`test_alert`

Use names that match the implemented functionality. Do not expose a
generic "execute command" Tauri endpoint.

------------------------------------------------------------------------

# 9. Alert engine design

Implement alert behavior as a testable Rust state machine, not a
collection of unrelated frontend timers.

Requirements: - Threshold-crossing detection. - Hysteresis and
re-arming. - Duplicate suppression. - Cooldown. - Charging direction
awareness. - Configurable notification channels. - Startup policy for
values already past a threshold. - Safe handling of unknown readings. -
Sleep/resume recovery. - Unit tests for boundary conditions.

The monitoring process should have a single source of truth. The UI
subscribes to typed events or refreshes snapshots; it must not
independently invent alert state.

------------------------------------------------------------------------

# 10. Testing strategy

Implement automated tests for: - Threshold validation. - Threshold
crossing. - Hysteresis and re-arming. - Duplicate alert suppression. -
Missing battery readings. - Abrupt percentage jumps. - Sleep/resume and
state changes. - Invalid charge-limit values. - Unsupported capability
behavior. - Failed apply and failed read-back. - Settings persistence
and migration. - Recommendation rules. - Platform adapter parsing. -
Rust command input validation.

Use mocked providers for deterministic tests. Add a documented manual
test matrix for: - Windows laptop. - Linux laptop with supported sysfs
thresholds. - Linux laptop without charge-control interfaces. - macOS
laptop. - Desktop PC without a battery. - Notifications disabled by OS
settings. - App startup, tray close/reopen, and suspend/resume.

Do not claim tests passed unless they were run. Record real-device
validation as pending where no device is available.

------------------------------------------------------------------------

# 11. Build and delivery

Provide: - Reproducible development instructions. - Formatting and lint
commands. - Unit and integration tests. - Production builds for Windows,
Linux, and macOS using CI runners or documented native build
requirements. - Platform-specific packaging notes. - App icon and a
coherent application identity. - A release checklist. - A README with
installation, permissions, feature support, limitations, privacy,
troubleshooting, and development instructions. -
`docs/platform-capabilities.md`. - `docs/security.md`. -
`docs/manual-test-plan.md`.

Use Tauri's official autostart, notification, tray, store, and updater
plugins only where appropriate and supported by the selected Tauri
version. Verify each plugin's platform support before relying on it.

Do not hard-code signing credentials or private updater keys. Document
signing as a release configuration step.

------------------------------------------------------------------------

# 12. Suggested implementation phases

## Phase 1: Working foundation

-   Inspect or scaffold the repository.
-   Set up Tauri, Rust, React, TypeScript, styling, linting, and tests.
-   Implement real battery monitoring on the current development OS.
-   Add typed platform capability reporting.
-   Build the dashboard and settings persistence.
-   Implement threshold alerts, sound, native notification where
    supported, and a flashing visual indicator.

## Phase 2: Hardware charging control

-   Research supported interfaces for each OS and device family.
-   Implement only safe, verifiable adapters.
-   Add capability discovery, explicit apply confirmation, read-back
    verification, and fallback states.
-   Test unsupported hardware paths as thoroughly as supported paths.

## Phase 3: Power settings and tips

-   Add recommendations and links to system settings.
-   Implement only documented, reversible system changes.
-   Add previews, confirmations, read-back checks, and undo.

## Phase 4: Tray and background monitoring

-   Add tray/menu-bar behavior.
-   Add opt-in startup launch.
-   Handle suspend/resume and monitor lifecycle.
-   Test that background monitoring does not consume excessive CPU or
    wake the system unnecessarily.

## Phase 5: Health history and polish

-   Add locally stored history only where it provides genuine value.
-   Add exports and diagnostics.
-   Complete accessibility, responsive design, error states, packaging,
    and documentation.

After each phase, run the relevant tests and leave the project in a
working state. Do not generate the entire app as a single untested code
dump.

------------------------------------------------------------------------

# 13. Definition of done

The project is not complete until:

-   The application builds in the available development environment.
-   The dashboard uses real platform data or clearly labeled mock data
    in development only.
-   Low and high alerts work without duplicate spam.
-   Sound and visual alerts can be tested from settings.
-   The app can be minimized to the tray where supported and continues
    monitoring while running.
-   Unsupported charge-limit hardware is reported honestly.
-   A charge-limit change is never reported as successful without
    appropriate verification.
-   Power-setting changes require clear consent and have safe failure
    behavior.
-   The UI works with keyboard navigation, dark mode, reduced motion,
    and small windows.
-   Tests and platform limitations are documented.
-   No important control is decorative or nonfunctional.
-   No battery metrics, energy savings, or platform capabilities are
    fabricated.

## Final instruction to the coding agent

Start by inspecting the repository and reporting a concise
implementation plan based on its actual state. Then implement **Phase 1
completely**, including a real working UI, battery data integration for
the current OS, alert engine, settings persistence, and tests. Do not
stop after producing a design mockup. Once Phase 1 is tested, proceed
through the remaining phases in manageable increments, prioritizing
correctness, safety, transparency, and excellent visual quality over
feature count.

Useful official references to verify during implementation: - Tauri v2
documentation: https://v2.tauri.app/ - Tauri plugin documentation:
https://v2.tauri.app/plugin/ - Windows battery settings:
https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/battery-settings -
Windows battery and charging design guidance:
https://learn.microsoft.com/en-us/windows-hardware/design/component-guidelines/battery-and-charging -
Microsoft Surface Battery Limit documentation (device-specific example):
https://learn.microsoft.com/en-us/surface/battery-limit

Treat these as starting points, not proof that a specific interface is
available on every device. Verify current APIs, crate maintenance,
licenses, permissions, and platform support before implementation.
