//! BOLH Chain — Quantum-resistant, private, modular blockchain
//!
//! # Architecture
//! - **types**: Core data structures (Block, Transaction, Address, Account)
//! - **storage**: Persistent storage via RocksDB
//! - **network**: P2P networking via libp2p
//! - **consensus**: Proof of Stake (calls SPARK/Ada via FFI)
//! - **mempool**: Transaction pool
//! - **executor**: Parallel transaction execution
//! - **rpc**: JSON-RPC server for UI communication
//!
//! # Tokenomics
//! - Total supply: 10,000,000,000 BOLH
//! - 60% mining/earn, 20% referral, 10% advertising, 10% reserve

pub mod types;
pub mod storage;
pub mod network;
pub mod consensus;
pub mod mempool;
pub mod executor;
pub mod rpc;
pub mod metrics;
pub mod wallet;
pub mod chain;
pub mod security;
pub mod contract;
pub mod referral;
pub mod ffi;

/// BOLH Chain version
pub const VERSION: &str = "0.1.0";

/// Total supply: 10 billion BOLH (with 8 decimal places)
/// Supply is fixed and must never change (no burn or mint beyond defined pools).
pub const TOTAL_SUPPLY: u64 = 10_000_000_000__00_000_000; // 10B * 10^8 decimals

/// Decimal places for BOLH
pub const DECIMALS: u8 = 8;

/// Minimum transaction fee
pub const MIN_FEE: u64 = 1_000; // 0.00001 BOLH

/// Block time target in milliseconds
pub const BLOCK_TIME_MS: u64 = 500; // 0.5 seconds for speed

/// Maximum transactions per block
pub const MAX_TXS_PER_BLOCK: usize = 50_000;

/// Distribution pools
pub mod distribution {
    use super::TOTAL_SUPPLY;

    /// 60% — mining/earn via app (ads, tasks, faucet)
    pub const MINING_POOL: u64 = TOTAL_SUPPLY / 100 * 60;

    /// 20% — referral program
    pub const REFERRAL_POOL: u64 = TOTAL_SUPPLY / 100 * 20;

    /// 10% — advertising fund
    pub const ADVERTISING_POOL: u64 = TOTAL_SUPPLY / 100 * 10;

    /// 10% — reserve (development, partnerships)
    pub const RESERVE_POOL: u64 = TOTAL_SUPPLY / 100 * 10;

    /// Referral tiers
    pub mod referral {
        /// First 1,000 users: 10,000 BOLH each (to both inviter and invitee)
        pub const TIER1_LIMIT: u64 = 1_000;
        pub const TIER1_REWARD: u64 = 10_000__00_000_000; // 10,000 BOLH

        /// 1,001 - 10,000 users: 2,500 BOLH each
        pub const TIER2_LIMIT: u64 = 10_000;
        pub const TIER2_REWARD: u64 = 2_500__00_000_000;

        /// 10,001 - 100,000 users: 1,000 BOLH each
        pub const TIER3_LIMIT: u64 = 100_000;
        pub const TIER3_REWARD: u64 = 1_000__00_000_000;

        /// 100,001+: 500 BOLH each
        pub const TIER4_REWARD: u64 = 500__00_000_000;

        /// Get reward for given user count
        pub fn reward_for_user(user_count: u64) -> u64 {
            if user_count <= TIER1_LIMIT {
                TIER1_REWARD
            } else if user_count <= TIER2_LIMIT {
                TIER2_REWARD
            } else if user_count <= TIER3_LIMIT {
                TIER3_REWARD
            } else {
                TIER4_REWARD
            }
        }
    }
}
