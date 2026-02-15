pub mod block;
pub mod transaction;
pub mod address;

pub use block::{Block, BlockHeader};
pub use transaction::{Transaction, TxType, PrivacyLevel};
pub use address::{Address, Account};

/// Hash type: 32 bytes (SHA3-256 or BLAKE3)
pub type Hash = [u8; 32];

/// Signature type: variable size for post-quantum (Dilithium ~2420 bytes)
pub type Signature = Vec<u8>;

/// Public key type: variable size for post-quantum (Dilithium ~1312 bytes)
pub type PublicKey = Vec<u8>;

/// Amount in smallest unit (1 BOLH = 10^8 units)
pub type Amount = u64;

/// Block height
pub type BlockHeight = u64;

/// Timestamp in milliseconds since epoch
pub type Timestamp = u64;

/// Nonce
pub type Nonce = u64;
