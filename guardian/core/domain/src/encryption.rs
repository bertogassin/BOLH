// Шифрование чувствительных данных (цены). AES-256-GCM.
// Ключи — только из Vault/env, не в коде.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use rand::rngs::OsRng;

use crate::Money;

const NONCE_LEN: usize = 12;

#[derive(Debug, thiserror::Error)]
pub enum EncryptionError {
    #[error("encryption failed")]
    Encrypt,
    #[error("decryption failed")]
    Decrypt,
    #[error("invalid key length")]
    KeyLength,
}

/// Шифрование цены. Ключ 32 байта (256 бит).
pub fn encrypt_price(price: &Money, key: &[u8]) -> Result<Vec<u8>, EncryptionError> {
    if key.len() != 32 {
        return Err(EncryptionError::KeyLength);
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| EncryptionError::KeyLength)?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = format!("{}:{}", price.amount(), currency_to_str(price.currency()));
    cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| EncryptionError::Encrypt)
        .map(|mut out| {
            let mut result = nonce_bytes.to_vec();
            result.append(&mut out);
            result
        })
}

/// Дешифровка только алгоритмом. Ключ 32 байта.
pub fn decrypt_price(encrypted: &[u8], key: &[u8]) -> Result<Money, EncryptionError> {
    if key.len() != 32 || encrypted.len() < NONCE_LEN {
        return Err(EncryptionError::Decrypt);
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| EncryptionError::KeyLength)?;
    let (nonce_slice, ciphertext) = encrypted.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_slice);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| EncryptionError::Decrypt)?;
    let s = std::str::from_utf8(&plaintext).map_err(|_| EncryptionError::Decrypt)?;
    let mut parts = s.splitn(2, ':');
    let amount_str = parts.next().ok_or(EncryptionError::Decrypt)?;
    let currency_str = parts.next().ok_or(EncryptionError::Decrypt)?;
    let amount: rust_decimal::Decimal = amount_str.parse().map_err(|_| EncryptionError::Decrypt)?;
    let currency = str_to_currency(currency_str).ok_or(EncryptionError::Decrypt)?;
    Money::new(amount, currency).map_err(|_| EncryptionError::Decrypt)
}

fn currency_to_str(c: crate::Currency) -> &'static str {
    match c {
        crate::Currency::Rub => "RUB",
        crate::Currency::Usd => "USD",
        crate::Currency::Eur => "EUR",
    }
}

fn str_to_currency(s: &str) -> Option<crate::Currency> {
    match s {
        "RUB" => Some(crate::Currency::Rub),
        "USD" => Some(crate::Currency::Usd),
        "EUR" => Some(crate::Currency::Eur),
        _ => None,
    }
}
