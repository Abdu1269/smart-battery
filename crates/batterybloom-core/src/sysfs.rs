use std::fs;
use std::path::{Path, PathBuf};

use thiserror::Error;

const DEFAULT_POWER_SUPPLY_ROOT: &str = "/sys/class/power_supply";

#[derive(Debug, Error)]
pub enum SysfsError {
    #[error("power supply directory could not be read")]
    ReadFailed,
    #[error("a power supply value was invalid")]
    InvalidValue,
}

/// Small, testable façade over the Linux power_supply class.
#[derive(Debug, Clone)]
pub struct SysfsPowerSupply {
    root: PathBuf,
}

impl Default for SysfsPowerSupply {
    fn default() -> Self {
        Self {
            root: PathBuf::from(DEFAULT_POWER_SUPPLY_ROOT),
        }
    }
}

impl SysfsPowerSupply {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Returns battery directories that are present. Missing or malformed
    /// entries are skipped; a missing battery is a supported state, not a crash.
    pub fn battery_dirs(&self) -> Result<Vec<PathBuf>, SysfsError> {
        let entries = fs::read_dir(&self.root).map_err(|_| SysfsError::ReadFailed)?;
        let mut batteries = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let kind = read_trim(&path.join("type")).unwrap_or_default();
            if kind != "Battery" {
                continue;
            }
            if read_trim(&path.join("present")).as_deref() == Some("0") {
                continue;
            }
            batteries.push(path);
        }
        batteries.sort();
        Ok(batteries)
    }

    /// `Some(true)` if any mains/USB source is online, `Some(false)` when the
    /// system exposes a source that is offline, and `None` when it exposes none.
    pub fn ac_online(&self) -> Option<bool> {
        let entries = fs::read_dir(&self.root).ok()?;
        let mut found = false;
        let mut online = false;
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let kind = read_trim(&path.join("type")).unwrap_or_default();
            if !matches!(kind.as_str(), "Mains" | "USB" | "USB_C" | "USB_PD") {
                continue;
            }
            if let Some(value) = read_trim(&path.join("online")) {
                found = true;
                if value == "1" {
                    online = true;
                }
            }
        }
        found.then_some(online)
    }

    pub fn read_u8(&self, path: &Path) -> Option<u8> {
        read_trim(path)?.parse().ok()
    }

    pub fn read_u32(&self, path: &Path) -> Option<u32> {
        read_trim(path)?.parse().ok()
    }
}

pub fn read_trim(path: &Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub fn read_u8(path: &Path) -> Option<u8> {
    read_trim(path)?.parse().ok()
}

pub fn read_u64(path: &Path) -> Option<u64> {
    read_trim(path)?.parse().ok()
}

/// Test whether a sysfs attribute can be opened for writing without changing it.
pub fn is_writable(path: &Path) -> bool {
    fs::OpenOptions::new().write(true).open(path).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_present_battery_and_ac_state() {
        let dir = tempfile::tempdir().expect("tempdir");
        let bat = dir.path().join("BAT0");
        let ac = dir.path().join("AC");
        fs::create_dir_all(&bat).unwrap();
        fs::create_dir_all(&ac).unwrap();
        fs::write(bat.join("type"), "Battery\n").unwrap();
        fs::write(bat.join("present"), "1\n").unwrap();
        fs::write(ac.join("type"), "Mains\n").unwrap();
        fs::write(ac.join("online"), "1\n").unwrap();

        let sysfs = SysfsPowerSupply::new(dir.path());
        assert_eq!(sysfs.battery_dirs().unwrap(), vec![bat]);
        assert_eq!(sysfs.ac_online(), Some(true));
    }

    #[test]
    fn ignores_absent_battery() {
        let dir = tempfile::tempdir().expect("tempdir");
        let bat = dir.path().join("BAT0");
        fs::create_dir_all(&bat).unwrap();
        fs::write(bat.join("type"), "Battery\n").unwrap();
        fs::write(bat.join("present"), "0\n").unwrap();
        assert!(SysfsPowerSupply::new(dir.path())
            .battery_dirs()
            .unwrap()
            .is_empty());
    }
}
