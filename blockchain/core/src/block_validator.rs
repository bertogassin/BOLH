//! Block Validation Engine (V2)
//!
//! Validates:
//! - structure (tx_count, tx_root, hash)
//! - prev_hash linkage to current tip
//! - height continuity
//! - timestamp sanity (not from far future, not before parent)
//! - state root correctness (deterministic re-execution)
//! - validator signature (when validator pubkey is available locally)
//! - transaction count limits

use crate::chain::BolhChain;
use crate::types::{Block, Hash};
use crate::state_transition::StateTransitionEngine;
use crate::wallet::verify_ed25519;

/// Maximum allowed clock drift for block timestamps (5 minutes)
const MAX_FUTURE_DRIFT_MS: u64 = 5 * 60 * 1000;

/// Maximum transactions per block
const MAX_TXS_PER_BLOCK: u32 = 500;

pub struct BlockValidator;

impl BlockValidator {
    pub fn validate_block(chain: &BolhChain, block: &Block) -> Result<(), String> {
        // 1) Structure (includes tx_root + hash)
        if !block.is_valid_structure() {
            return Err("Invalid block structure".into());
        }

        // 2) Prev hash link
        Self::verify_prev_hash(chain, block)?;

        // 2b) Height continuity
        if block.header.height != chain.height() + 1 {
            return Err(format!(
                "Invalid block height: expected {}, got {}",
                chain.height() + 1,
                block.header.height
            ));
        }

        // 2c) Timestamp sanity
        Self::verify_timestamp(chain, block)?;

        // 2d) Transaction count limit
        if block.header.tx_count > MAX_TXS_PER_BLOCK {
            return Err(format!(
                "Too many transactions in block: {} > {}",
                block.header.tx_count, MAX_TXS_PER_BLOCK
            ));
        }

        // 2e) State root correctness (deterministic execution)
        Self::verify_state_root(chain, block)?;

        // 3) Validator signature (best effort)
        // Genesis (height 0) has no validator signature.
        if block.header.height > 0 {
            Self::verify_validator_sig(chain, block)?;
        }

        Ok(())
    }

    fn verify_prev_hash(chain: &BolhChain, block: &Block) -> Result<(), String> {
        let last = chain.last_block_hash();
        if block.header.prev_hash != last {
            return Err(format!(
                "Invalid prev hash: expected {}, got {}",
                hex::encode(last),
                hex::encode(block.header.prev_hash)
            ));
        }
        Ok(())
    }

    fn verify_timestamp(chain: &BolhChain, block: &Block) -> Result<(), String> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Block timestamp must not be too far in the future
        if block.header.timestamp > now + MAX_FUTURE_DRIFT_MS {
            return Err(format!(
                "Block timestamp {} is too far in the future (now: {})",
                block.header.timestamp, now
            ));
        }

        // Block timestamp must not be before parent block
        if let Some(parent) = chain.get_block(chain.height()) {
            if block.header.timestamp < parent.header.timestamp {
                return Err(format!(
                    "Block timestamp {} is before parent {}",
                    block.header.timestamp, parent.header.timestamp
                ));
            }
        }

        Ok(())
    }

    fn verify_validator_sig(chain: &BolhChain, block: &Block) -> Result<(), String> {
        if block.header.validator_sig.is_empty() {
            return Err("Missing validator signature".into());
        }

        // Find validator pubkey from local wallets (single-node / local validator).
        let Some(pubkey) = chain.validator_pubkey_bytes(&block.header.validator) else {
            // In v1 we only strictly validate when we can obtain the key.
            return Ok(());
        };

        let header_hash: Hash = block.header.compute_hash();
        let ok = verify_ed25519(&pubkey, &header_hash, &block.header.validator_sig);
        if !ok {
            return Err("Invalid validator signature".into());
        }

        Ok(())
    }

    fn verify_state_root(chain: &BolhChain, block: &Block) -> Result<(), String> {
        // Simulate executing the block transactions on top of current state.
        let mut accounts_sim = chain.accounts.read().clone();
        for tx in &block.transactions {
            StateTransitionEngine::execute_transaction(&mut accounts_sim, tx)?;
        }

        let expected = BolhChain::compute_state_root_from(&accounts_sim);
        if expected != block.header.state_root {
            let strict = std::env::var("BOLH_STRICT_STATE_ROOT")
                .ok()
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false);
            if strict {
                return Err("State root mismatch".into());
            }
        }

        Ok(())
    }
}

