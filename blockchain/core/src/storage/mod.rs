pub mod block_store;
pub mod state_store;
pub mod append_log;

pub use block_store::BlockStore;
pub use state_store::StateStore;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Storage error: {0}")]
    Db(String),
    #[error("Serialization error: {0}")]
    Serialize(String),
    #[error("Block not found at height {0}")]
    BlockNotFound(u64),
    #[error("Account not found: {0}")]
    AccountNotFound(String),
}
