//! Cryptography module
//! 
//! AES-256-GCM, ChaCha20-Poly1305, Argon2id, Ed25519, X25519

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use chacha20poly1305::ChaCha20Poly1305;
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey, Signature, Verifier};
use x25519_dalek::{PublicKey, StaticSecret};
use sha2::{Sha256, Digest};
use hmac::Hmac;
use hmac::Mac as HmacMac;
use rand::RngCore;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hex;

pub struct CryptoService;

impl CryptoService {
    /// Generate random bytes
    pub fn random_bytes(len: usize) -> Vec<u8> {
        let mut bytes = vec![0u8; len];
        OsRng.fill_bytes(&mut bytes);
        bytes
    }

    /// Generate a 256-bit encryption key
    pub fn generate_key() -> String {
        BASE64.encode(Self::random_bytes(32))
    }

    /// Encrypt with AES-256-GCM
    pub fn encrypt_aes256(plaintext: &str, key_base64: &str) -> Result<String, CryptoError> {
        let key_bytes = BASE64.decode(key_base64).map_err(|_| CryptoError::InvalidKey)?;
        if key_bytes.len() != 32 {
            return Err(CryptoError::InvalidKey);
        }

        let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|_| CryptoError::InvalidKey)?;
        let nonce_bytes = Self::random_bytes(12);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|_| CryptoError::EncryptionFailed)?;

        let mut result = nonce_bytes;
        result.extend(ciphertext);
        Ok(BASE64.encode(result))
    }

    /// Decrypt AES-256-GCM
    pub fn decrypt_aes256(ciphertext_base64: &str, key_base64: &str) -> Result<String, CryptoError> {
        let key_bytes = BASE64.decode(key_base64).map_err(|_| CryptoError::InvalidKey)?;
        let data = BASE64.decode(ciphertext_base64).map_err(|_| CryptoError::InvalidCiphertext)?;

        if data.len() < 12 {
            return Err(CryptoError::InvalidCiphertext);
        }

        let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|_| CryptoError::InvalidKey)?;
        let nonce = Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| CryptoError::DecryptionFailed)?;

        String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptionFailed)
    }

    /// Encrypt with ChaCha20-Poly1305
    pub fn encrypt_chacha20(plaintext: &str, key_base64: &str) -> Result<String, CryptoError> {
        let key_bytes = BASE64.decode(key_base64).map_err(|_| CryptoError::InvalidKey)?;
        if key_bytes.len() != 32 {
            return Err(CryptoError::InvalidKey);
        }

        let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes).map_err(|_| CryptoError::InvalidKey)?;
        let nonce_bytes = Self::random_bytes(12);
        let nonce = chacha20poly1305::Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|_| CryptoError::EncryptionFailed)?;

        let mut result = nonce_bytes;
        result.extend(ciphertext);
        Ok(BASE64.encode(result))
    }

    /// Decrypt ChaCha20-Poly1305
    pub fn decrypt_chacha20(ciphertext_base64: &str, key_base64: &str) -> Result<String, CryptoError> {
        let key_bytes = BASE64.decode(key_base64).map_err(|_| CryptoError::InvalidKey)?;
        let data = BASE64.decode(ciphertext_base64).map_err(|_| CryptoError::InvalidCiphertext)?;

        if data.len() < 12 {
            return Err(CryptoError::InvalidCiphertext);
        }

        let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes).map_err(|_| CryptoError::InvalidKey)?;
        let nonce = chacha20poly1305::Nonce::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| CryptoError::DecryptionFailed)?;

        String::from_utf8(plaintext).map_err(|_| CryptoError::DecryptionFailed)
    }

    /// Hash password with Argon2id
    pub fn hash_password(password: &str) -> Result<String, CryptoError> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|_| CryptoError::HashingFailed)
    }

    /// Verify password against Argon2id hash
    pub fn verify_password(password: &str, hash: &str) -> bool {
        let parsed_hash = match PasswordHash::new(hash) {
            Ok(h) => h,
            Err(_) => return false,
        };
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok()
    }

    /// SHA-256 hash
    pub fn sha256(data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// HMAC-SHA256
    pub fn hmac_sha256(data: &str, key_base64: &str) -> Result<String, CryptoError> {
        let key = BASE64.decode(key_base64).map_err(|_| CryptoError::InvalidKey)?;
        let mut mac: Hmac<Sha256> = HmacMac::new_from_slice(&key).map_err(|_| CryptoError::InvalidKey)?;
        HmacMac::update(&mut mac, data.as_bytes());
        Ok(BASE64.encode(HmacMac::finalize(mac).into_bytes()))
    }

    /// Generate Ed25519 signing keypair
    pub fn generate_signing_keypair() -> SigningKeypair {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        
        SigningKeypair {
            secret_key: BASE64.encode(signing_key.to_bytes()),
            public_key: BASE64.encode(verifying_key.to_bytes()),
        }
    }

    /// Sign message with Ed25519
    pub fn sign_message(message: &str, secret_key_base64: &str) -> Result<String, CryptoError> {
        let key_bytes = BASE64.decode(secret_key_base64).map_err(|_| CryptoError::InvalidKey)?;
        let key_array: [u8; 32] = key_bytes.try_into().map_err(|_| CryptoError::InvalidKey)?;
        let signing_key = SigningKey::from_bytes(&key_array);
        
        let signature = signing_key.sign(message.as_bytes());
        Ok(BASE64.encode(signature.to_bytes()))
    }

    /// Verify Ed25519 signature
    pub fn verify_signature(message: &str, signature_base64: &str, public_key_base64: &str) -> bool {
        let sig_bytes = match BASE64.decode(signature_base64) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let key_bytes = match BASE64.decode(public_key_base64) {
            Ok(b) => b,
            Err(_) => return false,
        };

        let sig_array: [u8; 64] = match sig_bytes.try_into() {
            Ok(a) => a,
            Err(_) => return false,
        };
        let key_array: [u8; 32] = match key_bytes.try_into() {
            Ok(a) => a,
            Err(_) => return false,
        };

        let signature = Signature::from_bytes(&sig_array);
        let verifying_key = match VerifyingKey::from_bytes(&key_array) {
            Ok(k) => k,
            Err(_) => return false,
        };

        verifying_key.verify(message.as_bytes(), &signature).is_ok()
    }

    /// Generate X25519 key exchange keypair
    pub fn generate_exchange_keypair() -> ExchangeKeypair {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&secret);
        
        ExchangeKeypair {
            secret_key: BASE64.encode(secret.to_bytes()),
            public_key: BASE64.encode(public.to_bytes()),
        }
    }

    /// Derive shared secret using X25519
    pub fn derive_shared_secret(my_secret_base64: &str, their_public_base64: &str) -> Result<String, CryptoError> {
        let secret_bytes = BASE64.decode(my_secret_base64).map_err(|_| CryptoError::InvalidKey)?;
        let public_bytes = BASE64.decode(their_public_base64).map_err(|_| CryptoError::InvalidKey)?;

        let secret_array: [u8; 32] = secret_bytes.try_into().map_err(|_| CryptoError::InvalidKey)?;
        let public_array: [u8; 32] = public_bytes.try_into().map_err(|_| CryptoError::InvalidKey)?;

        let secret = StaticSecret::from(secret_array);
        let public = PublicKey::from(public_array);
        let shared = secret.diffie_hellman(&public);

        Ok(BASE64.encode(shared.to_bytes()))
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SigningKeypair {
    pub secret_key: String,
    pub public_key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExchangeKeypair {
    pub secret_key: String,
    pub public_key: String,
}

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("Invalid key")]
    InvalidKey,
    #[error("Invalid ciphertext")]
    InvalidCiphertext,
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Hashing failed")]
    HashingFailed,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes256_roundtrip() {
        let key = CryptoService::generate_key();
        let plaintext = "Hello, BOLH!";
        
        let encrypted = CryptoService::encrypt_aes256(plaintext, &key).unwrap();
        let decrypted = CryptoService::decrypt_aes256(&encrypted, &key).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_password_hashing() {
        let password = "secure_password_123";
        let hash = CryptoService::hash_password(password).unwrap();
        
        assert!(CryptoService::verify_password(password, &hash));
        assert!(!CryptoService::verify_password("wrong_password", &hash));
    }

    #[test]
    fn test_signing() {
        let keypair = CryptoService::generate_signing_keypair();
        let message = "Important message";
        
        let signature = CryptoService::sign_message(message, &keypair.secret_key).unwrap();
        assert!(CryptoService::verify_signature(message, &signature, &keypair.public_key));
    }
}
