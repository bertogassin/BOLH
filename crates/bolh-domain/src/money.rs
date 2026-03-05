//! Деньги — value object. Не используем f64 для денег.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::currency::Currency;
use crate::DomainError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Money {
    pub amount: Decimal,
    pub currency: Currency,
}

impl Money {
    /// Создаёт Money только при неотрицательной сумме.
    pub fn new(amount: Decimal, currency: Currency) -> Result<Self, DomainError> {
        if amount < Decimal::ZERO {
            return Err(DomainError::InvalidMoney(
                "amount must be non-negative".into(),
            ));
        }
        Ok(Self { amount, currency })
    }

    pub fn is_same_currency(&self, other: &Money) -> bool {
        self.currency == other.currency
    }
}
