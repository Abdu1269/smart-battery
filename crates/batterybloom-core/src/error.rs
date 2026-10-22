use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum BatteryError {
    #[error("battery information is not available on this device")]
    NotAvailable,
    #[error("battery information could not be read")]
    ReadFailed,
    #[error("battery information contained an unsupported value")]
    InvalidData,
}

#[derive(Debug, Error)]
pub enum ChargeLimitError {
    #[error("charge limit control is not supported on this device")]
    Unsupported,
    #[error("charge limit control requires permission that this app does not have")]
    PermissionRequired,
    #[error("the requested charge limit is outside the supported range")]
    InvalidRange,
    #[error("the start threshold must be lower than the end threshold")]
    InvalidOrdering,
    #[error("the charge limit could not be applied")]
    ApplyFailed,
    #[error("the charge limit could not be verified after it was applied")]
    VerificationFailed,
    #[error("the charge limit changed while the request was in progress")]
    ChangedConcurrently,
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("settings could not be read")]
    ReadFailed,
    #[error("settings could not be saved")]
    WriteFailed,
    #[error("settings use an unsupported schema version")]
    UnsupportedVersion,
    #[error("settings are invalid: {0}")]
    Invalid(String),
}

#[derive(Debug, Error)]
pub enum HistoryError {
    #[error("battery history could not be read")]
    ReadFailed,
    #[error("battery history could not be saved")]
    WriteFailed,
    #[error("battery history could not be exported")]
    ExportFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl CommandError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            detail: None,
        }
    }
}
