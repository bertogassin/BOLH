//! Payments module
//! 
//! Payment processing, subscriptions, invoices

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Payment status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Refunded,
    Cancelled,
}

/// Payment method type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Card,
    ApplePay,
    GooglePay,
    BankTransfer,
    Cash,
    Wallet,
}

/// Payment entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: Uuid,
    pub order_id: Option<Uuid>,
    pub user_id: i64,
    pub amount: i64,
    pub currency: String,
    pub status: PaymentStatus,
    pub method: PaymentMethod,
    pub card_last_four: Option<String>,
    pub transaction_id: Option<String>,
    pub error_message: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Payment {
    pub fn new(user_id: i64, amount: i64, method: PaymentMethod) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            order_id: None,
            user_id,
            amount,
            currency: "KZT".to_string(),
            status: PaymentStatus::Pending,
            method,
            card_last_four: None,
            transaction_id: None,
            error_message: None,
            metadata: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn mark_processing(&mut self, transaction_id: String) {
        self.status = PaymentStatus::Processing;
        self.transaction_id = Some(transaction_id);
        self.updated_at = Utc::now();
    }

    pub fn mark_completed(&mut self) {
        self.status = PaymentStatus::Completed;
        self.updated_at = Utc::now();
    }

    pub fn mark_failed(&mut self, error: String) {
        self.status = PaymentStatus::Failed;
        self.error_message = Some(error);
        self.updated_at = Utc::now();
    }

    pub fn refund(&mut self) -> Result<(), PaymentError> {
        if self.status != PaymentStatus::Completed {
            return Err(PaymentError::CannotRefund);
        }
        self.status = PaymentStatus::Refunded;
        self.updated_at = Utc::now();
        Ok(())
    }
}

/// Subscription plan
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionPlan {
    Free,
    Basic,
    Premium,
    Enterprise,
}

impl SubscriptionPlan {
    pub fn monthly_price(&self) -> i64 {
        match self {
            SubscriptionPlan::Free => 0,
            SubscriptionPlan::Basic => 4990,
            SubscriptionPlan::Premium => 9990,
            SubscriptionPlan::Enterprise => 29990,
        }
    }

    pub fn features(&self) -> Vec<&'static str> {
        match self {
            SubscriptionPlan::Free => vec![
                "Basic guard discovery",
                "5 orders per month",
                "Standard support",
            ],
            SubscriptionPlan::Basic => vec![
                "Unlimited guard discovery",
                "20 orders per month",
                "Priority support",
                "Order history",
            ],
            SubscriptionPlan::Premium => vec![
                "All Basic features",
                "Unlimited orders",
                "Preferred guards",
                "Real-time tracking",
                "24/7 support",
            ],
            SubscriptionPlan::Enterprise => vec![
                "All Premium features",
                "Custom integrations",
                "Dedicated account manager",
                "API access",
                "Analytics dashboard",
            ],
        }
    }
}

/// User subscription
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub id: Uuid,
    pub user_id: i64,
    pub plan: SubscriptionPlan,
    pub status: SubscriptionStatus,
    pub current_period_start: DateTime<Utc>,
    pub current_period_end: DateTime<Utc>,
    pub cancel_at_period_end: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    PastDue,
    Cancelled,
    Expired,
}

impl Subscription {
    pub fn new(user_id: i64, plan: SubscriptionPlan) -> Self {
        let now = Utc::now();
        let period_end = now + chrono::Duration::days(30);
        
        Self {
            id: Uuid::new_v4(),
            user_id,
            plan,
            status: SubscriptionStatus::Active,
            current_period_start: now,
            current_period_end: period_end,
            cancel_at_period_end: false,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn is_active(&self) -> bool {
        self.status == SubscriptionStatus::Active && Utc::now() < self.current_period_end
    }

    pub fn cancel(&mut self) {
        self.cancel_at_period_end = true;
        self.updated_at = Utc::now();
    }

    pub fn renew(&mut self) {
        self.current_period_start = Utc::now();
        self.current_period_end = Utc::now() + chrono::Duration::days(30);
        self.status = SubscriptionStatus::Active;
        self.cancel_at_period_end = false;
        self.updated_at = Utc::now();
    }
}

/// Invoice entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Invoice {
    pub id: Uuid,
    pub user_id: i64,
    pub number: String,
    pub amount: i64,
    pub currency: String,
    pub status: InvoiceStatus,
    pub items: Vec<InvoiceItem>,
    pub due_date: DateTime<Utc>,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Overdue,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceItem {
    pub description: String,
    pub quantity: i32,
    pub unit_price: i64,
    pub total: i64,
}

impl Invoice {
    pub fn new(user_id: i64, items: Vec<InvoiceItem>) -> Self {
        let total: i64 = items.iter().map(|i| i.total).sum();
        let now = Utc::now();
        
        Self {
            id: Uuid::new_v4(),
            user_id,
            number: format!("INV-{}", Uuid::new_v4().to_string()[..8].to_uppercase()),
            amount: total,
            currency: "KZT".to_string(),
            status: InvoiceStatus::Draft,
            items,
            due_date: now + chrono::Duration::days(14),
            paid_at: None,
            created_at: now,
        }
    }

    pub fn mark_paid(&mut self) {
        self.status = InvoiceStatus::Paid;
        self.paid_at = Some(Utc::now());
    }
}

/// Wallet for in-app balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub user_id: i64,
    pub balance: i64,
    pub currency: String,
    pub updated_at: DateTime<Utc>,
}

impl Wallet {
    pub fn new(user_id: i64) -> Self {
        Self {
            user_id,
            balance: 0,
            currency: "KZT".to_string(),
            updated_at: Utc::now(),
        }
    }

    pub fn add_funds(&mut self, amount: i64) -> Result<(), PaymentError> {
        if amount <= 0 {
            return Err(PaymentError::InvalidAmount);
        }
        self.balance += amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn deduct_funds(&mut self, amount: i64) -> Result<(), PaymentError> {
        if amount <= 0 {
            return Err(PaymentError::InvalidAmount);
        }
        if self.balance < amount {
            return Err(PaymentError::InsufficientFunds);
        }
        self.balance -= amount;
        self.updated_at = Utc::now();
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PaymentError {
    #[error("Cannot refund payment in current status")]
    CannotRefund,
    #[error("Invalid amount")]
    InvalidAmount,
    #[error("Insufficient funds")]
    InsufficientFunds,
    #[error("Payment processing failed: {0}")]
    ProcessingFailed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_payment_lifecycle() {
        let mut payment = Payment::new(1, 5000, PaymentMethod::Card);
        assert_eq!(payment.status, PaymentStatus::Pending);

        payment.mark_processing("txn_123".into());
        assert_eq!(payment.status, PaymentStatus::Processing);

        payment.mark_completed();
        assert_eq!(payment.status, PaymentStatus::Completed);

        payment.refund().unwrap();
        assert_eq!(payment.status, PaymentStatus::Refunded);
    }

    #[test]
    fn test_subscription() {
        let sub = Subscription::new(1, SubscriptionPlan::Premium);
        assert!(sub.is_active());
        assert_eq!(sub.plan.monthly_price(), 9990);
    }

    #[test]
    fn test_wallet() {
        let mut wallet = Wallet::new(1);
        wallet.add_funds(10000).unwrap();
        assert_eq!(wallet.balance, 10000);

        wallet.deduct_funds(3000).unwrap();
        assert_eq!(wallet.balance, 7000);

        assert!(wallet.deduct_funds(10000).is_err());
    }
}
