//! Consensus Runtime (V2) — proposer/vote/finality for single height.
//!
//! This module keeps ephemeral consensus state (pending proposals, votes, jailing).
//! Persistent safety is provided by snapshot + blocks.log; proposals are not persisted.

use std::collections::{HashMap, HashSet};

use crate::consensus::ConsensusConfig;
use crate::types::{Address, Block, BlockHeight};

#[derive(Clone, Debug)]
pub struct PendingProposal {
    pub block_id: String,
    pub block: Block,
    pub height: BlockHeight,
    pub proposer: Address,
    pub yes: HashSet<Address>,
    pub no: HashSet<Address>,
    pub created_at_ms: u64,
}

#[derive(Default)]
pub struct ConsensusRuntime {
    pub config: ConsensusConfig,
    /// Pending proposals by block_id (usually one per height).
    pub proposals: HashMap<String, PendingProposal>,
    /// For each height, remember which validator already proposed which block id (double-sign detection).
    pub proposed_by_height: HashMap<(BlockHeight, Address), String>,
    /// Jailed validators until height (exclusive).
    pub jailed_until: HashMap<Address, BlockHeight>,
}

impl ConsensusRuntime {
    pub fn new() -> Self {
        ConsensusRuntime {
            config: ConsensusConfig::default(),
            proposals: HashMap::new(),
            proposed_by_height: HashMap::new(),
            jailed_until: HashMap::new(),
        }
    }

    pub fn is_jailed(&self, addr: &Address, current_height: BlockHeight) -> bool {
        self.jailed_until
            .get(addr)
            .map(|until| current_height < *until)
            .unwrap_or(false)
    }

    pub fn jail(&mut self, addr: &Address, until: BlockHeight) {
        self.jailed_until.insert(addr.clone(), until);
    }
}

