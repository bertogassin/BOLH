//! Тендерное предложение от агентства или охранника. Не привязано к конкретному заказу.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Money;

pub type BidId = Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BidderType {
    Guard,
    Agency,
}

/// Что предлагают: люди, техника, условия (упрощённо).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ServiceOffer {
    pub guard_ids: Vec<crate::GuardId>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimeRange {
    pub from_ts: i64,
    pub to_ts: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Bid {
    pub id: BidId,
    pub bidder_type: BidderType,
    pub bidder_id: Uuid,
    pub offer: ServiceOffer,
    pub price: Money,
    pub validity_period: TimeRange,
}

impl Bid {
    /// Проверка совместимости с заказом выполняется в Matching Engine:
    /// локация, время, лицензии, цена в бюджете, репутация. Участники не знают друг о друге.
    pub fn could_match_order(&self, _order: &crate::Order) -> bool {
        true
    }
}
