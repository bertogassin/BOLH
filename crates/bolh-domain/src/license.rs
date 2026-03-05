//! Лицензия охранника — тип, верификация, срок.

use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};

use crate::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseType {
    Weapon,
    Medical,
    Security,
    Other,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct License {
    pub license_type: LicenseType,
    pub verified: bool,
    pub expiry_date: NaiveDate,
}

impl License {
    pub fn new(
        license_type: LicenseType,
        verified: bool,
        expiry_date: NaiveDate,
    ) -> Result<Self, DomainError> {
        if expiry_date.year() < 2000 {
            return Err(DomainError::InvalidLicense(
                "expiry_date too far in past".into(),
            ));
        }
        Ok(Self {
            license_type,
            verified,
            expiry_date,
        })
    }

    pub fn is_expired(&self, as_of: NaiveDate) -> bool {
        self.expiry_date < as_of
    }
}
