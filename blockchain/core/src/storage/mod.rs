pub mod block_store;
pub mod state_store;

pub use block_store::BlockStore;
pub use state_store::StateStore;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("RocksDB error: {0}")]
    Db(String),
    #[error("Serialization error: {0}")]
    Serialize(String),
    #[error("Block not found at height {0}")]
    BlockNotFound(u64),
    #[error("Account not found: {0}")]
    AccountNotFound(String),
}

impl From<rocksdb::Error> for StorageError {
    fn from(e: rocksdb::Error) -> Self {
        StorageError::Db(e.to_string())
    }
}
