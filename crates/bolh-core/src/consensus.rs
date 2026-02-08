use std::hash::{Hash, Hasher};
use std::collections::{HashMap, hash_map::DefaultHasher};
use std::sync::{Mutex, OnceLock};
use serde::{Deserialize, Serialize};
use crate::transaction::Transaction;

/// Validator in the consensus committee
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct Validator {
    /// Validator public key (address)
    pub address: String,
    /// Validator voting power (stake)
    pub voting_power: u64,
}

/// Vote on a block proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    /// Block being voted on
    pub block_id: String,
    /// Validator who cast the vote
    pub validator: String,
    /// Round number
    pub round: u64,
    /// Vote signature
    pub signature: String,
    /// Approve or reject
    pub approve: bool,
}

/// Block proposal with consensus metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockProposal {
    /// Unique block ID
    pub block_id: String,
    /// Transactions in the block
    pub transactions: Vec<Transaction>,
    /// Proposer address
    pub proposer: String,
    /// Round number
    pub round: u64,
    /// Block height
    pub height: u64,
    /// Previous block hash
    pub prev_block: String,
    /// Timestamp
    pub timestamp: u64,
}

/// Consensus state
#[derive(Debug, Clone)]
pub struct ConsensusState {
    /// Current round
    pub round: u64,
    /// Current block height
    pub height: u64,
    /// Active validators
    pub validators: Vec<Validator>,
    /// Votes collected for current round
    pub votes: HashMap<String, Vec<Vote>>, // block_id -> votes
    /// Finalized blocks
    pub finalized_blocks: Vec<String>,
}

impl ConsensusState {
    fn new() -> Self {
        // Initialize with demo validators (3 validators for testing)
        let validators = vec![
            Validator {
                address: "validator_1".to_string(),
                voting_power: 100,
            },
            Validator {
                address: "validator_2".to_string(),
                voting_power: 100,
            },
            Validator {
                address: "validator_3".to_string(),
                voting_power: 100,
            },
        ];

        ConsensusState {
            round: 0,
            height: 0,
            validators,
            votes: HashMap::new(),
            finalized_blocks: Vec::new(),
        }
    }

    /// Total voting power in the committee
    fn total_voting_power(&self) -> u64 {
        self.validators.iter().map(|v| v.voting_power).sum()
    }

    /// Calculate voting power for a block (sum of votes)
    fn block_voting_power(&self, block_id: &str) -> u64 {
        if let Some(votes) = self.votes.get(block_id) {
            votes.iter()
                .filter(|v| v.approve)
                .filter_map(|v| {
                    self.validators.iter()
                        .find(|val| val.address == v.validator)
                        .map(|val| val.voting_power)
                })
                .sum()
        } else {
            0
        }
    }

    /// Check if block has 2/3+ majority (BFT threshold)
    fn has_supermajority(&self, block_id: &str) -> bool {
        let total = self.total_voting_power();
        let block_power = self.block_voting_power(block_id);
        // BFT requires > 2/3 of voting power
        block_power * 3 > total * 2
    }
}

static STATE: OnceLock<Mutex<ConsensusState>> = OnceLock::new();

fn state() -> &'static Mutex<ConsensusState> {
    STATE.get_or_init(|| Mutex::new(ConsensusState::new()))
}

/// Create block ID from transactions
pub fn create_block_id(txs: &[Transaction]) -> String {
    let mut hasher = DefaultHasher::new();
    for tx in txs.iter() {
        tx.txid.hash(&mut hasher);
    }
    let h = hasher.finish();
    format!("block_{:016x}", h)
}

/// Propose a new block
pub fn propose_block(txs: Vec<Transaction>, proposer: &str, prev_block: &str) -> BlockProposal {
    let mut s = state().lock().unwrap();
    
    let block_id = create_block_id(&txs);
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let proposal = BlockProposal {
        block_id: block_id.clone(),
        transactions: txs,
        proposer: proposer.to_string(),
        round: s.round,
        height: s.height + 1,
        prev_block: prev_block.to_string(),
        timestamp,
    };

    // Initialize vote collection for this block
    s.votes.entry(block_id).or_insert_with(Vec::new);

    proposal
}

/// Cast a vote on a block proposal
pub fn vote_on_block(block_id: &str, validator: &str, approve: bool) -> Result<Vote, String> {
    let mut s = state().lock().unwrap();

    // Check if validator is in the committee
    if !s.validators.iter().any(|v| v.address == validator) {
        return Err(format!("Validator {} not in committee", validator));
    }

    // Check if already voted in this round
    if let Some(votes) = s.votes.get(block_id) {
        if votes.iter().any(|v| v.validator == validator) {
            return Err(format!("Validator {} already voted on block {}", validator, block_id));
        }
    }

    // Create vote (signature is placeholder for now)
    let vote = Vote {
        block_id: block_id.to_string(),
        validator: validator.to_string(),
        round: s.round,
        signature: format!("sig_{}_{}", validator, block_id),
        approve,
    };

    // Record the vote
    s.votes.entry(block_id.to_string())
        .or_insert_with(Vec::new)
        .push(vote.clone());

    Ok(vote)
}

/// Check if a block can be finalized (has 2/3+ majority)
pub fn can_finalize(block_id: &str) -> bool {
    let s = state().lock().unwrap();
    s.has_supermajority(block_id)
}

/// Finalize a block (mark as committed)
pub fn finalize_block(block_id: &str) -> Result<(), String> {
    let mut s = state().lock().unwrap();

    if !s.has_supermajority(block_id) {
        let total = s.total_voting_power();
        let block_power = s.block_voting_power(block_id);
        return Err(format!(
            "Block {} does not have supermajority ({}/{} voting power)",
            block_id, block_power, total
        ));
    }

    // Mark as finalized
    s.finalized_blocks.push(block_id.to_string());
    s.height += 1;
    s.round += 1;

    // Clear votes for next round
    s.votes.clear();

    // Persist to storage
    crate::storage::save_block(
        block_id,
        &format!("{{\"finalized\":true,\"height\":{}}}", s.height)
    )?;

    Ok(())
}

/// Get current consensus state info
pub fn get_state_info() -> serde_json::Value {
    let s = state().lock().unwrap();
    serde_json::json!({
        "round": s.round,
        "height": s.height,
        "validators": s.validators.len(),
        "total_voting_power": s.total_voting_power(),
        "finalized_blocks": s.finalized_blocks.len(),
    })
}

/// Get voting status for a block
pub fn get_voting_status(block_id: &str) -> serde_json::Value {
    let s = state().lock().unwrap();
    let votes = s.votes.get(block_id).map(|v| v.len()).unwrap_or(0);
    let voting_power = s.block_voting_power(block_id);
    let total_power = s.total_voting_power();
    let has_majority = s.has_supermajority(block_id);

    serde_json::json!({
        "block_id": block_id,
        "votes": votes,
        "voting_power": voting_power,
        "total_power": total_power,
        "supermajority": has_majority,
        "threshold": total_power * 2 / 3,
    })
}

/// Reset consensus state (for testing)
pub fn reset_state() {
    let mut s = state().lock().unwrap();
    *s = ConsensusState::new();
}
