// core/domain/src/lib.rs
// Pure domain model. No framework dependencies.

mod auth;
mod encryption;

pub use auth::{hash_password, verify_password, AuthConfig, AuthError, TokenPair, generate_biometric_challenge};
pub use encryption::{decrypt_price, encrypt_price, EncryptionError};

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// === Identifiers ===
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct OrderId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BidId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct GuardId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AgencyId(pub Uuid);

// === Currency and money ===
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Currency {
    #[default]
    Rub,
    Usd,
    Eur,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    amount: Decimal,
    currency: Currency,
}

impl Money {
    pub fn new(amount: Decimal, currency: Currency) -> Result<Self, DomainError> {
        if amount < Decimal::ZERO {
            return Err(DomainError::NegativeMoney);
        }
        Ok(Self { amount, currency })
    }
    pub fn amount(&self) -> Decimal {
        self.amount
    }
    pub fn currency(&self) -> Currency {
        self.currency
    }
}

// === Reputation ===
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct ReputationScore(pub f64);

// === Geo and availability ===
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeoPoint {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Availability {
    pub slots: Vec<TimeSlot>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TimeSlot {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

// === License ===
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseType {
    Weapon,
    Medical,
    Security,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct License {
    pub license_type: LicenseType,
    pub verified: bool,
    pub expiry_date: chrono::NaiveDate,
}

// === Order requirements ===
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Requirements {
    pub title: String,
    pub description: String,
    pub required_licenses: Vec<LicenseType>,
    pub guard_count: u32,
}

// === Order status ===
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Open,
    Matched,
    InProgress,
    Completed,
    Cancelled,
}

// === User ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UserType {
    Client,
    Guard,
    Agency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: UserId,
    pub user_type: UserType,
    pub email: String,
    pub phone: String,
    pub verified: bool,
    pub reputation: ReputationScore,
    pub created_at: DateTime<Utc>,
}

// === Guard ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guard {
    pub user_id: UserId,
    pub licenses: Vec<License>,
    pub rate: Money,
    pub location: GeoPoint,
    pub availability: Availability,
}

// === Order ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub client_id: UserId,
    pub requirements: Requirements,
    pub budget_range: (Money, Money),
    pub location: GeoPoint,
    pub time_window: (DateTime<Utc>, DateTime<Utc>),
    pub status: OrderStatus,
    /// Price is hidden from everyone except the matching algorithm.
    pub matched_price: Option<Money>,
}

/// Client-facing projection without budget and price.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientOrderView {
    pub id: OrderId,
    pub requirements: Requirements,
    pub location: GeoPoint,
    pub time_window: (DateTime<Utc>, DateTime<Utc>),
    pub status: OrderStatus,
}

impl Order {
    pub fn new(
        client_id: UserId,
        requirements: Requirements,
        budget_range: (Money, Money),
        location: GeoPoint,
        time_window: (DateTime<Utc>, DateTime<Utc>),
    ) -> Result<Self, DomainError> {
        let min_rate = Money::new(Decimal::new(500, 2), Currency::Usd)?; // $5.00
        if budget_range.0.amount < min_rate.amount {
            return Err(DomainError::BudgetTooLow);
        }
        Ok(Self {
            id: OrderId(Uuid::new_v4()),
            client_id,
            requirements,
            budget_range,
            location,
            time_window,
            status: OrderStatus::Open,
            matched_price: None,
        })
    }

    pub fn client_view(&self) -> ClientOrderView {
        ClientOrderView {
            id: self.id,
            requirements: self.requirements.clone(),
            location: self.location.clone(),
            time_window: self.time_window,
            status: self.status,
        }
    }
}

// === Bid (offer) ===
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BidderType {
    Guard,
    Agency,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bid {
    pub id: BidId,
    pub bidder_type: BidderType,
    pub bidder_id: Uuid,
    pub guard_id: GuardId,
    pub agency_id: Option<AgencyId>,
    pub price: Money,
    pub location: GeoPoint,
    pub licenses: Vec<LicenseType>,
    pub valid_from: DateTime<Utc>,
    pub valid_to: DateTime<Utc>,
}

// === Match (matching result) ===
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub order_id: OrderId,
    pub bid_id: BidId,
    pub guard_id: GuardId,
    pub agency_id: Option<AgencyId>,
    pub final_price: Money,
}

impl Match {
    pub fn new(
        order_id: OrderId,
        bid_id: BidId,
        guard_id: GuardId,
        agency_id: Option<AgencyId>,
        final_price: Money,
    ) -> Self {
        Self {
            order_id,
            bid_id,
            guard_id,
            agency_id,
            final_price,
        }
    }
}

// === Domain errors ===
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("Money amount cannot be negative")]
    NegativeMoney,

    #[error("Order budget is below minimum rate")]
    BudgetTooLow,

    #[error("Guard does not have required license: {0}")]
    MissingLicense(String),

    #[error("User not verified")]
    UnverifiedUser,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};
    use rust_decimal::Decimal;

    #[test]
    fn order_creation_with_valid_budget() {
        let client_id = UserId(Uuid::new_v4());
        let budget_min = Money::new(Decimal::new(10000, 2), Currency::Usd).unwrap(); // $100
        let budget_max = Money::new(Decimal::new(50000, 2), Currency::Usd).unwrap(); // $500
        let location = GeoPoint {
            lat: 55.7558,
            lon: 37.6173,
        };
        let now = Utc::now();
        let time_window = (now, now + Duration::hours(5));

        let order = Order::new(
            client_id,
            Requirements::default(),
            (budget_min, budget_max),
            location,
            time_window,
        );

        assert!(order.is_ok());
        let order = order.unwrap();
        assert_eq!(order.status, OrderStatus::Open);
        assert!(order.matched_price.is_none());
        assert_eq!(order.client_id, client_id);
    }

    #[test]
    fn order_creation_with_budget_below_minimum() {
        let client_id = UserId(Uuid::new_v4());
        let budget_min = Money::new(Decimal::new(100, 2), Currency::Usd).unwrap(); // $1
        let budget_max = Money::new(Decimal::new(1000, 2), Currency::Usd).unwrap();
        let location = GeoPoint {
            lat: 55.7558,
            lon: 37.6173,
        };
        let now = Utc::now();
        let time_window = (now, now + Duration::hours(5));

        let order = Order::new(
            client_id,
            Requirements::default(),
            (budget_min, budget_max),
            location,
            time_window,
        );

        assert!(matches!(order, Err(DomainError::BudgetTooLow)));
    }

    #[test]
    fn order_client_view_hides_budget_and_price() {
        let client_id = UserId(Uuid::new_v4());
        let budget_min = Money::new(Decimal::new(10000, 2), Currency::Usd).unwrap();
        let budget_max = Money::new(Decimal::new(50000, 2), Currency::Usd).unwrap();
        let location = GeoPoint {
            lat: 55.7558,
            lon: 37.6173,
        };
        let now = Utc::now();
        let time_window = (now, now + Duration::hours(5));
        let order = Order::new(
            client_id,
            Requirements::default(),
            (budget_min, budget_max),
            location.clone(),
            time_window,
        )
        .unwrap();

        let view = order.client_view();
        assert_eq!(view.id, order.id);
        assert_eq!(view.status, OrderStatus::Open);
        assert_eq!(view.location.lat, location.lat);
    }
}
