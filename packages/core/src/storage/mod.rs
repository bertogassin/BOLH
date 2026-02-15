//! Secure storage module
//! 
//! Encrypted key-value storage

use crate::crypto::CryptoService;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Secure storage with encryption
pub struct SecureStorage {
    data: HashMap<String, String>,
    master_key: Option<String>,
    is_unlocked: bool,
}

impl SecureStorage {
    pub fn new() -> Self {
        Self {
            data: HashMap::new(),
            master_key: None,
            is_unlocked: false,
        }
    }

    /// Initialize storage with a master key
    pub fn initialize(&mut self, master_key: &str) -> Result<(), StorageError> {
        let key_hash = CryptoService::sha256(&format!("{}:guardio_salt_v2", master_key));
        self.master_key = Some(key_hash[..32].to_string());
        self.is_unlocked = true;
        Ok(())
    }

    /// Unlock storage with master key
    pub fn unlock(&mut self, master_key: &str) -> Result<(), StorageError> {
        self.initialize(master_key)
    }

    /// Lock storage
    pub fn lock(&mut self) {
        self.is_unlocked = false;
    }

    /// Check if storage is unlocked
    pub fn is_unlocked(&self) -> bool {
        self.is_unlocked
    }

    /// Write encrypted value
    pub fn write(&mut self, key: &str, value: &str) -> Result<(), StorageError> {
        if !self.is_unlocked {
            return Err(StorageError::Locked);
        }

        let encryption_key = self.get_derived_key(key)?;
        let encrypted = CryptoService::encrypt_aes256(value, &encryption_key)
            .map_err(|_| StorageError::EncryptionFailed)?;

        self.data.insert(key.to_string(), encrypted);
        Ok(())
    }

    /// Read and decrypt value
    pub fn read(&self, key: &str) -> Result<Option<String>, StorageError> {
        if !self.is_unlocked {
            return Err(StorageError::Locked);
        }

        let encrypted = match self.data.get(key) {
            Some(v) => v,
            None => return Ok(None),
        };

        let encryption_key = self.get_derived_key(key)?;
        let decrypted = CryptoService::decrypt_aes256(encrypted, &encryption_key)
            .map_err(|_| StorageError::DecryptionFailed)?;

        Ok(Some(decrypted))
    }

    /// Delete a key
    pub fn delete(&mut self, key: &str) -> Result<bool, StorageError> {
        if !self.is_unlocked {
            return Err(StorageError::Locked);
        }
        Ok(self.data.remove(key).is_some())
    }

    /// Check if key exists
    pub fn contains(&self, key: &str) -> bool {
        self.data.contains_key(key)
    }

    /// Clear all data
    pub fn clear(&mut self) -> Result<(), StorageError> {
        if !self.is_unlocked {
            return Err(StorageError::Locked);
        }
        self.data.clear();
        Ok(())
    }

    /// Get all keys
    pub fn keys(&self) -> Vec<String> {
        self.data.keys().cloned().collect()
    }

    /// Derive encryption key for a specific item
    fn get_derived_key(&self, item_key: &str) -> Result<String, StorageError> {
        let master = self.master_key.as_ref().ok_or(StorageError::NotInitialized)?;
        let derived = CryptoService::sha256(&format!("{}:{}", master, item_key));
        
        // Convert hex to base64 for AES key (take first 32 bytes)
        let bytes: Vec<u8> = (0..32)
            .map(|i| u8::from_str_radix(&derived[i*2..i*2+2], 16).unwrap_or(0))
            .collect();
        Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes))
    }

    /// Store a card securely
    pub fn store_card(&mut self, card: &PaymentCard) -> Result<String, StorageError> {
        let card_id = uuid::Uuid::new_v4().to_string();
        let json = serde_json::to_string(card).map_err(|_| StorageError::SerializationFailed)?;
        self.write(&format!("card:{}", card_id), &json)?;
        Ok(card_id)
    }

    /// Retrieve a card
    pub fn get_card(&self, card_id: &str) -> Result<Option<PaymentCard>, StorageError> {
        let json = self.read(&format!("card:{}", card_id))?;
        match json {
            Some(j) => {
                let card: PaymentCard = serde_json::from_str(&j)
                    .map_err(|_| StorageError::DeserializationFailed)?;
                Ok(Some(card))
            }
            None => Ok(None),
        }
    }

    /// Store credentials
    pub fn store_credentials(&mut self, creds: &Credentials) -> Result<(), StorageError> {
        let json = serde_json::to_string(creds).map_err(|_| StorageError::SerializationFailed)?;
        self.write("credentials", &json)
    }

    /// Get credentials
    pub fn get_credentials(&self) -> Result<Option<Credentials>, StorageError> {
        let json = self.read("credentials")?;
        match json {
            Some(j) => {
                let creds: Credentials = serde_json::from_str(&j)
                    .map_err(|_| StorageError::DeserializationFailed)?;
                Ok(Some(creds))
            }
            None => Ok(None),
        }
    }
}

impl Default for SecureStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentCard {
    pub number_masked: String,  // **** **** **** 1234
    pub holder_name: String,
    pub expiry_month: u8,
    pub expiry_year: u16,
    pub card_type: CardType,
    pub token: String,          // Payment processor token
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CardType {
    Visa,
    Mastercard,
    AmericanExpress,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: i64,
    pub expires_at: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Storage is locked")]
    Locked,
    #[error("Storage not initialized")]
    NotInitialized,
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Serialization failed")]
    SerializationFailed,
    #[error("Deserialization failed")]
    DeserializationFailed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secure_storage() {
        let mut storage = SecureStorage::new();
        storage.initialize("my_master_key").unwrap();

        storage.write("secret", "my_secret_value").unwrap();
        let value = storage.read("secret").unwrap();
        assert_eq!(value, Some("my_secret_value".to_string()));

        storage.lock();
        assert!(storage.read("secret").is_err());
    }
}
