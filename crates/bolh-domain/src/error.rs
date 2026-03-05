//! Доменные ошибки. Без паники и unwrap в production-коде.

use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq)]
pub enum DomainError {
    #[error("budget below minimum guard rate")]
    BudgetTooLow,

    #[error("invalid order: {0}")]
    InvalidOrder(String),

    #[error("invalid money: {0}")]
    InvalidMoney(String),

    #[error("invalid license: {0}")]
    InvalidLicense(String),
}
