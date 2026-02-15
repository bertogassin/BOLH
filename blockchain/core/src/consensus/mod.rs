//! Consensus module — Proof of Stake with BFT finality
//! Core logic in SPARK/Ada, called via FFI from Rust

use crate::types::{Address, Block, BlockHeight};

/// Validator info
#[derive(Debug, Clone)]
pub struct ValidatorInfo {
    pub address: Address,
    pub stake: u64,
    pub is_active: bool,
    pub blocks_produced: u64,
    pub last_block_height: BlockHeight,
    pub slash_count: u32,
    pub jailed_until: Option<BlockHeight>,
}

/// Slashing event types
#[derive(Debug, Clone)]
pub enum SlashingReason {
    /// Double signing same block height
    DoubleSign,
    /// Missing too many blocks
    Downtime,
    /// Invalid block produced
    InvalidBlock,
}

/// Slashing event record
#[derive(Debug, Clone)]
pub struct SlashingEvent {
    pub validator: Address,
    pub reason: SlashingReason,
    pub height: BlockHeight,
    pub slash_amount: u64,
    pub jail_duration: BlockHeight,
}

/// Consensus configuration
#[derive(Clone)]
pub struct ConsensusConfig {
    /// Minimum stake to become a validator
    pub min_stake: u64,
    /// Maximum validators
    pub max_validators: u32,
    /// Block time target in milliseconds
    pub block_time_ms: u64,
    /// Finality threshold (2/3 + 1 of validators)
    pub finality_threshold: f64,
    /// Slashing percentage for double signing (5% of stake)
    pub double_sign_slash_percent: u64,
    /// Jail duration in blocks for slashing
    pub jail_duration_blocks: BlockHeight,
    /// Maximum downtime blocks before slashing
    pub max_downtime_blocks: u64,
}

impl ConsensusConfig {
    /// Validate consensus configuration for safety.
    pub fn validate(&self) -> Result<(), String> {
        if self.min_stake == 0 {
            return Err("min_stake must be greater than zero".into());
        }
        if self.max_validators == 0 {
            return Err("max_validators must be greater than zero".into());
        }
        if !(0.667..=0.9).contains(&self.finality_threshold) {
            return Err("finality_threshold must be between 0.667 and 0.9".into());
        }
        Ok(())
    }
}

impl Default for ConsensusConfig {
    fn default() -> Self {
        ConsensusConfig {
            min_stake: 10_000__00_000_000, // 10,000 BOLH minimum stake
            max_validators: 100,
            block_time_ms: crate::BLOCK_TIME_MS,
            finality_threshold: 0.667, // 2/3
            double_sign_slash_percent: 5, // 5% slash
            jail_duration_blocks: 10_000, // ~1.4 hours at 0.5s blocks
            max_downtime_blocks: 100, // 50 seconds
        }
    }
}

/// Apply slashing to a validator
pub fn slash_validator(
    validator: &mut ValidatorInfo,
    reason: SlashingReason,
    config: &ConsensusConfig,
    current_height: BlockHeight,
) -> SlashingEvent {
    let slash_amount = match reason {
        SlashingReason::DoubleSign => {
            // 5% of stake slashed
            validator.stake * config.double_sign_slash_percent / 100
        }
        SlashingReason::Downtime => {
            // 1% of stake slashed
            validator.stake / 100
        }
        SlashingReason::InvalidBlock => {
            // 2% of stake slashed
            validator.stake * 2 / 100
        }
    };

    validator.stake = validator.stake.saturating_sub(slash_amount);
    validator.slash_count += 1;
    validator.jailed_until = Some(current_height + config.jail_duration_blocks);
    validator.is_active = false;

    SlashingEvent {
        validator: validator.address.clone(),
        reason,
        height: current_height,
        slash_amount,
        jail_duration: config.jail_duration_blocks,
    }
}

/// Check if validator can be unjailed
pub fn can_unjail(validator: &ValidatorInfo, current_height: BlockHeight) -> bool {
    if let Some(jailed_until) = validator.jailed_until {
        current_height >= jailed_until && validator.stake >= 10_000__00_000_000
    } else {
        false
    }
}

/// Detect double signing (simplified - real implementation needs full block comparison)
pub fn detect_double_sign(
    validator: &Address,
    height: BlockHeight,
    block_signatures: &[(BlockHeight, Address)],
) -> bool {
    // Count how many times this validator signed at this height
    let sign_count = block_signatures
        .iter()
        .filter(|(h, addr)| h == &height && addr == validator)
        .count();
    
    sign_count > 1
}

/// Select next block validator based on stake weight
pub fn select_validator(validators: &[ValidatorInfo], block_height: BlockHeight) -> Option<&ValidatorInfo> {
    if validators.is_empty() {
        return None;
    }

    let total_stake: u64 = validators.iter().filter(|v| v.is_active).map(|v| v.stake).sum();
    if total_stake == 0 {
        return None;
    }

    // Deterministic selection based on block height and stake
    let seed = block_height;
    let target = seed % total_stake;

    let mut cumulative = 0u64;
    for v in validators.iter().filter(|v| v.is_active) {
        cumulative += v.stake;
        if cumulative > target {
            return Some(v);
        }
    }

    validators.iter().filter(|v| v.is_active).last()
}

/// Validate a block against consensus rules
pub fn validate_block(block: &Block, prev_block: &Block) -> Result<(), String> {
    // Height must be prev + 1
    if block.header.height != prev_block.header.height + 1 {
        return Err(format!(
            "Invalid height: expected {}, got {}",
            prev_block.header.height + 1,
            block.header.height
        ));
    }

    // Previous hash must match
    if block.header.prev_hash != prev_block.hash {
        return Err("Previous hash mismatch".into());
    }

    // Timestamp must be after previous block
    if block.header.timestamp <= prev_block.header.timestamp {
        return Err("Timestamp must be after previous block".into());
    }

    // Structure must be valid
    if !block.is_valid_structure() {
        return Err("Invalid block structure".into());
    }

    Ok(())
}
