// Алгоритм выбора лучшего кандидата.

use domain::{Bid, BidderType, Money, Order};
use rust_decimal::Decimal;
use std::cmp::Ordering;

use crate::models::Candidate;

/// Выбираем лучшего: свободные агенты выше агентств, затем по цене (ниже лучше).
pub fn select_best(
    mut guards: Vec<Candidate>,
    mut agencies: Vec<Candidate>,
) -> Option<Candidate> {
    guards.sort_by(cmp_candidate_by_price);
    agencies.sort_by(cmp_candidate_by_price);
    guards
        .into_iter()
        .next()
        .or_else(|| agencies.into_iter().next())
}

fn cmp_candidate_by_price(a: &Candidate, b: &Candidate) -> Ordering {
    a.bid.price.amount().cmp(&b.bid.price.amount())
}

/// Итоговая цена для клиента (с учётом комиссии платформы при необходимости).
pub fn calculate_price(order: &Order, candidate: &Candidate) -> Money {
    let price = candidate.bid.price;
    // Упрощённо: возвращаем цену предложения. В проде: + platform_fee, + agency commission.
    price
}
