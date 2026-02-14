//! BOLH Chain Persistence — Save/Load blockchain state to disk
//!
//! Uses JSON serialization for maximum portability.
//! Chain state is saved atomically: write to temp file, then rename.
//!
//! Stored data:
//! - All blocks (full chain history)
//! - Account balances and state
//! - Wallet keys (encrypted export format)
//! - Transaction history
//! - User count (for referral tiers)

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

use crate::types::{Address, Account, Block};
use crate::wallet::{Wallet, WalletExport};
use crate::wallet_vault::{decrypt_private_key, encrypt_private_key};
use crate::chain::{BolhChain, TxRecord};

/// Snapshot of the entire chain state (serializable)
#[derive(Serialize, Deserialize)]
pub struct ChainSnapshot {
    /// Version for forward compatibility
    pub version: u32,
    /// Last block height included in this snapshot (for log/snapshot reconciliation)
    #[serde(default)]
    pub last_block_height: u64,
    /// All blocks
    pub blocks: Vec<Block>,
    /// All accounts (address -> account)
    pub accounts: HashMap<String, Account>,
    /// Wallet exports (name -> wallet with keys)
    pub wallets: Vec<WalletExport>,
    /// Transaction history (address -> records)
    pub tx_history: HashMap<String, Vec<TxRecord>>,
    /// Total registered users
    pub user_count: u64,
    /// Snapshot timestamp
    pub saved_at: u64,
}

impl ChainSnapshot {
    /// Current snapshot format version
    pub const CURRENT_VERSION: u32 = 2;
}

/// Persistence manager
pub struct PersistenceManager {
    /// Directory to store chain data
    data_dir: PathBuf,
}

impl PersistenceManager {
    /// Create a new persistence manager
    pub fn new(data_dir: impl AsRef<Path>) -> Self {
        PersistenceManager {
            data_dir: data_dir.as_ref().to_path_buf(),
        }
    }

    /// Default data directory (platform-aware)
    pub fn default_dir() -> PathBuf {
        // Try common app data locations
        if let Some(data) = dirs_fallback() {
            data.join("bolh-chain")
        } else {
            PathBuf::from("./bolh-data")
        }
    }

    /// Ensure data directory exists
    fn ensure_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.data_dir)
            .map_err(|e| format!("Failed to create data dir: {}", e))
    }

    /// Path to the main chain state file
    fn state_path(&self) -> PathBuf {
        self.data_dir.join("chain_state.json")
    }

    /// Path to temporary file for atomic writes
    fn temp_path(&self) -> PathBuf {
        self.data_dir.join("chain_state.tmp")
    }

    /// Path to backup file
    fn backup_path(&self) -> PathBuf {
        self.data_dir.join("chain_state.bak")
    }

    /// Save chain state to disk (atomic write)
    pub fn save(&self, chain: &BolhChain) -> Result<(), String> {
        self.ensure_dir()?;

        let pw = vault_password();
        let snapshot = chain.to_snapshot_with_vault(pw.as_deref())?;
        let json = serde_json::to_string_pretty(&snapshot)
            .map_err(|e| format!("Serialization error: {}", e))?;

        // Write to temp file first
        let temp = self.temp_path();
        fs::write(&temp, &json)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        // Backup existing state file if it exists
        let state = self.state_path();
        if state.exists() {
            let backup = self.backup_path();
            let _ = fs::copy(&state, &backup); // best effort
        }

        // Atomic rename
        fs::rename(&temp, &state)
            .map_err(|e| format!("Failed to rename temp to state: {}", e))?;

        Ok(())
    }

    /// Load chain state from disk
    pub fn load(&self) -> Result<ChainSnapshot, String> {
        let state = self.state_path();

        if !state.exists() {
            return Err("No saved state found".into());
        }

        let json = fs::read_to_string(&state)
            .map_err(|e| format!("Failed to read state file: {}", e))?;

        let snapshot: ChainSnapshot = serde_json::from_str(&json)
            .map_err(|e| format!("Deserialization error: {}", e))?;

        // Version check
        if snapshot.version > ChainSnapshot::CURRENT_VERSION {
            return Err(format!(
                "State file version {} is newer than supported {}",
                snapshot.version,
                ChainSnapshot::CURRENT_VERSION
            ));
        }

        Ok(snapshot)
    }

    /// Check if saved state exists
    pub fn has_saved_state(&self) -> bool {
        self.state_path().exists()
    }

    /// Delete saved state (for reset)
    pub fn delete(&self) -> Result<(), String> {
        let state = self.state_path();
        if state.exists() {
            fs::remove_file(&state)
                .map_err(|e| format!("Failed to delete state: {}", e))?;
        }
        Ok(())
    }

    /// Get data directory path
    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }
}

/// Fallback for getting a data directory without the `dirs` crate
fn dirs_fallback() -> Option<PathBuf> {
    // Try environment variables
    if let Ok(data) = std::env::var("BOLH_DATA_DIR") {
        return Some(PathBuf::from(data));
    }

    // Platform defaults
    #[cfg(target_os = "android")]
    {
        // Android internal storage
        return Some(PathBuf::from("/data/data/com.bolh.app/files"));
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("LOCALAPPDATA") {
            return Some(PathBuf::from(appdata));
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join("Library/Application Support"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join(".local/share"));
        }
    }

    // Fallback: current directory
    Some(PathBuf::from("."))
}

impl BolhChain {
    /// Create a snapshot of the current chain state.
    ///
    /// If `vault_password` is provided, wallet secret keys are encrypted and
    /// raw `seckey` is omitted from the snapshot.
    pub fn to_snapshot_with_vault(&self, vault_password: Option<&str>) -> Result<ChainSnapshot, String> {
        let blocks = self.blocks.read();
        let accounts = self.accounts.read();
        let wallets = self.wallets.read();
        let tx_history = self.tx_history.read();
        let user_count = *self.user_count.read();

        // Convert accounts: Address -> bech32 string key
        let accounts_map: HashMap<String, Account> = accounts
            .iter()
            .map(|(addr, acct)| (addr.to_bech32(), acct.clone()))
            .collect();

        // Export wallets (vault-encrypted if configured)
        let wallet_exports: Vec<WalletExport> = wallets.values().map(|w| {
            let mut export = w.export();
            if let Some(pw) = vault_password {
                let Some(seckey_hex) = export.seckey.clone() else {
                    return Ok(export);
                };
                let sk_bytes = hex::decode(&seckey_hex)
                    .map_err(|e| format!("wallet '{}' seckey hex decode failed: {}", export.name, e))?;
                let enc = encrypt_private_key(&sk_bytes, pw)
                    .map_err(|e| format!("wallet '{}' encryption failed: {}", export.name, e))?;
                export.seckey = None;
                export.encrypted_seckey = Some(enc);
            }
            Ok(export)
        }).collect::<Result<Vec<_>, String>>()?;

        // Convert tx history: Address -> bech32 string key
        let history_map: HashMap<String, Vec<TxRecord>> = tx_history
            .iter()
            .map(|(addr, records)| (addr.to_bech32(), records.clone()))
            .collect();

        // Compute hashes for blocks that have skip(hash)
        let blocks_with_hash: Vec<Block> = blocks
            .iter()
            .map(|b| {
                let mut block = b.clone();
                block.hash = block.header.compute_hash();
                block
            })
            .collect();

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Ok(ChainSnapshot {
            version: ChainSnapshot::CURRENT_VERSION,
            last_block_height: blocks.len().saturating_sub(1) as u64,
            blocks: blocks_with_hash,
            accounts: accounts_map,
            wallets: wallet_exports,
            tx_history: history_map,
            user_count,
            saved_at: now,
        })
    }

    /// Backward-compatible snapshot without vault.
    pub fn to_snapshot(&self) -> ChainSnapshot {
        self.to_snapshot_with_vault(None).expect("snapshot without vault must not fail")
    }

    /// Restore chain from a snapshot
    pub fn from_snapshot(snapshot: ChainSnapshot) -> Result<Self, String> {
        // Reconstruct blocks (recompute hashes since they are #[serde(skip)])
        let blocks: Vec<Block> = snapshot.blocks.into_iter().map(|mut b| {
            b.hash = b.header.compute_hash();
            // Recompute tx hashes too
            for tx in &mut b.transactions {
                tx.hash = tx.compute_hash();
            }
            b
        }).collect();

        if blocks.is_empty() {
            return Err("Snapshot has no blocks".into());
        }

        // Reconstruct accounts
        let mut accounts = HashMap::new();
        for (addr_str, acct) in snapshot.accounts {
            let addr = Address::from_bech32(&addr_str)
                .map_err(|e| format!("Invalid address '{}': {}", addr_str, e))?;
            accounts.insert(addr, acct);
        }

        // Reconstruct wallets from exports (decrypt if needed)
        let mut wallets = HashMap::new();
        for export in snapshot.wallets {
            // Prefer encrypted secret key
            if let Some(enc) = export.encrypted_seckey {
                let pw = vault_password().ok_or_else(|| {
                    format!("Wallet vault password required to load encrypted wallet '{}'", export.name)
                })?;
                let sk_bytes = decrypt_private_key(&enc, &pw)
                    .map_err(|e| format!("Failed to decrypt wallet '{}': {}", export.name, e))?;
                let sk_hex = hex::encode(sk_bytes);
                let wallet = Wallet::from_secret_hex(&export.name, &sk_hex)
                    .map_err(|e| format!("Failed to import wallet '{}': {}", export.name, e))?;
                wallets.insert(export.name.clone(), wallet);
                continue;
            }

            // Legacy raw secret key
            let Some(seckey) = export.seckey else {
                return Err(format!("Wallet '{}' missing secret key data", export.name));
            };
            let wallet = Wallet::from_secret_hex(&export.name, &seckey)
                .map_err(|e| format!("Failed to import wallet '{}': {}", export.name, e))?;
            wallets.insert(export.name.clone(), wallet);
        }

        // Reconstruct tx history
        let mut tx_history = HashMap::new();
        for (addr_str, records) in snapshot.tx_history {
            let addr = Address::from_bech32(&addr_str)
                .map_err(|e| format!("Invalid history address '{}': {}", addr_str, e))?;
            tx_history.insert(addr, records);
        }

        Ok(BolhChain {
            blocks: parking_lot::RwLock::new(blocks),
            accounts: parking_lot::RwLock::new(accounts),
            wallets: parking_lot::RwLock::new(wallets),
            mempool: parking_lot::RwLock::new(Vec::new()),
            tx_history: parking_lot::RwLock::new(tx_history),
            user_count: parking_lot::RwLock::new(snapshot.user_count),
            consensus: parking_lot::RwLock::new(crate::consensus_runtime::ConsensusRuntime::new()),
        })
    }
}

/// Optional vault password sourced from env for non-interactive environments.
///
/// If set, persistence will encrypt wallet secret keys at rest and require this
/// password to load them back.
fn vault_password() -> Option<String> {
    let enforce = std::env::var("BOLH_VAULT_ENFORCE")
        .ok()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    match std::env::var("BOLH_WALLET_VAULT_PASSWORD") {
        Ok(pw) if !pw.is_empty() => Some(pw),
        _ if enforce => Some(crate::wallet_vault::require_vault_password()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_snapshot_roundtrip() {
        let chain = BolhChain::new();

        // Create a wallet and some activity
        let alice = chain.create_wallet("alice").unwrap();
        let bob = chain.create_wallet("bob").unwrap();

        // Award tokens
        let alice_addr = Address::from_bech32(&alice.address).unwrap();
        chain.award_mining_tokens(&alice_addr, 5_000_00_000_000).unwrap();

        // Transfer
        let tx = chain.create_transfer("alice", &bob.address, 1_000_00_000_000).unwrap();
        let res = chain.submit_transaction(tx);
        assert!(res.success, "submit failed: {:?}", res.error);
        chain.produce_block("alice").unwrap();

        // Take snapshot
        let snapshot = chain.to_snapshot();
        let json = serde_json::to_string(&snapshot).unwrap();

        // Restore from snapshot
        let restored_snapshot: ChainSnapshot = serde_json::from_str(&json).unwrap();
        let restored = BolhChain::from_snapshot(restored_snapshot).unwrap();

        // Verify
        let orig_stats = chain.stats();
        let rest_stats = restored.stats();
        assert_eq!(orig_stats.height, rest_stats.height);
        assert_eq!(orig_stats.total_accounts, rest_stats.total_accounts);
        assert_eq!(orig_stats.circulating_supply, rest_stats.circulating_supply);

        // Wallet should still work
        let alice_bal = restored.get_wallet_balance("alice");
        let bob_bal = restored.get_wallet_balance("bob");
        assert!(alice_bal > 0);
        assert_eq!(bob_bal, 1_000_00_000_000);
    }

    #[test]
    fn test_persistence_save_load() {
        let tmp = std::env::temp_dir().join("bolh_test_persist");
        let _ = fs::remove_dir_all(&tmp);

        let pm = PersistenceManager::new(&tmp);

        // Create chain with data
        let chain = BolhChain::new();
        chain.create_wallet("test_wallet").unwrap();

        // Save
        pm.save(&chain).unwrap();
        assert!(pm.has_saved_state());

        // Load
        let snapshot = pm.load().unwrap();
        let restored = BolhChain::from_snapshot(snapshot).unwrap();

        assert!(restored.get_wallet("test_wallet").is_some());

        // Cleanup
        let _ = fs::remove_dir_all(&tmp);
    }
}
