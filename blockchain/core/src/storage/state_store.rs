use rocksdb::{DB, Options};
use std::path::Path;
use crate::types::{Account, Address, Hash};
use super::StorageError;

/// Account state storage using RocksDB
pub struct StateStore {
    db: DB,
}

impl StateStore {
    /// Open or create state store at path
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, StorageError> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.set_compression_type(rocksdb::DBCompressionType::Lz4);
        let db = DB::open(&opts, path)?;
        Ok(StateStore { db })
    }

    /// Get account by address
    pub fn get_account(&self, addr: &Address) -> Result<Account, StorageError> {
        match self.db.get(&addr.0)? {
            Some(value) => {
                bincode::deserialize(&value).map_err(|e| StorageError::Serialize(e.to_string()))
            }
            None => Ok(Account::new()), // Return empty account if not found
        }
    }

    /// Store account state
    pub fn put_account(&self, addr: &Address, account: &Account) -> Result<(), StorageError> {
        let value = bincode::serialize(account).map_err(|e| StorageError::Serialize(e.to_string()))?;
        self.db.put(&addr.0, value)?;
        Ok(())
    }

    /// Check if account exists with non-zero balance
    pub fn account_exists(&self, addr: &Address) -> Result<bool, StorageError> {
        Ok(self.db.get(&addr.0)?.is_some())
    }

    /// Get total number of accounts (approximate)
    pub fn account_count(&self) -> Result<u64, StorageError> {
        match self.db.get(b"__account_count")? {
            Some(bytes) => Ok(u64::from_be_bytes(bytes.try_into().unwrap_or([0u8; 8]))),
            None => Ok(0),
        }
    }

    /// Increment account counter
    pub fn increment_account_count(&self) -> Result<u64, StorageError> {
        let count = self.account_count()? + 1;
        self.db.put(b"__account_count", count.to_be_bytes())?;
        Ok(count)
    }

    /// Store referral user count (for tier calculation)
    pub fn get_referral_count(&self) -> Result<u64, StorageError> {
        match self.db.get(b"__referral_count")? {
            Some(bytes) => Ok(u64::from_be_bytes(bytes.try_into().unwrap_or([0u8; 8]))),
            None => Ok(0),
        }
    }

    /// Increment referral counter
    pub fn increment_referral_count(&self) -> Result<u64, StorageError> {
        let count = self.get_referral_count()? + 1;
        self.db.put(b"__referral_count", count.to_be_bytes())?;
        Ok(count)
    }

    /// Compute state root (simple hash of all accounts for now)
    pub fn compute_state_root(&self) -> Hash {
        use sha3::{Digest, Sha3_256};
        let mut hasher = Sha3_256::new();

        let iter = self.db.iterator(rocksdb::IteratorMode::Start);
        for item in iter {
            if let Ok((key, value)) = item {
                if !key.starts_with(b"__") {
                    hasher.update(&key);
                    hasher.update(&value);
                }
            }
        }

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}
