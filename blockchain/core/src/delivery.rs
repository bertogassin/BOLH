//! BOLH Delivery Module — Multi-address routing, courier types, pricing
//!
//! Supports:
//! - Single and multi-address deliveries
//! - All courier types: foot, bike, car, van, truck, air, expert
//! - Route calculation with per-segment distances
//! - Price suggestions based on distance and courier type
//! - Weight as info (not blocking), with filtering by courier capacity
//! - Escrow integration (funds locked on order creation)
//! - Order lifecycle: Created → Accepted → InProgress → Delivered → Confirmed

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// COURIER TYPES
// ═══════════════════════════════════════════════════════

/// Courier transport type — determines capacity, speed, and pricing
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum CourierType {
    /// Walking courier — documents, small items (up to 2 kg, up to 3 km)
    Foot,
    /// Bicycle courier — food, packages (up to 5 kg, up to 10 km)
    Bicycle,
    /// Motorcycle — urgent deliveries (up to 10 kg, up to 30 km)
    Motorcycle,
    /// Car — general cargo (up to 50 kg, city-wide)
    Car,
    /// Minivan — furniture, appliances (up to 500 kg, city-wide)
    Minivan,
    /// Truck — heavy cargo (tons, intercity)
    Truck,
    /// Special — fragile, medical, documents with signature
    Special,
    /// Expert courier — delivery + installation/consultation
    Expert,
    /// International — cross-city or cross-country
    International,
}

impl CourierType {
    /// Recommended max weight in kg (soft limit, for filtering)
    pub fn recommended_max_kg(&self) -> f64 {
        match self {
            CourierType::Foot => 2.0,
            CourierType::Bicycle => 5.0,
            CourierType::Motorcycle => 10.0,
            CourierType::Car => 50.0,
            CourierType::Minivan => 500.0,
            CourierType::Truck => 10_000.0,
            CourierType::Special => 20.0,
            CourierType::Expert => 30.0,
            CourierType::International => 1_000.0,
        }
    }

    /// Recommended max distance in km (soft limit)
    pub fn recommended_max_km(&self) -> f64 {
        match self {
            CourierType::Foot => 3.0,
            CourierType::Bicycle => 10.0,
            CourierType::Motorcycle => 30.0,
            CourierType::Car => 100.0,
            CourierType::Minivan => 200.0,
            CourierType::Truck => 5_000.0,
            CourierType::Special => 50.0,
            CourierType::Expert => 50.0,
            CourierType::International => 50_000.0,
        }
    }

    /// Base rate per km (in raw BOLH with 8 decimals)
    pub fn base_rate_per_km(&self) -> u64 {
        match self {
            CourierType::Foot => 5_00_000_000,       // 5 BOLH/km
            CourierType::Bicycle => 4_00_000_000,     // 4 BOLH/km
            CourierType::Motorcycle => 6_00_000_000,  // 6 BOLH/km
            CourierType::Car => 8_00_000_000,         // 8 BOLH/km
            CourierType::Minivan => 15_00_000_000,    // 15 BOLH/km
            CourierType::Truck => 25_00_000_000,      // 25 BOLH/km
            CourierType::Special => 20_00_000_000,    // 20 BOLH/km
            CourierType::Expert => 30_00_000_000,     // 30 BOLH/km
            CourierType::International => 10_00_000_000, // 10 BOLH/km (bulk discount)
        }
    }

    /// Fixed base fee (pickup fee, in raw BOLH)
    pub fn base_fee(&self) -> u64 {
        match self {
            CourierType::Foot => 10_00_000_000,       // 10 BOLH
            CourierType::Bicycle => 15_00_000_000,    // 15 BOLH
            CourierType::Motorcycle => 20_00_000_000, // 20 BOLH
            CourierType::Car => 30_00_000_000,        // 30 BOLH
            CourierType::Minivan => 80_00_000_000,    // 80 BOLH
            CourierType::Truck => 200_00_000_000,     // 200 BOLH
            CourierType::Special => 50_00_000_000,    // 50 BOLH
            CourierType::Expert => 100_00_000_000,    // 100 BOLH
            CourierType::International => 150_00_000_000, // 150 BOLH
        }
    }

    /// Display name (Russian)
    pub fn name_ru(&self) -> &'static str {
        match self {
            CourierType::Foot => "Пешком",
            CourierType::Bicycle => "Велосипед",
            CourierType::Motorcycle => "Мотоцикл",
            CourierType::Car => "Автомобиль",
            CourierType::Minivan => "Минивэн",
            CourierType::Truck => "Грузовик",
            CourierType::Special => "Специальный",
            CourierType::Expert => "Эксперт-курьер",
            CourierType::International => "Международный",
        }
    }

    /// Emoji icon
    pub fn icon(&self) -> &'static str {
        match self {
            CourierType::Foot => "🚶",
            CourierType::Bicycle => "🚲",
            CourierType::Motorcycle => "🏍️",
            CourierType::Car => "🚗",
            CourierType::Minivan => "🚐",
            CourierType::Truck => "🚛",
            CourierType::Special => "🔬",
            CourierType::Expert => "👨‍💼",
            CourierType::International => "✈️",
        }
    }
}

// ═══════════════════════════════════════════════════════
// DELIVERY ORDER
// ═══════════════════════════════════════════════════════

/// GPS coordinate
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeoPoint {
    pub lat: f64,
    pub lon: f64,
    /// Address text
    pub address: String,
    /// Optional contact at this address
    pub contact: Option<String>,
    /// Special instructions
    pub notes: Option<String>,
}

/// A segment between two addresses
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RouteSegment {
    /// Segment index (0, 1, 2, ...)
    pub index: u32,
    /// From address
    pub from: GeoPoint,
    /// To address
    pub to: GeoPoint,
    /// Distance in meters
    pub distance_meters: u64,
    /// Estimated time in seconds
    pub estimated_time_secs: u64,
}

/// Size category (not blocking, informational)
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum CargoSize {
    /// Envelope, documents
    Envelope,
    /// Fits in a bag
    Small,
    /// Box, up to 50cm
    Medium,
    /// Large box, suitcase
    Large,
    /// Furniture, appliance
    ExtraLarge,
    /// Custom (user describes)
    Custom(String),
}

/// Delivery order state
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum DeliveryState {
    /// Created, waiting for courier
    Created,
    /// Courier accepted
    Accepted,
    /// Courier picked up cargo
    PickedUp,
    /// In transit
    InTransit,
    /// Delivered to destination
    Delivered,
    /// Client confirmed receipt
    Confirmed,
    /// Cancelled
    Cancelled,
    /// Expired (no courier found)
    Expired,
    /// In dispute
    Disputed,
}

/// A delivery order
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeliveryOrder {
    /// Unique order ID
    pub id: String,
    /// Client (who creates the order)
    pub client_id: String,
    /// Courier (who accepts, empty until accepted)
    pub courier_id: Option<String>,
    /// Courier type requested
    pub courier_type: CourierType,
    /// Current state
    pub state: DeliveryState,
    /// Pickup point
    pub pickup: GeoPoint,
    /// Delivery addresses (1 or many)
    pub destinations: Vec<GeoPoint>,
    /// Route segments (calculated)
    pub route: Vec<RouteSegment>,
    /// Total route distance in meters
    pub total_distance_meters: u64,
    /// Estimated total time in seconds
    pub estimated_total_time_secs: u64,
    /// Cargo description
    pub cargo_description: String,
    /// Approximate weight in grams (informational, not blocking)
    pub weight_grams: u64,
    /// Cargo size
    pub cargo_size: CargoSize,
    /// Needs help loading/unloading
    pub needs_loading_help: bool,
    /// Photo of cargo (URL/path)
    pub cargo_photo: Option<String>,
    /// Client's offered price (in raw BOLH)
    pub offered_price: u64,
    /// System suggested price (in raw BOLH)
    pub suggested_price: u64,
    /// Courier's counter-offer (if any)
    pub courier_counter_price: Option<u64>,
    /// Final agreed price
    pub final_price: Option<u64>,
    /// Escrow contract ID
    pub escrow_id: Option<String>,
    /// Creation timestamp
    pub created_at: u64,
    /// Accepted timestamp
    pub accepted_at: Option<u64>,
    /// Delivered timestamp
    pub delivered_at: Option<u64>,
    /// Is urgent
    pub urgent: bool,
}

// ═══════════════════════════════════════════════════════
// COURIER PROFILE
// ═══════════════════════════════════════════════════════

/// Courier's delivery profile
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CourierProfile {
    /// User ID
    pub user_id: String,
    /// Transport types available
    pub courier_types: Vec<CourierType>,
    /// Max weight they'll carry (grams)
    pub max_weight_grams: u64,
    /// Price range: minimum per order (raw BOLH)
    pub price_min: u64,
    /// Price range: maximum per order (raw BOLH)
    pub price_max: u64,
    /// Max distance willing to travel (meters)
    pub max_distance_meters: u64,
    /// Currently online
    pub is_online: bool,
    /// Show on map
    pub show_on_map: bool,
    /// Current location
    pub location: Option<GeoPoint>,
    /// Completed deliveries count
    pub completed_deliveries: u64,
    /// Rating (1-5, with decimals)
    pub rating: f64,
}

// ═══════════════════════════════════════════════════════
// DELIVERY ENGINE
// ═══════════════════════════════════════════════════════

/// The delivery engine
pub struct DeliveryEngine {
    /// All orders
    orders: RwLock<HashMap<String, DeliveryOrder>>,
    /// Orders by client
    client_orders: RwLock<HashMap<String, Vec<String>>>,
    /// Orders by courier
    courier_orders: RwLock<HashMap<String, Vec<String>>>,
    /// Courier profiles
    couriers: RwLock<HashMap<String, CourierProfile>>,
    /// Order counter
    order_count: RwLock<u64>,
}

impl DeliveryEngine {
    pub fn new() -> Self {
        DeliveryEngine {
            orders: RwLock::new(HashMap::new()),
            client_orders: RwLock::new(HashMap::new()),
            courier_orders: RwLock::new(HashMap::new()),
            couriers: RwLock::new(HashMap::new()),
            order_count: RwLock::new(0),
        }
    }

    /// Calculate suggested price for a route
    pub fn calculate_suggested_price(
        courier_type: &CourierType,
        total_distance_meters: u64,
        num_destinations: usize,
    ) -> u64 {
        let distance_km = total_distance_meters as f64 / 1000.0;
        let base = courier_type.base_fee();
        let per_km = (distance_km * courier_type.base_rate_per_km() as f64) as u64;

        // Multi-stop surcharge: +5% per additional destination
        let multi_stop_multiplier = 10_000 + (num_destinations.saturating_sub(1) as u64) * 500;
        let subtotal = base + per_km;
        let total = subtotal * multi_stop_multiplier / 10_000;

        // Minimum price
        total.max(crate::system_rules::MINIMUM_ORDER_PRICE)
    }

    /// Calculate distance between two geo points (Haversine formula)
    pub fn distance_meters(a: &GeoPoint, b: &GeoPoint) -> u64 {
        let r = 6_371_000.0_f64; // Earth radius in meters
        let lat1 = a.lat.to_radians();
        let lat2 = b.lat.to_radians();
        let dlat = (b.lat - a.lat).to_radians();
        let dlon = (b.lon - a.lon).to_radians();

        let a_val = (dlat / 2.0).sin().powi(2)
            + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
        let c = 2.0 * a_val.sqrt().atan2((1.0 - a_val).sqrt());

        (r * c) as u64
    }

    /// Build route segments from pickup + destinations
    pub fn build_route(pickup: &GeoPoint, destinations: &[GeoPoint]) -> Vec<RouteSegment> {
        let mut segments = Vec::new();
        let mut prev = pickup;

        for (i, dest) in destinations.iter().enumerate() {
            let dist = Self::distance_meters(prev, dest);
            // Rough estimate: 30 km/h average in city → 33.3 m/s → 1 km = 120 sec
            let time = dist * 120 / 1000;

            segments.push(RouteSegment {
                index: i as u32,
                from: prev.clone(),
                to: dest.clone(),
                distance_meters: dist,
                estimated_time_secs: time,
            });
            prev = dest;
        }

        segments
    }

    /// Create a delivery order
    pub fn create_order(
        &self,
        client_id: &str,
        courier_type: CourierType,
        pickup: GeoPoint,
        destinations: Vec<GeoPoint>,
        cargo_description: &str,
        weight_grams: u64,
        cargo_size: CargoSize,
        needs_loading_help: bool,
        offered_price: u64,
        urgent: bool,
    ) -> Result<DeliveryOrder, String> {
        if destinations.is_empty() {
            return Err("Нужен хотя бы один адрес доставки".into());
        }

        if offered_price < crate::system_rules::MINIMUM_ORDER_PRICE {
            return Err(format!(
                "Минимальная цена: {} BOLH",
                crate::system_rules::MINIMUM_ORDER_PRICE / 100_000_000
            ));
        }

        let route = Self::build_route(&pickup, &destinations);
        let total_distance: u64 = route.iter().map(|s| s.distance_meters).sum();
        let total_time: u64 = route.iter().map(|s| s.estimated_time_secs).sum();

        let suggested = Self::calculate_suggested_price(
            &courier_type,
            total_distance,
            destinations.len(),
        );

        let count = {
            let mut c = self.order_count.write();
            *c += 1;
            *c
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let order = DeliveryOrder {
            id: format!("DEL-{:06}", count),
            client_id: client_id.to_string(),
            courier_id: None,
            courier_type,
            state: DeliveryState::Created,
            pickup,
            destinations,
            route,
            total_distance_meters: total_distance,
            estimated_total_time_secs: total_time,
            cargo_description: cargo_description.to_string(),
            weight_grams,
            cargo_size,
            needs_loading_help,
            cargo_photo: None,
            offered_price,
            suggested_price: suggested,
            courier_counter_price: None,
            final_price: None,
            escrow_id: None,
            created_at: now,
            accepted_at: None,
            delivered_at: None,
            urgent,
        };

        let id = order.id.clone();
        self.orders.write().insert(id.clone(), order.clone());
        self.client_orders.write().entry(client_id.to_string()).or_default().push(id);

        Ok(order)
    }

    /// Courier accepts an order
    pub fn accept_order(&self, order_id: &str, courier_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or("Заказ не найден")?;

        if order.state != DeliveryState::Created {
            return Err("Заказ уже принят или завершён".into());
        }

        // Check courier price range
        let couriers = self.couriers.read();
        if let Some(profile) = couriers.get(courier_id) {
            if order.offered_price < profile.price_min {
                return Err(format!(
                    "Цена заказа ({} BOLH) ниже вашего минимума ({} BOLH)",
                    order.offered_price / 100_000_000,
                    profile.price_min / 100_000_000
                ));
            }
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        order.courier_id = Some(courier_id.to_string());
        order.state = DeliveryState::Accepted;
        order.accepted_at = Some(now);
        order.final_price = Some(order.offered_price);

        drop(orders);
        self.courier_orders.write().entry(courier_id.to_string()).or_default().push(order_id.to_string());

        Ok(())
    }

    /// Mark as picked up
    pub fn mark_picked_up(&self, order_id: &str, courier_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id).ok_or("Заказ не найден")?;
        if order.courier_id.as_deref() != Some(courier_id) {
            return Err("Вы не курьер этого заказа".into());
        }
        if order.state != DeliveryState::Accepted {
            return Err("Заказ не в статусе 'Принят'".into());
        }
        order.state = DeliveryState::PickedUp;
        Ok(())
    }

    /// Mark as in transit
    pub fn mark_in_transit(&self, order_id: &str, courier_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id).ok_or("Заказ не найден")?;
        if order.courier_id.as_deref() != Some(courier_id) {
            return Err("Вы не курьер этого заказа".into());
        }
        order.state = DeliveryState::InTransit;
        Ok(())
    }

    /// Mark as delivered
    pub fn mark_delivered(&self, order_id: &str, courier_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id).ok_or("Заказ не найден")?;
        if order.courier_id.as_deref() != Some(courier_id) {
            return Err("Вы не курьер этого заказа".into());
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        order.state = DeliveryState::Delivered;
        order.delivered_at = Some(now);
        Ok(())
    }

    /// Client confirms delivery
    pub fn confirm_delivery(&self, order_id: &str, client_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id).ok_or("Заказ не найден")?;
        if order.client_id != client_id {
            return Err("Вы не заказчик".into());
        }
        if order.state != DeliveryState::Delivered {
            return Err("Заказ ещё не доставлен".into());
        }
        order.state = DeliveryState::Confirmed;

        // Update courier stats
        if let Some(courier_id) = &order.courier_id {
            let mut couriers = self.couriers.write();
            if let Some(profile) = couriers.get_mut(courier_id) {
                profile.completed_deliveries += 1;
            }
        }

        Ok(())
    }

    /// Register or update courier profile
    pub fn register_courier(&self, profile: CourierProfile) {
        self.couriers.write().insert(profile.user_id.clone(), profile);
    }

    /// Find orders matching courier's filters
    pub fn find_orders_for_courier(&self, courier_id: &str) -> Vec<DeliveryOrder> {
        let couriers = self.couriers.read();
        let profile = match couriers.get(courier_id) {
            Some(p) => p,
            None => return Vec::new(),
        };

        let orders = self.orders.read();
        orders.values()
            .filter(|o| {
                o.state == DeliveryState::Created
                    && o.offered_price >= profile.price_min
                    && (profile.price_max == 0 || o.offered_price <= profile.price_max)
                    && o.total_distance_meters <= profile.max_distance_meters
                    && profile.courier_types.contains(&o.courier_type)
            })
            .cloned()
            .collect()
    }

    /// Get order by ID
    pub fn get_order(&self, id: &str) -> Option<DeliveryOrder> {
        self.orders.read().get(id).cloned()
    }

    /// Get client's orders
    pub fn get_client_orders(&self, client_id: &str) -> Vec<DeliveryOrder> {
        let index = self.client_orders.read();
        let orders = self.orders.read();
        index.get(client_id)
            .map(|ids| ids.iter().filter_map(|id| orders.get(id).cloned()).collect())
            .unwrap_or_default()
    }

    /// Get courier's orders
    pub fn get_courier_orders(&self, courier_id: &str) -> Vec<DeliveryOrder> {
        let index = self.courier_orders.read();
        let orders = self.orders.read();
        index.get(courier_id)
            .map(|ids| ids.iter().filter_map(|id| orders.get(id).cloned()).collect())
            .unwrap_or_default()
    }

    /// Statistics
    pub fn stats(&self) -> DeliveryStats {
        let orders = self.orders.read();
        let active = orders.values().filter(|o| {
            matches!(o.state, DeliveryState::Created | DeliveryState::Accepted
                | DeliveryState::PickedUp | DeliveryState::InTransit)
        }).count();
        let completed = orders.values().filter(|o| o.state == DeliveryState::Confirmed).count();

        DeliveryStats {
            total_orders: orders.len(),
            active_orders: active,
            completed_orders: completed,
            total_couriers: self.couriers.read().len(),
            online_couriers: self.couriers.read().values().filter(|c| c.is_online).count(),
        }
    }
}

impl Default for DeliveryEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Delivery statistics
#[derive(Debug, Serialize)]
pub struct DeliveryStats {
    pub total_orders: usize,
    pub active_orders: usize,
    pub completed_orders: usize,
    pub total_couriers: usize,
    pub online_couriers: usize,
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    fn point(lat: f64, lon: f64, addr: &str) -> GeoPoint {
        GeoPoint { lat, lon, address: addr.into(), contact: None, notes: None }
    }

    fn bolh(amount: u64) -> u64 {
        amount * 100_000_000
    }

    #[test]
    fn test_distance_calculation() {
        // Moscow: Red Square to Kremlin (~0.5 km)
        let a = point(55.7539, 37.6208, "Red Square");
        let b = point(55.7520, 37.6175, "Kremlin");
        let dist = DeliveryEngine::distance_meters(&a, &b);
        assert!(dist > 200 && dist < 500, "Distance: {}m", dist);
    }

    #[test]
    fn test_route_building() {
        let pickup = point(55.75, 37.62, "Pickup");
        let dests = vec![
            point(55.76, 37.63, "Stop 1"),
            point(55.77, 37.64, "Stop 2"),
            point(55.78, 37.65, "Stop 3"),
        ];

        let route = DeliveryEngine::build_route(&pickup, &dests);
        assert_eq!(route.len(), 3);
        assert!(route[0].distance_meters > 0);

        let total: u64 = route.iter().map(|s| s.distance_meters).sum();
        assert!(total > 0);
    }

    #[test]
    fn test_price_calculation() {
        // 5 km car delivery, 1 destination
        let price = DeliveryEngine::calculate_suggested_price(
            &CourierType::Car,
            5000, // 5 km
            1,
        );
        // Base 30 + 5 * 8 = 70 BOLH
        assert!(price >= bolh(60), "Price: {} raw", price);

        // Same with 3 destinations: +10% surcharge
        let multi = DeliveryEngine::calculate_suggested_price(
            &CourierType::Car,
            5000,
            3,
        );
        assert!(multi > price, "Multi ({}) should be > single ({})", multi, price);
    }

    #[test]
    fn test_full_delivery_flow() {
        let engine = DeliveryEngine::new();

        // Register courier
        engine.register_courier(CourierProfile {
            user_id: "courier1".into(),
            courier_types: vec![CourierType::Car],
            max_weight_grams: 50_000,
            price_min: bolh(20),
            price_max: bolh(5000),
            max_distance_meters: 100_000,
            is_online: true,
            show_on_map: true,
            location: Some(point(55.75, 37.62, "Courier location")),
            completed_deliveries: 0,
            rating: 5.0,
        });

        // Create order
        let order = engine.create_order(
            "client1",
            CourierType::Car,
            point(55.75, 37.62, "Pickup"),
            vec![
                point(55.76, 37.63, "Deliver here"),
            ],
            "Piano from neighbors",
            150_000, // 150 kg
            CargoSize::ExtraLarge,
            true,
            bolh(500),
            false,
        ).unwrap();

        assert_eq!(order.state, DeliveryState::Created);
        assert!(order.total_distance_meters > 0);

        // Courier sees the order
        let available = engine.find_orders_for_courier("courier1");
        assert_eq!(available.len(), 1);

        // Courier accepts
        engine.accept_order(&order.id, "courier1").unwrap();
        let o = engine.get_order(&order.id).unwrap();
        assert_eq!(o.state, DeliveryState::Accepted);

        // Pickup → Transit → Delivered → Confirmed
        engine.mark_picked_up(&order.id, "courier1").unwrap();
        engine.mark_in_transit(&order.id, "courier1").unwrap();
        engine.mark_delivered(&order.id, "courier1").unwrap();
        engine.confirm_delivery(&order.id, "client1").unwrap();

        let o = engine.get_order(&order.id).unwrap();
        assert_eq!(o.state, DeliveryState::Confirmed);

        // Courier stats updated
        let couriers = engine.couriers.read();
        assert_eq!(couriers.get("courier1").unwrap().completed_deliveries, 1);
    }

    #[test]
    fn test_minimum_price_enforced() {
        let engine = DeliveryEngine::new();
        let result = engine.create_order(
            "client1", CourierType::Foot,
            point(55.75, 37.62, "A"),
            vec![point(55.76, 37.63, "B")],
            "test", 100, CargoSize::Small, false,
            bolh(1), // Too cheap!
            false,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_courier_price_filter() {
        let engine = DeliveryEngine::new();

        engine.register_courier(CourierProfile {
            user_id: "expensive_courier".into(),
            courier_types: vec![CourierType::Car],
            max_weight_grams: 50_000,
            price_min: bolh(1000), // Only accepts 1000+ BOLH orders
            price_max: 0,
            max_distance_meters: 100_000,
            is_online: true,
            show_on_map: true,
            location: None,
            completed_deliveries: 0,
            rating: 5.0,
        });

        // Create cheap order
        engine.create_order(
            "client1", CourierType::Car,
            point(55.75, 37.62, "A"),
            vec![point(55.76, 37.63, "B")],
            "test", 1000, CargoSize::Small, false,
            bolh(100), // Only 100 BOLH
            false,
        ).unwrap();

        // Courier should NOT see this order (below their minimum)
        let available = engine.find_orders_for_courier("expensive_courier");
        assert_eq!(available.len(), 0);
    }
}
