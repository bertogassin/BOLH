// services/matching/src/main.rs
// Matching Engine - Rust, in-memory, microsecond-level latency.

use dashmap::DashMap;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info};

mod algo;
mod config;
mod events;
mod index;
mod models;
mod sharding;

use domain::{Bid, BidId, BidderType, Match, Order, OrderId};
use index::{LicenseIndex, PriceIndex, SpatialIndex};
use models::{BidEvent, Candidate, OrderEvent};

struct MatchingEngine {
    orders: DashMap<OrderId, Order>,
    bids: DashMap<BidId, Bid>,
    spatial_index: Arc<DashMap<BidId, domain::GeoPoint>>,
    license_index: Arc<std::sync::RwLock<LicenseIndex>>,
    price_index: Arc<std::sync::RwLock<PriceIndex>>,
    order_rx: mpsc::Receiver<OrderEvent>,
    bid_rx: mpsc::Receiver<BidEvent>,
    match_tx: mpsc::Sender<Match>,
}

impl MatchingEngine {
    pub fn new(
        order_rx: mpsc::Receiver<OrderEvent>,
        bid_rx: mpsc::Receiver<BidEvent>,
        match_tx: mpsc::Sender<Match>,
    ) -> Self {
        Self {
            orders: DashMap::new(),
            bids: DashMap::new(),
            spatial_index: Arc::new(DashMap::new()),
            license_index: Arc::new(std::sync::RwLock::new(LicenseIndex::new())),
            price_index: Arc::new(std::sync::RwLock::new(PriceIndex::new())),
            order_rx,
            bid_rx,
            match_tx,
        }
    }

    pub async fn run(mut self) {
        loop {
            tokio::select! {
                Some(event) = self.order_rx.recv() => {
                    self.handle_order(event).await;
                }
                Some(event) = self.bid_rx.recv() => {
                    self.handle_bid(event).await;
                }
                else => break,
            }
        }
    }

    async fn handle_order(&self, event: OrderEvent) {
        let order = event.order;
        self.orders.insert(order.id, order.clone());

        let candidates = self.find_candidates(&order);
        let (guards, agencies): (Vec<_>, Vec<_>) = candidates
            .into_iter()
            .partition(|c| c.bidder_type == BidderType::Guard);

        if let Some(best) = algo::select_best(guards, agencies) {
            let final_price = algo::calculate_price(&order, &best);
            let match_result = Match::new(
                order.id,
                best.bid_id,
                best.guard_id,
                best.agency_id,
                final_price,
            );
            if self.match_tx.send(match_result.clone()).await.is_err() {
                error!("match_tx send failed");
            }
            info!(
                "Match created: order={}, guard={}",
                order.id.0,
                best.guard_id.0
            );
        }
    }

    async fn handle_bid(&self, event: BidEvent) {
        let bid = event.bid;
        self.bids.insert(bid.id, bid.clone());
        self.spatial_index.insert(bid.id, bid.location.clone());
        {
            let mut lic = self
                .license_index
                .write()
                .expect("license_index write lock");
            for lt in &bid.licenses {
                lic.insert(lt.clone(), bid.id);
            }
        }
        {
            let mut price = self
                .price_index
                .write()
                .expect("price_index write lock");
            price.insert(bid.price.amount(), bid.id);
        }
    }

    fn find_candidates(&self, order: &Order) -> Vec<Candidate> {
        let center = &order.location;
        let radius_m = 10_000.0;
        let lat_deg = radius_m / 111_320.0;
        let lon_deg = radius_m / (111_320.0 * center.lat.to_radians().cos().max(0.01));
        let by_location: HashSet<BidId> = self
            .spatial_index
            .iter()
            .filter(|r| {
                let p = r.value();
                (p.lat - center.lat).abs() <= lat_deg && (p.lon - center.lon).abs() <= lon_deg
            })
            .map(|r| *r.key())
            .collect();
        let by_location = if by_location.is_empty() {
            self.bids.iter().map(|r| *r.key()).collect::<HashSet<_>>()
        } else {
            by_location
        };

        let by_license: HashSet<BidId> = {
            let lic = self
                .license_index
                .read()
                .expect("license_index read lock");
            order
                .requirements
                .required_licenses
                .iter()
                .flat_map(|l| lic.get(l))
                .collect()
        };
        let by_license = if by_license.is_empty() {
            by_location.clone()
        } else {
            by_location.intersection(&by_license).copied().collect()
        };

        let (min_p, max_p) = (order.budget_range.0.amount(), order.budget_range.1.amount());
        let by_price = {
            let price = self
                .price_index
                .read()
                .expect("price_index read lock");
            price.query_range(min_p, max_p)
        };
        let bid_ids: HashSet<BidId> = if by_price.is_empty() {
            by_license
        } else {
            by_license.intersection(&by_price).copied().collect()
        };

        bid_ids
            .into_iter()
            .filter_map(|id| self.bids.get(&id).map(|r| Candidate::from_bid(r.value())))
            .collect()
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Matching Engine...");

    let (order_tx, order_rx) = mpsc::channel(10_000);
    let (bid_tx, bid_rx) = mpsc::channel(10_000);
    let (match_tx, _match_rx) = mpsc::channel(1000);

    let engine = MatchingEngine::new(order_rx, bid_rx, match_tx);
    let _ = order_tx;
    let _ = bid_tx;

    engine.run().await;
}
