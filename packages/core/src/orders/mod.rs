//! Orders module
//! 
//! Order management, state machine, pricing

use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Order status state machine
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    New,
    Accepted,
    InProgress,
    Completed,
    Cancelled,
    Disputed,
}

impl OrderStatus {
    /// Get valid transitions from current status
    pub fn valid_transitions(&self) -> Vec<OrderStatus> {
        match self {
            OrderStatus::New => vec![OrderStatus::Accepted, OrderStatus::Cancelled],
            OrderStatus::Accepted => vec![OrderStatus::InProgress, OrderStatus::Cancelled],
            OrderStatus::InProgress => vec![OrderStatus::Completed, OrderStatus::Disputed],
            OrderStatus::Completed => vec![OrderStatus::Disputed],
            OrderStatus::Cancelled => vec![],
            OrderStatus::Disputed => vec![OrderStatus::Completed, OrderStatus::Cancelled],
        }
    }

    /// Check if transition to new status is valid
    pub fn can_transition_to(&self, new_status: OrderStatus) -> bool {
        self.valid_transitions().contains(&new_status)
    }
}

/// Order service type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceType {
    Bodyguard,
    PropertyPatrol,
    EventSecurity,
    VehicleEscort,
    PersonalProtection,
    CctvMonitoring,
    AlarmResponse,
    Custom,
}

impl ServiceType {
    /// Get base hourly rate in KZT
    pub fn base_rate(&self) -> i64 {
        match self {
            ServiceType::Bodyguard => 5000,
            ServiceType::PropertyPatrol => 3000,
            ServiceType::EventSecurity => 4000,
            ServiceType::VehicleEscort => 6000,
            ServiceType::PersonalProtection => 8000,
            ServiceType::CctvMonitoring => 2000,
            ServiceType::AlarmResponse => 10000,
            ServiceType::Custom => 5000,
        }
    }
}

/// Order entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub client_id: i64,
    pub guard_id: Option<i64>,
    pub service_type: ServiceType,
    pub status: OrderStatus,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub description: Option<String>,
    pub scheduled_at: Option<DateTime<Utc>>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub duration_hours: f64,
    pub price: i64,
    pub currency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Order {
    pub fn new(client_id: i64, service_type: ServiceType, address: String, lat: f64, lng: f64) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            client_id,
            guard_id: None,
            service_type,
            status: OrderStatus::New,
            address,
            latitude: lat,
            longitude: lng,
            description: None,
            scheduled_at: None,
            started_at: None,
            completed_at: None,
            duration_hours: 1.0,
            price: 0,
            currency: "KZT".to_string(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Calculate price based on service type and duration
    pub fn calculate_price(&mut self, pricing: &PricingConfig) {
        let base = self.service_type.base_rate();
        let hours = self.duration_hours.max(1.0);
        
        let mut price = (base as f64 * hours) as i64;

        // Apply time multipliers
        if let Some(scheduled) = self.scheduled_at {
            let hour = scheduled.hour();
            if hour >= 22 || hour < 6 {
                price = (price as f64 * pricing.night_multiplier) as i64;
            }
            if scheduled.weekday().num_days_from_monday() >= 5 {
                price = (price as f64 * pricing.weekend_multiplier) as i64;
            }
        }

        // Apply surge pricing if applicable
        price = (price as f64 * pricing.surge_multiplier) as i64;

        self.price = price;
    }

    /// Transition to new status
    pub fn transition_to(&mut self, new_status: OrderStatus) -> Result<(), OrderError> {
        if !self.status.can_transition_to(new_status) {
            return Err(OrderError::InvalidTransition {
                from: self.status,
                to: new_status,
            });
        }

        match new_status {
            OrderStatus::InProgress => self.started_at = Some(Utc::now()),
            OrderStatus::Completed => self.completed_at = Some(Utc::now()),
            _ => {}
        }

        self.status = new_status;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// Assign guard to order
    pub fn assign_guard(&mut self, guard_id: i64) -> Result<(), OrderError> {
        if self.status != OrderStatus::New {
            return Err(OrderError::CannotAssign);
        }
        self.guard_id = Some(guard_id);
        self.transition_to(OrderStatus::Accepted)?;
        Ok(())
    }
}

/// Pricing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingConfig {
    pub night_multiplier: f64,      // 22:00 - 06:00
    pub weekend_multiplier: f64,
    pub holiday_multiplier: f64,
    pub surge_multiplier: f64,
    pub min_price: i64,
}

impl Default for PricingConfig {
    fn default() -> Self {
        Self {
            night_multiplier: 1.5,
            weekend_multiplier: 1.2,
            holiday_multiplier: 2.0,
            surge_multiplier: 1.0,
            min_price: 3000,
        }
    }
}

/// Recurring order configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringOrder {
    pub id: Uuid,
    pub base_order: Order,
    pub frequency: RecurringFrequency,
    pub days_of_week: Vec<u8>,      // 0 = Monday, 6 = Sunday
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum RecurringFrequency {
    Daily,
    Weekly,
    BiWeekly,
    Monthly,
}

#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("Invalid status transition from {from:?} to {to:?}")]
    InvalidTransition { from: OrderStatus, to: OrderStatus },
    #[error("Cannot assign guard in current status")]
    CannotAssign,
    #[error("Order not found")]
    NotFound,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_order_state_machine() {
        let mut order = Order::new(1, ServiceType::Bodyguard, "Test Address".into(), 43.0, 77.0);
        
        assert_eq!(order.status, OrderStatus::New);
        
        order.assign_guard(100).unwrap();
        assert_eq!(order.status, OrderStatus::Accepted);
        
        order.transition_to(OrderStatus::InProgress).unwrap();
        assert!(order.started_at.is_some());
        
        order.transition_to(OrderStatus::Completed).unwrap();
        assert!(order.completed_at.is_some());
    }

    #[test]
    fn test_pricing() {
        let mut order = Order::new(1, ServiceType::Bodyguard, "Test".into(), 43.0, 77.0);
        order.duration_hours = 2.0;
        
        let config = PricingConfig::default();
        order.calculate_price(&config);
        
        assert_eq!(order.price, 10000); // 5000 * 2 hours
    }
}
