//! C FFI interface for BOLH blockchain.
//! Exports stateful blockchain functions as C-callable APIs for Tauri.

use chrono::Utc;
use rand::RngCore;
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

const VERSION: &str = "0.2.0";
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

const BOOTSTRAP_VALIDATOR_POWER: u64 = 100;
const DEFAULT_GENESIS_ALLOCATION: u64 = 100_000_000_000;
const DEFAULT_WALLET_FAUCET: u64 = 100_000_000_000;

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
    metrics: MetricsState,
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
    utxos: Vec<UtxoRecord>,
    processed_txids: HashSet<String>,
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
            utxos: Vec::new(),
            processed_txids: HashSet::new(),
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
                "persistence": true
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
            version: 2,
            network: self.network.clone(),
            height: self.height,
            round: self.round,
            wallets: self.wallets.values().cloned().collect(),
            utxos: self.utxos.clone(),
            validators: self.validators.values().cloned().collect(),
            tx_history: self.tx_history.iter().cloned().collect(),
            processed_txids: self.processed_txids.iter().cloned().collect(),
            metrics: self.metrics.clone(),
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
        self.metrics = persisted.metrics;
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
        self.processed_txids.clear();

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

    fn balance_of(&self, address: &str) -> u64 {
        self.utxos
            .iter()
            .filter(|u| u.address == address && !u.spent)
            .map(|u| u.amount)
            .sum()
    }

    fn get_utxos_json(&self, address: &str) -> Value {
        let mut list: Vec<&UtxoRecord> =
            self.utxos.iter().filter(|u| u.address == address).collect();
        list.sort_by_key(|u| (u.spent, u.block_height, u.output_index));

        let result: Vec<Value> = list
            .into_iter()
            .map(|u| {
                json!({
                    "txid": u.txid,
                    "output_index": u.output_index,
                    "address": u.address,
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

        let metadata = tx_value
            .get("metadata")
            .cloned()
            .unwrap_or_else(|| json!({}));

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

    fn validate_and_process_tx_json(&mut self, tx_json: &str) -> Result<Value, String> {
        let start = Instant::now();
        let tx_val: Value =
            serde_json::from_str(tx_json).map_err(|e| format!("invalid tx JSON: {e}"))?;
        let mut tx = self.parse_tx_value(&tx_val)?;

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
        if self.processed_txids.contains(&tx.txid) || self.mempool.contains_key(&tx.txid) {
            self.record_rejected_tx();
            return Err("transaction replay detected".into());
        }

        let mut input_total: u64 = 0;
        let mut output_total: u64 = 0;
        let mut source_addresses: HashSet<String> = HashSet::new();
        let mut seen_inputs: HashSet<String> = HashSet::new();
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
            source_addresses.insert(self.utxos[idx].address.clone());
            consumed_indices.push(idx);
        }

        if source_addresses.len() != 1 {
            self.record_rejected_tx();
            return Err("multi-address inputs are not supported".into());
        }
        let sender = source_addresses.iter().next().cloned().unwrap_or_default();

        self.check_rate_limit(&sender)?;

        for output in &tx.outputs {
            if !is_valid_address(&output.address) {
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

        for idx in consumed_indices {
            if let Some(utxo) = self.utxos.get_mut(idx) {
                utxo.spent = true;
                utxo.spent_at = Some(Utc::now().to_rfc3339());
            }
        }

        let next_height = self.height.saturating_add(1);
        for (i, output) in tx.outputs.iter().enumerate() {
            self.utxos.push(UtxoRecord {
                txid: tx.txid.clone(),
                output_index: i as u32,
                address: output.address.clone(),
                amount: output.amount,
                block_height: next_height,
                spent: false,
                spent_at: None,
            });
            self.ensure_validator(&output.address);
        }

        tx.fee = fee;
        tx.status = "confirmed".to_string();
        self.processed_txids.insert(tx.txid.clone());
        self.mempool.remove(&tx.txid);

        self.tx_history.push_front(tx.clone());
        while self.tx_history.len() > MAX_TX_HISTORY {
            self.tx_history.pop_back();
        }

        self.metrics.tx_processed = self.metrics.tx_processed.saturating_add(1);
        self.record_tx_latency(start.elapsed().as_micros() as u64);
        self.bump_tps_counter();

        Ok(json!({
            "valid": true,
            "txid": tx.txid,
            "fee": fee,
            "status": "accepted",
            "inputs": tx.inputs.len(),
            "outputs": tx.outputs.len(),
            "from": sender,
            "new_balance": self.balance_of(&sender),
            "height_hint": next_height
        }))
    }

    fn sign_tx_payload(&self, tx_raw: &str) -> Value {
        let tx_hash = hash_hex(tx_raw);
        let signature = format!(
            "sig_{}",
            hash_hex(&format!("{tx_raw}:{tx_hash}:{CHAIN_ID}:{}", now_ms()))
        );

        let tx_value = serde_json::from_str::<Value>(tx_raw).unwrap_or_else(|_| json!(tx_raw));
        json!({
            "signed": signature,
            "tx": tx_value,
            "tx_hash": tx_hash,
            "chain_id": CHAIN_ID,
            "status": "signed"
        })
    }

    fn submit_signed_tx(&mut self, signed_raw: &str) -> Result<Value, String> {
        let signed_val: Value =
            serde_json::from_str(signed_raw).unwrap_or_else(|_| json!({ "raw": signed_raw }));
        let signature = signed_val
            .get("signed")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if signature.trim().len() < 8 {
            return Err("signed payload is invalid".into());
        }

        let tx_val = signed_val.get("tx").cloned().unwrap_or_else(|| json!({}));
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
        self.mempool.insert(txid.clone(), tx);

        Ok(json!({
            "txid": txid,
            "status": "pending",
            "mempool": true,
            "pool_size": self.mempool.len()
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
            "metrics": {
                "tx_processed": self.metrics.tx_processed,
                "tx_rejected": self.metrics.tx_rejected,
                "blocks_proposed": self.metrics.blocks_proposed,
                "blocks_finalized": self.metrics.blocks_finalized,
                "wallet_creations": self.metrics.wallet_creations,
                "avg_tx_process_micros": self.metrics.avg_tx_process_micros,
                "peak_tps": self.metrics.peak_tps
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
    let mut rng = rand::thread_rng();
    let mut sk = [0u8; 32];
    let mut pk = [0u8; 32];
    rng.fill_bytes(&mut sk);
    rng.fill_bytes(&mut pk);
    (hex::encode(pk), hex::encode(sk))
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

        let tx = json!({
            "txid": "tx_manual_1",
            "inputs": [
                {
                    "prev_txid": utxo.txid,
                    "output_index": utxo.output_index,
                    "signature": "sig_valid_123456"
                }
            ],
            "outputs": [
                { "address": to, "amount": 3000u64 },
                { "address": from, "amount": 1900u64 }
            ],
            "timestamp": Utc::now().timestamp_millis()
        });

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
}
