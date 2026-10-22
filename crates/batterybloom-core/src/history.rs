use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, Utc};
use log::warn;
use serde::{Deserialize, Serialize};

use crate::error::HistoryError;
use crate::models::{BatterySnapshot, BatteryState, PowerSource};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRecord {
    pub observed_at: String,
    pub percent: u8,
    pub state: BatteryState,
    pub power_source: Option<PowerSource>,
    pub full_charge_capacity_mwh: Option<u64>,
    pub design_capacity_mwh: Option<u64>,
    pub cycle_count: Option<u32>,
    pub temperature_celsius: Option<f32>,
}

impl HistoryRecord {
    pub fn from_snapshot(snapshot: &BatterySnapshot) -> Option<Self> {
        Some(Self {
            observed_at: snapshot.observed_at.clone(),
            percent: snapshot.percent?,
            state: snapshot.state,
            power_source: snapshot.power_source,
            full_charge_capacity_mwh: snapshot.full_charge_capacity_mwh,
            design_capacity_mwh: snapshot.design_capacity_mwh,
            cycle_count: snapshot.cycle_count,
            temperature_celsius: snapshot.temperature_celsius,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryExportResult {
    pub path: String,
    pub format: String,
    pub records: usize,
}

#[derive(Debug, Clone)]
pub struct HistoryStore {
    path: PathBuf,
}

impl HistoryStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<Vec<HistoryRecord>, HistoryError> {
        if !self.path.exists() {
            return Ok(Vec::new());
        }
        let file = fs::File::open(&self.path).map_err(|_| HistoryError::ReadFailed)?;
        let reader = BufReader::new(file);
        let mut records = Vec::new();
        for line in reader.lines() {
            let Ok(line) = line else { continue };
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<HistoryRecord>(&line) {
                Ok(record) => records.push(record),
                Err(error) => warn!("skipping malformed history record: {error}"),
            }
        }
        records.sort_by(|a, b| a.observed_at.cmp(&b.observed_at));
        Ok(records)
    }

    pub fn append(&self, record: &HistoryRecord, retention_days: u16) -> Result<(), HistoryError> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|_| HistoryError::WriteFailed)?;
        }
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .map_err(|_| HistoryError::WriteFailed)?;
        serde_json::to_writer(&mut file, record).map_err(|_| HistoryError::WriteFailed)?;
        file.write_all(b"\n")
            .map_err(|_| HistoryError::WriteFailed)?;
        file.flush().map_err(|_| HistoryError::WriteFailed)?;
        self.prune(retention_days)
    }

    pub fn prune(&self, retention_days: u16) -> Result<(), HistoryError> {
        if !self.path.exists() {
            return Ok(());
        }
        let cutoff = Utc::now() - Duration::days(i64::from(retention_days));
        let records = self.load()?;
        let filtered: Vec<&HistoryRecord> = records
            .iter()
            .filter(|record| {
                DateTime::parse_from_rfc3339(&record.observed_at)
                    .map(|timestamp| timestamp.with_timezone(&Utc) >= cutoff)
                    .unwrap_or(false)
            })
            .collect();
        if filtered.len() == records.len() {
            return Ok(());
        }
        let temp = self.path.with_extension("jsonl.tmp");
        {
            let mut file = fs::File::create(&temp).map_err(|_| HistoryError::WriteFailed)?;
            for record in filtered {
                serde_json::to_writer(&mut file, record).map_err(|_| HistoryError::WriteFailed)?;
                file.write_all(b"\n")
                    .map_err(|_| HistoryError::WriteFailed)?;
            }
            file.sync_all().map_err(|_| HistoryError::WriteFailed)?;
        }
        if fs::rename(&temp, &self.path).is_err() {
            let _ = fs::remove_file(&self.path);
            fs::rename(&temp, &self.path).map_err(|_| HistoryError::WriteFailed)?;
        }
        Ok(())
    }

    pub fn clear(&self) -> Result<(), HistoryError> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(HistoryError::WriteFailed),
        }
    }

    pub fn export_json(&self, target: &Path) -> Result<HistoryExportResult, HistoryError> {
        let records = self.load()?;
        let payload =
            serde_json::to_vec_pretty(&records).map_err(|_| HistoryError::ExportFailed)?;
        fs::write(target, payload).map_err(|_| HistoryError::ExportFailed)?;
        Ok(HistoryExportResult {
            path: target.display().to_string(),
            format: "json".into(),
            records: records.len(),
        })
    }

    pub fn export_csv(&self, target: &Path) -> Result<HistoryExportResult, HistoryError> {
        let records = self.load()?;
        let mut output = String::from(
            "observed_at,percent,state,power_source,full_charge_capacity_mwh,design_capacity_mwh,cycle_count,temperature_celsius\n",
        );
        for record in &records {
            output.push_str(&format!(
                "{},{},{},{},{},{},{},{}\n",
                record.observed_at,
                record.percent,
                state_label(record.state),
                power_source_label(record.power_source),
                record
                    .full_charge_capacity_mwh
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                record
                    .design_capacity_mwh
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                record
                    .cycle_count
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                record
                    .temperature_celsius
                    .map(|value| format!("{value:.1}"))
                    .unwrap_or_default(),
            ));
        }
        fs::write(target, output).map_err(|_| HistoryError::ExportFailed)?;
        Ok(HistoryExportResult {
            path: target.display().to_string(),
            format: "csv".into(),
            records: records.len(),
        })
    }
}

fn state_label(state: BatteryState) -> &'static str {
    match state {
        BatteryState::Charging => "charging",
        BatteryState::Discharging => "discharging",
        BatteryState::Full => "full",
        BatteryState::NotCharging => "notCharging",
        BatteryState::Unknown => "unknown",
    }
}

fn power_source_label(source: Option<PowerSource>) -> &'static str {
    match source {
        Some(PowerSource::Ac) => "ac",
        Some(PowerSource::Battery) => "battery",
        Some(PowerSource::Unknown) => "unknown",
        None => "",
    }
}

/// Record when the state changes or after the configured interval. A five-point
/// jump is also worth recording, but repeated 30-second polls are not.
pub fn should_record(
    previous: Option<&HistoryRecord>,
    current: &HistoryRecord,
    interval_minutes: u16,
) -> bool {
    let Some(previous) = previous else {
        return true;
    };
    if previous.state != current.state || previous.power_source != current.power_source {
        return true;
    }
    if previous.percent.abs_diff(current.percent) >= 5 {
        return true;
    }
    let Ok(previous_time) = DateTime::parse_from_rfc3339(&previous.observed_at) else {
        return true;
    };
    let Ok(current_time) = DateTime::parse_from_rfc3339(&current.observed_at) else {
        return true;
    };
    current_time - previous_time >= Duration::minutes(i64::from(interval_minutes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn record(percent: u8, minute: i64, state: BatteryState) -> HistoryRecord {
        let time = Utc.with_ymd_and_hms(2026, 1, 1, 12, 0, 0).unwrap() + Duration::minutes(minute);
        HistoryRecord {
            observed_at: time.to_rfc3339(),
            percent,
            state,
            power_source: Some(PowerSource::Battery),
            full_charge_capacity_mwh: Some(50_000),
            design_capacity_mwh: Some(60_000),
            cycle_count: Some(120),
            temperature_celsius: None,
        }
    }

    #[test]
    fn appends_and_loads_records() {
        let dir = tempfile::tempdir().unwrap();
        let store = HistoryStore::new(dir.path().join("history.jsonl"));
        store
            .append(&record(80, 0, BatteryState::Discharging), 365)
            .unwrap();
        store
            .append(&record(79, 5, BatteryState::Discharging), 365)
            .unwrap();
        let records = store.load().unwrap();
        assert_eq!(records.len(), 2);
        assert_eq!(records[1].percent, 79);
    }

    #[test]
    fn clears_history() {
        let dir = tempfile::tempdir().unwrap();
        let store = HistoryStore::new(dir.path().join("history.jsonl"));
        store
            .append(&record(80, 0, BatteryState::Discharging), 365)
            .unwrap();
        store.clear().unwrap();
        assert!(store.load().unwrap().is_empty());
    }

    #[test]
    fn skips_malformed_lines() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");
        fs::write(
            &path,
            format!(
                "{}\nnot-json\n",
                serde_json::to_string(&record(70, 0, BatteryState::Discharging)).unwrap()
            ),
        )
        .unwrap();
        let records = HistoryStore::new(&path).load().unwrap();
        assert_eq!(records.len(), 1);
    }

    #[test]
    fn exports_csv_without_serial_or_identity_fields() {
        let dir = tempfile::tempdir().unwrap();
        let store = HistoryStore::new(dir.path().join("history.jsonl"));
        store
            .append(&record(75, 0, BatteryState::Discharging), 365)
            .unwrap();
        let target = dir.path().join("out.csv");
        let result = store.export_csv(&target).unwrap();
        assert_eq!(result.records, 1);
        let content = fs::read_to_string(target).unwrap();
        assert!(content.contains("observed_at,percent,state"));
        assert!(!content.to_lowercase().contains("serial"));
    }

    #[test]
    fn sampling_throttles_repeated_polls() {
        let previous = record(70, 0, BatteryState::Discharging);
        let same = record(70, 1, BatteryState::Discharging);
        let changed = record(64, 1, BatteryState::Discharging);
        assert!(!should_record(Some(&previous), &same, 5));
        assert!(should_record(Some(&previous), &changed, 5));
        let later = record(69, 6, BatteryState::Discharging);
        assert!(should_record(Some(&previous), &later, 5));
    }

    #[test]
    fn samples_state_changes_immediately() {
        let previous = record(70, 0, BatteryState::Discharging);
        let charging = record(70, 1, BatteryState::Charging);
        assert!(should_record(Some(&previous), &charging, 5));
    }
}
