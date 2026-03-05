// Authentication: Argon2id, JWT pair, biometric challenge.
// Keys and secrets must come only from env/Vault, never from code.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use std::time::Duration;
use uuid::Uuid;

use crate::UserId;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("invalid password hash")]
    InvalidHash,
    #[error("password verification failed")]
    VerificationFailed,
}

/// Argon2id password hashing.
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AuthError::InvalidHash)
}

/// Verify password against a hash.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    let parsed = PasswordHash::new(hash).map_err(|_| AuthError::InvalidHash)?;
    let argon2 = Argon2::default();
    Ok(argon2
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Token pair (access + refresh). JWT signing lives in API Gateway/User Service.
#[derive(Debug, Clone)]
pub struct TokenPair {
    pub access: String,
    pub refresh: String,
}

/// Config for token generation (secret and TTL are provided externally).
pub struct AuthConfig {
    pub jwt_expiry: Duration,
    pub refresh_expiry: Duration,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            jwt_expiry: Duration::from_secs(15 * 60),
            refresh_expiry: Duration::from_secs(7 * 24 * 3600),
        }
    }
}

/// Generate biometric challenge for FaceID/TouchID.
/// In production: server signature and on-device verification.
pub fn generate_biometric_challenge(_user_id: &UserId) -> String {
    let nonce = Uuid::new_v4();
    format!("bio:{}", nonce)
}
