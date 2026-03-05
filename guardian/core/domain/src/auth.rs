// Аутентификация: Argon2id, JWT-пара, биометрический челлендж.
// Ключи и секреты — только из env/Vault, не из кода.

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

/// Хеширование пароля Argon2id.
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| AuthError::InvalidHash)
}

/// Проверка пароля против хеша.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    let parsed = PasswordHash::new(hash).map_err(|_| AuthError::InvalidHash)?;
    let argon2 = Argon2::default();
    Ok(argon2
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Пара токенов (access + refresh). Подпись JWT — в API Gateway/User Service.
#[derive(Debug, Clone)]
pub struct TokenPair {
    pub access: String,
    pub refresh: String,
}

/// Конфиг для генерации токенов (секрет и TTL задаются снаружи).
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

/// Генерация биометрического челленджа для FaceID/TouchID.
/// В проде: подпись сервером, проверка на устройстве.
pub fn generate_biometric_challenge(_user_id: &UserId) -> String {
    let nonce = Uuid::new_v4();
    format!("bio:{}", nonce)
}
