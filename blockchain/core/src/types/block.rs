use serde::{Deserialize, Serialize};
use super::{Address, BlockHeight, Hash, Signature, Timestamp, Transaction};

/// Block header — compact summary of a block
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockHeader {
    /// Block version
    pub version: u32,

    /// Block height (0 = genesis)
    pub height: BlockHeight,

    /// Hash of the previous block
    pub prev_hash: Hash,

    /// Merkle root of all transactions in this block
    pub tx_root: Hash,

    /// State root (account trie hash after applying all txs)
    pub state_root: Hash,

    /// Timestamp when block was created
    pub timestamp: Timestamp,

    /// Validator who produced this block
    pub validator: Address,

    /// Validator's post-quantum signature
    pub validator_sig: Signature,

    /// Number of transactions in this block
    pub tx_count: u32,

    /// Total fees collected in this block
    pub total_fees: u64,

    /// Block difficulty / stake weight
    pub difficulty: u64,
}

impl BlockHeader {
    /// Compute the hash of this block header
    pub fn compute_hash(&self) -> Hash {
        use sha3::{Digest, Sha3_256};
        let mut hasher = Sha3_256::new();

        hasher.update(self.version.to_le_bytes());
        hasher.update(self.height.to_le_bytes());
        hasher.update(self.prev_hash);
        hasher.update(self.tx_root);
        hasher.update(self.state_root);
        hasher.update(self.timestamp.to_le_bytes());
        hasher.update(&self.validator.0);
        hasher.update(self.tx_count.to_le_bytes());
        hasher.update(self.total_fees.to_le_bytes());
        hasher.update(self.difficulty.to_le_bytes());

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }
}

/// Full block — header + transactions
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    /// Block header
    pub header: BlockHeader,

    /// All transactions in this block
    pub transactions: Vec<Transaction>,

    /// Block hash (computed from header)
    #[serde(skip)]
    pub hash: Hash,
}

impl Block {
    /// Create a new block
    pub fn new(
        height: BlockHeight,
        prev_hash: Hash,
        validator: Address,
        transactions: Vec<Transaction>,
        state_root: Hash,
    ) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let total_fees: u64 = transactions.iter().map(|tx| tx.fee).sum();
        let tx_root = Self::compute_tx_root(&transactions);

        let header = BlockHeader {
            version: 1,
            height,
            prev_hash,
            tx_root,
            state_root,
            timestamp,
            validator,
            validator_sig: Vec::new(), // Filled by validator after signing
            tx_count: transactions.len() as u32,
            total_fees,
            difficulty: 1,
        };

        let hash = header.compute_hash();

        Block {
            header,
            transactions,
            hash,
        }
    }

    /// Compute merkle root of transactions
    pub fn compute_tx_root(txs: &[Transaction]) -> Hash {
        use sha3::{Digest, Sha3_256};

        if txs.is_empty() {
            return [0u8; 32];
        }

        let hashes: Vec<Hash> = txs.iter().map(|tx| tx.compute_hash()).collect();

        // Simple merkle: hash pairs until one root
        let mut level = hashes;
        while level.len() > 1 {
            let mut next_level = Vec::new();
            for chunk in level.chunks(2) {
                let mut hasher = Sha3_256::new();
                hasher.update(chunk[0]);
                if chunk.len() > 1 {
                    hasher.update(chunk[1]);
                } else {
                    hasher.update(chunk[0]); // Duplicate last if odd
                }
                let result = hasher.finalize();
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&result);
                next_level.push(hash);
            }
            level = next_level;
        }

        level[0]
    }

    /// Genesis block (block 0)
    pub fn genesis(state_root: Hash) -> Self {
        let header = BlockHeader {
            version: 1,
            height: 0,
            prev_hash: [0u8; 32],
            tx_root: [0u8; 32],
            state_root,
            timestamp: 1707350400000, // 2024-02-08 00:00:00 UTC (BOLH birthday)
            validator: Address::zero(),
            validator_sig: Vec::new(),
            tx_count: 0,
            total_fees: 0,
            difficulty: 1,
        };

        let hash = header.compute_hash();

        Block {
            header,
            transactions: Vec::new(),
            hash,
        }
    }

    /// Validate block structure (not consensus/signature)
    pub fn is_valid_structure(&self) -> bool {
        // Check tx count matches
        if self.header.tx_count as usize != self.transactions.len() {
            return false;
        }
        // Check tx root
        let expected_root = Self::compute_tx_root(&self.transactions);
        if self.header.tx_root != expected_root {
            return false;
        }
        // Check hash
        let expected_hash = self.header.compute_hash();
        if self.hash != expected_hash {
            return false;
        }
        // Check max tx count
        if self.transactions.len() > crate::MAX_TXS_PER_BLOCK {
            return false;
        }
        true
    }
}
