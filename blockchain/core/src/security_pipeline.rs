//! Security Pipeline (V2) — centralized transaction validation.
//!
//! This is the single gate that every transaction must pass before being
//! accepted into mempool / executed.
//!
//! It combines:
//! - Format checks (size, fee rules, timestamps)
//! - Data payload size limits
//! - Signature checks (Ed25519)
//! - State checks (nonce, balance)
//! - Policy checks (rate limits, replay, blacklists) via `SecurityEngine`
//! - Timestamp freshness checks

use std::sync::OnceLock;

use crate::chain::BolhChain;
use crate::security::SecurityEngine;
use crate::types::{Transaction, TxType};
use crate::wallet::verify_ed25519;

/// Maximum transaction data payload (64 KB)
const MAX_TX_DATA_SIZE: usize = 64 * 1024;

/// Maximum transaction age — reject txs older than 1 hour
const MAX_TX_AGE_MS: u64 = 60 * 60 * 1000;

/// Maximum transaction future drift — reject txs more than 5 minutes in the future
const MAX_TX_FUTURE_MS: u64 = 5 * 60 * 1000;

static ENGINE: OnceLock<SecurityEngine> = OnceLock::new();

fn engine() -> &'static SecurityEngine {
    ENGINE.get_or_init(SecurityEngine::new)
}

pub struct SecurityPipeline;

impl SecurityPipeline {
    pub fn validate_tx(chain: &BolhChain, tx: &Transaction) -> Result<(), String> {
        // 0) Basic format checks (cheap)
        if !tx.is_valid_format() {
            return Err("Invalid transaction format".into());
        }

        // 0b) Data payload size limit
        if tx.data.len() > MAX_TX_DATA_SIZE {
            return Err(format!(
                "Transaction data too large: {} bytes > {} limit",
                tx.data.len(), MAX_TX_DATA_SIZE
            ));
        }

        // 0c) Timestamp freshness
        Self::check_timestamp(tx)?;

        // 1) Signature check (Ed25519)
        Self::check_signature(tx)?;

        // 2) Replay pre-check (avoid misclassifying duplicates as nonce errors)
        let tx_hash_hex = hex::encode(tx.compute_hash());
        if engine().is_known_tx_hash(&tx_hash_hex) {
            return Err("Transaction replay detected".into());
        }

        // 3) State checks (nonce + balance)
        Self::check_nonce(chain, tx)?;
        Self::check_balance(chain, tx)?;

        // 4) Policy checks (rate limits, replay, blacklists, etc.)
        let sig_hex = hex::encode(&tx.signature);
        let check = engine().check_transaction(&tx.from, &tx.to, tx.amount, &tx_hash_hex, &sig_hex);
        if !check.allowed {
            return Err(check.reason.unwrap_or_else(|| "Rejected by security policy".into()));
        }

        Ok(())
    }

    fn check_nonce(chain: &BolhChain, tx: &Transaction) -> Result<(), String> {
        // System/reward txs may be authored by protocol.
        if matches!(tx.tx_type, TxType::System | TxType::MiningReward | TxType::ReferralReward) {
            return Ok(());
        }

        let acc = chain.get_account(&tx.from);

        // Include pending mempool txs to avoid false rejections when submit is mempool-only.
        let (_pending_spend, pending_max_nonce) = chain.pending_for_sender(&tx.from);
        let expected_nonce = if pending_max_nonce > acc.nonce {
            pending_max_nonce + 1
        } else {
            acc.nonce + 1
        };

        if tx.nonce != expected_nonce {
            return Err(format!("Invalid nonce: expected {}, got {}", expected_nonce, tx.nonce));
        }
        Ok(())
    }

    fn check_balance(chain: &BolhChain, tx: &Transaction) -> Result<(), String> {
        if matches!(tx.tx_type, TxType::System | TxType::MiningReward | TxType::ReferralReward) {
            return Ok(());
        }

        let acc = chain.get_account(&tx.from);
        let total_cost = tx.amount.saturating_add(tx.fee);

        let (pending_spend, _pending_max_nonce) = chain.pending_for_sender(&tx.from);
        let available = acc.available_balance().saturating_sub(pending_spend);

        if available < total_cost {
            return Err("Insufficient balance".into());
        }
        Ok(())
    }

    fn check_timestamp(tx: &Transaction) -> Result<(), String> {
        // System/reward txs may have synthetic timestamps
        if matches!(tx.tx_type, TxType::System | TxType::MiningReward | TxType::ReferralReward) {
            return Ok(());
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Reject transactions too old
        if tx.timestamp > 0 && now > tx.timestamp && (now - tx.timestamp) > MAX_TX_AGE_MS {
            return Err(format!(
                "Transaction too old: {} ms ago",
                now - tx.timestamp
            ));
        }

        // Reject transactions from the future
        if tx.timestamp > now + MAX_TX_FUTURE_MS {
            return Err(format!(
                "Transaction timestamp is in the future: {} > {}",
                tx.timestamp, now
            ));
        }

        Ok(())
    }

    fn check_signature(tx: &Transaction) -> Result<(), String> {
        if matches!(tx.tx_type, TxType::System) {
            // System txs may be unsigned (genesis/emission) in early versions.
            return Ok(());
        }

        if tx.signature.is_empty() || tx.public_key.is_empty() {
            return Err("Missing signature or public key".into());
        }

        let signing_bytes = tx.signing_bytes();
        let ok = verify_ed25519(&tx.public_key, &signing_bytes, &tx.signature);
        if !ok {
            return Err("Invalid signature".into());
        }

        // Ensure pubkey matches sender address.
        let expected_addr = crate::types::Address::from_public_key(&tx.public_key);
        if expected_addr != tx.from {
            return Err("Public key does not match sender address".into());
        }

        Ok(())
    }
}

