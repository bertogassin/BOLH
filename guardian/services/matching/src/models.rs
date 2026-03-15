// Events and candidate models for Matching Engine.

use domain::{Bid, BidId, BidderType, GuardId, Order};
use std::sync::Arc;

pub struct OrderEvent {
    pub order: Order,
}

pub struct BidEvent {
    pub bid: Bid,
}

pub struct Candidate {
    pub bid_id: BidId,
    pub bidder_type: BidderType,
    pub guard_id: GuardId,
    pub agency_id: Option<domain::AgencyId>,
    pub bid: Arc<Bid>,
}

impl Candidate {
    pub fn from_bid(bid: &Bid) -> Self {
        Self {
            bid_id: bid.id,
            bidder_type: bid.bidder_type,
            guard_id: bid.guard_id,
            agency_id: bid.agency_id,
            bid: Arc::new(bid.clone()),
        }
    }
}
