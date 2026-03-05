//! Заказ от клиента. Цена заказа не видна никому, кроме алгоритма.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::DomainError;
use crate::Money;

pub type OrderId = Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Draft,
    Active,
    Matched,
    InProgress,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visibility {
    All,
    VerifiedOnly,
    InviteOnly,
}

/// Требования: локация, время, лицензии (упрощённо).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Requirements {
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    pub radius_km: Option<f64>,
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub required_license_types: Vec<crate::LicenseType>,
}

/// Вилка бюджета клиента.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MoneyRange {
    pub min: Money,
    pub max: Money,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Order {
    pub id: OrderId,
    pub client_id: crate::ClientId,
    pub requirements: Requirements,
    pub budget: MoneyRange,
    pub status: OrderStatus,
    pub visibility: Visibility,
    /// Заполняется после подбора. Не видна никому, кроме Matching Engine.
    pub actual_price: Option<Money>,
}

/// Минимальная ставка охранника (инвариант домена).
pub fn minimum_guard_rate() -> rust_decimal::Decimal {
    use rust_decimal::Decimal;
    Decimal::from(100i64)
}

impl Order {
    pub fn create(
        id: OrderId,
        client_id: crate::ClientId,
        requirements: Requirements,
        budget: MoneyRange,
        visibility: Visibility,
    ) -> Result<Self, DomainError> {
        if budget.max.amount < minimum_guard_rate() {
            return Err(DomainError::BudgetTooLow);
        }
        if !budget.min.is_same_currency(&budget.max) {
            return Err(DomainError::InvalidOrder(
                "budget min/max currency mismatch".into(),
            ));
        }
        Ok(Self {
            id,
            client_id,
            requirements,
            budget,
            status: OrderStatus::Active,
            visibility,
            actual_price: None,
        })
    }

    /// Клиент не видит цены участников и детали бюджета в ответах.
    pub fn visible_to_client(&self) -> OrderView {
        OrderView {
            id: self.id,
            requirements: self.requirements.clone(),
            status: self.status.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OrderView {
    pub id: OrderId,
    pub requirements: Requirements,
    pub status: OrderStatus,
}
