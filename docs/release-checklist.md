# Release checklist

Release candidate: ____________________
Version: ____________________
Date: ____________________
Release owner: ____________________

Do not ship a build that has not passed the automated checks and the applicable
manual test cases. Compilation is not hardware validation.

## 1. Scope and version

- [ ] `package.json`, `src-tauri/tauri.conf.json`, and the Cargo workspace agree
      on the version.
- [ ] Product name is `BatteryBloom` and identifier is
      `com.batterybloom.desktop`.
- [ ] Release notes state the actual changes, not aspirational features.
- [ ] Known limitations list the unvalidated platforms and any unavailable power
      controls.
- [ ] No claim of Windows/macOS hardware validation is made without device
      evidence.
- [ ] No signing key, updater key, token, password, or private endpoint is in the
      repository or build logs.

## 2. Dependencies and licenses

- [ ] `pnpm install --frozen-lockfile` succeeds from a clean checkout.
- [ ] `cargo fetch --locked` succeeds from a clean checkout.
- [ ] `pnpm audit` and `cargo audit` have been reviewed. Accepted findings have a
      dated rationale.
- [ ] Tauri plugins are still supported by the selected Tauri version.
- [ ] The MIT license and third-party notices are appropriate for the bundled
      dependencies.

## 3. Automated quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

- [ ] All commands pass locally on the release commit.
- [ ] CI passes on Linux, Windows, and macOS runners.
- [ ] The CI build job produces installable bundles on each runner.
- [ ] The automated test count and status are recorded in the release notes or
      test log.
- [ ] The production frontend contains no development-only mock data or debug
      routes.

## 4. Security and privacy review

- [ ] No `sudo`, `pkexec`, shell interpolation, or privileged helper exists in
      the release.
- [ ] Charge-limit writes are gated by a writable capability and exact read-back.
- [ ] A failed charge-limit write attempts to restore previous values and never
      reports success.
- [ ] Settings validation runs on the Rust side.
- [ ] Export paths are validated and cannot overwrite the live history.
- [ ] Diagnostics contain no serial number, username, hostname, or file path by
      default.
- [ ] CSP and Tauri capabilities were reviewed after dependency changes.
- [ ] Notifications are opt-in and OS permission is respected.
- [ ] Autostart is off by default and reversible.
- [ ] No network/telemetry client or update feed was added without documentation
      and review.

## 5. Manual validation

Run the cases in [manual-test-plan.md](manual-test-plan.md) that apply to the
release.

- [ ] Linux reference laptop: launch, live data, alerts, quiet hours, tray,
      autostart, history, diagnostics, dark mode, reduced motion, keyboard.
- [ ] Linux laptop with writable thresholds: apply, read-back, restore, failure.
- [ ] Linux desktop without a battery: honest empty state.
- [ ] Windows laptop: core flow, notifications, tray, autostart, unsupported
      charge-limit messaging. Status: **not run here**.
- [ ] macOS laptop: core flow, menu bar, notifications, autostart, unsupported
      controls. Status: **not run here**.
- [ ] Notifications disabled by the OS.
- [ ] Suspend/resume and a multi-hour background run.
- [ ] Screen-reader pass and 200% text scaling.
- [ ] Minimum window size 760×620 and default 1180×800.

Record each result with environment, date, commit, and evidence. Do not tick a
platform box without a device run.

## 6. Packaging and signing

### Linux

```bash
pnpm tauri build --bundles deb,appimage
```

- [ ] DEB installs and launches on a clean supported distribution.
- [ ] AppImage launches with WebKitGTK available.
- [ ] Desktop entry, icon, category, and product name are correct.
- [ ] Tray works under the target desktop (GNOME AppIndicator, KDE, etc.).
- [ ] Uninstall removes binaries; user data remains unless explicitly removed.

### Windows

```bash
pnpm tauri build --bundles nsis
```

- [ ] NSIS installer installs per-user or per-machine as intended.
- [ ] WebView2 availability is handled by the installer/runtime.
- [ ] Icon, product name, publisher, and version metadata are correct.
- [ ] Signing certificate comes from CI secrets; verify the signature.
- [ ] Test on a machine without the development toolchain.

### macOS

```bash
pnpm tauri build --bundles dmg
```

- [ ] App bundle identity, icon, and version are correct.
- [ ] Developer ID signing and notarisation are configured outside the repo.
- [ ] Gatekeeper accepts the notarised DMG on a clean machine.
- [ ] Test the Intel and/or Apple-silicon artifact that is actually shipped.

### GitHub Actions release

The [release workflow](../.github/workflows/release.yml) runs on `v*` tags. It
verifies that `package.json`, `src-tauri/tauri.conf.json`, and the Cargo
workspace agree on the version before building.

- [ ] The tag matches the version (`v0.1.0` for version `0.1.0`).
- [ ] The Linux, Windows, and macOS matrix jobs all succeed on the tagged commit.
- [ ] The release is created as a draft first, unless an immediate publish was
      explicitly requested.
- [ ] Draft assets are labelled accurately: Linux packages are unsigned, the
      Windows NSIS installer is unsigned, and the macOS DMG is either
      Developer ID signed/notarised or ad-hoc signed.
- [ ] `SHA256SUMS.txt` is present and matches every uploaded artifact.
- [ ] A rerun uses the same draft state; an existing draft is not silently
      published by a mismatched `releaseDraft` value.

- [ ] Checksums are produced for every published artifact.
- [ ] Release artifacts are built from the tagged commit, not a dirty tree.
- [ ] Build logs contain no secrets or personal paths.

## 7. Publish

- [ ] Tag the exact release commit.
- [ ] Attach signed/unsigned artifacts with clear labels.
- [ ] Publish release notes, platform limitations, and checksums.
- [ ] Link the security and manual-test documents.
- [ ] Update the download page/README if the install method changes.
- [ ] Announce only validated platforms and features.

## 8. Rollback and follow-up

- [ ] Previous release remains downloadable.
- [ ] A rollback path is documented for any data/schema change.
- [ ] No destructive migration runs without a backup of prior settings.
- [ ] Post-release issues have an owner and severity.
- [ ] Pending Windows/macOS/device checks are carried into the next milestone.

## Current build evidence

Fill this section from the actual release run:

| Check                              | Result  | Date       | Notes                                                               |
| ---------------------------------- | ------- | ---------- | ------------------------------------------------------------------- |
| Frontend lint/typecheck/test/build | Passed  | 2026-10-22 | 21 Vitest tests; production main JS ~303 kB; no chunk warning       |
| Rust fmt/clippy/test               | Passed  | 2026-10-22 | 47 core tests; clippy `-D warnings` clean; workspace app tests: 0   |
| Linux production bundle            | Passed  | 2026-10-22 | DEB installed/uninstalled in build container; AppImage launched     |
| CI workflow (all runners)          | Passed  | 2026-10-22 | Run 39823780937; Linux, Windows, macOS bundle jobs succeeded        |
| Release workflow                   | Passed  | 2026-10-22 | Run 39829522662; DEB, AppImage, NSIS, universal DMG, SHA256SUMS     |
| Release checksums                  | Passed  | 2026-10-22 | Downloaded all assets; `sha256sum -c SHA256SUMS.txt` verified them  |
| Published release                  | Passed  | 2026-10-22 | `v0.1.0` published after draft review                               |
| Windows/macOS signing              | Not set | 2026-10-22 | Windows unsigned; macOS ad-hoc signed, not notarised                |
| Manual Linux matrix                | Partial | 2026-10-22 | L-01/L-02/L-04/L-07/L-09/L-13/L-15 partial; remaining cases pending |
| Manual Windows/macOS               | Not run | —          | No devices available                                                |

The Linux production binary and AppImage were launched outside the development
server and displayed live battery data and the permission-required charge state.
The DEB was installed and removed in the build container. A clean-machine
install/launch on a supported distribution remains open.
