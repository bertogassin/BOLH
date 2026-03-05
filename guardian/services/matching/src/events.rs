// Real-time event processing (Kafka consumer).
// In production: consumer.recv() -> MatchingEvent -> index updates and search.

use domain::{Bid, BidId, Order};
use uuid::Uuid;

#[derive(Debug)]
pub enum MatchingEvent {
    OrderCreated(Order),
    BidCreated(Bid),
    BidUpdated(BidId, BidUpdate),
    OrderCancelled(domain::OrderId),
    BidExpired(BidId),
    MatchResponse(Uuid, MatchResponse),
    OrderCompleted(domain::OrderId),
}

#[derive(Debug, Clone)]
pub struct BidUpdate {
    pub price_per_hour: Option<rust_decimal::Decimal>,
    pub active: Option<bool>,
}

#[derive(Debug)]
pub enum MatchResponse {
    Accepted,
    Rejected,
}

/// Placeholder: in production this runs consumer.recv() loop and calls engine.handle_event().
pub async fn start_event_processor_placeholder() {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
    }
}
