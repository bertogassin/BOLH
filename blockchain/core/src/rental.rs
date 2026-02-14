//! BOLH Rental Module — Peer-to-peer rental for everything
//!
//! Supports:
//! - Property: apartments, rooms, houses, villas, hotels, hostels, dachas
//! - Any item category: transport, tools, electronics, spaces, etc.
//! - Rental lifecycle: Listed → Reserved → Active → Returned → Confirmed
//! - Delivery integration via DeliveryEngine for rental items
//! - Escrow: deposit + rental fee locked on reservation
//! - Time-based pricing (hourly, daily, weekly, monthly)
//! - Damage protection & deposit system
//! - Rating for both renter and owner

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// RENTAL CATEGORIES
// ═══════════════════════════════════════════════════════

/// Category of the rental item
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum RentalCategory {
    /// Apartments, rooms, houses, villas, hotels, hostels, dachas, glamping
    Property,
    /// Cars, motorcycles, bicycles, scooters, boats, trailers
    Transport,
    /// Power tools, garden equipment, construction gear, generators
    Tools,
    /// Cameras, projectors, sound systems, gaming, VR
    Electronics,
    /// Halls, studios, offices, coworking, parking, storage, garages
    Space,
    /// Sports gear, costumes, party/event, kids, medical
    Other,
}

impl RentalCategory {
    pub fn name_ru(&self) -> &'static str {
        match self {
            RentalCategory::Property => "Жильё",
            RentalCategory::Transport => "Транспорт",
            RentalCategory::Tools => "Инструменты",
            RentalCategory::Electronics => "Электроника",
            RentalCategory::Space => "Пространства",
            RentalCategory::Other => "Разное",
        }
    }

    pub fn name_en(&self) -> &'static str {
        match self {
            RentalCategory::Property => "Property",
            RentalCategory::Transport => "Transport",
            RentalCategory::Tools => "Tools",
            RentalCategory::Electronics => "Electronics",
            RentalCategory::Space => "Spaces",
            RentalCategory::Other => "Other",
        }
    }

    pub fn icon(&self) -> &'static str {
        match self {
            RentalCategory::Property => "🏘️",
            RentalCategory::Transport => "🚗",
            RentalCategory::Tools => "🛠️",
            RentalCategory::Electronics => "📷",
            RentalCategory::Space => "🏢",
            RentalCategory::Other => "🎯",
        }
    }
}

// ═══════════════════════════════════════════════════════
// PROPERTY SUB-TYPES
// ═══════════════════════════════════════════════════════

/// Specific property type for the Property category
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum PropertyType {
    Apartment,
    Room,
    House,
    Villa,
    Hotel,
    Hostel,
    Dacha,
    Glamping,
}

/// Property details (only for Property category)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PropertyDetails {
    pub property_type: PropertyType,
    /// Number of rooms / bedrooms
    pub rooms: u8,
    /// Number of guests max
    pub max_guests: u8,
    /// Area in sq. meters
    pub area_sqm: f64,
    /// Has kitchen
    pub has_kitchen: bool,
    /// Has WiFi
    pub has_wifi: bool,
    /// Has parking
    pub has_parking: bool,
    /// Has AC
    pub has_ac: bool,
    /// Has washer
    pub has_washer: bool,
    /// Check-in time (e.g. "14:00")
    pub check_in: String,
    /// Check-out time (e.g. "12:00")
    pub check_out: String,
    /// House rules / description
    pub rules: String,
    /// Photos (hashes)
    pub photos: Vec<String>,
    /// Verified by platform
    pub verified: bool,
}

// ═══════════════════════════════════════════════════════
// PRICING MODEL
// ═══════════════════════════════════════════════════════

/// Time unit for rental pricing
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum PricingUnit {
    PerHour,
    PerDay,
    PerWeek,
    PerMonth,
}

/// Pricing configuration set by the owner
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RentalPricing {
    /// Price per unit (in raw BOLH)
    pub price_per_unit: u64,
    /// Pricing time unit
    pub unit: PricingUnit,
    /// Security deposit (returned if no damage)
    pub deposit: u64,
    /// Minimum rental duration (in hours)
    pub min_duration_hours: u32,
    /// Maximum rental duration (in hours, 0 = unlimited)
    pub max_duration_hours: u32,
    /// Discount for 7+ days (basis points, e.g. 1000 = 10%)
    pub weekly_discount_bps: u32,
    /// Discount for 30+ days (basis points)
    pub monthly_discount_bps: u32,
}

impl RentalPricing {
    /// Calculate total price for a given duration in hours
    pub fn calculate_total(&self, duration_hours: u32) -> u64 {
        let hours = duration_hours.max(self.min_duration_hours);
        let base = match self.unit {
            PricingUnit::PerHour => self.price_per_unit * hours as u64,
            PricingUnit::PerDay => {
                let days = (hours as f64 / 24.0).ceil() as u64;
                self.price_per_unit * days
            }
            PricingUnit::PerWeek => {
                let weeks = (hours as f64 / 168.0).ceil() as u64;
                self.price_per_unit * weeks
            }
            PricingUnit::PerMonth => {
                let months = (hours as f64 / 720.0).ceil() as u64;
                self.price_per_unit * months
            }
        };

        // Apply discounts
        let discount_bps = if duration_hours >= 720 {
            self.monthly_discount_bps
        } else if duration_hours >= 168 {
            self.weekly_discount_bps
        } else {
            0
        };

        if discount_bps > 0 {
            base - (base * discount_bps as u64 / 10_000)
        } else {
            base
        }
    }
}

// ═══════════════════════════════════════════════════════
// DELIVERY OPTIONS
// ═══════════════════════════════════════════════════════

/// How the rental item is transferred
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum DeliveryOption {
    /// Renter picks up at owner's location
    SelfPickup,
    /// Owner delivers to renter
    OwnerDelivers,
    /// Platform courier delivers (linked to DeliveryEngine)
    CourierDelivery {
        delivery_order_id: Option<String>,
    },
    /// Meet at agreed location
    MeetupPoint {
        lat: f64,
        lon: f64,
        description: String,
    },
}

// ═══════════════════════════════════════════════════════
// RENTAL LISTING (what owner publishes)
// ═══════════════════════════════════════════════════════

/// A rental listing — published by the owner
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RentalListing {
    pub id: String,
    pub owner_id: String,
    /// Item details
    pub title: String,
    pub description: String,
    pub category: RentalCategory,
    pub subcategory: String, // e.g. "rent_car", "rent_apartment"
    /// Property details (only for Property category)
    pub property_details: Option<PropertyDetails>,
    /// Location (owner's location or item location)
    pub location_lat: f64,
    pub location_lon: f64,
    pub location_address: String,
    /// Pricing
    pub pricing: RentalPricing,
    /// Delivery options
    pub delivery_options: Vec<DeliveryOption>,
    /// Item condition (1-5 stars)
    pub condition: u8,
    /// Images (IPFS hashes or URLs)
    pub images: Vec<String>,
    /// Available or not
    pub is_available: bool,
    /// Timestamps
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    /// Rating (accumulated)
    pub total_rentals: u32,
    pub avg_rating: f32,
}

// ═══════════════════════════════════════════════════════
// RENTAL ORDER (booking)
// ═══════════════════════════════════════════════════════

/// State of a rental order
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum RentalState {
    /// Renter requested, waiting for owner to approve
    Requested,
    /// Owner approved, escrow locked (deposit + rental fee)
    Reserved,
    /// Item handed over, rental started
    Active,
    /// Renter returned the item, pending owner confirmation
    Returned,
    /// Owner confirmed return, all clear
    Confirmed,
    /// Dispute raised (damage, late return, etc.)
    Disputed,
    /// Order cancelled before handover
    Cancelled,
}

/// A rental order/booking
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RentalOrder {
    pub id: String,
    pub listing_id: String,
    pub renter_id: String,
    pub owner_id: String,
    /// Rental period
    pub start_time_ms: u64,
    pub end_time_ms: u64,
    pub duration_hours: u32,
    /// Pricing
    pub rental_fee: u64,
    pub deposit: u64,
    pub total_locked: u64,   // rental_fee + deposit in escrow
    /// Delivery
    pub delivery: DeliveryOption,
    pub delivery_fee: u64,
    /// State
    pub state: RentalState,
    /// Escrow contract ID (from contract module)
    pub escrow_id: Option<String>,
    /// Return & damage
    pub return_condition: Option<u8>, // owner rates condition on return
    pub damage_claim: Option<u64>,    // damage amount claimed by owner
    /// Timestamps
    pub created_at_ms: u64,
    pub reserved_at_ms: Option<u64>,
    pub active_at_ms: Option<u64>,
    pub returned_at_ms: Option<u64>,
    pub confirmed_at_ms: Option<u64>,
    /// Late return penalty (per hour, basis points of daily rate)
    pub late_penalty_accrued: u64,
}

// ═══════════════════════════════════════════════════════
// RENTAL ENGINE
// ═══════════════════════════════════════════════════════

/// Late return penalty: 5% of daily rate per extra hour
const LATE_PENALTY_BPS_PER_HOUR: u64 = 500;
/// Maximum late penalty cap: 200% of rental fee
const MAX_LATE_PENALTY_MULTIPLIER: u64 = 2;

pub struct RentalEngine {
    /// All listings
    listings: RwLock<HashMap<String, RentalListing>>,
    /// All orders
    orders: RwLock<HashMap<String, RentalOrder>>,
    /// Owner → listing IDs
    owner_listings: RwLock<HashMap<String, Vec<String>>>,
    /// Renter → order IDs
    renter_orders: RwLock<HashMap<String, Vec<String>>>,
    /// Auto-increment counters
    listing_counter: RwLock<u64>,
    order_counter: RwLock<u64>,
}

impl RentalEngine {
    pub fn new() -> Self {
        RentalEngine {
            listings: RwLock::new(HashMap::new()),
            orders: RwLock::new(HashMap::new()),
            owner_listings: RwLock::new(HashMap::new()),
            renter_orders: RwLock::new(HashMap::new()),
            listing_counter: RwLock::new(0),
            order_counter: RwLock::new(0),
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    // ─── LISTINGS ─────────────────────────────────────

    /// Owner publishes a new rental listing
    pub fn create_listing(
        &self,
        owner_id: &str,
        title: &str,
        description: &str,
        category: RentalCategory,
        subcategory: &str,
        property_details: Option<PropertyDetails>,
        lat: f64,
        lon: f64,
        address: &str,
        pricing: RentalPricing,
        delivery_options: Vec<DeliveryOption>,
        condition: u8,
        images: Vec<String>,
    ) -> String {
        let mut counter = self.listing_counter.write();
        *counter += 1;
        let id = format!("RENT-L-{:06}", *counter);

        let now = Self::now_ms();
        let listing = RentalListing {
            id: id.clone(),
            owner_id: owner_id.into(),
            title: title.into(),
            description: description.into(),
            category,
            subcategory: subcategory.into(),
            property_details,
            location_lat: lat,
            location_lon: lon,
            location_address: address.into(),
            pricing,
            delivery_options,
            condition: condition.min(5).max(1),
            images,
            is_available: true,
            created_at_ms: now,
            updated_at_ms: now,
            total_rentals: 0,
            avg_rating: 0.0,
        };

        self.listings.write().insert(id.clone(), listing);
        self.owner_listings.write()
            .entry(owner_id.into())
            .or_default()
            .push(id.clone());

        id
    }

    /// Toggle listing availability
    pub fn set_listing_available(&self, listing_id: &str, available: bool) -> bool {
        if let Some(listing) = self.listings.write().get_mut(listing_id) {
            listing.is_available = available;
            listing.updated_at_ms = Self::now_ms();
            true
        } else {
            false
        }
    }

    /// Get listing by ID
    pub fn get_listing(&self, listing_id: &str) -> Option<RentalListing> {
        self.listings.read().get(listing_id).cloned()
    }

    /// Search listings by category, optional location radius
    pub fn search_listings(
        &self,
        category: Option<RentalCategory>,
        lat: Option<f64>,
        lon: Option<f64>,
        radius_km: Option<f64>,
        max_price_per_day: Option<u64>,
    ) -> Vec<RentalListing> {
        let listings = self.listings.read();
        listings.values()
            .filter(|l| l.is_available)
            .filter(|l| {
                category.as_ref().map_or(true, |c| &l.category == c)
            })
            .filter(|l| {
                if let (Some(lat), Some(lon), Some(radius)) = (lat, lon, radius_km) {
                    distance_km(lat, lon, l.location_lat, l.location_lon) <= radius
                } else {
                    true
                }
            })
            .filter(|l| {
                max_price_per_day.map_or(true, |max| {
                    l.pricing.calculate_total(24) <= max
                })
            })
            .cloned()
            .collect()
    }

    /// Get all listings by owner
    pub fn owner_listings(&self, owner_id: &str) -> Vec<RentalListing> {
        let index = self.owner_listings.read();
        let ids = match index.get(owner_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };
        let listings = self.listings.read();
        ids.iter().filter_map(|id| listings.get(id).cloned()).collect()
    }

    // ─── ORDERS ───────────────────────────────────────

    /// Renter requests a rental
    pub fn request_rental(
        &self,
        listing_id: &str,
        renter_id: &str,
        start_ms: u64,
        duration_hours: u32,
        delivery: DeliveryOption,
        delivery_fee: u64,
    ) -> Result<String, String> {
        let listings = self.listings.read();
        let listing = listings.get(listing_id)
            .ok_or_else(|| "Listing not found".to_string())?;

        if !listing.is_available {
            return Err("Listing is not available".into());
        }

        if renter_id == listing.owner_id {
            return Err("Cannot rent your own item".into());
        }

        // Check duration limits
        if listing.pricing.min_duration_hours > 0 && duration_hours < listing.pricing.min_duration_hours {
            return Err(format!(
                "Minimum rental duration is {} hours",
                listing.pricing.min_duration_hours
            ));
        }
        if listing.pricing.max_duration_hours > 0 && duration_hours > listing.pricing.max_duration_hours {
            return Err(format!(
                "Maximum rental duration is {} hours",
                listing.pricing.max_duration_hours
            ));
        }

        let rental_fee = listing.pricing.calculate_total(duration_hours);
        let deposit = listing.pricing.deposit;
        let total_locked = rental_fee + deposit + delivery_fee;
        let end_ms = start_ms + (duration_hours as u64 * 3_600_000);

        drop(listings);

        let mut counter = self.order_counter.write();
        *counter += 1;
        let id = format!("RENT-O-{:06}", *counter);

        let order = RentalOrder {
            id: id.clone(),
            listing_id: listing_id.into(),
            renter_id: renter_id.into(),
            owner_id: self.listings.read().get(listing_id).unwrap().owner_id.clone(),
            start_time_ms: start_ms,
            end_time_ms: end_ms,
            duration_hours,
            rental_fee,
            deposit,
            total_locked,
            delivery,
            delivery_fee,
            state: RentalState::Requested,
            escrow_id: None,
            return_condition: None,
            damage_claim: None,
            created_at_ms: Self::now_ms(),
            reserved_at_ms: None,
            active_at_ms: None,
            returned_at_ms: None,
            confirmed_at_ms: None,
            late_penalty_accrued: 0,
        };

        self.orders.write().insert(id.clone(), order);
        self.renter_orders.write()
            .entry(renter_id.into())
            .or_default()
            .push(id.clone());

        Ok(id)
    }

    /// Owner approves rental request → funds locked in escrow
    pub fn approve_rental(&self, order_id: &str, escrow_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        if order.state != RentalState::Requested {
            return Err("Order is not in Requested state".into());
        }

        order.state = RentalState::Reserved;
        order.escrow_id = Some(escrow_id.into());
        order.reserved_at_ms = Some(Self::now_ms());

        Ok(())
    }

    /// Item handed over → rental starts
    pub fn start_rental(&self, order_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        if order.state != RentalState::Reserved {
            return Err("Order is not Reserved".into());
        }

        order.state = RentalState::Active;
        order.active_at_ms = Some(Self::now_ms());

        // Mark listing as unavailable during rental
        if let Some(listing) = self.listings.write().get_mut(&order.listing_id) {
            listing.is_available = false;
        }

        Ok(())
    }

    /// Renter returns item
    pub fn return_item(&self, order_id: &str) -> Result<u64, String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        if order.state != RentalState::Active {
            return Err("Order is not Active".into());
        }

        let now = Self::now_ms();
        order.returned_at_ms = Some(now);

        // Calculate late penalty
        let late_penalty = if now > order.end_time_ms {
            let late_hours = ((now - order.end_time_ms) / 3_600_000).max(1) as u64;
            let daily_rate = order.rental_fee / (order.duration_hours as u64 / 24).max(1);
            let penalty = daily_rate * LATE_PENALTY_BPS_PER_HOUR * late_hours / 10_000;
            let max_penalty = order.rental_fee * MAX_LATE_PENALTY_MULTIPLIER;
            penalty.min(max_penalty)
        } else {
            0
        };

        order.late_penalty_accrued = late_penalty;
        order.state = RentalState::Returned;

        Ok(late_penalty)
    }

    /// Owner confirms return — deposit returned (minus damage), rental fee released
    pub fn confirm_return(
        &self,
        order_id: &str,
        condition: u8,
        damage_amount: u64,
    ) -> Result<RentalSettlement, String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        if order.state != RentalState::Returned {
            return Err("Order is not in Returned state".into());
        }

        order.return_condition = Some(condition.min(5).max(1));
        order.damage_claim = if damage_amount > 0 { Some(damage_amount) } else { None };
        order.confirmed_at_ms = Some(Self::now_ms());
        order.state = RentalState::Confirmed;

        // Calculate settlement
        let damage_deducted = damage_amount.min(order.deposit);
        let deposit_returned = order.deposit - damage_deducted;
        let owner_receives = order.rental_fee + damage_deducted + order.late_penalty_accrued;
        let renter_receives = deposit_returned;

        // Re-enable listing
        if let Some(listing) = self.listings.write().get_mut(&order.listing_id) {
            listing.is_available = true;
            listing.total_rentals += 1;
        }

        Ok(RentalSettlement {
            order_id: order_id.into(),
            owner_receives,
            renter_receives,
            damage_deducted,
            late_penalty: order.late_penalty_accrued,
            delivery_fee: order.delivery_fee,
        })
    }

    /// Cancel rental (before it starts)
    pub fn cancel_rental(&self, order_id: &str, _by_owner: bool) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        match order.state {
            RentalState::Requested | RentalState::Reserved => {
                order.state = RentalState::Cancelled;
                // Re-enable listing
                if let Some(listing) = self.listings.write().get_mut(&order.listing_id) {
                    listing.is_available = true;
                }
                Ok(())
            }
            _ => Err("Cannot cancel: rental is already active or completed".into()),
        }
    }

    /// Raise a dispute
    pub fn dispute_rental(&self, order_id: &str) -> Result<(), String> {
        let mut orders = self.orders.write();
        let order = orders.get_mut(order_id)
            .ok_or_else(|| "Order not found".to_string())?;

        match order.state {
            RentalState::Active | RentalState::Returned => {
                order.state = RentalState::Disputed;
                Ok(())
            }
            _ => Err("Cannot dispute at this stage".into()),
        }
    }

    /// Get order by ID
    pub fn get_order(&self, order_id: &str) -> Option<RentalOrder> {
        self.orders.read().get(order_id).cloned()
    }

    /// Get all orders for a renter
    pub fn renter_orders(&self, renter_id: &str) -> Vec<RentalOrder> {
        let index = self.renter_orders.read();
        let ids = match index.get(renter_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };
        let orders = self.orders.read();
        ids.iter().filter_map(|id| orders.get(id).cloned()).collect()
    }

    /// Get all orders for listings owned by owner
    pub fn owner_orders(&self, owner_id: &str) -> Vec<RentalOrder> {
        let orders = self.orders.read();
        orders.values()
            .filter(|o| o.owner_id == owner_id)
            .cloned()
            .collect()
    }

    /// Stats
    pub fn stats(&self) -> RentalStats {
        let listings = self.listings.read();
        let orders = self.orders.read();
        RentalStats {
            total_listings: listings.len() as u32,
            available_listings: listings.values().filter(|l| l.is_available).count() as u32,
            total_orders: orders.len() as u32,
            active_orders: orders.values().filter(|o| o.state == RentalState::Active).count() as u32,
            completed_orders: orders.values().filter(|o| o.state == RentalState::Confirmed).count() as u32,
        }
    }
}

// ═══════════════════════════════════════════════════════
// SETTLEMENT & STATS
// ═══════════════════════════════════════════════════════

/// Financial settlement after rental completion
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RentalSettlement {
    pub order_id: String,
    /// Amount released to owner (fee + damage + late penalty)
    pub owner_receives: u64,
    /// Amount returned to renter (deposit minus damage)
    pub renter_receives: u64,
    /// Damage deducted from deposit
    pub damage_deducted: u64,
    /// Late return penalty
    pub late_penalty: u64,
    /// Delivery fee (paid separately)
    pub delivery_fee: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RentalStats {
    pub total_listings: u32,
    pub available_listings: u32,
    pub total_orders: u32,
    pub active_orders: u32,
    pub completed_orders: u32,
}

// ═══════════════════════════════════════════════════════
// GEO HELPER
// ═══════════════════════════════════════════════════════

/// Haversine distance in km
fn distance_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let r = 6_371.0; // Earth radius km
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();
    r * c
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    fn bolh(amount: u64) -> u64 {
        amount * 100_000_000
    }

    fn make_pricing() -> RentalPricing {
        RentalPricing {
            price_per_unit: bolh(100),  // 100 BOLH per day
            unit: PricingUnit::PerDay,
            deposit: bolh(500),          // 500 BOLH deposit
            min_duration_hours: 24,
            max_duration_hours: 720,     // max 30 days
            weekly_discount_bps: 1000,   // 10% weekly
            monthly_discount_bps: 2000,  // 20% monthly
        }
    }

    #[test]
    fn test_pricing_calculation() {
        let p = make_pricing();

        // 1 day = 100 BOLH
        assert_eq!(p.calculate_total(24), bolh(100));

        // 3 days = 300 BOLH
        assert_eq!(p.calculate_total(72), bolh(300));

        // 7 days (168h) = 700 - 10% = 630 BOLH
        assert_eq!(p.calculate_total(168), bolh(630));

        // 30 days (720h) = 3000 - 20% = 2400 BOLH
        assert_eq!(p.calculate_total(720), bolh(2400));
    }

    #[test]
    fn test_full_rental_lifecycle() {
        let engine = RentalEngine::new();

        // Owner creates listing
        let listing_id = engine.create_listing(
            "owner1",
            "Электродрель Bosch",
            "Мощная дрель, отличное состояние",
            RentalCategory::Tools,
            "rent_power",
            None,
            55.75, 37.62, "Москва, ул. Пушкина 10",
            make_pricing(),
            vec![DeliveryOption::SelfPickup, DeliveryOption::CourierDelivery { delivery_order_id: None }],
            5,
            vec!["img1.jpg".into()],
        );
        assert!(listing_id.starts_with("RENT-L-"));

        // Renter requests
        let now = RentalEngine::now_ms();
        let order_id = engine.request_rental(
            &listing_id,
            "renter1",
            now + 86_400_000, // starts tomorrow
            48,                // 2 days
            DeliveryOption::SelfPickup,
            0,
        ).unwrap();
        assert!(order_id.starts_with("RENT-O-"));

        // Check state
        let order = engine.get_order(&order_id).unwrap();
        assert_eq!(order.state, RentalState::Requested);
        assert_eq!(order.rental_fee, bolh(200)); // 2 days * 100
        assert_eq!(order.deposit, bolh(500));

        // Owner approves
        engine.approve_rental(&order_id, "ESC-001").unwrap();
        let order = engine.get_order(&order_id).unwrap();
        assert_eq!(order.state, RentalState::Reserved);

        // Start rental
        engine.start_rental(&order_id).unwrap();
        let order = engine.get_order(&order_id).unwrap();
        assert_eq!(order.state, RentalState::Active);

        // Listing should be unavailable
        let listing = engine.get_listing(&listing_id).unwrap();
        assert!(!listing.is_available);

        // Renter returns
        let late_penalty = engine.return_item(&order_id).unwrap();
        // Not late (we just started), so no penalty
        assert_eq!(late_penalty, 0);

        // Owner confirms return — no damage
        let settlement = engine.confirm_return(&order_id, 5, 0).unwrap();
        assert_eq!(settlement.owner_receives, bolh(200)); // rental fee
        assert_eq!(settlement.renter_receives, bolh(500)); // full deposit back
        assert_eq!(settlement.damage_deducted, 0);

        // Listing available again
        let listing = engine.get_listing(&listing_id).unwrap();
        assert!(listing.is_available);
        assert_eq!(listing.total_rentals, 1);
    }

    #[test]
    fn test_damage_deduction() {
        let engine = RentalEngine::new();

        let lid = engine.create_listing(
            "owner1", "Камера Canon", "Pro camera",
            RentalCategory::Electronics, "rent_camera",
            None,
            55.75, 37.62, "Москва",
            make_pricing(),
            vec![DeliveryOption::SelfPickup],
            5, vec![],
        );

        let now = RentalEngine::now_ms();
        let oid = engine.request_rental(&lid, "renter1", now, 24, DeliveryOption::SelfPickup, 0).unwrap();
        engine.approve_rental(&oid, "ESC-002").unwrap();
        engine.start_rental(&oid).unwrap();
        engine.return_item(&oid).unwrap();

        // Damage: 200 BOLH out of 500 deposit
        let settlement = engine.confirm_return(&oid, 3, bolh(200)).unwrap();
        assert_eq!(settlement.damage_deducted, bolh(200));
        assert_eq!(settlement.renter_receives, bolh(300));  // 500 - 200
        assert_eq!(settlement.owner_receives, bolh(300));    // 100 fee + 200 damage
    }

    #[test]
    fn test_cannot_rent_own_item() {
        let engine = RentalEngine::new();
        let lid = engine.create_listing(
            "user1", "Test", "Test",
            RentalCategory::Other, "rent_sport",
            None,
            0.0, 0.0, "Loc",
            make_pricing(),
            vec![DeliveryOption::SelfPickup],
            4, vec![],
        );

        let now = RentalEngine::now_ms();
        let result = engine.request_rental(&lid, "user1", now, 24, DeliveryOption::SelfPickup, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("own item"));
    }

    #[test]
    fn test_search_by_category() {
        let engine = RentalEngine::new();

        engine.create_listing(
            "owner1", "Drill", "Test",
            RentalCategory::Tools, "rent_power", None,
            55.75, 37.62, "Moscow",
            make_pricing(), vec![DeliveryOption::SelfPickup], 4, vec![],
        );
        engine.create_listing(
            "owner2", "Car", "Test",
            RentalCategory::Transport, "rent_car", None,
            55.76, 37.63, "Moscow",
            make_pricing(), vec![DeliveryOption::SelfPickup], 5, vec![],
        );

        let tools = engine.search_listings(Some(RentalCategory::Tools), None, None, None, None);
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].title, "Drill");

        let all = engine.search_listings(None, None, None, None, None);
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_distance_filter() {
        let engine = RentalEngine::new();

        // Moscow center
        engine.create_listing(
            "o1", "Near", "Test",
            RentalCategory::Tools, "rent_power", None,
            55.7558, 37.6173, "Center",
            make_pricing(), vec![], 4, vec![],
        );
        // 50+ km away
        engine.create_listing(
            "o2", "Far", "Test",
            RentalCategory::Tools, "rent_power", None,
            56.3, 37.6, "Far away",
            make_pricing(), vec![], 4, vec![],
        );

        // Search within 10km of center
        let nearby = engine.search_listings(
            None, Some(55.7558), Some(37.6173), Some(10.0), None,
        );
        assert_eq!(nearby.len(), 1);
        assert_eq!(nearby[0].title, "Near");
    }
}
