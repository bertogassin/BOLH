//! BOLH Core Domain — чистая бизнес-логика, сущности, value objects.
//! Без зависимостей от фреймворков и БД. Соответствует ABSOLUTE_STANDARD.md.

mod bid;
mod client;
mod currency;
mod error;
mod guard;
mod license;
mod match_entity;
mod money;
mod order;
mod agency;

pub use bid::{Bid, BidId, BidderType, ServiceOffer, TimeRange};
pub use client::{Client, ClientId, ReputationScore};
pub use currency::Currency;
pub use error::DomainError;
pub use guard::{AvailabilitySchedule, Guard, GuardId};
pub use license::{License, LicenseType};
pub use match_entity::{Match, MatchStatus};
pub use money::Money;
pub use order::{Order, OrderId, OrderStatus, OrderView, MoneyRange, Requirements, Visibility};
pub use agency::{Agency, AgencyId};

pub use chrono::NaiveDate;
pub use rust_decimal::Decimal;
pub use uuid::Uuid;
