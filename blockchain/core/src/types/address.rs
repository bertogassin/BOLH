use serde::{Deserialize, Serialize};
use std::fmt;

/// BOLH address: derived from post-quantum public key hash
/// Format: "bolh1" + 40 hex chars (20 bytes of SHA3-256 of public key)
#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Address(pub [u8; 20]);

impl Address {
    /// Create address from public key (SHA3-256 hash, take first 20 bytes)
    pub fn from_public_key(pubkey: &[u8]) -> Self {
        use sha3::{Digest, Sha3_256};
        let hash = Sha3_256::digest(pubkey);
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&hash[..20]);
        Address(addr)
    }

    /// Zero address (used for genesis/system transactions)
    pub fn zero() -> Self {
        Address([0u8; 20])
    }

    /// Check if this is the zero address
    pub fn is_zero(&self) -> bool {
        self.0 == [0u8; 20]
    }

    /// Convert to hex string with "bolh1" prefix
    pub fn to_bech32(&self) -> String {
        format!("bolh1{}", hex::encode(self.0))
    }

    /// Parse from "bolh1..." string
    pub fn from_bech32(s: &str) -> Result<Self, String> {
        if !s.starts_with("bolh1") {
            return Err("Address must start with 'bolh1'".into());
        }
        let hex_part = &s[5..];
        let bytes = hex::decode(hex_part).map_err(|e| format!("Invalid hex: {}", e))?;
        if bytes.len() != 20 {
            return Err(format!("Expected 20 bytes, got {}", bytes.len()));
        }
        let mut addr = [0u8; 20];
        addr.copy_from_slice(&bytes);
        Ok(Address(addr))
    }
}

impl fmt::Display for Address {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_bech32())
    }
}

/// Account state stored in the state trie
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Account {
    /// Current balance in smallest units
    pub balance: u64,

    /// Transaction nonce (prevents replay attacks)
    pub nonce: u64,

    /// Staked amount (for PoS validators)
    pub staked: u64,

    /// Is this account a validator?
    pub is_validator: bool,

    /// Privacy enabled for this account
    pub privacy_enabled: bool,

    /// Referral code (unique per account)
    pub referral_code: Option<String>,

    /// Who referred this account
    pub referred_by: Option<Address>,

    /// Number of successful referrals
    pub referral_count: u64,
}

impl Account {
    /// New empty account
    pub fn new() -> Self {
        Account {
            balance: 0,
            nonce: 0,
            staked: 0,
            is_validator: false,
            privacy_enabled: false,
            referral_code: None,
            referred_by: None,
            referral_count: 0,
        }
    }

    /// New account with initial balance (for genesis)
    pub fn with_balance(balance: u64) -> Self {
        Account {
            balance,
            ..Account::new()
        }
    }

    /// Available balance (total - staked)
    pub fn available_balance(&self) -> u64 {
        self.balance.saturating_sub(self.staked)
    }
}

impl Default for Account {
    fn default() -> Self {
        Self::new()
    }
}
