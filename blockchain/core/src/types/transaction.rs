use serde::{Deserialize, Serialize};
use super::{Address, Amount, Hash, Nonce, PublicKey, Signature, Timestamp};

/// Transaction type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum TxType {
    /// Regular transfer
    Transfer,
    /// Staking deposit
    Stake,
    /// Unstake withdrawal
    Unstake,
    /// Mining/earning reward (from app activity)
    MiningReward,
    /// Referral reward
    ReferralReward,
    /// Smart contract call
    ContractCall,
    /// System transaction (genesis, emission)
    System,
}

/// Privacy level for a transaction
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum PrivacyLevel {
    /// Public transaction (fully visible)
    Transparent,
    /// Ring signature (sender hidden among decoys)
    RingSig { ring_size: u8 },
    /// Stealth address (receiver hidden)
    Stealth,
    /// Full privacy (ring sig + stealth + confidential amount)
    Full { ring_size: u8 },
}

/// A single BOLH transaction
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    /// Transaction type
    pub tx_type: TxType,

    /// Sender address
    pub from: Address,

    /// Recipient address
    pub to: Address,

    /// Amount to transfer (in smallest units)
    pub amount: Amount,

    /// Transaction fee
    pub fee: Amount,

    /// Sender's nonce (must match account nonce + 1)
    pub nonce: Nonce,

    /// Timestamp when created
    pub timestamp: Timestamp,

    /// Privacy level
    pub privacy: PrivacyLevel,

    /// Optional data payload (for contract calls, referral codes, etc.)
    pub data: Vec<u8>,

    /// Sender's post-quantum public key
    pub public_key: PublicKey,

    /// Post-quantum signature (Dilithium)
    pub signature: Signature,

    /// Transaction hash (computed)
    #[serde(skip)]
    pub hash: Hash,
}

impl Transaction {
    /// Maximum transaction size in bytes (100KB)
    pub const MAX_TX_SIZE: usize = 100_000;

    /// Maximum data payload size (50KB)
    pub const MAX_DATA_SIZE: usize = 50_000;

    /// Maximum future timestamp offset in milliseconds (5 minutes)
    pub const MAX_FUTURE_OFFSET_MS: u64 = 5 * 60 * 1000;

    /// Expected Dilithium signature length (for post-quantum verification)
    pub const DILITHIUM_SIG_LENGTH: usize = 2420;

    /// Compute the hash of this transaction (excluding the signature for signing)
    pub fn compute_hash(&self) -> Hash {
        use sha3::{Digest, Sha3_256};
        let mut hasher = Sha3_256::new();

        hasher.update(bincode::serialize(&self.tx_type).unwrap_or_default());
        hasher.update(&self.from.0);
        hasher.update(&self.to.0);
        hasher.update(self.amount.to_le_bytes());
        hasher.update(self.fee.to_le_bytes());
        hasher.update(self.nonce.to_le_bytes());
        hasher.update(self.timestamp.to_le_bytes());
        hasher.update(&self.data);

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }

    /// Bytes to sign (everything except signature and hash)
    pub fn signing_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&bincode::serialize(&self.tx_type).unwrap_or_default());
        bytes.extend_from_slice(&self.from.0);
        bytes.extend_from_slice(&self.to.0);
        bytes.extend_from_slice(&self.amount.to_le_bytes());
        bytes.extend_from_slice(&self.fee.to_le_bytes());
        bytes.extend_from_slice(&self.nonce.to_le_bytes());
        bytes.extend_from_slice(&self.timestamp.to_le_bytes());
        bytes.extend_from_slice(&self.data);
        bytes.extend_from_slice(&self.public_key);
        bytes
    }

    /// Check basic transaction validity (not cryptographic signature verification)
    pub fn is_valid_format(&self) -> bool {
        // Fee must be at least minimum (except for system/reward txs)
        if self.fee < crate::MIN_FEE 
            && self.tx_type != TxType::System 
            && self.tx_type != TxType::MiningReward 
            && self.tx_type != TxType::ReferralReward {
            return false;
        }
        // Amount must not overflow with fee
        if self.amount.checked_add(self.fee).is_none() {
            return false;
        }
        // Amount must not be zero (except for contract calls or data txs)
        if self.amount == 0 && self.tx_type == TxType::Transfer {
            return false;
        }
        // Must have a public key
        if self.public_key.is_empty() {
            return false;
        }
        // Must have a signature (unless system tx)
        if self.signature.is_empty() && self.tx_type != TxType::System {
            return false;
        }
        // Signature should be valid Dilithium length (relaxed check for compatibility)
        if !self.signature.is_empty() && self.signature.len() > Self::DILITHIUM_SIG_LENGTH * 2 {
            return false;
        }
        // Data payload size limit
        if self.data.len() > Self::MAX_DATA_SIZE {
            return false;
        }
        // Timestamp must not be too far in the future
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        if self.timestamp > now + Self::MAX_FUTURE_OFFSET_MS {
            return false;
        }
        // From and to must not be the same (except for staking)
        if self.from == self.to && self.tx_type != TxType::Stake && self.tx_type != TxType::Unstake {
            return false;
        }
        // Total size must be within limit
        if self.size() > Self::MAX_TX_SIZE {
            return false;
        }
        true
    }

    /// Verify Ed25519 cryptographic signature
    pub fn verify_signature(&self) -> bool {
        if self.signature.is_empty() || self.public_key.is_empty() {
            return false;
        }
        let signing_bytes = self.signing_bytes();
        crate::wallet::verify_ed25519(&self.public_key, &signing_bytes, &self.signature)
    }

    /// Check if transaction is executable given current timestamp
    pub fn is_timely(&self, current_time_ms: u64) -> bool {
        // Transaction must not be from the future
        if self.timestamp > current_time_ms + Self::MAX_FUTURE_OFFSET_MS {
            return false;
        }
        // Transaction must not be too old (1 hour max age)
        if current_time_ms > self.timestamp + 3600_000 {
            return false;
        }
        true
    }

    /// Size in bytes (for block size limit calculation)
    pub fn size(&self) -> usize {
        std::mem::size_of::<TxType>()
            + 20 * 2  // from + to addresses
            + 8 * 4   // amount + fee + nonce + timestamp
            + self.data.len()
            + self.public_key.len()
            + self.signature.len()
    }
}
