//! Охранник — лицензии, расписание, ставка, верификация.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::License;
use crate::Money;

pub type GuardId = Uuid;

/// Расписание занятости (упрощённо — JSON-совместимая структура).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AvailabilitySchedule {
    pub slots: Vec<TimeSlot>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimeSlot {
    pub start: i64,
    pub end: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Guard {
    pub id: GuardId,
    pub licenses: Vec<License>,
    pub availability: AvailabilitySchedule,
    pub rate: Money,
    pub verified: bool,
}

impl Guard {
    pub fn new(
        id: GuardId,
        licenses: Vec<License>,
        availability: AvailabilitySchedule,
        rate: Money,
        verified: bool,
    ) -> Self {
        Self {
            id,
            licenses,
            availability,
            rate,
            verified,
        }
    }
}
