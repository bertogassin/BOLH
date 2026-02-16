//! C FFI interface for BOLH blockchain.
//! Exports stateful blockchain functions as C-callable APIs for Tauri.

use chrono::Utc;
use pqcrypto_dilithium::dilithium2::{
    detached_sign as pq_detached_sign, keypair as pq_keypair,
    verify_detached_signature as pq_verify, DetachedSignature as DilithiumSignature,
    PublicKey as DilithiumPublicKey, SecretKey as DilithiumSecretKey,
};
use pqcrypto_traits::sign::{DetachedSignature as _, PublicKey as _, SecretKey as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::ffi::{CStr, CString};
use std::fs;
use std::hash::{Hash as StdHash, Hasher};
use std::os::raw::c_char;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const VERSION: &str = "0.3.0";
const NETWORK: &str = "main";
const CHAIN_ID: u64 = 0xB01A;

const MAX_WALLETS: usize = 10_000;
const MAX_MEMPOOL_TXS: usize = 20_000;
const MAX_TX_HISTORY: usize = 5_000;
const MAX_FINALIZED_BLOCKS: usize = 2_000;
const MAX_TX_INPUTS: usize = 128;
const MAX_TX_OUTPUTS: usize = 128;
const MAX_TXS_PER_BLOCK: usize = 50_000;
const MAX_TXS_PER_MINUTE: usize = 30;
const MAX_TX_AMOUNT: u64 = 1_000_000_000_000_000;
const MAX_PRIVATE_PAYLOAD_BYTES: usize = 16_384;
const MIN_RING_SIZE: usize = 3;
const MAX_RING_SIZE: usize = 32;
const MAX_REVEAL_AUDIT_EVENTS: usize = 10_000;

const BOOTSTRAP_VALIDATOR_POWER: u64 = 100;
const DEFAULT_GENESIS_ALLOCATION: u64 = 100_000_000_000;
const DEFAULT_WALLET_FAUCET: u64 = 100_000_000_000;
const DEFAULT_TX_PRIORITY: u8 = 1;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum SignatureScheme {
    HybridQrV1,
    LegacyCompat,
}

impl SignatureScheme {
    fn as_str(self) -> &'static str {
        match self {
            SignatureScheme::HybridQrV1 => "hybrid_qr_v1",
            SignatureScheme::LegacyCompat => "legacy_compat",
        }
    }

    fn from_metadata(meta: &Value) -> Self {
        match meta.get("sig_scheme").and_then(Value::as_str) {
            Some("legacy_compat") => SignatureScheme::LegacyCompat,
            _ => SignatureScheme::HybridQrV1,
        }
    }

    fn requires_quantum_prefix(self) -> bool {
        matches!(self, SignatureScheme::HybridQrV1)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum PrivacyMode {
    Transparent,
    Shielded,
    Viewable,
}

impl PrivacyMode {
    fn as_str(self) -> &'static str {
        match self {
            PrivacyMode::Transparent => "transparent",
            PrivacyMode::Shielded => "shielded",
            PrivacyMode::Viewable => "viewable",
        }
    }

    fn from_metadata(meta: &Value) -> Self {
        match meta.get("privacy_mode").and_then(Value::as_str) {
            Some("shielded") => PrivacyMode::Shielded,
            Some("viewable") => PrivacyMode::Viewable,
            _ => PrivacyMode::Transparent,
        }
    }

    fn is_private(self) -> bool {
        !matches!(self, PrivacyMode::Transparent)
    }
}

/// Runtime policy configuration for decoupled blockchain architecture.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
struct ChainConfig {
    base_fee: u64,
    fee_per_input: u64,
    fee_per_output: u64,
    amount_fee_ppm: u64,
    low_congestion_multiplier_bps: u64,
    medium_congestion_multiplier_bps: u64,
    high_congestion_multiplier_bps: u64,
    instant_settlement_mempool_limit: usize,
    min_quantum_sig_len: usize,
    max_private_payload_bytes: usize,
    low_load_ring_min: usize,
    medium_load_ring_min: usize,
    high_load_ring_min: usize,
    low_load_ring_max: usize,
    medium_load_ring_max: usize,
    high_load_ring_max: usize,
    reveal_audit_retention: usize,
}

impl Default for ChainConfig {
    fn default() -> Self {
        Self {
            base_fee: 400,
            fee_per_input: 120,
            fee_per_output: 80,
            amount_fee_ppm: 150,                    // 0.015%
            low_congestion_multiplier_bps: 850,     // 0.85x
            medium_congestion_multiplier_bps: 1000, // 1.0x
            high_congestion_multiplier_bps: 1200,   // 1.2x
            instant_settlement_mempool_limit: 2_000,
            min_quantum_sig_len: 20,
            max_private_payload_bytes: MAX_PRIVATE_PAYLOAD_BYTES,
            low_load_ring_min: 6,
            medium_load_ring_min: 10,
            high_load_ring_min: 14,
            low_load_ring_max: MAX_RING_SIZE,
            medium_load_ring_max: 28,
            high_load_ring_max: 24,
            reveal_audit_retention: 4_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WalletRecord {
    name: String,
    address: String,
    pubkey: String,
    seckey: String,
    created_at: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct UtxoRecord {
    txid: String,
    output_index: u32,
    address: String,
    amount: u64,
    block_height: u64,
    spent: bool,
    spent_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TxInputRecord {
    prev_txid: String,
    output_index: u32,
    signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TxOutputRecord {
    address: String,
    amount: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TxRecord {
    txid: String,
    inputs: Vec<TxInputRecord>,
    outputs: Vec<TxOutputRecord>,
    fee: u64,
    status: String,
    timestamp: i64,
    metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ValidatorRecord {
    address: String,
    voting_power: u64,
    blocks_proposed: u64,
    votes_cast: u64,
    slash_count: u32,
    is_active: bool,
    last_block_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PendingBlock {
    block_id: String,
    proposer: String,
    height: u64,
    transactions: Vec<Value>,
    votes_yes: HashSet<String>,
    votes_no: HashSet<String>,
    proposed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FinalizedBlockRecord {
    block_id: String,
    proposer: String,
    height: u64,
    transactions: Vec<Value>,
    finalized_at: i64,
    yes_votes: usize,
    no_votes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PrivateTxRecord {
    txid: String,
    privacy_mode: String,
    commitment: String,
    reveal_hash: Option<String>,
    created_at: i64,
    from_hint: String,
    output_count: usize,
    amount_masked: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RevealAuditRecord {
    txid: String,
    requester_hash: String,
    result: String,
    reason: Option<String>,
    timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct MetricsState {
    tx_processed: u64,
    tx_rejected: u64,
    blocks_proposed: u64,
    blocks_finalized: u64,
    wallet_creations: u64,
    avg_tx_process_micros: u64,
    peak_tps: u64,
    tps_window_start_ms: u64,
    tps_window_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RateLimitState {
    window_start_ms: u64,
    count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedState {
    version: u32,
    network: String,
    height: u64,
    round: u64,
    wallets: Vec<WalletRecord>,
    utxos: Vec<UtxoRecord>,
    validators: Vec<ValidatorRecord>,
    tx_history: Vec<TxRecord>,
    processed_txids: Vec<String>,
    #[serde(default)]
    used_signatures: Vec<String>,
    #[serde(default)]
    private_txs: Vec<PrivateTxRecord>,
    #[serde(default)]
    stealth_owner: HashMap<String, String>,
    #[serde(default)]
    reveal_audit: Vec<RevealAuditRecord>,
    metrics: MetricsState,
    #[serde(default)]
    config: ChainConfig,
    tx_seq: u64,
    block_seq: u64,
}

struct ChainState {
    initialized: bool,
    network: String,
    height: u64,
    round: u64,
    wallets: BTreeMap<String, WalletRecord>,
    wallet_by_address: HashMap<String, String>,
    config: ChainConfig,
    utxos: Vec<UtxoRecord>,
    stealth_owner: HashMap<String, String>,
    processed_txids: HashSet<String>,
    used_signatures: HashSet<String>,
    private_txs: BTreeMap<String, PrivateTxRecord>,
    reveal_audit: VecDeque<RevealAuditRecord>,
    mempool: BTreeMap<String, TxRecord>,
    tx_history: VecDeque<TxRecord>,
    validators: BTreeMap<String, ValidatorRecord>,
    pending_blocks: BTreeMap<String, PendingBlock>,
    finalized_blocks: VecDeque<FinalizedBlockRecord>,
    metrics: MetricsState,
    rate_limits: HashMap<String, RateLimitState>,
    tx_seq: u64,
    block_seq: u64,
}

impl ChainState {
    fn new() -> Self {
        let now = now_ms();
        let mut state = Self {
            initialized: false,
            network: NETWORK.to_string(),
            height: 0,
            round: 0,
            wallets: BTreeMap::new(),
            wallet_by_address: HashMap::new(),
            config: ChainConfig::default(),
            utxos: Vec::new(),
            stealth_owner: HashMap::new(),
            processed_txids: HashSet::new(),
            used_signatures: HashSet::new(),
            private_txs: BTreeMap::new(),
            reveal_audit: VecDeque::new(),
            mempool: BTreeMap::new(),
            tx_history: VecDeque::new(),
            validators: BTreeMap::new(),
            pending_blocks: BTreeMap::new(),
            finalized_blocks: VecDeque::new(),
            metrics: MetricsState {
                tps_window_start_ms: now,
                ..MetricsState::default()
            },
            rate_limits: HashMap::new(),
            tx_seq: 0,
            block_seq: 0,
        };
        state.ensure_bootstrap_validators();
        state
    }

    fn init(&mut self) -> Value {
        if !self.initialized {
            if let Ok(Some(persisted)) = Self::load_from_disk() {
                self.apply_persisted(persisted);
            }
            self.initialized = true;
            if self.validators.is_empty() {
                self.ensure_bootstrap_validators();
            }
        }

        json!({
            "status": "initialized",
            "version": VERSION,
            "network": self.network,
            "height": self.height,
            "round": self.round,
            "wallets": self.wallets.len(),
            "validators": self.validators.len(),
            "pending_txs": self.mempool.len(),
            "features": {
                "wallets": true,
                "utxo": true,
                "consensus": true,
                "rate_limit": true,
                "replay_protection": true,
                "signature_replay_protection": true,
                "privacy_modes": ["transparent", "shielded", "viewable"],
                "persistence": true,
                "adaptive_fee": true,
                "instant_settlement": true
            },
            "architecture": {
                "signature_scheme": "hybrid_qr_v1",
                "privacy_model": "shielded_with_view_key_reveal",
                "consensus_model": "weighted_bft_pos",
                "ring_policy": {
                    "low": {"min": self.config.low_load_ring_min, "max": self.config.low_load_ring_max},
                    "medium": {"min": self.config.medium_load_ring_min, "max": self.config.medium_load_ring_max},
                    "high": {"min": self.config.high_load_ring_min, "max": self.config.high_load_ring_max}
                },
                "goal": {
                    "fast": true,
                    "cheap": true,
                    "private": true,
                    "revealable": true
                }
            }
        })
    }

    fn state_path() -> PathBuf {
        if let Ok(path) = std::env::var("BOLH_STATE_PATH") {
            return PathBuf::from(path);
        }
        std::env::temp_dir().join("bolh_chain_state.json")
    }

    fn load_from_disk() -> Result<Option<PersistedState>, String> {
        let path = Self::state_path();
        if !path.exists() {
            return Ok(None);
        }

        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("failed to read persisted state: {e}"))?;
        let persisted: PersistedState = serde_json::from_str(&raw)
            .map_err(|e| format!("failed to parse persisted state: {e}"))?;
        Ok(Some(persisted))
    }

    fn save_to_disk(&self) -> Result<PathBuf, String> {
        let path = Self::state_path();
        let persisted = self.to_persisted();
        let serialized = serde_json::to_string_pretty(&persisted)
            .map_err(|e| format!("failed to serialize state: {e}"))?;
        fs::write(&path, serialized).map_err(|e| format!("failed to write state: {e}"))?;
        Ok(path)
    }

    fn to_persisted(&self) -> PersistedState {
        PersistedState {
            version: 3,
            network: self.network.clone(),
            height: self.height,
            round: self.round,
            wallets: self.wallets.values().cloned().collect(),
            utxos: self.utxos.clone(),
            validators: self.validators.values().cloned().collect(),
            tx_history: self.tx_history.iter().cloned().collect(),
            processed_txids: self.processed_txids.iter().cloned().collect(),
            used_signatures: self.used_signatures.iter().cloned().collect(),
            private_txs: self.private_txs.values().cloned().collect(),
            stealth_owner: self.stealth_owner.clone(),
            reveal_audit: self.reveal_audit.iter().cloned().collect(),
            metrics: self.metrics.clone(),
            config: self.config.clone(),
            tx_seq: self.tx_seq,
            block_seq: self.block_seq,
        }
    }

    fn apply_persisted(&mut self, persisted: PersistedState) {
        self.network = persisted.network;
        self.height = persisted.height;
        self.round = persisted.round;
        self.wallets = persisted
            .wallets
            .into_iter()
            .map(|w| (w.name.clone(), w))
            .collect();
        self.wallet_by_address = self
            .wallets
            .iter()
            .map(|(name, wallet)| (wallet.address.clone(), name.clone()))
            .collect();
        self.utxos = persisted.utxos;
        self.validators = persisted
            .validators
            .into_iter()
            .map(|v| (v.address.clone(), v))
            .collect();
        self.tx_history = persisted.tx_history.into_iter().collect();
        self.processed_txids = persisted.processed_txids.into_iter().collect();
        self.used_signatures = persisted.used_signatures.into_iter().collect();
        self.private_txs = persisted
            .private_txs
            .into_iter()
            .map(|p| (p.txid.clone(), p))
            .collect();
        self.stealth_owner = persisted.stealth_owner;
        self.reveal_audit = persisted.reveal_audit.into_iter().collect();
        self.metrics = persisted.metrics;
        self.config = persisted.config;
        self.tx_seq = persisted.tx_seq;
        self.block_seq = persisted.block_seq;
        self.mempool.clear();
        self.pending_blocks.clear();
        self.finalized_blocks.clear();
        self.rate_limits.clear();

        if self.validators.is_empty() {
            self.ensure_bootstrap_validators();
        }
    }

    fn maybe_autopersist(&self) {
        let _ = self.save_to_disk();
    }

    fn ensure_bootstrap_validators(&mut self) {
        for label in ["validator-alpha", "validator-bravo", "validator-charlie"] {
            let addr = derive_address(&hash_hex(label));
            self.validators
                .entry(addr.clone())
                .or_insert(ValidatorRecord {
                    address: addr,
                    voting_power: BOOTSTRAP_VALIDATOR_POWER,
                    blocks_proposed: 0,
                    votes_cast: 0,
                    slash_count: 0,
                    is_active: true,
                    last_block_height: self.height,
                });
        }
    }

    fn ensure_validator(&mut self, address: &str) {
        self.validators
            .entry(address.to_string())
            .or_insert(ValidatorRecord {
                address: address.to_string(),
                voting_power: BOOTSTRAP_VALIDATOR_POWER,
                blocks_proposed: 0,
                votes_cast: 0,
                slash_count: 0,
                is_active: true,
                last_block_height: self.height,
            });
    }

    fn slash_validator(&mut self, address: &str, reason: &str) {
        let mut slash_count = None;
        if let Some(v) = self.validators.get_mut(address) {
            let slash_amount = (v.voting_power / 10).max(1);
            v.voting_power = v.voting_power.saturating_sub(slash_amount);
            v.slash_count = v.slash_count.saturating_add(1);
            if v.voting_power == 0 {
                v.is_active = false;
            }
            slash_count = Some(v.slash_count);
        }
        if let Some(count) = slash_count {
            let txid = self.next_tx_id(&format!("slash:{address}:{reason}"));
            self.tx_history.push_front(TxRecord {
                txid,
                inputs: Vec::new(),
                outputs: Vec::new(),
                fee: 0,
                status: "slashed".to_string(),
                timestamp: Utc::now().timestamp_millis(),
                metadata: json!({
                    "address": address,
                    "reason": reason,
                    "slash_count": count
                }),
            });
            while self.tx_history.len() > MAX_TX_HISTORY {
                self.tx_history.pop_back();
            }
        }
    }

    fn wallet_json(&self, wallet: &WalletRecord) -> Value {
        json!({
            "name": wallet.name,
            "address": wallet.address,
            "balance": self.balance_of(&wallet.address),
            "pubkey": wallet.pubkey,
            "seckey": wallet.seckey,
            "created_at": wallet.created_at,
            "status": wallet.status
        })
    }

    fn list_wallets_json(&self) -> Value {
        let wallets: Vec<Value> = self.wallets.values().map(|w| self.wallet_json(w)).collect();
        Value::Array(wallets)
    }

    fn create_wallet(&mut self, name: &str) -> Result<Value, String> {
        let wallet_name = name.trim();
        validate_wallet_name(wallet_name)?;
        if self.wallets.len() >= MAX_WALLETS {
            return Err("Wallet limit reached".into());
        }
        if self.wallets.contains_key(wallet_name) {
            return Err("Wallet already exists".into());
        }

        let (pubkey, seckey) = generate_keypair_hex();
        let address = derive_address(&pubkey);
        if self.wallet_by_address.contains_key(&address) {
            return Err("Address collision detected; retry wallet creation".into());
        }

        let wallet = WalletRecord {
            name: wallet_name.to_string(),
            address: address.clone(),
            pubkey,
            seckey,
            created_at: Utc::now().to_rfc3339(),
            status: "active".to_string(),
        };

        self.wallet_by_address
            .insert(address.clone(), wallet.name.clone());
        self.wallets.insert(wallet.name.clone(), wallet.clone());
        self.ensure_validator(&address);
        self.metrics.wallet_creations = self.metrics.wallet_creations.saturating_add(1);

        if self.utxos.is_empty() {
            let faucet_txid = self.next_tx_id("faucet");
            self.utxos.push(UtxoRecord {
                txid: faucet_txid,
                output_index: 0,
                address: address.clone(),
                amount: DEFAULT_WALLET_FAUCET,
                block_height: self.height,
                spent: false,
                spent_at: None,
            });
        }

        Ok(self.wallet_json(&wallet))
    }

    fn get_wallet_info(&self, name: &str) -> Result<Value, String> {
        let wallet = self
            .wallets
            .get(name)
            .ok_or_else(|| "Wallet not found".to_string())?;
        Ok(self.wallet_json(wallet))
    }

    fn get_wallet_balance(&self, name: &str) -> Result<u64, String> {
        let wallet = self
            .wallets
            .get(name)
            .ok_or_else(|| "Wallet not found".to_string())?;
        Ok(self.balance_of(&wallet.address))
    }

    fn delete_wallet(&mut self, name: &str) -> Result<Value, String> {
        let wallet = self
            .wallets
            .remove(name)
            .ok_or_else(|| "Wallet not found".to_string())?;
        self.wallet_by_address.remove(&wallet.address);
        self.rate_limits.remove(&wallet.address);
        self.validators.remove(&wallet.address);
        self.utxos.retain(|u| u.address != wallet.address);

        Ok(json!({
            "deleted": wallet.name,
            "address": wallet.address,
            "status": "success"
        }))
    }

    fn import_wallet(&mut self, name: &str, pubkey: &str, seckey: &str) -> Result<Value, String> {
        let wallet_name = name.trim();
        validate_wallet_name(wallet_name)?;
        if self.wallets.contains_key(wallet_name) {
            return Err("Wallet already exists".into());
        }
        if !is_hex(pubkey) || !is_hex(seckey) {
            return Err("pubkey/seckey must be hex strings".into());
        }
        if pubkey.len() < 16 || seckey.len() < 16 {
            return Err("pubkey/seckey too short".into());
        }

        let address = derive_address(pubkey);
        if self.wallet_by_address.contains_key(&address) {
            return Err("Address already imported".into());
        }

        let wallet = WalletRecord {
            name: wallet_name.to_string(),
            address: address.clone(),
            pubkey: pubkey.to_string(),
            seckey: seckey.to_string(),
            created_at: Utc::now().to_rfc3339(),
            status: "active".to_string(),
        };

        self.wallet_by_address
            .insert(address.clone(), wallet.name.clone());
        self.wallets.insert(wallet.name.clone(), wallet.clone());
        self.ensure_validator(&address);

        Ok(self.wallet_json(&wallet))
    }

    fn init_genesis_from_json(&mut self, accounts_json: &str) -> Result<Value, String> {
        let value: Value = serde_json::from_str(accounts_json)
            .map_err(|e| format!("invalid accounts JSON: {e}"))?;
        let arr = value
            .as_array()
            .ok_or_else(|| "accounts must be a JSON array".to_string())?;
        if arr.is_empty() {
            return Err("accounts list is empty".into());
        }

        let mut allocations: Vec<(String, u64)> = Vec::with_capacity(arr.len());
        for item in arr {
            if let Some(addr) = item.as_str() {
                if !is_valid_address(addr) {
                    return Err(format!("invalid address: {addr}"));
                }
                allocations.push((addr.to_string(), DEFAULT_GENESIS_ALLOCATION));
                continue;
            }

            if let Some(obj) = item.as_object() {
                let addr = obj
                    .get("address")
                    .and_then(Value::as_str)
                    .ok_or_else(|| "account object missing address".to_string())?;
                if !is_valid_address(addr) {
                    return Err(format!("invalid address: {addr}"));
                }
                let amount = obj
                    .get("amount")
                    .and_then(parse_amount)
                    .unwrap_or(DEFAULT_GENESIS_ALLOCATION);
                allocations.push((addr.to_string(), amount));
                continue;
            }

            return Err("account entries must be string addresses or objects".into());
        }

        self.height = 0;
        self.round = 0;
        self.mempool.clear();
        self.pending_blocks.clear();
        self.finalized_blocks.clear();
        self.utxos.clear();
        self.stealth_owner.clear();
        self.processed_txids.clear();
        self.used_signatures.clear();
        self.private_txs.clear();
        self.reveal_audit.clear();

        let genesis_txid = self.next_tx_id("genesis");
        let mut total_allocated = 0u64;
        for (idx, (addr, amount)) in allocations.iter().enumerate() {
            total_allocated = total_allocated.saturating_add(*amount);
            self.utxos.push(UtxoRecord {
                txid: genesis_txid.clone(),
                output_index: idx as u32,
                address: addr.clone(),
                amount: *amount,
                block_height: 0,
                spent: false,
                spent_at: None,
            });
            self.ensure_validator(addr);
        }

        Ok(json!({
            "genesis_height": 0,
            "timestamp": Utc::now().to_rfc3339(),
            "accounts": allocations.len(),
            "total_allocated": total_allocated,
            "status": "initialized"
        }))
    }

    fn resolve_owner_address(&self, address: &str) -> String {
        self.stealth_owner
            .get(address)
            .cloned()
            .unwrap_or_else(|| address.to_string())
    }

    fn owned_by(&self, owner: &str, utxo_addr: &str) -> bool {
        if utxo_addr == owner {
            return true;
        }
        self.stealth_owner
            .get(utxo_addr)
            .map(|mapped| mapped == owner)
            .unwrap_or(false)
    }

    fn derive_stealth_address(&self, owner: &str, txid: &str, output_index: usize) -> String {
        let digest = hash_hex(&format!("stealth:{owner}:{txid}:{output_index}:{CHAIN_ID}"));
        format!("stealth_{}", &digest[..24])
    }

    fn balance_of(&self, address: &str) -> u64 {
        self.utxos
            .iter()
            .filter(|u| self.owned_by(address, &u.address) && !u.spent)
            .map(|u| u.amount)
            .sum()
    }

    fn get_utxos_json(&self, address: &str) -> Value {
        let mut list: Vec<&UtxoRecord> = self
            .utxos
            .iter()
            .filter(|u| self.owned_by(address, &u.address))
            .collect();
        list.sort_by_key(|u| (u.spent, u.block_height, u.output_index));

        let result: Vec<Value> = list
            .into_iter()
            .map(|u| {
                let owner = self.resolve_owner_address(&u.address);
                json!({
                    "txid": u.txid,
                    "output_index": u.output_index,
                    "address": u.address,
                    "owner_hint": if owner == u.address { Value::Null } else { Value::String(owner) },
                    "amount": u.amount,
                    "block_height": u.block_height,
                    "spent": u.spent
                })
            })
            .collect();

        Value::Array(result)
    }

    fn check_rate_limit(&mut self, address: &str) -> Result<(), String> {
        let now = now_ms();
        let entry = self
            .rate_limits
            .entry(address.to_string())
            .or_insert(RateLimitState {
                window_start_ms: now,
                count: 0,
            });

        if now.saturating_sub(entry.window_start_ms) >= 60_000 {
            entry.window_start_ms = now;
            entry.count = 0;
        }

        if entry.count >= MAX_TXS_PER_MINUTE {
            return Err(format!(
                "Rate limit exceeded: max {MAX_TXS_PER_MINUTE} tx/min for address"
            ));
        }
        entry.count += 1;
        Ok(())
    }

    fn parse_priority(meta: &Value) -> u8 {
        let raw = meta
            .get("priority")
            .and_then(Value::as_u64)
            .unwrap_or(DEFAULT_TX_PRIORITY as u64);
        raw.min(3) as u8
    }

    fn parse_ring_size(meta: &Value) -> usize {
        let raw = meta.get("ring_size").and_then(Value::as_u64).unwrap_or(8) as usize;
        raw.clamp(MIN_RING_SIZE, MAX_RING_SIZE)
    }

    fn dynamic_ring_policy(&self) -> (&'static str, usize, usize) {
        let load_ratio = if MAX_MEMPOOL_TXS == 0 {
            0.0
        } else {
            self.mempool.len() as f64 / MAX_MEMPOOL_TXS as f64
        };

        if load_ratio < 0.40 {
            (
                "low",
                self.config.low_load_ring_min.max(MIN_RING_SIZE),
                self.config
                    .low_load_ring_max
                    .clamp(MIN_RING_SIZE, MAX_RING_SIZE),
            )
        } else if load_ratio < 0.75 {
            (
                "medium",
                self.config.medium_load_ring_min.max(MIN_RING_SIZE),
                self.config
                    .medium_load_ring_max
                    .clamp(MIN_RING_SIZE, MAX_RING_SIZE),
            )
        } else {
            (
                "high",
                self.config.high_load_ring_min.max(MIN_RING_SIZE),
                self.config
                    .high_load_ring_max
                    .clamp(MIN_RING_SIZE, MAX_RING_SIZE),
            )
        }
    }

    fn enforce_ring_policy(
        &self,
        requested: usize,
        input_count: usize,
    ) -> Result<(usize, usize, usize, String), String> {
        let requested = requested
            .max(input_count)
            .clamp(MIN_RING_SIZE, MAX_RING_SIZE);
        let (band, mut min_ring, mut max_ring) = self.dynamic_ring_policy();

        if min_ring > max_ring {
            std::mem::swap(&mut min_ring, &mut max_ring);
        }

        if requested < min_ring {
            return Err(format!(
                "ring_size {} below dynamic minimum {} for {} network load",
                requested, min_ring, band
            ));
        }

        let effective = requested.clamp(min_ring, max_ring);
        Ok((min_ring, max_ring, effective, band.to_string()))
    }

    fn record_reveal_audit(
        &mut self,
        txid: &str,
        reveal_key: &str,
        result: &str,
        reason: Option<&str>,
    ) {
        let event = RevealAuditRecord {
            txid: txid.to_string(),
            requester_hash: hash_hex(reveal_key),
            result: result.to_string(),
            reason: reason.map(str::to_string),
            timestamp: Utc::now().timestamp_millis(),
        };
        self.reveal_audit.push_front(event);

        let cap = self
            .config
            .reveal_audit_retention
            .clamp(50, MAX_REVEAL_AUDIT_EVENTS);
        while self.reveal_audit.len() > cap {
            self.reveal_audit.pop_back();
        }
    }

    fn reveal_audit_json(&self, limit: usize) -> Value {
        let cap = limit.clamp(1, 500);
        Value::Array(
            self.reveal_audit
                .iter()
                .take(cap)
                .map(|e| {
                    json!({
                        "txid": e.txid,
                        "requester_hash": e.requester_hash,
                        "result": e.result,
                        "reason": e.reason,
                        "timestamp": e.timestamp
                    })
                })
                .collect(),
        )
    }

    fn estimate_required_fee(
        &self,
        input_count: usize,
        output_count: usize,
        output_total: u64,
        priority: u8,
    ) -> u64 {
        let base = self.config.base_fee;
        let io_fee = self
            .config
            .fee_per_input
            .saturating_mul(input_count as u64)
            .saturating_add(
                self.config
                    .fee_per_output
                    .saturating_mul(output_count as u64),
            );
        let amount_fee = output_total.saturating_mul(self.config.amount_fee_ppm) / 1_000_000;
        let priority_boost = match priority {
            0 => 90,
            1 => 100,
            2 => 120,
            _ => 150,
        };

        let congestion_ratio_bps = if self.mempool.len() < (MAX_MEMPOOL_TXS / 3) {
            self.config.low_congestion_multiplier_bps
        } else if self.mempool.len() < (MAX_MEMPOOL_TXS * 2 / 3) {
            self.config.medium_congestion_multiplier_bps
        } else {
            self.config.high_congestion_multiplier_bps
        };

        let subtotal = base
            .saturating_add(io_fee)
            .saturating_add(amount_fee)
            .saturating_mul(priority_boost as u64)
            / 100;

        subtotal.saturating_mul(congestion_ratio_bps) / 10_000
    }

    fn select_decoy_inputs(
        &self,
        consumed_indices: &[usize],
        sender_owner: &str,
        target_decoys: usize,
    ) -> Vec<String> {
        if target_decoys == 0 {
            return Vec::new();
        }
        let consumed: HashSet<usize> = consumed_indices.iter().copied().collect();
        let mut refs: Vec<String> = self
            .utxos
            .iter()
            .enumerate()
            .filter(|(idx, utxo)| {
                !utxo.spent
                    && !consumed.contains(idx)
                    && self.resolve_owner_address(&utxo.address) != sender_owner
            })
            .map(|(_, utxo)| format!("{}:{}", utxo.txid, utxo.output_index))
            .collect();
        refs.sort();
        refs.into_iter().take(target_decoys).collect()
    }

    fn commitment_for_tx(
        &self,
        txid: &str,
        sender: &str,
        output_total: u64,
        mode: PrivacyMode,
        reveal_hash: Option<&str>,
    ) -> String {
        hash_hex(&format!(
            "commit:{txid}:{sender}:{output_total}:{}:{}:{CHAIN_ID}",
            mode.as_str(),
            reveal_hash.unwrap_or("-")
        ))
    }

    fn track_private_tx(
        &mut self,
        txid: &str,
        sender: &str,
        output_total: u64,
        output_count: usize,
        mode: PrivacyMode,
        reveal_hash: Option<String>,
        revealable: bool,
    ) -> Value {
        let commitment =
            self.commitment_for_tx(txid, sender, output_total, mode, reveal_hash.as_deref());
        if mode.is_private() {
            let record = PrivateTxRecord {
                txid: txid.to_string(),
                privacy_mode: mode.as_str().to_string(),
                commitment: commitment.clone(),
                reveal_hash: reveal_hash.clone(),
                created_at: Utc::now().timestamp_millis(),
                from_hint: obfuscate_address(sender),
                output_count,
                amount_masked: mask_amount(output_total),
            };
            self.private_txs.insert(txid.to_string(), record);
        }
        json!({
            "mode": mode.as_str(),
            "private": mode.is_private(),
            "revealable": revealable,
            "commitment": commitment,
            "reveal_hash": reveal_hash
        })
    }

    fn reveal_private_tx(&mut self, txid: &str, reveal_key: &str) -> Result<Value, String> {
        let record = match self.private_txs.get(txid).cloned() {
            Some(record) => record,
            None => {
                self.record_reveal_audit(
                    txid,
                    reveal_key,
                    "denied",
                    Some("private transaction not found"),
                );
                return Err("private transaction not found".into());
            }
        };

        if record.privacy_mode != "viewable" {
            self.record_reveal_audit(
                txid,
                reveal_key,
                "denied",
                Some("transaction is shielded-only"),
            );
            return Err("transaction is shielded-only and cannot be revealed".into());
        }

        let expected = match record.reveal_hash.as_ref() {
            Some(v) => v,
            None => {
                self.record_reveal_audit(txid, reveal_key, "denied", Some("missing reveal hash"));
                return Err("transaction has no reveal key".into());
            }
        };

        let provided = hash_hex(reveal_key);
        if &provided != expected {
            self.record_reveal_audit(txid, reveal_key, "denied", Some("invalid reveal key"));
            return Err("invalid reveal key".into());
        }

        let tx = match self
            .tx_history
            .iter()
            .find(|entry| entry.txid == txid)
            .cloned()
        {
            Some(tx) => tx,
            None => {
                self.record_reveal_audit(
                    txid,
                    reveal_key,
                    "denied",
                    Some("transaction payload not found"),
                );
                return Err("transaction payload not found".into());
            }
        };

        self.record_reveal_audit(txid, reveal_key, "success", None);
        let total_output: u64 = tx.outputs.iter().map(|o| o.amount).sum();
        Ok(json!({
            "txid": txid,
            "revealed": true,
            "mode": record.privacy_mode,
            "commitment": record.commitment,
            "outputs": tx.outputs,
            "fee": tx.fee,
            "status": tx.status,
            "timestamp": tx.timestamp,
            "total_output": total_output
        }))
    }

    fn parse_tx_value(&mut self, tx_value: &Value) -> Result<TxRecord, String> {
        let txid = tx_value
            .get("txid")
            .and_then(Value::as_str)
            .filter(|s| !s.trim().is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| self.next_tx_id("tx"));

        let timestamp = tx_value
            .get("timestamp")
            .and_then(Value::as_i64)
            .unwrap_or_else(|| Utc::now().timestamp_millis());

        let mut metadata = tx_value
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| json!({}));
        if metadata.to_string().len() > self.config.max_private_payload_bytes {
            return Err("metadata payload is too large".into());
        }
        if !metadata.is_object() {
            metadata = json!({});
        }
        if let Some(meta_obj) = metadata.as_object_mut() {
            meta_obj.entry("sig_scheme").or_insert(Value::String(
                SignatureScheme::HybridQrV1.as_str().to_string(),
            ));
            meta_obj
                .entry("privacy_mode")
                .or_insert(Value::String(PrivacyMode::Transparent.as_str().to_string()));
            meta_obj
                .entry("priority")
                .or_insert(Value::from(DEFAULT_TX_PRIORITY));
            meta_obj.entry("ring_size").or_insert(Value::from(8u64));
        }

        let inputs: Vec<TxInputRecord> = tx_value
            .get("inputs")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .map(|input| {
                        let prev_txid = input
                            .get("prev_txid")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        let output_index = input
                            .get("output_index")
                            .and_then(Value::as_u64)
                            .unwrap_or(0) as u32;
                        let signature = input
                            .get("signature")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        TxInputRecord {
                            prev_txid,
                            output_index,
                            signature,
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        let outputs: Vec<TxOutputRecord> = tx_value
            .get("outputs")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .map(|output| {
                        let address = output
                            .get("address")
                            .and_then(Value::as_str)
                            .unwrap_or_default()
                            .to_string();
                        let amount = output
                            .get("amount")
                            .and_then(parse_amount)
                            .unwrap_or_default();
                        TxOutputRecord { address, amount }
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(TxRecord {
            txid,
            inputs,
            outputs,
            fee: 0,
            status: "pending".to_string(),
            timestamp,
            metadata,
        })
    }

    fn tx_signing_material_from_value(tx_value: &Value) -> String {
        let inputs = tx_value
            .get("inputs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let outputs = tx_value
            .get("outputs")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let timestamp = tx_value
            .get("timestamp")
            .and_then(Value::as_i64)
            .unwrap_or(0);
        let metadata = tx_value
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| json!({}));
        let privacy_mode = metadata
            .get("privacy_mode")
            .and_then(Value::as_str)
            .unwrap_or("transparent");
        let priority = metadata
            .get("priority")
            .and_then(Value::as_u64)
            .unwrap_or(DEFAULT_TX_PRIORITY as u64);
        let sender = metadata
            .get("sender")
            .and_then(Value::as_str)
            .unwrap_or_default();

        let input_material = inputs
            .iter()
            .map(|entry| {
                let prev = entry
                    .get("prev_txid")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let idx = entry
                    .get("output_index")
                    .and_then(Value::as_u64)
                    .unwrap_or_default();
                format!("{prev}:{idx}")
            })
            .collect::<Vec<_>>()
            .join("|");
        let output_material = outputs
            .iter()
            .map(|entry| {
                let addr = entry
                    .get("address")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let amount = entry
                    .get("amount")
                    .and_then(parse_amount)
                    .unwrap_or_default();
                format!("{addr}:{amount}")
            })
            .collect::<Vec<_>>()
            .join("|");

        hash_hex(&format!(
            "txmat:{input_material}>{output_material}:{timestamp}:{privacy_mode}:{priority}:{sender}:{CHAIN_ID}"
        ))
    }

    fn tx_signing_material_from_record(tx: &TxRecord) -> String {
        let input_material = tx
            .inputs
            .iter()
            .map(|entry| format!("{}:{}", entry.prev_txid, entry.output_index))
            .collect::<Vec<_>>()
            .join("|");
        let output_material = tx
            .outputs
            .iter()
            .map(|entry| format!("{}:{}", entry.address, entry.amount))
            .collect::<Vec<_>>()
            .join("|");
        let privacy_mode = tx
            .metadata
            .get("privacy_mode")
            .and_then(Value::as_str)
            .unwrap_or("transparent");
        let priority = tx
            .metadata
            .get("priority")
            .and_then(Value::as_u64)
            .unwrap_or(DEFAULT_TX_PRIORITY as u64);
        let sender = tx
            .metadata
            .get("sender")
            .and_then(Value::as_str)
            .unwrap_or_default();

        hash_hex(&format!(
            "txmat:{input_material}>{output_material}:{}:{privacy_mode}:{priority}:{sender}:{CHAIN_ID}",
            tx.timestamp
        ))
    }

    fn resolve_signing_keypair(
        &self,
        metadata: &Value,
        tx_value: &Value,
    ) -> (String, String, String) {
        let from_metadata = metadata
            .get("signing_pubkey")
            .and_then(Value::as_str)
            .zip(metadata.get("signing_seckey").and_then(Value::as_str))
            .map(|(pk, sk)| (pk.to_string(), sk.to_string(), "metadata"));
        if let Some((pk, sk, src)) = from_metadata {
            return (pk, sk, src.to_string());
        }

        if let Some(sender_name) = metadata.get("sender").and_then(Value::as_str) {
            if let Some(wallet) = self.wallets.get(sender_name) {
                return (
                    wallet.pubkey.clone(),
                    wallet.seckey.clone(),
                    "wallet_sender".to_string(),
                );
            }
        }

        let from_address = tx_value
            .get("from")
            .and_then(Value::as_str)
            .or_else(|| metadata.get("sender_address").and_then(Value::as_str));
        if let Some(address) = from_address {
            if let Some(wallet_name) = self.wallet_by_address.get(address) {
                if let Some(wallet) = self.wallets.get(wallet_name) {
                    return (
                        wallet.pubkey.clone(),
                        wallet.seckey.clone(),
                        "wallet_address".to_string(),
                    );
                }
            }
        }

        let (pk, sk) = generate_keypair_hex();
        (pk, sk, "ephemeral".to_string())
    }

    fn validate_and_process_tx_json(&mut self, tx_json: &str) -> Result<Value, String> {
        let start = Instant::now();
        let tx_val: Value =
            serde_json::from_str(tx_json).map_err(|e| format!("invalid tx JSON: {e}"))?;
        let mut tx = self.parse_tx_value(&tx_val)?;
        let sig_scheme = SignatureScheme::from_metadata(&tx.metadata);
        let privacy_mode = PrivacyMode::from_metadata(&tx.metadata);
        let reveal_key = tx
            .metadata
            .get("reveal_key")
            .and_then(Value::as_str)
            .map(str::to_string);
        let signing_material = Self::tx_signing_material_from_record(&tx);

        if let Some(declared_material) = tx.metadata.get("signed_material").and_then(Value::as_str)
        {
            if declared_material != signing_material {
                self.record_rejected_tx();
                return Err("signed material mismatch (tampered transaction payload)".into());
            }
        }

        if sig_scheme == SignatureScheme::HybridQrV1 {
            let pq_pubkey = tx
                .metadata
                .get("pq_pubkey")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    self.record_rejected_tx();
                    "missing pq_pubkey in metadata".to_string()
                })?;
            let pq_signature = tx
                .metadata
                .get("pq_signature")
                .and_then(Value::as_str)
                .ok_or_else(|| {
                    self.record_rejected_tx();
                    "missing pq_signature in metadata".to_string()
                })?;
            let verified = pq_verify_bytes(signing_material.as_bytes(), pq_signature, pq_pubkey)
                .map_err(|err| {
                    self.record_rejected_tx();
                    format!("post-quantum verify error: {err}")
                })?;
            if !verified {
                self.record_rejected_tx();
                return Err("post-quantum signature verification failed".into());
            }
        }

        if privacy_mode == PrivacyMode::Viewable && reveal_key.is_none() {
            self.record_rejected_tx();
            return Err("viewable transactions require metadata.reveal_key".into());
        }

        if tx.inputs.is_empty() {
            self.record_rejected_tx();
            return Err("transaction must contain at least one input".into());
        }
        if tx.outputs.is_empty() {
            self.record_rejected_tx();
            return Err("transaction must contain at least one output".into());
        }
        if tx.inputs.len() > MAX_TX_INPUTS {
            self.record_rejected_tx();
            return Err(format!("too many inputs (max {MAX_TX_INPUTS})"));
        }
        if tx.outputs.len() > MAX_TX_OUTPUTS {
            self.record_rejected_tx();
            return Err(format!("too many outputs (max {MAX_TX_OUTPUTS})"));
        }
        if self.processed_txids.contains(&tx.txid) {
            self.record_rejected_tx();
            return Err("transaction replay detected".into());
        }
        if let Some(existing) = self.mempool.get(&tx.txid) {
            if tx_io_fingerprint(existing) != tx_io_fingerprint(&tx) {
                self.record_rejected_tx();
                return Err("mempool transaction id collision".into());
            }
        }
        self.mempool.remove(&tx.txid);

        let mut input_total: u64 = 0;
        let mut output_total: u64 = 0;
        let mut source_addresses: HashSet<String> = HashSet::new();
        let mut seen_inputs: HashSet<String> = HashSet::new();
        let mut seen_signatures: HashSet<String> = HashSet::new();
        let mut consumed_indices: Vec<usize> = Vec::new();

        for input in &tx.inputs {
            if input.prev_txid.is_empty() {
                self.record_rejected_tx();
                return Err("input prev_txid is empty".into());
            }
            if input.signature.trim().len() < 8 {
                self.record_rejected_tx();
                return Err("input signature is too short".into());
            }
            if sig_scheme.requires_quantum_prefix() {
                if !input.signature.starts_with("qsig_") {
                    self.record_rejected_tx();
                    return Err("quantum signature required (qsig_ prefix missing)".into());
                }
                if input.signature.len() < self.config.min_quantum_sig_len {
                    self.record_rejected_tx();
                    return Err("quantum signature payload too short".into());
                }
            }
            if !seen_signatures.insert(input.signature.clone()) {
                self.record_rejected_tx();
                return Err("duplicate signature in transaction".into());
            }
            if self.used_signatures.contains(&input.signature) {
                self.record_rejected_tx();
                return Err("signature replay detected".into());
            }

            let key = format!("{}:{}", input.prev_txid, input.output_index);
            if !seen_inputs.insert(key) {
                self.record_rejected_tx();
                return Err("duplicate input in transaction".into());
            }

            let idx = self
                .utxos
                .iter()
                .position(|u| u.txid == input.prev_txid && u.output_index == input.output_index)
                .ok_or_else(|| {
                    self.record_rejected_tx();
                    format!(
                        "input not found: {}:{}",
                        input.prev_txid, input.output_index
                    )
                })?;

            if self.utxos[idx].spent {
                self.record_rejected_tx();
                return Err("double spend detected (input already spent)".into());
            }

            input_total = input_total
                .checked_add(self.utxos[idx].amount)
                .ok_or_else(|| {
                    self.record_rejected_tx();
                    "input total overflow".to_string()
                })?;
            source_addresses.insert(self.resolve_owner_address(&self.utxos[idx].address));
            consumed_indices.push(idx);
        }

        if source_addresses.len() != 1 {
            self.record_rejected_tx();
            return Err("multi-address inputs are not supported".into());
        }
        let sender = source_addresses.iter().next().cloned().unwrap_or_default();

        if let Err(rate_err) = self.check_rate_limit(&sender) {
            self.record_rejected_tx();
            return Err(rate_err);
        }

        for output in &tx.outputs {
            let is_valid_output = if privacy_mode.is_private() {
                is_valid_address(&output.address) || output.address.starts_with("stealth_")
            } else {
                is_valid_address(&output.address)
            };
            if !is_valid_output {
                self.record_rejected_tx();
                return Err(format!("invalid output address: {}", output.address));
            }
            if output.amount == 0 {
                self.record_rejected_tx();
                return Err("output amount must be > 0".into());
            }
            if output.amount > MAX_TX_AMOUNT {
                self.record_rejected_tx();
                return Err("output amount exceeds maximum".into());
            }
            output_total = output_total.checked_add(output.amount).ok_or_else(|| {
                self.record_rejected_tx();
                "output total overflow".to_string()
            })?;
        }

        if output_total > input_total {
            self.record_rejected_tx();
            return Err("insufficient input amount".into());
        }

        let fee = input_total.saturating_sub(output_total);
        let priority = Self::parse_priority(&tx.metadata);
        let ring_size_requested = Self::parse_ring_size(&tx.metadata);
        let (ring_min, ring_max, ring_size_target, ring_load_band) = if privacy_mode.is_private() {
            match self.enforce_ring_policy(ring_size_requested, tx.inputs.len()) {
                Ok(v) => v,
                Err(err) => {
                    self.record_rejected_tx();
                    return Err(err);
                }
            }
        } else {
            (
                tx.inputs.len(),
                tx.inputs.len(),
                tx.inputs.len(),
                "transparent".to_string(),
            )
        };
        let decoys = if privacy_mode.is_private() {
            self.select_decoy_inputs(
                &consumed_indices,
                &sender,
                ring_size_target.saturating_sub(tx.inputs.len()),
            )
        } else {
            Vec::new()
        };
        let ring_size_effective = tx.inputs.len() + decoys.len();
        let required_fee =
            self.estimate_required_fee(tx.inputs.len(), tx.outputs.len(), output_total, priority);
        if fee < required_fee {
            self.record_rejected_tx();
            return Err(format!(
                "fee too low: paid {fee}, required at least {required_fee}"
            ));
        }

        for idx in consumed_indices {
            if let Some(utxo) = self.utxos.get_mut(idx) {
                utxo.spent = true;
                utxo.spent_at = Some(Utc::now().to_rfc3339());
            }
        }

        let next_height = self.height.saturating_add(1);
        let mut issued_addresses: Vec<String> = Vec::with_capacity(tx.outputs.len());
        for (i, output) in tx.outputs.iter().enumerate() {
            let mut ledger_address = output.address.clone();
            if privacy_mode.is_private() && is_valid_address(&output.address) {
                let stealth = self.derive_stealth_address(&output.address, &tx.txid, i);
                self.stealth_owner
                    .insert(stealth.clone(), output.address.clone());
                ledger_address = stealth;
            }
            self.utxos.push(UtxoRecord {
                txid: tx.txid.clone(),
                output_index: i as u32,
                address: ledger_address.clone(),
                amount: output.amount,
                block_height: next_height,
                spent: false,
                spent_at: None,
            });
            let validator_addr = self.resolve_owner_address(&ledger_address);
            self.ensure_validator(&validator_addr);
            issued_addresses.push(ledger_address);
        }

        for input in &tx.inputs {
            self.used_signatures.insert(input.signature.clone());
        }
        tx.fee = fee;
        tx.status = "confirmed".to_string();
        if privacy_mode.is_private() {
            if let Some(meta_obj) = tx.metadata.as_object_mut() {
                meta_obj.insert(
                    "amount_commitment".to_string(),
                    Value::String(hash_hex(&format!(
                        "amt:{}:{}:{}",
                        output_total, tx.txid, CHAIN_ID
                    ))),
                );
            }
        }
        self.processed_txids.insert(tx.txid.clone());
        let reveal_hash = if privacy_mode == PrivacyMode::Viewable {
            reveal_key.as_ref().map(|k| hash_hex(k))
        } else {
            None
        };
        let mut privacy_info = self.track_private_tx(
            &tx.txid,
            &sender,
            output_total,
            tx.outputs.len(),
            privacy_mode,
            reveal_hash.clone(),
            privacy_mode == PrivacyMode::Viewable,
        );
        if let Some(obj) = privacy_info.as_object_mut() {
            obj.insert(
                "ring_size_requested".to_string(),
                Value::from(ring_size_requested),
            );
            obj.insert(
                "ring_size_effective".to_string(),
                Value::from(ring_size_effective),
            );
            obj.insert("ring_policy_min".to_string(), Value::from(ring_min as u64));
            obj.insert("ring_policy_max".to_string(), Value::from(ring_max as u64));
            obj.insert(
                "ring_load_band".to_string(),
                Value::String(ring_load_band.clone()),
            );
            obj.insert("decoy_count".to_string(), Value::from(decoys.len() as u64));
            obj.insert(
                "decoy_inputs".to_string(),
                Value::Array(decoys.into_iter().map(Value::String).collect()),
            );
            obj.insert(
                "stealth_outputs".to_string(),
                Value::Array(
                    issued_addresses
                        .iter()
                        .map(|addr| {
                            if privacy_mode.is_private() {
                                Value::String(obfuscate_address(addr))
                            } else {
                                Value::String(addr.clone())
                            }
                        })
                        .collect(),
                ),
            );
        }

        self.tx_history.push_front(tx.clone());
        while self.tx_history.len() > MAX_TX_HISTORY {
            self.tx_history.pop_back();
        }

        self.metrics.tx_processed = self.metrics.tx_processed.saturating_add(1);
        self.record_tx_latency(start.elapsed().as_micros() as u64);
        self.bump_tps_counter();

        let from_public = if privacy_mode.is_private() {
            obfuscate_address(&sender)
        } else {
            sender.clone()
        };
        let fee_tier = if required_fee < 1_000 {
            "ultra_cheap"
        } else if required_fee < 3_000 {
            "cheap"
        } else {
            "normal"
        };

        Ok(json!({
            "valid": true,
            "txid": tx.txid,
            "fee": fee,
            "status": "accepted",
            "inputs": tx.inputs.len(),
            "outputs": tx.outputs.len(),
            "from": from_public,
            "new_balance": self.balance_of(&sender),
            "height_hint": next_height,
            "signature_scheme": sig_scheme.as_str(),
            "privacy": privacy_info,
            "fee_policy": {
                "required_fee": required_fee,
                "paid_fee": fee,
                "priority": priority,
                "tier": fee_tier
            }
        }))
    }

    fn sign_tx_payload(&self, tx_raw: &str) -> Value {
        let mut tx_value = serde_json::from_str::<Value>(tx_raw).unwrap_or_else(|_| json!(tx_raw));
        if !tx_value.is_object() {
            return json!({ "error": "transaction payload must be a JSON object" });
        }
        let mut metadata = tx_value
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| json!({}));
        if !metadata.is_object() {
            metadata = json!({});
        }
        if let Some(meta_obj) = metadata.as_object_mut() {
            meta_obj.entry("sig_scheme").or_insert(Value::String(
                SignatureScheme::HybridQrV1.as_str().to_string(),
            ));
            meta_obj
                .entry("privacy_mode")
                .or_insert(Value::String(PrivacyMode::Transparent.as_str().to_string()));
            meta_obj
                .entry("priority")
                .or_insert(Value::from(DEFAULT_TX_PRIORITY));
            meta_obj.entry("ring_size").or_insert(Value::from(8u64));
        }
        if let Some(tx_obj) = tx_value.as_object_mut() {
            tx_obj.insert("metadata".to_string(), metadata.clone());
        }

        let sig_scheme = SignatureScheme::from_metadata(&metadata);
        let signing_material = Self::tx_signing_material_from_value(&tx_value);
        let tx_hash = signing_material.clone();
        let (pq_pubkey, pq_seckey, key_source) = self.resolve_signing_keypair(&metadata, &tx_value);

        let (signature, pq_signature, local_verify_ok) = match sig_scheme {
            SignatureScheme::HybridQrV1 => {
                let pq_signature = match pq_sign_bytes(signing_material.as_bytes(), &pq_seckey) {
                    Ok(sig) => sig,
                    Err(err) => {
                        return json!({
                            "error": format!("quantum signing failed: {err}")
                        });
                    }
                };
                let verify_ok =
                    pq_verify_bytes(signing_material.as_bytes(), &pq_signature, &pq_pubkey)
                        .unwrap_or(false);
                let marker = format!("qsig_{}", &hash_hex(&pq_signature)[..32]);
                (marker, Some(pq_signature), verify_ok)
            }
            SignatureScheme::LegacyCompat => {
                let signature_seed =
                    hash_hex(&format!("{tx_raw}:{tx_hash}:{CHAIN_ID}:{}", now_ms()));
                (format!("sig_{signature_seed}"), None, true)
            }
        };

        let privacy_mode = PrivacyMode::from_metadata(&metadata);
        let priority = Self::parse_priority(&metadata);
        if let Some(tx_obj) = tx_value.as_object_mut() {
            if let Some(meta_obj) = tx_obj.get_mut("metadata").and_then(Value::as_object_mut) {
                meta_obj.insert(
                    "signed_material".to_string(),
                    Value::String(signing_material.clone()),
                );
                meta_obj.insert("tx_hash".to_string(), Value::String(tx_hash.clone()));
                if sig_scheme == SignatureScheme::HybridQrV1 {
                    meta_obj.insert("pq_pubkey".to_string(), Value::String(pq_pubkey.clone()));
                    if let Some(pq_sig) = &pq_signature {
                        meta_obj.insert("pq_signature".to_string(), Value::String(pq_sig.clone()));
                    }
                }
            }
        }

        json!({
            "signed": signature,
            "tx": tx_value,
            "tx_hash": tx_hash,
            "chain_id": CHAIN_ID,
            "status": "signed",
            "signature_bundle": {
                "scheme": sig_scheme.as_str(),
                "quantum_resistant": sig_scheme.requires_quantum_prefix(),
                "chain_locked": true,
                "key_source": key_source,
                "pq_pubkey": pq_pubkey,
                "pq_signature": pq_signature,
                "signed_material": signing_material,
                "verified_locally": local_verify_ok
            },
            "privacy_mode": privacy_mode.as_str(),
            "priority": priority
        })
    }

    fn submit_signed_tx(&mut self, signed_raw: &str) -> Result<Value, String> {
        let signed_val: Value =
            serde_json::from_str(signed_raw).unwrap_or_else(|_| json!({ "raw": signed_raw }));
        let signature_bundle = signed_val.get("signature_bundle");
        let signature = signed_val
            .get("signed")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if signature.trim().len() < 8 {
            return Err("signed payload is invalid".into());
        }

        let mut tx_val = signed_val.get("tx").cloned().unwrap_or_else(|| json!({}));
        let sig_scheme = signed_val
            .get("signature_bundle")
            .and_then(|bundle| bundle.get("scheme"))
            .and_then(Value::as_str)
            .map(|s| match s {
                "legacy_compat" => SignatureScheme::LegacyCompat,
                _ => SignatureScheme::HybridQrV1,
            })
            .unwrap_or_else(|| {
                let meta = tx_val.get("metadata").cloned().unwrap_or_else(|| json!({}));
                SignatureScheme::from_metadata(&meta)
            });
        if sig_scheme.requires_quantum_prefix() {
            if !signature.starts_with("qsig_") {
                return Err("signed payload must use qsig_ prefix for hybrid_qr_v1".into());
            }
            if signature.len() < self.config.min_quantum_sig_len {
                return Err("signed payload is too short for hybrid_qr_v1".into());
            }
        }

        if let Some(tx_obj) = tx_val.as_object_mut() {
            let mut metadata = tx_obj.get("metadata").cloned().unwrap_or_else(|| json!({}));
            if !metadata.is_object() {
                metadata = json!({});
            }
            if let Some(meta_obj) = metadata.as_object_mut() {
                meta_obj
                    .entry("sig_scheme")
                    .or_insert(Value::String(sig_scheme.as_str().to_string()));
                meta_obj
                    .entry("privacy_mode")
                    .or_insert(Value::String(PrivacyMode::Transparent.as_str().to_string()));
                meta_obj
                    .entry("priority")
                    .or_insert(Value::from(DEFAULT_TX_PRIORITY));
                meta_obj.entry("ring_size").or_insert(Value::from(8u64));
                if let Some(bundle) = signature_bundle {
                    if let Some(pubkey) = bundle.get("pq_pubkey").and_then(Value::as_str) {
                        meta_obj
                            .entry("pq_pubkey".to_string())
                            .or_insert(Value::String(pubkey.to_string()));
                    }
                    if let Some(sig) = bundle.get("pq_signature").and_then(Value::as_str) {
                        meta_obj
                            .entry("pq_signature".to_string())
                            .or_insert(Value::String(sig.to_string()));
                    }
                    if let Some(mat) = bundle.get("signed_material").and_then(Value::as_str) {
                        meta_obj
                            .entry("signed_material".to_string())
                            .or_insert(Value::String(mat.to_string()));
                    }
                }
                if let Some(tx_hash) = signed_val.get("tx_hash").and_then(Value::as_str) {
                    meta_obj
                        .entry("tx_hash".to_string())
                        .or_insert(Value::String(tx_hash.to_string()));
                }
            }
            tx_obj.insert("metadata".to_string(), metadata);

            if let Some(inputs) = tx_obj.get_mut("inputs").and_then(Value::as_array_mut) {
                for (idx, input) in inputs.iter_mut().enumerate() {
                    if let Some(input_obj) = input.as_object_mut() {
                        let should_patch = input_obj
                            .get("signature")
                            .and_then(Value::as_str)
                            .map(|s| s.trim().is_empty())
                            .unwrap_or(true);
                        if should_patch {
                            input_obj.insert(
                                "signature".to_string(),
                                Value::String(format!("{signature}_{idx}")),
                            );
                        }
                    }
                }
            }
        }

        let tx_hash = signed_val
            .get("tx_hash")
            .and_then(Value::as_str)
            .unwrap_or_default();

        let txid = tx_val
            .get("txid")
            .and_then(Value::as_str)
            .filter(|v| !v.trim().is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| {
                if tx_hash.is_empty() {
                    self.next_tx_id(signed_raw)
                } else {
                    format!("tx_{}", &tx_hash[..tx_hash.len().min(16)])
                }
            });

        if self.processed_txids.contains(&txid) || self.mempool.contains_key(&txid) {
            return Err("transaction already known".into());
        }
        if self.mempool.len() >= MAX_MEMPOOL_TXS {
            return Err("mempool is full".into());
        }

        let mut tx = self.parse_tx_value(&tx_val)?;
        tx.txid = txid.clone();
        tx.status = "pending".to_string();
        let priority = Self::parse_priority(&tx.metadata);
        let output_total: u64 = tx.outputs.iter().map(|o| o.amount).sum();
        let recommended_fee =
            self.estimate_required_fee(tx.inputs.len(), tx.outputs.len(), output_total, priority);
        let fast_path_eligible = self.mempool.len() <= self.config.instant_settlement_mempool_limit;
        let tx_backup = tx.clone();
        self.mempool.insert(txid.clone(), tx);

        let use_fast_path = tx_backup
            .metadata
            .get("fast")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        if use_fast_path && fast_path_eligible {
            let tx_json = serde_json::to_string(&tx_backup)
                .map_err(|e| format!("failed to serialize tx for fast path: {e}"))?;
            match self.validate_and_process_tx_json(&tx_json) {
                Ok(processed) => {
                    return Ok(json!({
                        "txid": txid,
                        "status": "confirmed_fast",
                        "mempool": false,
                        "pool_size": self.mempool.len(),
                        "fast_path": true,
                        "processed": processed
                    }));
                }
                Err(_fast_err) => {
                    self.mempool.entry(txid.clone()).or_insert(tx_backup);
                }
            }
        }

        let fee_tier = if recommended_fee < 1_000 {
            "ultra_cheap"
        } else if recommended_fee < 3_000 {
            "cheap"
        } else {
            "normal"
        };

        Ok(json!({
            "txid": txid,
            "status": "pending",
            "mempool": true,
            "pool_size": self.mempool.len(),
            "fast_path": false,
            "fast_path_eligible": fast_path_eligible,
            "recommended_fee": recommended_fee,
            "fee_tier": fee_tier,
            "signature_scheme": sig_scheme.as_str()
        }))
    }

    fn propose_block(&mut self, proposer: &str, txs_json: &str) -> Result<Value, String> {
        if !is_valid_address(proposer) {
            return Err("invalid proposer address".into());
        }
        self.ensure_validator(proposer);

        let parsed: Value = serde_json::from_str(txs_json).unwrap_or_else(|_| json!([]));
        let mut transactions = parsed.as_array().cloned().unwrap_or_default();
        if transactions.is_empty() && !self.mempool.is_empty() {
            transactions = self
                .mempool
                .values()
                .take(250)
                .map(|tx| serde_json::to_value(tx).unwrap_or_else(|_| json!({ "txid": tx.txid })))
                .collect();
        }
        if transactions.len() > MAX_TXS_PER_BLOCK {
            return Err(format!(
                "too many transactions in block proposal (max {MAX_TXS_PER_BLOCK})"
            ));
        }

        let block_id = self.next_block_id(proposer);
        let height = self.height.saturating_add(1);
        let mut votes_yes = HashSet::new();
        votes_yes.insert(proposer.to_string());

        self.pending_blocks.insert(
            block_id.clone(),
            PendingBlock {
                block_id: block_id.clone(),
                proposer: proposer.to_string(),
                height,
                transactions: transactions.clone(),
                votes_yes,
                votes_no: HashSet::new(),
                proposed_at: Utc::now().to_rfc3339(),
            },
        );

        if let Some(v) = self.validators.get_mut(proposer) {
            v.blocks_proposed = v.blocks_proposed.saturating_add(1);
            v.last_block_height = height;
        }
        self.metrics.blocks_proposed = self.metrics.blocks_proposed.saturating_add(1);
        self.round = self.round.saturating_add(1);

        Ok(json!({
            "block_id": block_id,
            "proposer": proposer,
            "transactions": transactions,
            "height": height,
            "status": "proposed",
            "yes_votes": 1,
            "no_votes": 0
        }))
    }

    fn vote_on_block(
        &mut self,
        voter: &str,
        block_id: &str,
        approved: bool,
    ) -> Result<Value, String> {
        if !is_valid_address(voter) {
            return Err("invalid voter address".into());
        }
        self.ensure_validator(voter);

        let (already_yes, already_no) = {
            let block = self
                .pending_blocks
                .get(block_id)
                .ok_or_else(|| "block not found".to_string())?;
            (
                block.votes_yes.contains(voter),
                block.votes_no.contains(voter),
            )
        };

        if (already_yes && approved) || (already_no && !approved) {
            let status = if approved {
                "duplicate_yes_vote"
            } else {
                "duplicate_no_vote"
            };
            return Ok(json!({
                "block_id": block_id,
                "voter": voter,
                "approved": approved,
                "status": status
            }));
        }

        if (already_yes && !approved) || (already_no && approved) {
            self.slash_validator(voter, "vote_flip");
        }

        let (yes_votes, no_votes) = {
            let block = self
                .pending_blocks
                .get_mut(block_id)
                .ok_or_else(|| "block not found".to_string())?;
            block.votes_yes.remove(voter);
            block.votes_no.remove(voter);
            if approved {
                block.votes_yes.insert(voter.to_string());
            } else {
                block.votes_no.insert(voter.to_string());
            }
            (block.votes_yes.len(), block.votes_no.len())
        };

        if let Some(v) = self.validators.get_mut(voter) {
            v.votes_cast = v.votes_cast.saturating_add(1);
            v.last_block_height = self.height;
        }

        let can_finalize = self.can_finalize_block(block_id);
        Ok(json!({
            "block_id": block_id,
            "voter": voter,
            "approved": approved,
            "status": "recorded",
            "yes_votes": yes_votes,
            "no_votes": no_votes,
            "can_finalize": can_finalize
        }))
    }

    fn total_voting_power(&self) -> u64 {
        self.validators
            .values()
            .filter(|v| v.is_active && v.voting_power > 0)
            .map(|v| v.voting_power)
            .sum()
    }

    fn finality_threshold(total_power: u64) -> u64 {
        (total_power.saturating_mul(2) / 3).saturating_add(1)
    }

    fn vote_power_sum<'a>(&'a self, votes: impl Iterator<Item = &'a String>) -> u64 {
        votes
            .filter_map(|addr| self.validators.get(addr))
            .filter(|v| v.is_active)
            .map(|v| v.voting_power)
            .sum()
    }

    fn can_finalize_block(&self, block_id: &str) -> bool {
        let Some(block) = self.pending_blocks.get(block_id) else {
            return false;
        };
        let total = self.total_voting_power();
        if total == 0 {
            return false;
        }
        let yes_power = self.vote_power_sum(block.votes_yes.iter());
        yes_power >= Self::finality_threshold(total)
    }

    fn voting_status_json(&self, block_id: &str) -> Result<Value, String> {
        let block = self
            .pending_blocks
            .get(block_id)
            .ok_or_else(|| "block not found".to_string())?;

        let total_power = self.total_voting_power();
        let threshold = Self::finality_threshold(total_power);
        let yes_power = self.vote_power_sum(block.votes_yes.iter());
        let no_power = self.vote_power_sum(block.votes_no.iter());

        let validators_count = self
            .validators
            .values()
            .filter(|v| v.is_active && v.voting_power > 0)
            .count();
        let votes_received = block.votes_yes.len() + block.votes_no.len();
        let pending_votes = validators_count.saturating_sub(votes_received);
        let can_finalize = yes_power >= threshold;

        let status = if can_finalize {
            "passed"
        } else if no_power >= threshold {
            "rejected"
        } else {
            "pending"
        };

        Ok(json!({
            "block_id": block_id,
            "total_power": total_power,
            "votes_received": votes_received,
            "can_finalize": can_finalize,
            "yes_votes": block.votes_yes.len(),
            "no_votes": block.votes_no.len(),
            "pending": pending_votes,
            "yes_power": yes_power,
            "no_power": no_power,
            "threshold": threshold,
            "status": status
        }))
    }

    fn finalize_block(&mut self, block_id: &str) -> Result<Value, String> {
        if !self.can_finalize_block(block_id) {
            return Err("block does not have enough votes to finalize".into());
        }

        let block = self
            .pending_blocks
            .remove(block_id)
            .ok_or_else(|| "block not found".to_string())?;

        let total = self.total_voting_power();
        let threshold = Self::finality_threshold(total);
        let yes_power = self.vote_power_sum(block.votes_yes.iter());
        let no_power = self.vote_power_sum(block.votes_no.iter());

        if yes_power < threshold {
            return Err("supermajority threshold not met".into());
        }

        self.height = self.height.max(block.height);
        self.round = self.round.saturating_add(1);
        self.metrics.blocks_finalized = self.metrics.blocks_finalized.saturating_add(1);
        let finalized_at = Utc::now().timestamp_millis();

        for tx_value in &block.transactions {
            if let Some(txid) = tx_value.get("txid").and_then(Value::as_str) {
                if let Some(mut tx) = self.mempool.remove(txid) {
                    tx.status = "confirmed".to_string();
                    self.tx_history.push_front(tx);
                }
            }
        }
        while self.tx_history.len() > MAX_TX_HISTORY {
            self.tx_history.pop_back();
        }

        let record = FinalizedBlockRecord {
            block_id: block.block_id.clone(),
            proposer: block.proposer.clone(),
            height: block.height,
            transactions: block.transactions.clone(),
            finalized_at,
            yes_votes: block.votes_yes.len(),
            no_votes: block.votes_no.len(),
        };
        self.finalized_blocks.push_front(record);
        while self.finalized_blocks.len() > MAX_FINALIZED_BLOCKS {
            self.finalized_blocks.pop_back();
        }

        Ok(json!({
            "block_id": block.block_id,
            "proposer": block.proposer,
            "transactions": block.transactions,
            "height": block.height,
            "finalized": true,
            "finalized_at": finalized_at,
            "yes_votes": block.votes_yes.len(),
            "no_votes": block.votes_no.len(),
            "yes_power": yes_power,
            "no_power": no_power,
            "threshold": threshold,
            "status": "finalized"
        }))
    }

    fn consensus_state_json(&self) -> Value {
        let mut validators: Vec<&ValidatorRecord> = self
            .validators
            .values()
            .filter(|v| v.is_active && v.voting_power > 0)
            .collect();
        validators.sort_by(|a, b| b.voting_power.cmp(&a.voting_power));

        let current_proposer = if validators.is_empty() {
            String::new()
        } else {
            validators[(self.round as usize) % validators.len()]
                .address
                .clone()
        };

        let validators_json: Vec<Value> = validators
            .iter()
            .map(|v| {
                json!({
                    "address": v.address,
                    "voting_power": v.voting_power,
                    "slash_count": v.slash_count,
                    "blocks_proposed": v.blocks_proposed
                })
            })
            .collect();

        json!({
            "height": self.height,
            "round": self.round,
            "validators": validators_json,
            "current_proposer": current_proposer,
            "pending_blocks": self.pending_blocks.len(),
            "finalized_blocks": self.finalized_blocks.len(),
            "mempool_size": self.mempool.len(),
            "privacy_pool_size": self.private_txs.len(),
            "reveal_audit_events": self.reveal_audit.len(),
            "config": {
                "base_fee": self.config.base_fee,
                "fee_per_input": self.config.fee_per_input,
                "fee_per_output": self.config.fee_per_output,
                "amount_fee_ppm": self.config.amount_fee_ppm,
                "instant_settlement_mempool_limit": self.config.instant_settlement_mempool_limit,
                "ring_policy": {
                    "low": {"min": self.config.low_load_ring_min, "max": self.config.low_load_ring_max},
                    "medium": {"min": self.config.medium_load_ring_min, "max": self.config.medium_load_ring_max},
                    "high": {"min": self.config.high_load_ring_min, "max": self.config.high_load_ring_max}
                },
                "reveal_audit_retention": self.config.reveal_audit_retention,
                "signature_scheme": "hybrid_qr_v1",
                "privacy_modes": ["transparent", "shielded", "viewable"]
            },
            "metrics": {
                "tx_processed": self.metrics.tx_processed,
                "tx_rejected": self.metrics.tx_rejected,
                "blocks_proposed": self.metrics.blocks_proposed,
                "blocks_finalized": self.metrics.blocks_finalized,
                "wallet_creations": self.metrics.wallet_creations,
                "avg_tx_process_micros": self.metrics.avg_tx_process_micros,
                "peak_tps": self.metrics.peak_tps,
                "signature_replays_blocked": self.used_signatures.len()
            }
        })
    }

    fn next_tx_id(&mut self, seed: &str) -> String {
        self.tx_seq = self.tx_seq.saturating_add(1);
        format!(
            "tx_{}",
            hash_hex(&format!("{}:{}:{}", self.tx_seq, now_ms(), seed))
        )
    }

    fn next_block_id(&mut self, proposer: &str) -> String {
        self.block_seq = self.block_seq.saturating_add(1);
        format!(
            "block_{}",
            hash_hex(&format!("{}:{}:{}", self.block_seq, proposer, now_ms()))
        )
    }

    fn record_rejected_tx(&mut self) {
        self.metrics.tx_rejected = self.metrics.tx_rejected.saturating_add(1);
    }

    fn record_tx_latency(&mut self, elapsed_micros: u64) {
        let count = self.metrics.tx_processed.max(1);
        if count == 1 {
            self.metrics.avg_tx_process_micros = elapsed_micros;
            return;
        }
        let prev = self.metrics.avg_tx_process_micros;
        self.metrics.avg_tx_process_micros = ((prev * (count - 1)) + elapsed_micros) / count;
    }

    fn bump_tps_counter(&mut self) {
        let now = now_ms();
        if self.metrics.tps_window_start_ms == 0 {
            self.metrics.tps_window_start_ms = now;
            self.metrics.tps_window_count = 1;
            return;
        }
        if now.saturating_sub(self.metrics.tps_window_start_ms) >= 1_000 {
            if self.metrics.tps_window_count > self.metrics.peak_tps {
                self.metrics.peak_tps = self.metrics.tps_window_count;
            }
            self.metrics.tps_window_start_ms = now;
            self.metrics.tps_window_count = 1;
        } else {
            self.metrics.tps_window_count = self.metrics.tps_window_count.saturating_add(1);
        }
    }
}

impl Default for ChainState {
    fn default() -> Self {
        Self::new()
    }
}

static CHAIN_STATE: OnceLock<RwLock<ChainState>> = OnceLock::new();

fn global_state() -> &'static RwLock<ChainState> {
    CHAIN_STATE.get_or_init(|| RwLock::new(ChainState::new()))
}

fn with_state_read<T>(f: impl FnOnce(&ChainState) -> T) -> T {
    match global_state().read() {
        Ok(guard) => f(&guard),
        Err(poisoned) => f(&poisoned.into_inner()),
    }
}

fn with_state_write<T>(f: impl FnOnce(&mut ChainState) -> T) -> T {
    match global_state().write() {
        Ok(mut guard) => f(&mut guard),
        Err(poisoned) => {
            let mut guard = poisoned.into_inner();
            f(&mut guard)
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn hash_hex(input: &str) -> String {
    let mut h1 = DefaultHasher::new();
    input.hash(&mut h1);
    let v1 = h1.finish();

    let mut h2 = DefaultHasher::new();
    format!("{}:{}", input.len(), input).hash(&mut h2);
    let v2 = h2.finish();

    format!("{v1:016x}{v2:016x}")
}

fn derive_address(pubkey_hex: &str) -> String {
    let digest = hash_hex(pubkey_hex);
    format!("bolh_{}", &digest[..16])
}

fn generate_keypair_hex() -> (String, String) {
    let (pk, sk) = pq_keypair();
    (hex::encode(pk.as_bytes()), hex::encode(sk.as_bytes()))
}

fn validate_wallet_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("wallet name cannot be empty".into());
    }
    if name.len() > 64 {
        return Err("wallet name is too long".into());
    }
    if !name
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '-')
    {
        return Err("wallet name must be alphanumeric (plus _ or -)".into());
    }
    Ok(())
}

fn is_hex(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|b| b.is_ascii_hexdigit())
}

fn is_valid_address(address: &str) -> bool {
    address.starts_with("bolh_") && address.len() >= 10
}

fn parse_amount(value: &Value) -> Option<u64> {
    match value {
        Value::Number(n) => n
            .as_u64()
            .or_else(|| n.as_i64().filter(|v| *v >= 0).map(|v| v as u64))
            .or_else(|| n.as_f64().filter(|v| *v >= 0.0).map(|v| v.round() as u64)),
        Value::String(s) => s.parse::<u64>().ok(),
        _ => None,
    }
}

fn tx_io_fingerprint(tx: &TxRecord) -> String {
    let inputs = tx
        .inputs
        .iter()
        .map(|i| format!("{}:{}:{}", i.prev_txid, i.output_index, i.signature))
        .collect::<Vec<_>>()
        .join("|");
    let outputs = tx
        .outputs
        .iter()
        .map(|o| format!("{}:{}", o.address, o.amount))
        .collect::<Vec<_>>()
        .join("|");
    hash_hex(&format!("{inputs}>{outputs}"))
}

fn obfuscate_address(address: &str) -> String {
    if address.len() <= 10 {
        return "hidden".to_string();
    }
    format!("{}***{}", &address[..8], &address[address.len() - 4..])
}

fn mask_amount(amount: u64) -> String {
    let salt = now_ms();
    format!("mask_{}", hash_hex(&format!("{amount}:{salt}")))
}

fn pq_sign_bytes(payload: &[u8], seckey_hex: &str) -> Result<String, String> {
    let seckey_raw = hex::decode(seckey_hex).map_err(|_| "invalid secret key hex".to_string())?;
    let seckey = DilithiumSecretKey::from_bytes(&seckey_raw)
        .map_err(|_| "invalid dilithium secret key bytes".to_string())?;
    let sig = pq_detached_sign(payload, &seckey);
    Ok(hex::encode(sig.as_bytes()))
}

fn pq_verify_bytes(payload: &[u8], signature_hex: &str, pubkey_hex: &str) -> Result<bool, String> {
    let sig_raw = hex::decode(signature_hex).map_err(|_| "invalid pq signature hex".to_string())?;
    let pubkey_raw =
        hex::decode(pubkey_hex).map_err(|_| "invalid pq public key hex".to_string())?;

    let sig = DilithiumSignature::from_bytes(&sig_raw)
        .map_err(|_| "invalid dilithium signature bytes".to_string())?;
    let pubkey = DilithiumPublicKey::from_bytes(&pubkey_raw)
        .map_err(|_| "invalid dilithium public key bytes".to_string())?;

    Ok(pq_verify(&sig, payload, &pubkey).is_ok())
}

fn cstr_to_rust(ptr: *const c_char, arg_name: &str) -> Result<String, String> {
    if ptr.is_null() {
        return Err(format!("null pointer for {arg_name}"));
    }
    // SAFETY: pointer is provided by C caller; null checked above.
    Ok(unsafe { CStr::from_ptr(ptr) }
        .to_string_lossy()
        .into_owned())
}

fn value_to_c_ptr(value: Value) -> *const c_char {
    string_to_c_ptr(value.to_string())
}

fn result_to_c_ptr(result: Result<Value, String>) -> *const c_char {
    match result {
        Ok(v) => value_to_c_ptr(v),
        Err(e) => value_to_c_ptr(json!({ "error": e })),
    }
}

fn string_to_c_ptr(value: String) -> *const c_char {
    match CString::new(value) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => CString::new("{}")
            .map(CString::into_raw)
            .unwrap_or(std::ptr::null_mut()),
    }
}

/// Free allocated C string.
#[no_mangle]
pub extern "C" fn bolh_free(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    // SAFETY: pointer was allocated by CString::into_raw in this library.
    unsafe {
        let _ = CString::from_raw(ptr);
    }
}

/// Initialize blockchain.
#[no_mangle]
pub extern "C" fn bolh_init() -> *const c_char {
    let value = with_state_write(|state| {
        let v = state.init();
        state.maybe_autopersist();
        v
    });
    value_to_c_ptr(value)
}

/// Create a new key pair.
#[no_mangle]
pub extern "C" fn bolh_create_key() -> *const c_char {
    let (pubkey, seckey) = generate_keypair_hex();
    let address = derive_address(&pubkey);
    value_to_c_ptr(json!({
        "pubkey": pubkey,
        "seckey": seckey,
        "address": address
    }))
}

/// Sign a transaction payload.
#[no_mangle]
pub extern "C" fn bolh_sign_tx(tx_ptr: *const c_char) -> *const c_char {
    let tx_raw = match cstr_to_rust(tx_ptr, "tx") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let signed = with_state_read(|state| state.sign_tx_payload(&tx_raw));
    value_to_c_ptr(signed)
}

/// Submit a signed transaction to mempool.
#[no_mangle]
pub extern "C" fn bolh_submit_tx(signed_ptr: *const c_char) -> *const c_char {
    let signed_raw = match cstr_to_rust(signed_ptr, "signed") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.submit_signed_tx(&signed_raw);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Get balance for address.
#[no_mangle]
pub extern "C" fn bolh_get_balance(addr_ptr: *const c_char) -> u64 {
    let address = match cstr_to_rust(addr_ptr, "addr") {
        Ok(v) => v,
        Err(_) => return 0,
    };
    with_state_read(|state| state.balance_of(&address))
}

// ============= WALLET API =============

/// Create a new wallet.
#[no_mangle]
pub extern "C" fn bolh_create_wallet(name_ptr: *const c_char) -> *const c_char {
    let name = match cstr_to_rust(name_ptr, "wallet_name") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.create_wallet(&name);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Get wallet info.
#[no_mangle]
pub extern "C" fn bolh_get_wallet_info(name_ptr: *const c_char) -> *const c_char {
    let name = match cstr_to_rust(name_ptr, "wallet_name") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_read(|state| state.get_wallet_info(&name));
    result_to_c_ptr(result)
}

/// Get wallet balance.
#[no_mangle]
pub extern "C" fn bolh_get_wallet_balance(name_ptr: *const c_char) -> u64 {
    let name = match cstr_to_rust(name_ptr, "wallet_name") {
        Ok(v) => v,
        Err(_) => return 0,
    };
    with_state_read(|state| state.get_wallet_balance(&name).unwrap_or(0))
}

/// List all wallets.
#[no_mangle]
pub extern "C" fn bolh_list_wallets() -> *const c_char {
    let value = with_state_read(|state| state.list_wallets_json());
    value_to_c_ptr(value)
}

/// Delete a wallet.
#[no_mangle]
pub extern "C" fn bolh_delete_wallet(name_ptr: *const c_char) -> *const c_char {
    let name = match cstr_to_rust(name_ptr, "wallet_name") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.delete_wallet(&name);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Import a wallet.
#[no_mangle]
pub extern "C" fn bolh_import_wallet(
    name_ptr: *const c_char,
    pubkey_ptr: *const c_char,
    seckey_ptr: *const c_char,
) -> *const c_char {
    let name = match cstr_to_rust(name_ptr, "wallet_name") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let pubkey = match cstr_to_rust(pubkey_ptr, "pubkey") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let seckey = match cstr_to_rust(seckey_ptr, "seckey") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };

    let result = with_state_write(|state| {
        let out = state.import_wallet(&name, &pubkey, &seckey);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

// ============= UTXO API =============

/// Initialize genesis block.
#[no_mangle]
pub extern "C" fn bolh_init_genesis(accounts_ptr: *const c_char) -> *const c_char {
    let accounts_json = match cstr_to_rust(accounts_ptr, "accounts_json") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.init_genesis_from_json(&accounts_json);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Get UTXO balance.
#[no_mangle]
pub extern "C" fn bolh_get_utxo_balance(addr_ptr: *const c_char) -> u64 {
    let address = match cstr_to_rust(addr_ptr, "address") {
        Ok(v) => v,
        Err(_) => return 0,
    };
    with_state_read(|state| state.balance_of(&address))
}

/// Get UTXOs for address.
#[no_mangle]
pub extern "C" fn bolh_get_utxos(addr_ptr: *const c_char) -> *const c_char {
    let address = match cstr_to_rust(addr_ptr, "address") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let value = with_state_read(|state| state.get_utxos_json(&address));
    value_to_c_ptr(value)
}

/// Reveal a viewable private transaction.
#[no_mangle]
pub extern "C" fn bolh_reveal_private_tx(
    txid_ptr: *const c_char,
    reveal_key_ptr: *const c_char,
) -> *const c_char {
    let txid = match cstr_to_rust(txid_ptr, "txid") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let reveal_key = match cstr_to_rust(reveal_key_ptr, "reveal_key") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.reveal_private_tx(&txid, &reveal_key);
        state.maybe_autopersist();
        out
    });
    result_to_c_ptr(result)
}

/// Get reveal audit trail.
#[no_mangle]
pub extern "C" fn bolh_get_reveal_audit(limit_ptr: *const c_char) -> *const c_char {
    let limit_raw = cstr_to_rust(limit_ptr, "limit").unwrap_or_else(|_| "20".to_string());
    let limit = limit_raw.trim().parse::<usize>().unwrap_or(20);
    let value = with_state_read(|state| state.reveal_audit_json(limit));
    value_to_c_ptr(value)
}

/// Validate and process transaction.
#[no_mangle]
pub extern "C" fn bolh_validate_and_process_tx(tx_ptr: *const c_char) -> *const c_char {
    let tx_json = match cstr_to_rust(tx_ptr, "tx_json") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.validate_and_process_tx_json(&tx_json);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Persist chain state.
#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    let result = with_state_read(|state| match state.save_to_disk() {
        Ok(path) => Ok(json!({
            "status": "persisted",
            "timestamp": Utc::now().to_rfc3339(),
            "path": path.to_string_lossy(),
            "wallets": state.wallets.len(),
            "utxos": state.utxos.len(),
            "height": state.height
        })),
        Err(e) => Err(e),
    });
    result_to_c_ptr(result)
}

// ============= CONSENSUS API =============

/// Propose a new block.
#[no_mangle]
pub extern "C" fn bolh_propose_block(
    proposer_ptr: *const c_char,
    txs_ptr: *const c_char,
) -> *const c_char {
    let proposer = match cstr_to_rust(proposer_ptr, "proposer") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let txs_json = match cstr_to_rust(txs_ptr, "txs_json") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };

    let result = with_state_write(|state| {
        let out = state.propose_block(&proposer, &txs_json);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Vote on a block.
#[no_mangle]
pub extern "C" fn bolh_vote_on_block(
    voter_ptr: *const c_char,
    block_id_ptr: *const c_char,
    approved: bool,
) -> *const c_char {
    let voter = match cstr_to_rust(voter_ptr, "voter") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let block_id = match cstr_to_rust(block_id_ptr, "block_id") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };

    let result = with_state_write(|state| {
        let out = state.vote_on_block(&voter, &block_id, approved);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Check if block can be finalized.
#[no_mangle]
pub extern "C" fn bolh_can_finalize(block_id_ptr: *const c_char) -> bool {
    let block_id = match cstr_to_rust(block_id_ptr, "block_id") {
        Ok(v) => v,
        Err(_) => return false,
    };
    with_state_read(|state| state.can_finalize_block(&block_id))
}

/// Finalize a block.
#[no_mangle]
pub extern "C" fn bolh_finalize_block(block_id_ptr: *const c_char) -> *const c_char {
    let block_id = match cstr_to_rust(block_id_ptr, "block_id") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_write(|state| {
        let out = state.finalize_block(&block_id);
        if out.is_ok() {
            state.maybe_autopersist();
        }
        out
    });
    result_to_c_ptr(result)
}

/// Get consensus state.
#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let value = with_state_read(|state| state.consensus_state_json());
    value_to_c_ptr(value)
}

/// Get voting status for a block.
#[no_mangle]
pub extern "C" fn bolh_voting_status(block_id_ptr: *const c_char) -> *const c_char {
    let block_id = match cstr_to_rust(block_id_ptr, "block_id") {
        Ok(v) => v,
        Err(e) => return value_to_c_ptr(json!({ "error": e })),
    };
    let result = with_state_read(|state| state.voting_status_json(&block_id));
    result_to_c_ptr(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_address(tag: &str) -> String {
        derive_address(&hash_hex(tag))
    }

    fn attach_quantum_proof(tx: &mut Value) {
        if tx.get("timestamp").is_none() {
            if let Some(obj) = tx.as_object_mut() {
                obj.insert(
                    "timestamp".to_string(),
                    Value::from(Utc::now().timestamp_millis()),
                );
            }
        }
        let material = ChainState::tx_signing_material_from_value(tx);
        let (pubkey, seckey) = generate_keypair_hex();
        let signature = pq_sign_bytes(material.as_bytes(), &seckey).expect("pq sign");
        let marker = format!("qsig_{}", &hash_hex(&signature)[..32]);

        if let Some(inputs) = tx.get_mut("inputs").and_then(Value::as_array_mut) {
            for (idx, input) in inputs.iter_mut().enumerate() {
                if let Some(obj) = input.as_object_mut() {
                    obj.insert(
                        "signature".to_string(),
                        Value::String(format!("{marker}_{idx}")),
                    );
                }
            }
        }

        let metadata = tx
            .get_mut("metadata")
            .and_then(Value::as_object_mut)
            .expect("metadata object");
        metadata.insert(
            "sig_scheme".to_string(),
            Value::String("hybrid_qr_v1".to_string()),
        );
        metadata.insert("pq_pubkey".to_string(), Value::String(pubkey));
        metadata.insert("pq_signature".to_string(), Value::String(signature));
        metadata.insert("signed_material".to_string(), Value::String(material));
    }

    #[test]
    fn wallet_create_list_delete_flow() {
        let mut state = ChainState::new();
        let created = state
            .create_wallet("alice_1")
            .expect("wallet should be created");
        assert_eq!(created["name"], "alice_1");
        assert!(created["pubkey"].as_str().unwrap_or_default().len() >= 32);

        let listed = state.list_wallets_json();
        assert_eq!(listed.as_array().map(|a| a.len()).unwrap_or_default(), 1);

        state
            .delete_wallet("alice_1")
            .expect("wallet should be deleted");
        let listed_after = state.list_wallets_json();
        assert_eq!(
            listed_after.as_array().map(|a| a.len()).unwrap_or_default(),
            0
        );
    }

    #[test]
    fn genesis_and_balance_tracking() {
        let mut state = ChainState::new();
        let addr = dummy_address("genesis-test");
        let accounts = json!([{ "address": addr, "amount": 7777u64 }]).to_string();

        let response = state
            .init_genesis_from_json(&accounts)
            .expect("genesis should initialize");
        assert_eq!(response["status"], "initialized");
        assert_eq!(state.balance_of(&addr), 7777);
    }

    #[test]
    fn tx_validation_spend_and_change() {
        let mut state = ChainState::new();
        let from = dummy_address("sender");
        let to = dummy_address("recipient");
        let genesis = json!([{ "address": from, "amount": 5000u64 }]).to_string();
        state
            .init_genesis_from_json(&genesis)
            .expect("genesis init should work");

        let utxo = state
            .utxos
            .iter()
            .find(|u| u.address == from && !u.spent)
            .cloned()
            .expect("sender utxo must exist");

        let mut tx = json!({
            "txid": "tx_manual_1",
            "inputs": [
                {
                    "prev_txid": utxo.txid,
                    "output_index": utxo.output_index,
                    "signature": ""
                }
            ],
            "outputs": [
                { "address": to, "amount": 3000u64 },
                { "address": from, "amount": 1900u64 }
            ],
            "timestamp": Utc::now().timestamp_millis(),
            "metadata": {
                "sig_scheme": "hybrid_qr_v1",
                "privacy_mode": "transparent",
                "priority": 1
            }
        });
        attach_quantum_proof(&mut tx);

        let processed = state
            .validate_and_process_tx_json(&tx.to_string())
            .expect("transaction should process");
        assert_eq!(processed["status"], "accepted");
        assert_eq!(state.balance_of(&to), 3000);
        assert_eq!(state.balance_of(&from), 1900);
    }

    #[test]
    fn consensus_requires_supermajority_then_finalizes() {
        let mut state = ChainState::new();
        let validators: Vec<String> = state.validators.keys().cloned().collect();
        assert!(validators.len() >= 3);

        let proposer = validators[0].clone();
        let voter_b = validators[1].clone();
        let voter_c = validators[2].clone();

        let proposed = state
            .propose_block(&proposer, "[]")
            .expect("block proposal should succeed");
        let block_id = proposed["block_id"]
            .as_str()
            .expect("block_id must exist")
            .to_string();

        assert!(!state.can_finalize_block(&block_id));
        state
            .vote_on_block(&voter_b, &block_id, true)
            .expect("second validator vote");
        assert!(!state.can_finalize_block(&block_id));
        state
            .vote_on_block(&voter_c, &block_id, true)
            .expect("third validator vote");
        assert!(state.can_finalize_block(&block_id));

        let finalized = state
            .finalize_block(&block_id)
            .expect("block should finalize");
        assert_eq!(finalized["finalized"], true);
        assert_eq!(state.height, 1);
    }

    #[test]
    fn rejects_legacy_signature_when_quantum_scheme_required() {
        let mut state = ChainState::new();
        let from = dummy_address("sender-legacy");
        let to = dummy_address("recipient-legacy");
        let genesis = json!([{ "address": from, "amount": 9000u64 }]).to_string();
        state
            .init_genesis_from_json(&genesis)
            .expect("genesis init should work");

        let utxo = state
            .utxos
            .iter()
            .find(|u| u.address == from && !u.spent)
            .cloned()
            .expect("sender utxo must exist");

        let tx = json!({
            "txid": "tx_legacy_sig",
            "inputs": [
                {
                    "prev_txid": utxo.txid,
                    "output_index": utxo.output_index,
                    "signature": "sig_old_style_1234"
                }
            ],
            "outputs": [
                { "address": to, "amount": 7000u64 },
                { "address": from, "amount": 1800u64 }
            ],
            "metadata": {
                "sig_scheme": "hybrid_qr_v1",
                "privacy_mode": "transparent",
                "priority": 1
            }
        });

        let err = state
            .validate_and_process_tx_json(&tx.to_string())
            .expect_err("legacy signature should be rejected");
        assert!(
            err.contains("quantum signature") || err.contains("pq_pubkey"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn viewable_private_tx_reveal_flow() {
        let mut state = ChainState::new();
        let from = dummy_address("sender-private");
        let to = dummy_address("recipient-private");
        let genesis = json!([{ "address": from, "amount": 12_000u64 }]).to_string();
        state
            .init_genesis_from_json(&genesis)
            .expect("genesis init should work");

        let utxo = state
            .utxos
            .iter()
            .find(|u| u.address == from && !u.spent)
            .cloned()
            .expect("sender utxo must exist");
        let reveal_key = "view-key-private-001";
        let txid = "tx_viewable_1";
        let mut tx = json!({
            "txid": txid,
            "inputs": [
                {
                    "prev_txid": utxo.txid,
                    "output_index": utxo.output_index,
                    "signature": ""
                }
            ],
            "outputs": [
                { "address": to, "amount": 8500u64 },
                { "address": from, "amount": 2500u64 }
            ],
            "metadata": {
                "sig_scheme": "hybrid_qr_v1",
                "privacy_mode": "viewable",
                "reveal_key": reveal_key,
                "priority": 2
            },
            "timestamp": Utc::now().timestamp_millis()
        });
        attach_quantum_proof(&mut tx);

        let processed = state
            .validate_and_process_tx_json(&tx.to_string())
            .expect("private viewable tx should process");
        assert_eq!(processed["privacy"]["private"], true);
        assert_eq!(processed["privacy"]["revealable"], true);

        let denied = state.reveal_private_tx(txid, "wrong-key");
        assert!(denied.is_err());

        let revealed = state
            .reveal_private_tx(txid, reveal_key)
            .expect("reveal should work with valid key");
        assert_eq!(revealed["revealed"], true);
        assert_eq!(revealed["mode"], "viewable");

        let audit = state.reveal_audit_json(10);
        let events = audit.as_array().expect("audit array");
        assert!(events.iter().any(|e| e["result"] == "success"));
        assert!(events.iter().any(|e| e["result"] == "denied"));
    }

    #[test]
    fn ring_policy_hardens_under_high_load() {
        let mut state = ChainState::new();
        let filler = TxRecord {
            txid: "filler".to_string(),
            inputs: Vec::new(),
            outputs: Vec::new(),
            fee: 0,
            status: "pending".to_string(),
            timestamp: Utc::now().timestamp_millis(),
            metadata: json!({}),
        };
        for i in 0..(MAX_MEMPOOL_TXS * 8 / 10) {
            let mut item = filler.clone();
            item.txid = format!("mempool_fill_{i}");
            state.mempool.insert(item.txid.clone(), item);
        }

        let err = state
            .enforce_ring_policy(8, 1)
            .expect_err("ring should be stricter under high load");
        assert!(err.contains("dynamic minimum"));

        let (_, max_ring, effective, band) = state
            .enforce_ring_policy(18, 1)
            .expect("larger ring should pass");
        assert_eq!(band, "high");
        assert!(effective <= max_ring);
    }

    #[test]
    fn benchmark_fee_and_latency_guard() {
        let mut state = ChainState::new();
        let from = dummy_address("bench-from");
        let genesis = json!([{ "address": from, "amount": 2_000_000u64 }]).to_string();
        state
            .init_genesis_from_json(&genesis)
            .expect("genesis should initialize");

        let mut sample_fees = Vec::new();
        for i in 0..10 {
            let utxo = state
                .utxos
                .iter()
                .find(|u| state.owned_by(&from, &u.address) && !u.spent)
                .cloned()
                .expect("unspent output should exist");
            let send_amount = utxo.amount.saturating_sub(2_000);
            assert!(send_amount > 0, "insufficient amount for fee sample");

            let mut tx = json!({
                "txid": format!("bench_tx_{i}"),
                "inputs": [{
                    "prev_txid": utxo.txid,
                    "output_index": utxo.output_index,
                    "signature": ""
                }],
                "outputs": [{
                    "address": from,
                    "amount": send_amount
                }],
                "metadata": {
                    "sig_scheme": "hybrid_qr_v1",
                    "privacy_mode": "transparent",
                    "priority": 1
                },
                "timestamp": Utc::now().timestamp_millis()
            });
            attach_quantum_proof(&mut tx);

            let result = state
                .validate_and_process_tx_json(&tx.to_string())
                .expect("benchmark tx should pass");
            let required = result
                .get("fee_policy")
                .and_then(|v| v.get("required_fee"))
                .and_then(Value::as_u64)
                .expect("required_fee must be present");
            sample_fees.push(required);
        }

        assert!(sample_fees.iter().all(|v| *v > 0));
        assert_eq!(state.metrics.tx_processed, sample_fees.len() as u64);
        assert!(state.metrics.avg_tx_process_micros > 0);
        assert!(
            state.metrics.avg_tx_process_micros < 2_000_000,
            "unexpectedly slow avg latency: {}us",
            state.metrics.avg_tx_process_micros
        );
    }
}
