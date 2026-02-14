//! Wallet Vault (V1) — encrypt/decrypt wallet secret keys at rest.
//!
//! Goal: avoid persisting raw private keys on disk. We derive a 256-bit key
//! from a user-supplied password using Argon2, then encrypt with AES-256-GCM.
//!
//! Notes:
//! - AES-GCM nonce must be unique per encryption (12 bytes).
//! - Argon2 salt must be random and stored alongside ciphertext.
//! - This module does not manage password UX; callers decide how to source it
//!   (env var, UI prompt, OS secret store, etc.).

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{password_hash::SaltString, Argon2};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

/// Encrypted wallet payload (JSON-serializable)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EncryptedWallet {
    /// AES-GCM nonce (12 bytes)
    pub nonce: Vec<u8>,
    /// Ciphertext (includes auth tag)
    pub ciphertext: Vec<u8>,
    /// Argon2 salt (base64 string)
    pub salt: String,
}

#[derive(Debug)]
pub enum VaultError {
    InvalidNonceLength(usize),
    CryptoError(String),
    KdfError(String),
    SaltError(String),
}

impl std::fmt::Display for VaultError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VaultError::InvalidNonceLength(n) => write!(f, "invalid nonce length: {}", n),
            VaultError::CryptoError(e) => write!(f, "crypto error: {}", e),
            VaultError::KdfError(e) => write!(f, "kdf error: {}", e),
            VaultError::SaltError(e) => write!(f, "salt error: {}", e),
        }
    }
}

impl std::error::Error for VaultError {}

/// Derive a 256-bit key from password and salt using Argon2.
pub fn derive_key(password: &str, salt: &SaltString) -> Result<[u8; 32], VaultError> {
    let argon = Argon2::default();
    let mut key = [0u8; 32];
    argon
        // Note: `hash_password_into` accepts arbitrary salt bytes; use the salt string bytes.
        .hash_password_into(password.as_bytes(), salt.as_str().as_bytes(), &mut key)
        .map_err(|e| VaultError::KdfError(e.to_string()))?;
    Ok(key)
}

/// Encrypt a secret key (raw bytes) with a password.
pub fn encrypt_private_key(private_key: &[u8], password: &str) -> Result<EncryptedWallet, VaultError> {
    let salt = SaltString::generate(&mut OsRng);
    let key = derive_key(password, &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;

    let nonce_bytes: [u8; 12] = rand::random();
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce_bytes), private_key)
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;

    Ok(EncryptedWallet {
        nonce: nonce_bytes.to_vec(),
        ciphertext,
        salt: salt.to_string(),
    })
}

/// Decrypt an encrypted secret key with a password.
pub fn decrypt_private_key(wallet: &EncryptedWallet, password: &str) -> Result<Vec<u8>, VaultError> {
    if wallet.nonce.len() != 12 {
        return Err(VaultError::InvalidNonceLength(wallet.nonce.len()));
    }

    let salt = SaltString::from_b64(&wallet.salt)
        .map_err(|e| VaultError::SaltError(e.to_string()))?;
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| VaultError::CryptoError(e.to_string()))?;

    let mut nonce_bytes = [0u8; 12];
    nonce_bytes.copy_from_slice(&wallet.nonce);

    cipher
        .decrypt(Nonce::from_slice(&nonce_bytes), wallet.ciphertext.as_ref())
        .map_err(|e| VaultError::CryptoError(e.to_string()))
}

/// Require vault password from environment (protocol-hardening helper).
///
/// Prefer using this only in contexts where encrypted wallet material is present.
pub fn require_vault_password() -> String {
    std::env::var("BOLH_WALLET_VAULT_PASSWORD").expect("Vault password not set")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_encrypt_decrypt() {
        let sk = [42u8; 32];
        let pw = "correct horse battery staple";
        let enc = encrypt_private_key(&sk, pw).unwrap();
        let dec = decrypt_private_key(&enc, pw).unwrap();
        assert_eq!(dec, sk);
    }

    #[test]
    fn wrong_password_fails() {
        let sk = [1u8; 32];
        let enc = encrypt_private_key(&sk, "pw1").unwrap();
        let dec = decrypt_private_key(&enc, "pw2");
        assert!(dec.is_err());
    }
}

