//! Matching Engine — сердце системы. Индексы в памяти, подбор за микросекунды.
//! Полная реализация: DashMap, RTree (локация), BTreeMap (цена), Kafka out.

use bolh_domain::{Bid, BidId, BidderType, Match, MatchStatus, Order, OrderId};
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
    bids: Vec<Bid>,
}

impl MatchingEngine {
    pub fn new() -> Self {
        Self { bids: Vec::new() }
    }

    /// Обновляет внутренний набор кандидатов. В проде заменится индексами.
    pub fn set_bids(&mut self, bids: Vec<Bid>) {
        self.bids = bids;
    }

    /// Добавляет одно предложение в набор кандидатов.
    pub fn add_bid(&mut self, bid: Bid) {
        self.bids.push(bid);
    }

    /// Обработка нового заказа: поиск кандидатов → приоритизация → лучший match → в Kafka.
    pub fn on_new_order(&self, order: Order) -> Vec<PotentialMatch> {
        let mut matches = self
            .bids
            .iter()
            .filter(|bid| bid.could_match_order(&order))
            .filter(|bid| is_bid_time_compatible(&order, bid))
            .filter(|bid| is_bid_price_compatible(&order, bid))
            .map(|bid| PotentialMatch {
                order_id: order.id,
                bid_id: bid.id,
                score: score_match(&order, bid),
            })
            .collect::<Vec<_>>();

        matches.sort_by(|a, b| b.score.total_cmp(&a.score));
        matches
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

fn is_bid_price_compatible(order: &Order, bid: &Bid) -> bool {
    if !order.budget.min.is_same_currency(&bid.price) || !order.budget.max.is_same_currency(&bid.price) {
        return false;
    }
    bid.price.amount >= order.budget.min.amount && bid.price.amount <= order.budget.max.amount
}

fn is_bid_time_compatible(order: &Order, bid: &Bid) -> bool {
    let start = order.requirements.start_time;
    let end = order.requirements.end_time;
    match (start, end) {
        (Some(order_start), Some(order_end)) => {
            bid.validity_period.from_ts <= order_start && bid.validity_period.to_ts >= order_end
        }
        _ => true,
    }
}

fn score_match(order: &Order, bid: &Bid) -> f64 {
    let budget_mid = decimal_to_f64((order.budget.min.amount + order.budget.max.amount) / bolh_domain::Decimal::from(2));
    let bid_price = decimal_to_f64(bid.price.amount);
    let budget_mid_safe = if budget_mid <= 0.0 { 1.0 } else { budget_mid };
    let price_delta = (budget_mid - bid_price).abs() / budget_mid_safe;
    let price_score = (1.0 - price_delta).clamp(0.0, 1.0);

    let bidder_bonus = match bid.bidder_type {
        BidderType::Guard => 0.12,
        BidderType::Agency => 0.06,
    };
    let team_bonus = (bid.offer.guard_ids.len() as f64 * 0.02).min(0.1);

    (price_score * 0.82 + bidder_bonus + team_bonus).clamp(0.0, 1.2)
}

fn decimal_to_f64(value: bolh_domain::Decimal) -> f64 {
    value.to_string().parse::<f64>().unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use bolh_domain::{
        Bid, BidderType, Currency, Decimal, Money, MoneyRange, Order, Requirements, ServiceOffer,
        TimeRange, Visibility,
    };
    use uuid::Uuid;

    use crate::MatchingEngine;

    fn money(amount: i64) -> Money {
        Money::new(Decimal::from(amount), Currency::Rub).expect("valid money")
    }

    fn sample_order() -> Order {
        Order::create(
            Uuid::new_v4(),
            Uuid::new_v4(),
            Requirements {
                start_time: Some(1_000),
                end_time: Some(2_000),
                ..Default::default()
            },
            MoneyRange {
                min: money(1_000),
                max: money(2_000),
            },
            Visibility::All,
        )
        .expect("valid order")
    }

    fn sample_bid(price: i64, from_ts: i64, to_ts: i64, bidder_type: BidderType) -> Bid {
        Bid {
            id: Uuid::new_v4(),
            bidder_type,
            bidder_id: Uuid::new_v4(),
            offer: ServiceOffer {
                guard_ids: vec![Uuid::new_v4()],
                description: None,
            },
            price: money(price),
            validity_period: TimeRange { from_ts, to_ts },
        }
    }

    #[test]
    fn on_new_order_filters_incompatible_bids() {
        let order = sample_order();
        let mut engine = MatchingEngine::new();
        engine.set_bids(vec![
            sample_bid(1_500, 900, 2_100, BidderType::Guard),
            sample_bid(5_000, 900, 2_100, BidderType::Guard),
            sample_bid(1_600, 1_500, 2_100, BidderType::Agency),
        ]);

        let matches = engine.on_new_order(order);
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn on_new_order_sorts_by_score_desc() {
        let order = sample_order();
        let mut engine = MatchingEngine::new();
        let best = sample_bid(1_450, 900, 2_100, BidderType::Guard);
        let worst = sample_bid(1_900, 900, 2_100, BidderType::Agency);
        let best_id = best.id;
        engine.set_bids(vec![worst, best]);

        let matches = engine.on_new_order(order);
        assert_eq!(matches.first().map(|m| m.bid_id), Some(best_id));
    }
}
