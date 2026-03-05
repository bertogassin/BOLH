//! Агентство — название, верификация, охранники, комиссия.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::GuardId;

pub type AgencyId = Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Agency {
    pub id: AgencyId,
    pub name: String,
    pub verified: bool,
    pub guards: Vec<GuardId>,
    /// Доля агентства сверху (0.0..=1.0).
    pub commission_rate: f64,
}

impl Agency {
    pub fn new(
        id: AgencyId,
        name: String,
        verified: bool,
        guards: Vec<GuardId>,
        commission_rate: f64,
    ) -> Self {
        Self {
            id,
            name,
            verified,
            guards,
            commission_rate,
        }
    }
}
