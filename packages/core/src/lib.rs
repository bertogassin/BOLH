//! BOLH Core Library
//!
//! Shared business logic, cryptography, and utilities for all BOLH platforms.

pub mod auth;
pub mod crypto;
pub mod geo;
pub mod validation;
pub mod storage;
pub mod orders;
pub mod guards;
pub mod payments;

// Re-exports
pub use auth::*;
pub use crypto::CryptoService;
pub use geo::GeoService;
pub use validation::ValidationService;
pub use storage::SecureStorage;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Initialize the core library
pub fn init() {
    tracing::info!("BOLH Core v{} initialized", VERSION);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        init();
        assert!(!VERSION.is_empty());
    }
}
