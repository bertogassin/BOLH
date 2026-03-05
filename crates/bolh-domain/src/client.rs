//! Клиент — сущность с репутационным скорингом.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type ClientId = Uuid;

/// Скоринг на основе истории заказов (упрощённо — число).
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct ReputationScore(pub f64);

impl ReputationScore {
    pub const fn min() -> Self {
        Self(0.0)
    }
    pub const fn max() -> Self {
        Self(1.0)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Client {
    pub id: ClientId,
    pub reputation: ReputationScore,
}

impl Client {
    pub fn new(id: ClientId, reputation: ReputationScore) -> Self {
        Self { id, reputation }
    }
}
