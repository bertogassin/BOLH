//! Результат работы алгоритма подбора — связка заказ + предложение + охранник.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AgencyId;
use crate::BidId;
use crate::GuardId;
use crate::Money;
use crate::OrderId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MatchStatus {
    Created,
    AcceptedByGuard,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Match {
    pub id: Uuid,
    pub order_id: OrderId,
    pub bid_id: BidId,
    pub matched_guard_id: GuardId,
    pub final_price: Money,
    pub agency_id: Option<AgencyId>,
    pub status: MatchStatus,
}
