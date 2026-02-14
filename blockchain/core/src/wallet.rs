//! BOLH Wallet — Real Ed25519 keypair management
//!
//! Each wallet contains:
//! - Ed25519 signing keypair (secret + public)
//! - BOLH address derived from SHA3-256(public_key)[0..20]
//! - Human-readable name

use ed25519_dalek::{SigningKey, VerifyingKey, Signer, Verifier, Signature};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use crate::types::Address;

/// A BOLH wallet with real Ed25519 keys
#[derive(Clone)]
pub struct Wallet {
    /// Human-readable name
    pub name: String,
    /// Ed25519 signing key (secret)
    signing_key: SigningKey,
    /// Ed25519 verifying key (public)  
    pub verifying_key: VerifyingKey,
    /// BOLH address derived from public key
    pub address: Address,
    /// Creation timestamp
    pub created_at: u64,
}

/// Serializable wallet info (without secret key)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WalletInfo {
    pub name: String,
    pub address: String,
    pub pubkey: String,
    pub created_at: u64,
}

/// Serializable wallet export (WITH secret key — for backup only)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WalletExport {
    pub name: String,
    pub address: String,
    pub pubkey: String,
    pub seckey: String,
    pub created_at: u64,
}

impl Wallet {
    /// Create a new wallet with a fresh Ed25519 keypair
    pub fn new(name: &str) -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let address = Address::from_public_key(verifying_key.as_bytes());
        
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Wallet {
            name: name.to_string(),
            signing_key,
            verifying_key,
            address,
            created_at,
        }
    }

    /// Import wallet from secret key bytes
    pub fn from_secret_key(name: &str, secret_bytes: &[u8; 32]) -> Self {
        let signing_key = SigningKey::from_bytes(secret_bytes);
        let verifying_key = signing_key.verifying_key();
        let address = Address::from_public_key(verifying_key.as_bytes());
        
        let created_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Wallet {
            name: name.to_string(),
            signing_key,
            verifying_key,
            address,
            created_at,
        }
    }

    /// Import wallet from hex-encoded secret key
    pub fn from_secret_hex(name: &str, hex_key: &str) -> Result<Self, String> {
        let bytes = hex::decode(hex_key).map_err(|e| format!("Invalid hex: {}", e))?;
        if bytes.len() != 32 {
            return Err(format!("Expected 32 bytes, got {}", bytes.len()));
        }
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&bytes);
        Ok(Self::from_secret_key(name, &key_bytes))
    }

    /// Sign arbitrary bytes with this wallet's private key
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        let signature = self.signing_key.sign(message);
        signature.to_bytes().to_vec()
    }

    /// Sign a transaction's signing bytes
    pub fn sign_transaction(&self, tx_bytes: &[u8]) -> Vec<u8> {
        self.sign(tx_bytes)
    }

    /// Get public key bytes
    pub fn public_key_bytes(&self) -> Vec<u8> {
        self.verifying_key.as_bytes().to_vec()
    }

    /// Get public key as hex string
    pub fn public_key_hex(&self) -> String {
        hex::encode(self.verifying_key.as_bytes())
    }

    /// Get secret key as hex string (for export/backup ONLY)
    pub fn secret_key_hex(&self) -> String {
        hex::encode(self.signing_key.to_bytes())
    }

    /// Get wallet info (safe, no secret key)
    pub fn info(&self) -> WalletInfo {
        WalletInfo {
            name: self.name.clone(),
            address: self.address.to_bech32(),
            pubkey: self.public_key_hex(),
            created_at: self.created_at,
        }
    }

    /// Export wallet (includes secret key!)
    pub fn export(&self) -> WalletExport {
        WalletExport {
            name: self.name.clone(),
            address: self.address.to_bech32(),
            pubkey: self.public_key_hex(),
            seckey: self.secret_key_hex(),
            created_at: self.created_at,
        }
    }
}

/// Verify an Ed25519 signature given public key bytes, message, and signature bytes
pub fn verify_ed25519(pubkey_bytes: &[u8], message: &[u8], sig_bytes: &[u8]) -> bool {
    if pubkey_bytes.len() != 32 || sig_bytes.len() != 64 {
        return false;
    }

    let Ok(verifying_key) = VerifyingKey::try_from(&pubkey_bytes[..32]) else {
        return false;
    };

    let Ok(signature) = Signature::try_from(&sig_bytes[..64]) else {
        return false;
    };

    verifying_key.verify(message, &signature).is_ok()
}

/// Derive a BOLH address from public key bytes
pub fn address_from_pubkey(pubkey_bytes: &[u8]) -> String {
    Address::from_public_key(pubkey_bytes).to_bech32()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wallet_creation() {
        let wallet = Wallet::new("test");
        assert_eq!(wallet.name, "test");
        assert!(!wallet.address.is_zero());
        assert_eq!(wallet.public_key_bytes().len(), 32);
    }

    #[test]
    fn test_sign_and_verify() {
        let wallet = Wallet::new("signer");
        let message = b"Hello BOLH blockchain!";
        
        let signature = wallet.sign(message);
        assert_eq!(signature.len(), 64); // Ed25519 signature is 64 bytes
        
        let valid = verify_ed25519(&wallet.public_key_bytes(), message, &signature);
        assert!(valid);
        
        // Tampered message should fail
        let invalid = verify_ed25519(&wallet.public_key_bytes(), b"tampered", &signature);
        assert!(!invalid);
    }

    #[test]
    fn test_wallet_import_export() {
        let wallet1 = Wallet::new("original");
        let export = wallet1.export();
        
        let wallet2 = Wallet::from_secret_hex("imported", &export.seckey).unwrap();
        
        assert_eq!(wallet1.address, wallet2.address);
        assert_eq!(wallet1.public_key_hex(), wallet2.public_key_hex());
        
        // Both should produce valid signatures
        let msg = b"test message";
        let sig1 = wallet1.sign(msg);
        let sig2 = wallet2.sign(msg);
        assert_eq!(sig1, sig2); // Same key = same signature for Ed25519
    }

    #[test]
    fn test_address_deterministic() {
        let secret = [42u8; 32];
        let w1 = Wallet::from_secret_key("a", &secret);
        let w2 = Wallet::from_secret_key("b", &secret);
        assert_eq!(w1.address, w2.address);
        assert_eq!(w1.public_key_hex(), w2.public_key_hex());
    }
}
