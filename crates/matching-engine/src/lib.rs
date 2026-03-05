//! Matching Engine — сердце системы. Индексы в памяти, подбор за микросекунды.
//! Полная реализация: DashMap, RTree (локация), BTreeMap (цена), Kafka out.

use bolh_domain::{Bid, BidId, Match, MatchStatus, Order, OrderId};
use uuid::Uuid;

/// Потенциальное совпадение заказа и предложения (до подтверждения).
#[derive(Debug, Clone)]
pub struct PotentialMatch {
    pub order_id: OrderId,
    pub bid_id: BidId,
    pub score: f64,
}

/// Движок подбора. В проде: индексы orders, bids, location_index, license_index, price_index.
pub struct MatchingEngine {
    _placeholder: (),
}

impl MatchingEngine {
    pub fn new() -> Self {
        Self { _placeholder: () }
    }

    /// Обработка нового заказа: поиск кандидатов → приоритизация → лучший match → в Kafka.
    pub fn on_new_order(&self, order: Order) -> Vec<PotentialMatch> {
        let _ = order;
        // TODO: find_candidates(order) -> partition Guard vs Agency -> select_best -> Match
        vec![]
    }

    /// Создание Match после выбора лучшего кандидата.
    pub fn create_match(
        order_id: OrderId,
        bid_id: BidId,
        bid: &Bid,
        final_price: bolh_domain::Money,
        agency_id: Option<bolh_domain::AgencyId>,
    ) -> Match {
        let guard_id = bid
            .offer
            .guard_ids
            .first()
            .copied()
            .unwrap_or(bid.bidder_id);
        Match {
            id: Uuid::new_v4(),
            order_id,
            bid_id,
            matched_guard_id: guard_id,
            final_price,
            agency_id,
            status: MatchStatus::Created,
        }
    }
}

impl Default for MatchingEngine {
    fn default() -> Self {
        Self::new()
    }
}
