use std::io::Write;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use chrono::Utc;
use log::warn;

use crate::error::ChargeLimitError;
use crate::models::{
    CapabilityStatus, ChargeLimitApplyResult, ChargeLimitCapability, ChargeLimitRequest,
};
use crate::settings::ChargeLimitBaseline;
use crate::sysfs::{is_writable, read_u8, SysfsPowerSupply};

pub trait ChargeLimitProvider: Send + Sync {
    fn capability(&self) -> ChargeLimitCapability;

    fn apply(
        &self,
        request: &ChargeLimitRequest,
    ) -> Result<ChargeLimitApplyResult, ChargeLimitError>;

    fn reset(
        &self,
        baseline: &ChargeLimitBaseline,
    ) -> Result<ChargeLimitApplyResult, ChargeLimitError> {
        self.apply(&ChargeLimitRequest {
            start: baseline.start,
            end: baseline.end,
            confirmed: true,
        })
    }
}

#[derive(Debug, Clone, Default)]
pub struct LinuxChargeLimitProvider {
    sysfs: SysfsPowerSupply,
}

impl LinuxChargeLimitProvider {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self {
            sysfs: SysfsPowerSupply::new(root),
        }
    }

    fn find_target(&self) -> Option<(PathBuf, PathBuf, Option<PathBuf>)> {
        let batteries = self.sysfs.battery_dirs().ok()?;
        batteries.into_iter().find_map(|dir| {
            let end = dir.join("charge_control_end_threshold");
            if !end.exists() {
                return None;
            }
            let start = dir.join("charge_control_start_threshold");
            let start = start.exists().then_some(start);
            Some((dir, end, start))
        })
    }

    fn read_capability(&self) -> ChargeLimitCapability {
        let Some((_dir, end_path, start_path)) = self.find_target() else {
            return ChargeLimitCapability {
                status: CapabilityStatus::NotDetected,
                minimum: None,
                maximum: None,
                current_start: None,
                current_end: None,
                supports_start_threshold: false,
                supports_end_threshold: false,
                reason: "No writable charge-threshold interface was found for this battery.".into(),
                next_step: Some(
                    "Use charging alerts at your preferred percentage, or check your laptop vendor's battery software."
                        .into(),
                ),
            };
        };

        let current_end = read_u8(&end_path);
        let current_start = start_path.as_deref().and_then(read_u8);
        let supports_start = start_path.is_some();
        let writable =
            is_writable(&end_path) && start_path.as_deref().map(is_writable).unwrap_or(true);

        if !writable {
            return ChargeLimitCapability {
                status: CapabilityStatus::PermissionRequired,
                minimum: Some(5),
                maximum: Some(100),
                current_start,
                current_end,
                supports_start_threshold: supports_start,
                supports_end_threshold: true,
                reason: "This laptop exposes charge thresholds, but BatteryBloom does not have permission to change them.".into(),
                next_step: Some(
                    "BatteryBloom will not run privileged commands by itself. Use it in alerts-only mode, or ask your system administrator to grant the app access through a narrowly scoped helper."
                        .into(),
                ),
            };
        }

        ChargeLimitCapability {
            status: CapabilityStatus::Supported,
            minimum: Some(5),
            maximum: Some(100),
            current_start,
            current_end,
            supports_start_threshold: supports_start,
            supports_end_threshold: true,
            reason: if supports_start {
                "This device exposes readable and writable start and end charge thresholds.".into()
            } else {
                "This device exposes a readable and writable end charge threshold.".into()
            },
            next_step: None,
        }
    }
}

impl ChargeLimitProvider for LinuxChargeLimitProvider {
    fn capability(&self) -> ChargeLimitCapability {
        self.read_capability()
    }

    fn apply(
        &self,
        request: &ChargeLimitRequest,
    ) -> Result<ChargeLimitApplyResult, ChargeLimitError> {
        validate_request(request)?;
        let Some((_dir, end_path, start_path)) = self.find_target() else {
            return Err(ChargeLimitError::Unsupported);
        };
        let capability = self.read_capability();
        if capability.status == CapabilityStatus::PermissionRequired {
            return Err(ChargeLimitError::PermissionRequired);
        }
        if capability.status != CapabilityStatus::Supported {
            return Err(ChargeLimitError::Unsupported);
        }
        if request.start.is_some() && start_path.is_none() {
            return Err(ChargeLimitError::Unsupported);
        }

        let previous_end = read_u8(&end_path);
        let previous_start = start_path.as_deref().and_then(read_u8);
        let Some(previous_end_value) = previous_end else {
            return Err(ChargeLimitError::ApplyFailed);
        };

        // End first: this keeps the pair valid if the new start is above the
        // old end. If anything fails, try to restore both values.
        if let Err(error) = write_threshold(&end_path, request.end) {
            warn!("charge end threshold write failed: {error}");
            return Err(ChargeLimitError::ApplyFailed);
        }
        if let (Some(start_path), Some(start)) = (start_path.as_deref(), request.start) {
            if let Err(error) = write_threshold(start_path, start) {
                warn!("charge start threshold write failed: {error}");
                let _ = write_threshold(&end_path, previous_end_value);
                return Err(ChargeLimitError::ApplyFailed);
            }
        }

        let verified =
            verify_readback(request.end, request.start, &end_path, start_path.as_deref());
        if !verified {
            let _ = write_threshold(&end_path, previous_end_value);
            if let (Some(path), Some(value)) = (start_path.as_deref(), previous_start) {
                let _ = write_threshold(path, value);
            }
            return Err(ChargeLimitError::VerificationFailed);
        }

        Ok(ChargeLimitApplyResult {
            start: request.start,
            end: request.end,
            verified: true,
            applied_at: Utc::now().to_rfc3339(),
            read_back_start: start_path.as_deref().and_then(read_u8),
            read_back_end: read_u8(&end_path).unwrap_or(request.end),
            previous_start,
            previous_end: Some(previous_end_value),
        })
    }
}

fn validate_request(request: &ChargeLimitRequest) -> Result<(), ChargeLimitError> {
    if !request.confirmed {
        return Err(ChargeLimitError::InvalidRange);
    }
    if !(5..=100).contains(&request.end) {
        return Err(ChargeLimitError::InvalidRange);
    }
    if let Some(start) = request.start {
        if !(5..=100).contains(&start) {
            return Err(ChargeLimitError::InvalidRange);
        }
        if start >= request.end {
            return Err(ChargeLimitError::InvalidOrdering);
        }
    }
    Ok(())
}

fn write_threshold(path: &Path, value: u8) -> std::io::Result<()> {
    let mut file = std::fs::OpenOptions::new().write(true).open(path)?;
    file.write_all(format!("{value}\n").as_bytes())?;
    file.flush()
}

fn verify_readback(
    expected_end: u8,
    expected_start: Option<u8>,
    end_path: &Path,
    start_path: Option<&Path>,
) -> bool {
    for attempt in 0..5 {
        let end_matches = read_u8(end_path) == Some(expected_end);
        let start_matches = expected_start
            .map(|start| start_path.and_then(read_u8) == Some(start))
            .unwrap_or(true);
        if end_matches && start_matches {
            return true;
        }
        if attempt < 4 {
            thread::sleep(Duration::from_millis(100));
        }
    }
    false
}

#[cfg(target_os = "linux")]
pub type PlatformChargeLimitProvider = LinuxChargeLimitProvider;

#[cfg(not(target_os = "linux"))]
pub type PlatformChargeLimitProvider = UnsupportedChargeLimitProvider;

#[derive(Debug, Default, Clone)]
pub struct UnsupportedChargeLimitProvider;

impl ChargeLimitProvider for UnsupportedChargeLimitProvider {
    fn capability(&self) -> ChargeLimitCapability {
        ChargeLimitCapability::unsupported(
            "BatteryBloom has no verified charge-limit interface for this platform. Monitoring and alerts are still available.",
            Some("Use your laptop manufacturer's battery software if it offers a supported limit."),
        )
    }

    fn apply(
        &self,
        _request: &ChargeLimitRequest,
    ) -> Result<ChargeLimitApplyResult, ChargeLimitError> {
        Err(ChargeLimitError::Unsupported)
    }
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use crate::sysfs::read_trim;
    use std::fs;

    fn fixture(writable: bool) -> (tempfile::TempDir, LinuxChargeLimitProvider) {
        let dir = tempfile::tempdir().unwrap();
        let bat = dir.path().join("BAT0");
        fs::create_dir_all(&bat).unwrap();
        fs::write(bat.join("type"), "Battery\n").unwrap();
        fs::write(bat.join("present"), "1\n").unwrap();
        fs::write(bat.join("charge_control_end_threshold"), "80\n").unwrap();
        fs::write(bat.join("charge_control_start_threshold"), "50\n").unwrap();
        if !writable {
            #[cfg(unix)]
            {
                use std::os::unix::fs::symlink;
                // A read-only proc file also rejects writes from root, unlike a
                // chmod-only fixture in a root-owned test container.
                let end = bat.join("charge_control_end_threshold");
                let start = bat.join("charge_control_start_threshold");
                fs::remove_file(&end).unwrap();
                fs::remove_file(&start).unwrap();
                symlink("/proc/version", end).unwrap();
                symlink("/proc/version", start).unwrap();
            }
        }
        let provider = LinuxChargeLimitProvider::new(dir.path());
        (dir, provider)
    }

    #[test]
    fn reports_readable_thresholds() {
        let (_dir, provider) = fixture(true);
        let capability = provider.capability();
        assert_eq!(capability.status, CapabilityStatus::Supported);
        assert_eq!(capability.current_end, Some(80));
        assert_eq!(capability.current_start, Some(50));
        assert!(capability.supports_start_threshold);
    }

    #[test]
    fn missing_battery_is_not_detected() {
        let dir = tempfile::tempdir().unwrap();
        let provider = LinuxChargeLimitProvider::new(dir.path());
        assert_eq!(provider.capability().status, CapabilityStatus::NotDetected);
    }

    #[test]
    fn readonly_thresholds_require_permission() {
        let (_dir, provider) = fixture(false);
        assert_eq!(
            provider.capability().status,
            CapabilityStatus::PermissionRequired
        );
        let error = provider
            .apply(&ChargeLimitRequest {
                start: Some(60),
                end: 80,
                confirmed: true,
            })
            .unwrap_err();
        assert!(matches!(error, ChargeLimitError::PermissionRequired));
    }

    #[test]
    fn rejects_invalid_requests() {
        let (_dir, provider) = fixture(true);
        assert!(matches!(
            provider.apply(&ChargeLimitRequest {
                start: None,
                end: 80,
                confirmed: false
            }),
            Err(ChargeLimitError::InvalidRange)
        ));
        assert!(matches!(
            provider.apply(&ChargeLimitRequest {
                start: Some(80),
                end: 80,
                confirmed: true
            }),
            Err(ChargeLimitError::InvalidOrdering)
        ));
        assert!(matches!(
            provider.apply(&ChargeLimitRequest {
                start: None,
                end: 101,
                confirmed: true
            }),
            Err(ChargeLimitError::InvalidRange)
        ));
    }

    #[test]
    fn applies_and_verifies_thresholds() {
        let (dir, provider) = fixture(true);
        let result = provider
            .apply(&ChargeLimitRequest {
                start: Some(60),
                end: 80,
                confirmed: true,
            })
            .unwrap();
        assert!(result.verified);
        assert_eq!(result.read_back_end, 80);
        assert_eq!(result.read_back_start, Some(60));
        assert_eq!(
            read_trim(&dir.path().join("BAT0/charge_control_end_threshold")).unwrap(),
            "80"
        );
    }

    #[test]
    fn readback_verification_checks_both_values() {
        let dir = tempfile::tempdir().unwrap();
        let end = dir.path().join("end");
        let start = dir.path().join("start");
        fs::write(&end, "80\n").unwrap();
        fs::write(&start, "60\n").unwrap();
        assert!(verify_readback(80, Some(60), &end, Some(&start)));
        assert!(!verify_readback(75, Some(60), &end, Some(&start)));
    }
}
