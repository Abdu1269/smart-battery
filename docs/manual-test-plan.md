# Manual test plan

This plan covers behaviours that automated tests cannot fully prove: real battery
drivers, native notifications, tray integration, autostart, suspend/resume, and
visual/accessibility quality.

Test status must reflect evidence. Do not mark a case passed because the code
looks correct or because CI compiled it.

Last updated: 2026-10-22

## Evidence rules

For each manual case record:

- date and commit;
- operating system and version;
- desktop environment and notification daemon;
- laptop model (no serial number);
- steps performed;
- observed result;
- screenshot or diagnostics report reference where useful;
- pass/fail/blocked status.

A diagnostics report itself must be reviewed for personal data before attaching.

## Automated coverage already run

| Suite          | Command                                                    | Coverage                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rust core      | `cargo test -p batterybloom-core`                          | Alert thresholds/crossings/hysteresis/re-arm/cooldown, jumps, sleep/resume, settings migration, history, recommendations, sysfs parsing, charge-limit validation and read-back verification, power/timeout parsers |
| Rust workspace | `cargo test --workspace`                                   | Full workspace target set                                                                                                                                                                                          |
| Frontend       | `pnpm test`                                                | Formatters, thresholds, history filtering/downsampling, battery orb, chart accessibility                                                                                                                           |
| Static         | `pnpm lint`, `pnpm typecheck`, `cargo fmt`, `cargo clippy` | Style and types                                                                                                                                                                                                    |

Automated tests do not replace the device matrix.

## Environments

| ID     | Environment                                                          | Status        |
| ------ | -------------------------------------------------------------------- | ------------- |
| ENV-L1 | Ubuntu 26.04, Dell XPS 15 7590, GNOME, `BAT0`, thresholds root-owned | Available     |
| ENV-L2 | Linux laptop with writable sysfs thresholds                          | Not available |
| ENV-L3 | Linux desktop without a battery                                      | Not available |
| ENV-W1 | Windows 10/11 laptop with battery                                    | Not available |
| ENV-W2 | Windows desktop without a battery                                    | Not available |
| ENV-M1 | macOS laptop (Intel or Apple silicon)                                | Not available |

## Linux reference device

### L-01 — First launch and onboarding

1. Remove any existing BatteryBloom app-data directory in a disposable test
   profile, or use a fresh user.
2. Start the production build.
3. Confirm the onboarding window appears after the battery read.
4. Confirm the current percentage and state match the OS battery indicator.
5. Walk through steps 1–3. Try low ≥ high and confirm validation prevents
   continuing.
6. Finish setup; confirm the main window appears and the tray icon exists.

Expected: no fabricated values; settings saved; tray present; setup is keyboard
operable.

Status: **Partially passed, 2026-10-22.** A fresh app-data profile launched the
production AppImage into the Welcome step and showed live, matching battery data
(30% charging, 67.7% design ratio). “Skip for now” saved settings and opened the
Overview with a confirmation toast. The running process registered an active
StatusNotifierItem titled `batterybloom`. The full three-step path, threshold
validation, and complete keyboard-only traversal were not exercised.

### L-02 — Live dashboard accuracy

1. Compare the percentage, charging state, and power source with
   `upower -i $(upower -e | grep BAT)` and the desktop indicator.
2. Plug and unplug the charger. Wait at least one refresh interval.
3. Confirm the dashboard and tray status update without restarting.
4. Compare capacity vs design with sysfs/UPower values. Confirm missing cycle
   count and temperature render as “Not reported”/“—”.

Expected: values match the OS; missing values are not estimated.

Status: **Partially passed, 2026-10-22.** The production Linux build showed
29–33% discharging, then 20% on battery and 22% charging after the charger was
connected, without restarting. Capacity vs design was 67.7%, time-left/until-full
estimates were present, and cycle count/temperature remained unavailable rather
than being estimated. Real samples were written to history. Tray label text was
not independently inspected.

### L-03 — Low reminder, hysteresis, and deduplication

1. In Settings, set low threshold above the current charge (for example 90%),
   high threshold 100%, hysteresis 2, cooldown 1 minute, quiet hours off.
2. Enable visual, sound, and native notification channels.
3. Wait for the next sample.
4. Confirm exactly one low alert appears. Do not dismiss it.
5. Wait several refresh cycles. Confirm no repeated low alert.
6. Set the low threshold below the current charge, then above it again after the
   cooldown. Confirm it can fire again only after re-arming.
7. Plug in and charge above the threshold + hysteresis, then discharge below it
   again. Confirm a new crossing can fire after the cooldown.

Expected: edge-triggered behaviour, no spam, and clear visual/native channels.

Status: **Pending** (Rust state-machine portions covered by automated tests)

### L-04 — High goal is a reminder, not a limit

1. Set high threshold below the current charge, enable the high goal and
   `Alert for current state` startup policy.
2. Confirm the high alert says the charging goal is reached and does not claim
   charging stopped.
3. On a device with no writable limit, confirm the Charging page shows
   unsupported/permission-required and offers the reminder instead.

Expected: no false claim of hardware control; wording distinguishes reminder from
limit.

Status: **Partially passed, 2026-10-22.** The Charging page showed
**Permission needed**, explained that the interface exists but is not writable,
and offered the high-charge reminder. The low-reminder presentation was also
visible on the Overview. The live high-alert notification path was not triggered
in this run.

### L-05 — Quiet hours and channels

1. Enable quiet hours with a window covering the current local time.
2. Trigger a low alert.
3. Confirm the in-app banner still appears, while native notification and chime
   are suppressed, and the banner notes quiet hours.
4. Disable visual alerts and repeat; confirm a native notification/chime can
   still fire if enabled.
5. Disable all channels; confirm the alert state still advances without UI or
   sound. Re-enable channels and confirm no backlog of duplicate alerts.

Expected: channel isolation; no queued spam.

Status: **Pending**

### L-06 — Notification permission and test

1. Open Settings → How alerts arrive.
2. Use **Send test notification**.
3. Grant permission if prompted; confirm the notification arrives.
4. Disable notifications in the OS settings and repeat.
5. Confirm BatteryBloom reports a failure or blocked state without crashing.
6. Re-enable OS permission and test again.

Expected: OS-controlled permission is respected; in-app channels remain usable.

Status: **Pending**

### L-07 — Charge limit on the reference laptop

1. Open Charging.
2. Confirm the capability badge says **Permission needed**.
3. Confirm the reason mentions the threshold exists but is not writable and that
   no privileged command was attempted.
4. Confirm the high reminder remains available.
5. Use **See platform notes** / Help and confirm the explanation matches.
6. Inspect the app process list; confirm no helper or `sudo` process is spawned.

Expected: no write, no escalation, honest UI.

Status: **Partially passed, 2026-10-22.** The permission badge and explanation
were visible, the high reminder remained available, and sysfs still read
`50–80`. The running process tree contained only `batterybloom-release`; no
helper, `sudo`, or `pkexec` process was observed. The Help/platform-notes action
was not opened in this run.

### L-08 — Charge limit on writable hardware

Requires ENV-L2.

1. Record the original start/end thresholds independently.
2. Set a verified limit, for example 55–75%.
3. Confirm the UI reports the read-back values and the sysfs files match.
4. Quit/reopen; confirm settings and current values persist.
5. Restore previous values; confirm sysfs returns to the original values.
6. Simulate a failed verification (if a safe fixture/driver is available) and
   confirm the previous values are restored and no success is shown.
7. Change the sysfs value concurrently during an apply and confirm the operation
   fails rather than retrying blindly.

Expected: baseline, exact read-back, restore, honest failure.

Status: **Pending — no writable device available**

### L-09 — Tray and close behaviour

1. Close the window with the X button while close-to-tray is enabled.
2. Confirm the window hides, the process remains, and monitoring continues.
3. Click the tray icon: confirm the window shows and focuses.
4. Use tray menu → Charging settings; confirm the Charging page opens.
5. Toggle Charging alerts from the tray; confirm the settings event updates the
   UI and no settings are lost.
6. Disable close-to-tray, close the window, and confirm the app exits.
7. Use tray → Quit and confirm a clean exit.

Expected: predictable tray lifecycle; no zombie process; quit works.

Status: **Partially passed, 2026-10-22.** The running AppImage registered an
active `StatusNotifierItem` titled `batterybloom`, and its menu exposed a live
“Battery 35% · Charging · 1h 17m until full” status, Open BatteryBloom, Charging
settings, a checked Charging alerts toggle, and Quit. Activating “Charging
settings” opened the Charging page in the running window. Close-to-tray, alert
toggling, quit, and relaunch were not exercised.

### L-10 — Launch at login

1. Enable **Start when I sign in** and save.
2. Inspect the XDG autostart entry (`~/.config/autostart/`) without exposing it
   in a public report.
3. Log out/in or start a disposable session; confirm BatteryBloom starts.
4. With **Start hidden**, confirm it opens to the tray.
5. Disable the option and confirm the entry is removed.

Expected: explicit opt-in, reversible, no hidden persistence.

Status: **Pending**

### L-11 — Power profile and undo

1. Open Power. Confirm the current profile matches
   `powerprofilesctl get`.
2. Select a different available profile and apply.
3. Confirm the UI and `powerprofilesctl get` match.
4. Use **Undo last change**; confirm the previous profile is restored and the
   undo action disappears.
5. Try applying an unavailable profile; confirm it is not offered.

Expected: only advertised profiles, verified read-back, reversible.

Status: **Pending**

### L-12 — GNOME timeouts and undo

1. Note current display and sleep timeout values.
2. Change display timeout only; confirm the read-back and GNOME Settings match.
3. Change sleep timeout only; confirm the read-back.
4. Undo the last change; confirm the previous value.
5. Change both in one save; confirm both apply and the last undo restores the
   most recent recorded change.
6. On a non-GNOME desktop, confirm the controls are reported unsupported.

Expected: no invented options; verified changes; clear undo semantics.

Status: **Pending**

### L-13 — History, chart, and export

1. Leave the app running for at least three sampling intervals.
2. Open History; confirm the range filters, summary, chart, and table agree.
3. Change sampling and retention in Settings; save; confirm new samples follow
   the interval.
4. Export CSV and JSON to a temporary directory. Confirm absolute paths only and
   that the live history file cannot be chosen as the destination.
5. Confirm exports contain no serial number, username, hostname, or path fields.
6. Clear history; confirm the chart and table empty and the confirmation dialog
   is not decorative.

Expected: real samples only; local export; clear is destructive and confirmed.

Status: **Partially passed, 2026-10-22.** History displayed four real samples,
a chart, range summary, and table consistent with the Overview. Export, retention
changes, and clearing were not exercised in this run.

### L-14 — Diagnostics privacy

1. Settings → View diagnostics.
2. Inspect the JSON for serial number, username, hostname, home directory, and
   file paths.
3. Copy and save the report. Confirm "Save JSON" uses an absolute path chosen by
   the user.
4. Confirm the report contains battery values, capabilities, settings, and no
   account identifier.

Expected: no identifiers by default; user-initiated only.

Status: **Pending**

### L-15 — Theme, reduced motion, and scaling

1. Set theme to Light, Dark, and System; confirm the window and native form
   controls follow.
2. Change the OS dark-mode setting while System is selected; confirm live update.
3. Enable OS reduced motion; confirm breathing/pulse/rise animations are
   effectively removed.
4. Set 200% text scaling or a large font; confirm no clipped buttons or
   unreadable chart labels.
5. Check the small minimum window (760×620) and the default 1180×800.

Expected: no horizontal page overflow; readable contrast; motion respects the OS.

Status: **Partially passed, 2026-10-22.** Dark mode rendered correctly at the
default 1180×800 window in the production build. Light/system switching, reduced
motion, 200% scaling, and the 760×620 minimum window remain pending.

### L-16 — Keyboard and screen reader

1. Navigate every page with Tab/Shift+Tab, Enter/Space, arrow keys on sliders,
   and Escape in dialogs.
2. Confirm the skip link appears and moves focus to main content.
3. Confirm dialogs trap focus and return focus to the trigger.
4. Confirm status is not conveyed by colour alone.
5. With Orca (Linux) or another screen reader, confirm the battery orb accessible
   name, chart summary, switches, and error alerts are announced.

Expected: all controls reachable and understandable without a pointer.

Status: **Pending**

### L-17 — Suspend and resume

1. Leave the app monitoring on battery.
2. Suspend the laptop for at least twice the refresh interval.
3. Resume and wait for a sample.
4. Confirm the app does not crash, does not emit a burst of stale alerts, and
   resumes history sampling.
5. Change power source while suspended (if practical) and confirm the next sample
   reflects reality.

Expected: `on_resume` recovery; no duplicate backlog.

Status: **Pending** (engine portion covered by automated tests)

### L-18 — Long-running behaviour and malformed settings

1. Leave the app running for several hours with a short interval.
2. Check CPU usage and log growth; confirm no runaway polling or repeated alert
   spam.
3. Quit, corrupt `settings.json` with a backup copy, and restart.
4. Confirm defaults load, a warning is shown, and the malformed file is backed up
   rather than silently lost.
5. Confirm settings save remains atomic during a forced quit.

Expected: bounded resources; honest recovery.

Status: **Pending** (settings recovery covered by Rust tests)

### L-19 — No battery state

Requires ENV-L3 or a VM/desktop without a battery.

1. Launch the app.
2. Confirm the Overview empty state explains that no battery was detected and
   will keep checking.
3. Confirm no fake percentage, health, runtime, or alerts appear.
4. Confirm diagnostics report `battery: null` or an unavailable snapshot.

Expected: honest empty state.

Status: **Pending**

## Windows

### W-01 — Core laptop flow

On a Windows 10/11 laptop with a battery:

1. Launch the installed build.
2. Compare percentage/state with Windows battery flyout.
3. Complete onboarding and trigger low/high alerts.
4. Test native notifications, tray menu, close-to-tray, and startup.
5. Confirm charge limit and power-profile areas report unsupported, not fake
   controls.
6. Export history and diagnostics; inspect for identifiers.
7. Test at 125–200% display scaling and with keyboard only.

Status: **Pending — no Windows device available**

### W-02 — Desktop without a battery

Confirm an honest empty state and no alerts. Status: **Pending**.

## macOS

### M-01 — Core laptop flow

On a macOS laptop:

1. Launch the unsigned development build.
2. Compare battery state with the menu bar.
3. Trigger alerts; test notification permission.
4. Test menu-bar icon, close behaviour, and launch at login.
5. Confirm charge limit, power profiles, and timers report unsupported.
6. Test dark mode, reduced motion, full keyboard access, and VoiceOver.
7. Export diagnostics; confirm no identifiers.

Status: **Pending — no macOS device available**

### M-02 — Signing and notarisation

Release configuration only. Confirm a signed and notarised DMG launches on a
clean machine. Status: **Pending**.

## Results log

| Case | Date       | Commit      | Environment | Result  | Evidence/notes                                                          |
| ---- | ---------- | ----------- | ----------- | ------- | ----------------------------------------------------------------------- |
| L-01 | 2026-10-22 | uncommitted | ENV-L1      | Partial | AppImage onboarding; live 30% charging; skip saved settings             |
| L-02 | 2026-10-22 | uncommitted | ENV-L1      | Partial | Release binary; 20% battery→22% AC, no restart; 67.7% capacity          |
| L-03 |            |             | ENV-L1      | Pending |                                                                         |
| L-04 | 2026-10-22 | uncommitted | ENV-L1      | Partial | Permission-needed and reminder UI only                                  |
| L-05 |            |             | ENV-L1      | Pending |                                                                         |
| L-06 |            |             | ENV-L1      | Pending |                                                                         |
| L-07 | 2026-10-22 | uncommitted | ENV-L1      | Partial | No write; sysfs 50/80; no helper process                                |
| L-08 |            |             | ENV-L2      | Blocked | No writable threshold device                                            |
| L-09 | 2026-10-22 | uncommitted | ENV-L1      | Partial | Tray menu live status; Charging action opened page; close/quit untested |
| L-10 |            |             | ENV-L1      | Pending |                                                                         |
| L-11 |            |             | ENV-L1      | Pending |                                                                         |
| L-12 |            |             | ENV-L1      | Pending |                                                                         |
| L-13 | 2026-10-22 | uncommitted | ENV-L1      | Partial | Four real samples, chart and table shown                                |
| L-14 |            |             | ENV-L1      | Pending |                                                                         |
| L-15 | 2026-10-22 | uncommitted | ENV-L1      | Partial | Dark mode at 1180×800; rest pending                                     |
| L-16 |            |             | ENV-L1      | Pending |                                                                         |
| L-17 |            |             | ENV-L1      | Pending |                                                                         |
| L-18 |            |             | ENV-L1      | Pending |                                                                         |
| L-19 |            |             | ENV-L3      | Blocked | No desktop/VM without battery configured                                |
| W-01 |            |             | ENV-W1      | Blocked | No Windows device                                                       |
| W-02 |            |             | ENV-W2      | Blocked | No Windows device                                                       |
| M-01 |            |             | ENV-M1      | Blocked | No macOS device                                                         |
| M-02 |            |             | —           | Blocked | Signing credentials unavailable                                         |
