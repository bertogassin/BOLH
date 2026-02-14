//! In-memory state store for accounts
//! Will be replaced with RocksDB in production (v0.2)

use std::collections::HashMap;
use std::sync::RwLock;
use crate::types::{Address, Account};
use super::StorageError;

pub struct StateStore {
    accounts: RwLock<HashMap<Vec<u8>, Vec<u8>>>,
}

impl StateStore {
    pub fn new(_path: &str) -> Result<Self, StorageError> {
        Ok(StateStore {
            accounts: RwLock::new(HashMap::new()),
        })
    }

    pub fn get_account(&self, address: &Address) -> Option<Account> {
        let db = self.accounts.read().unwrap();
        let key = address.0.to_vec();
        db.get(&key).and_then(|bytes| {
            bincode::deserialize(bytes).ok()
        })
    }

    pub fn put_account(&self, address: &Address, account: &Account) -> Result<(), StorageError> {
        let mut db = self.accounts.write().unwrap();
        let key = address.0.to_vec();
        let value = bincode::serialize(account)
            .map_err(|e| StorageError::Serialize(e.to_string()))?;
        db.insert(key, value);
        Ok(())
    }

    pub fn get_nonce(&self, address: &Address) -> Result<u64, StorageError> {
        match self.get_account(address) {
            Some(account) => Ok(account.nonce),
            None => Ok(0),
        }
    }

    pub fn get_balance(&self, address: &Address) -> Result<u64, StorageError> {
        match self.get_account(address) {
            Some(account) => Ok(account.balance),
            None => Ok(0),
        }
    }

    pub fn account_count(&self) -> usize {
        let db = self.accounts.read().unwrap();
        db.len()
    }
}
