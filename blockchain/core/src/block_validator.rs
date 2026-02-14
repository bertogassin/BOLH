//! Block Validation Engine (V1)
//!
//! Validates:
//! - structure (tx_count, tx_root, hash)
//! - prev_hash linkage to current tip
//! - validator signature (when validator pubkey is available locally)

use crate::chain::BolhChain;
use crate::types::{Block, Hash};
use crate::state_transition::StateTransitionEngine;
use crate::wallet::verify_ed25519;

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
            return Err("Invalid block height".into());
        }

        // 2c) State root correctness (deterministic execution)
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
            return Err("Invalid prev hash".into());
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

