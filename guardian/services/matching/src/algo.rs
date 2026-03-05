// Best-candidate selection algorithm.

use domain::{Bid, BidderType, Money, Order};
use rust_decimal::Decimal;
use std::cmp::Ordering;

use crate::models::Candidate;

/// Select best candidate: free guards are prioritized, then lower price wins.
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

/// Final client price (platform/agency fee can be applied when needed).
pub fn calculate_price(order: &Order, candidate: &Candidate) -> Money {
    let price = candidate.bid.price;
    // Simplified: return bid price. In production: + platform_fee, + agency commission.
    price
}
