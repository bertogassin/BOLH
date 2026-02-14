//! BOLH Chain — In-memory blockchain state with real crypto
//!
//! Manages: blocks, accounts, balances, transactions, UTXO set
//! Uses Ed25519 for signing and SHA3-256 for hashing

use std::collections::HashMap;
use parking_lot::RwLock;
use sha3::{Digest, Sha3_256};

use crate::types::{Address, Account, Block, Transaction, TxType, PrivacyLevel, Hash};
use crate::wallet::Wallet;
use crate::security_pipeline::SecurityPipeline;
use crate::block_validator::BlockValidator;
use crate::state_transition::StateTransitionEngine;
use crate::consensus_runtime::{ConsensusRuntime, PendingProposal};
use crate::persistence::PersistenceManager;
use crate::storage::append_log;
use crate::{TOTAL_SUPPLY, MIN_FEE, distribution};

/// The BOLH blockchain state
pub struct BolhChain {
    /// All blocks in order
    pub(crate) blocks: RwLock<Vec<Block>>,
    /// Account balances and state
    pub(crate) accounts: RwLock<HashMap<Address, Account>>,
    /// Managed wallets (local node)
    pub(crate) wallets: RwLock<HashMap<String, Wallet>>,
    /// Pending transactions (mempool)
    pub(crate) mempool: RwLock<Vec<Transaction>>,
    /// Transaction history by address
    pub(crate) tx_history: RwLock<HashMap<Address, Vec<TxRecord>>>,
    /// Total registered users (for referral tier calculation)
    pub(crate) user_count: RwLock<u64>,
    /// Ephemeral consensus runtime (V2)
    pub(crate) consensus: RwLock<ConsensusRuntime>,
}

/// Simplified transaction record for history
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct TxRecord {
    pub txid: String,
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub fee: u64,
    pub tx_type: String,
    pub timestamp: u64,
    pub block_height: u64,
}

/// Result of submitting a transaction
#[derive(Debug, serde::Serialize)]
pub struct TxSubmitResult {
    pub success: bool,
    pub txid: String,
    pub error: Option<String>,
}

/// Chain statistics
#[derive(Debug, serde::Serialize)]
pub struct ChainStats {
    pub height: u64,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub total_accounts: usize,
    pub total_transactions: u64,
    pub genesis_hash: String,
}

impl BolhChain {
    /// Create a new blockchain with Genesis block
    pub fn new() -> Self {
        let mut accounts = HashMap::new();

        // Genesis distribution accounts
        let mining_addr = Address::from_public_key(b"bolh_mining_pool");
        let referral_addr = Address::from_public_key(b"bolh_referral_pool");
        let advertising_addr = Address::from_public_key(b"bolh_advertising_pool");
        let reserve_addr = Address::from_public_key(b"bolh_reserve_pool");

        // Allocate initial supply per tokenomics
        accounts.insert(mining_addr.clone(), Account::with_balance(distribution::MINING_POOL));
        accounts.insert(referral_addr.clone(), Account::with_balance(distribution::REFERRAL_POOL));
        accounts.insert(advertising_addr.clone(), Account::with_balance(distribution::ADVERTISING_POOL));
        accounts.insert(reserve_addr.clone(), Account::with_balance(distribution::RESERVE_POOL));

        // Compute state root from initial accounts
        let state_root = Self::compute_state_root_from(&accounts);

        // Create Genesis block
        let genesis = Block::genesis(state_root);

        let chain = BolhChain {
            blocks: RwLock::new(vec![genesis]),
            accounts: RwLock::new(accounts),
            wallets: RwLock::new(HashMap::new()),
            mempool: RwLock::new(Vec::new()),
            tx_history: RwLock::new(HashMap::new()),
            user_count: RwLock::new(0),
            consensus: RwLock::new(ConsensusRuntime::new()),
        };

        chain
    }

    /// Compute state root hash from accounts map
    pub(crate) fn compute_state_root_from(accounts: &HashMap<Address, Account>) -> Hash {
        let mut hasher = Sha3_256::new();
        let mut sorted: Vec<_> = accounts.iter().collect();
        sorted.sort_by_key(|(addr, _)| addr.0);
        for (addr, acct) in sorted {
            hasher.update(&addr.0);
            hasher.update(acct.balance.to_le_bytes());
            hasher.update(acct.nonce.to_le_bytes());
            hasher.update(acct.staked.to_le_bytes());
        }
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result);
        hash
    }

    /// Compute state root from current state
    fn compute_state_root(&self) -> Hash {
        let accounts = self.accounts.read();
        Self::compute_state_root_from(&accounts)
    }

    // =================== WALLET MANAGEMENT ===================

    /// Create a new wallet with real Ed25519 keypair
    pub fn create_wallet(&self, name: &str) -> Result<crate::wallet::WalletInfo, String> {
        // Optional vault enforcement (production hardening).
        // If enabled, prevent creating wallets when vault password is missing.
        let enforce = std::env::var("BOLH_VAULT_ENFORCE")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        if enforce && std::env::var("BOLH_WALLET_VAULT_PASSWORD").ok().filter(|s| !s.is_empty()).is_none() {
            return Err("Vault password not set (BOLH_WALLET_VAULT_PASSWORD)".into());
        }

        let mut wallets = self.wallets.write();
        if wallets.contains_key(name) {
            return Err(format!("Wallet '{}' already exists", name));
        }

        let wallet = Wallet::new(name);
        let info = wallet.info();

        // Register account if not exists
        let mut accounts = self.accounts.write();
        accounts.entry(wallet.address.clone()).or_insert_with(Account::new);

        // Increment user count (for referral tiers)
        *self.user_count.write() += 1;

        wallets.insert(name.to_string(), wallet);
        Ok(info)
    }

    /// Import wallet from secret key hex
    pub fn import_wallet(&self, name: &str, secret_hex: &str) -> Result<crate::wallet::WalletInfo, String> {
        let wallet = Wallet::from_secret_hex(name, secret_hex)?;
        let info = wallet.info();

        let mut wallets = self.wallets.write();
        wallets.insert(name.to_string(), wallet);
        Ok(info)
    }

    /// Get wallet info (public data only)
    pub fn get_wallet(&self, name: &str) -> Option<crate::wallet::WalletInfo> {
        let wallets = self.wallets.read();
        wallets.get(name).map(|w| w.info())
    }

    /// Export wallet (includes private key!)
    pub fn export_wallet(&self, name: &str) -> Option<crate::wallet::WalletExport> {
        let wallets = self.wallets.read();
        wallets.get(name).map(|w| w.export())
    }

    /// List all local wallets
    pub fn list_wallets(&self) -> Vec<crate::wallet::WalletInfo> {
        let wallets = self.wallets.read();
        wallets.values().map(|w| w.info()).collect()
    }

    /// Delete a wallet
    pub fn delete_wallet(&self, name: &str) -> bool {
        let mut wallets = self.wallets.write();
        wallets.remove(name).is_some()
    }

    // =================== BALANCE & ACCOUNTS ===================

    /// Get account balance
    pub fn get_balance(&self, address: &Address) -> u64 {
        let accounts = self.accounts.read();
        accounts.get(address).map(|a| a.balance).unwrap_or(0)
    }

    /// Get balance by wallet name
    pub fn get_wallet_balance(&self, wallet_name: &str) -> u64 {
        let wallets = self.wallets.read();
        if let Some(wallet) = wallets.get(wallet_name) {
            self.get_balance(&wallet.address)
        } else {
            0
        }
    }

    /// Get full account info
    pub fn get_account(&self, address: &Address) -> Account {
        let accounts = self.accounts.read();
        accounts.get(address).cloned().unwrap_or_default()
    }

    /// Hash of the current tip (last block).
    pub fn last_block_hash(&self) -> Hash {
        let blocks = self.blocks.read();
        blocks.last().map(|b| b.hash).unwrap_or([0u8; 32])
    }

    /// Best-effort lookup of validator public key bytes from local wallets.
    /// Returns `None` if we don't have this validator's key locally.
    pub fn validator_pubkey_bytes(&self, validator: &Address) -> Option<Vec<u8>> {
        let wallets = self.wallets.read();
        wallets
            .values()
            .find(|w| &w.address == validator)
            .map(|w| w.public_key_bytes())
    }

    /// Pending mempool stats for a sender: (total_cost, max_nonce).
    /// Used by `SecurityPipeline` to validate sequences when submit is mempool-only.
    pub fn pending_for_sender(&self, sender: &Address) -> (u64, u64) {
        let mempool = self.mempool.read();
        let mut total = 0u64;
        let mut max_nonce = 0u64;
        for tx in mempool.iter() {
            if &tx.from == sender {
                total = total.saturating_add(tx.amount.saturating_add(tx.fee));
                if tx.nonce > max_nonce {
                    max_nonce = tx.nonce;
                }
            }
        }
        (total, max_nonce)
    }

    // =================== CONSENSUS (V2) ===================

    /// Current epoch (simple fixed-length epochs).
    pub fn epoch(&self) -> u64 {
        const EPOCH_LEN: u64 = 1_000;
        self.height() / EPOCH_LEN
    }

    /// Active validators derived from accounts + consensus jail set.
    pub fn active_validators(&self) -> Vec<crate::consensus::ValidatorInfo> {
        let cfg = self.consensus.read().config.clone();
        let current_height = self.height();
        let jailed = self.consensus.read().jailed_until.clone();

        let accounts = self.accounts.read();
        let mut vals: Vec<crate::consensus::ValidatorInfo> = accounts
            .iter()
            .filter_map(|(addr, acct)| {
                if !acct.is_validator {
                    return None;
                }
                if acct.staked < cfg.min_stake {
                    return None;
                }
                let is_jailed = jailed
                    .get(addr)
                    .map(|until| current_height < *until)
                    .unwrap_or(false);
                Some(crate::consensus::ValidatorInfo {
                    address: addr.clone(),
                    stake: acct.staked,
                    is_active: !is_jailed,
                    blocks_produced: 0,
                    last_block_height: current_height,
                    slash_count: 0,
                    jailed_until: jailed.get(addr).copied(),
                })
            })
            .collect();

        // Sort by stake desc, cap to max_validators
        vals.sort_by_key(|v| std::cmp::Reverse(v.stake));
        vals.truncate(cfg.max_validators as usize);
        vals
    }

    /// Deterministically select proposer for next height.
    pub fn current_proposer(&self) -> Option<Address> {
        let height = self.height() + 1;
        let vals = self.active_validators();
        crate::consensus::select_validator(&vals, height).map(|v| v.address.clone())
    }

    /// Propose a new block (does NOT apply; creates a pending proposal).
    pub fn propose_block(&self, proposer_wallet: &str) -> Result<String, String> {
        let proposer = {
            let wallets = self.wallets.read();
            wallets
                .get(proposer_wallet)
                .cloned()
                .ok_or_else(|| format!("Validator wallet '{}' not found", proposer_wallet))?
        };

        // Must be active validator
        let vals = self.active_validators();
        let is_active = vals
            .iter()
            .any(|v| v.address == proposer.address && v.is_active);
        if !is_active {
            return Err("Proposer is not an active validator".into());
        }

        // One proposal per height (simple)
        let height = self.height() + 1;
        if self
            .consensus
            .read()
            .proposals
            .values()
            .any(|p| p.height == height)
        {
            return Err("A proposal already exists for this height".into());
        }

        // Deterministic tx ordering: sort by tx hash.
        let mut txs = self.mempool.read().clone();
        if txs.is_empty() {
            return Err("No transactions in mempool".into());
        }
        for tx in &mut txs {
            tx.hash = tx.compute_hash();
        }
        txs.sort_by_key(|t| t.hash);

        // Simulate execution for state_root
        let mut accounts_sim = self.accounts.read().clone();
        for tx in &txs {
            StateTransitionEngine::execute_transaction(&mut accounts_sim, tx)?;
        }
        let state_root = Self::compute_state_root_from(&accounts_sim);

        let blocks = self.blocks.read();
        let prev_hash = blocks.last().unwrap().hash;
        drop(blocks);

        let mut block = Block::new(
            height,
            prev_hash,
            proposer.address.clone(),
            txs,
            state_root,
        );

        // Sign header
        let header_hash = block.header.compute_hash();
        block.header.validator_sig = proposer.sign(&header_hash);
        block.hash = block.header.compute_hash();

        let block_id = hex::encode(block.hash);

        // Double-sign detection (same validator, same height, different block id)
        {
            let mut rt = self.consensus.write();
            let key = (height, proposer.address.clone());
            if let Some(existing) = rt.proposed_by_height.get(&key) {
                if existing != &block_id {
                    // Slash + jail (best-effort)
                    self.slash_and_jail(&proposer.address, crate::consensus::SlashingReason::DoubleSign, height);
                    return Err("Double-sign detected".into());
                }
            } else {
                rt.proposed_by_height.insert(key, block_id.clone());
            }

            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;

            rt.proposals.insert(
                block_id.clone(),
                PendingProposal {
                    block_id: block_id.clone(),
                    block,
                    height,
                    proposer: proposer.address.clone(),
                    yes: {
                        let mut s = std::collections::HashSet::new();
                        // Proposer auto-votes yes (common BFT optimization).
                        s.insert(proposer.address.clone());
                        s
                    },
                    no: Default::default(),
                    created_at_ms: now,
                },
            );
        }

        Ok(block_id)
    }

    /// Cast a vote on a pending block proposal.
    pub fn vote_on_block(&self, voter_wallet: &str, block_id: &str, approved: bool) -> Result<(), String> {
        let voter = {
            let wallets = self.wallets.read();
            wallets
                .get(voter_wallet)
                .cloned()
                .ok_or_else(|| format!("Wallet '{}' not found", voter_wallet))?
        };

        // Must be active validator
        let vals = self.active_validators();
        let is_active = vals.iter().any(|v| v.address == voter.address && v.is_active);
        if !is_active {
            return Err("Voter is not an active validator".into());
        }

        let mut rt = self.consensus.write();
        let prop = rt
            .proposals
            .get_mut(block_id)
            .ok_or_else(|| "Proposal not found".to_string())?;

        prop.yes.remove(&voter.address);
        prop.no.remove(&voter.address);
        if approved {
            prop.yes.insert(voter.address.clone());
        } else {
            prop.no.insert(voter.address.clone());
        }

        Ok(())
    }

    pub fn can_finalize(&self, block_id: &str) -> Result<bool, String> {
        let rt = self.consensus.read();
        let prop = rt
            .proposals
            .get(block_id)
            .ok_or_else(|| "Proposal not found".to_string())?;

        let cfg = rt.config.clone();
        let yes_set = prop.yes.clone();
        drop(rt);

        // Compute stake-weighted votes.
        let vals = self.active_validators();
        let total_stake: u64 = vals.iter().filter(|v| v.is_active).map(|v| v.stake).sum();
        if total_stake == 0 {
            return Ok(false);
        }
        let yes_stake: u64 = vals
            .iter()
            .filter(|v| v.is_active && yes_set.contains(&v.address))
            .map(|v| v.stake)
            .sum();

        Ok((yes_stake as f64) >= (total_stake as f64 * cfg.finality_threshold))
    }

    /// Finalize a block proposal and apply it to chain state (deterministic).
    pub fn finalize_block(&self, block_id: &str) -> Result<u64, String> {
        if !self.can_finalize(block_id)? {
            return Err("Not enough votes to finalize".into());
        }

        let block = {
            let mut rt = self.consensus.write();
            let prop = rt
                .proposals
                .remove(block_id)
                .ok_or_else(|| "Proposal not found".to_string())?;
            prop.block
        };

        // Apply block (unified execution path)
        self.apply_block(block.clone())?;

        // Remove included txs from mempool
        let included: std::collections::HashSet<crate::types::Hash> =
            block.transactions.iter().map(|t| t.hash).collect();
        self.mempool.write().retain(|t| !included.contains(&t.hash));

        Ok(self.height())
    }

    /// Best-effort slashing + jailing implemented on Account state.
    fn slash_and_jail(&self, validator: &Address, reason: crate::consensus::SlashingReason, height: u64) {
        let cfg = self.consensus.read().config.clone();
        let slash_percent = match reason {
            crate::consensus::SlashingReason::DoubleSign => cfg.double_sign_slash_percent,
            crate::consensus::SlashingReason::Downtime => 1,
            crate::consensus::SlashingReason::InvalidBlock => 2,
        };

        let reserve_addr = Address::from_public_key(b"bolh_reserve_pool");
        let mut accounts = self.accounts.write();
        let Some(acc) = accounts.get_mut(validator) else { return; };

        let slash_amount = acc.staked.saturating_mul(slash_percent) / 100;
        acc.staked = acc.staked.saturating_sub(slash_amount);
        acc.balance = acc.balance.saturating_sub(slash_amount);
        if acc.staked < cfg.min_stake {
            acc.is_validator = false;
        }

        let reserve = accounts.entry(reserve_addr).or_insert_with(Account::new);
        reserve.balance = reserve.balance.saturating_add(slash_amount);

        drop(accounts);

        // Jail
        let mut rt = self.consensus.write();
        rt.jail(validator, height + cfg.jail_duration_blocks);
    }

    /// Apply a full block to chain state using the StateTransitionEngine.
    /// This is the unified execution path for sync/recovery/production commit.
    pub fn apply_block(&self, mut block: Block) -> Result<(), String> {
        // Recompute skipped hashes before validation.
        block.hash = block.header.compute_hash();
        for tx in &mut block.transactions {
            tx.hash = tx.compute_hash();
        }

        // Validate block against current tip.
        BlockValidator::validate_block(self, &block)?;

        // Execute transactions deterministically.
        {
            let mut accounts = self.accounts.write();
            for tx in &block.transactions {
                StateTransitionEngine::execute_transaction(&mut accounts, tx)?;
            }
        }

        // Record transaction history at block-finalization time.
        {
            let mut history = self.tx_history.write();
            for tx in &block.transactions {
                let record = TxRecord {
                    txid: hex::encode(tx.hash),
                    from: tx.from.to_bech32(),
                    to: tx.to.to_bech32(),
                    amount: tx.amount,
                    fee: tx.fee,
                    tx_type: format!("{:?}", tx.tx_type),
                    timestamp: tx.timestamp,
                    block_height: block.header.height,
                };
                history.entry(tx.from.clone()).or_default().push(record.clone());
                history.entry(tx.to.clone()).or_default().push(record);
            }
        }

        // Append block and audit log.
        self.blocks.write().push(block.clone());

        let data_dir = PersistenceManager::default_dir();
        if let Err(e) = append_log::append_block(&data_dir, &block) {
            eprintln!("[BOLH] append blocks.log failed (apply): {}", e);
        }

        Ok(())
    }

    /// Recover missing blocks from an append-only block log.
    ///
    /// Safe to call on:
    /// - a fresh chain (will apply blocks from height 1..)
    /// - a snapshot-restored chain (will apply blocks with height > current height)
    pub fn recover_from_log(&self, log_path: &std::path::Path) -> Result<u64, String> {
        let blocks = append_log::replay_block_log(log_path)?;
        if blocks.is_empty() {
            return Ok(0);
        }

        let mut applied = 0u64;
        let current_height = self.height();

        for mut block in blocks {
            if block.header.height <= current_height {
                continue;
            }

            // Recompute skipped hashes before validation/apply
            block.hash = block.header.compute_hash();
            for tx in &mut block.transactions {
                tx.hash = tx.compute_hash();
            }

            self.apply_block(block)?;
            applied += 1;
        }

        Ok(applied)
    }

    // =================== TRANSACTIONS ===================

    /// Create and sign a transfer transaction
    pub fn create_transfer(
        &self,
        from_wallet: &str,
        to_address: &str,
        amount: u64,
    ) -> Result<Transaction, String> {
        let wallets = self.wallets.read();
        let wallet = wallets.get(from_wallet)
            .ok_or_else(|| format!("Wallet '{}' not found", from_wallet))?;

        let to = Address::from_bech32(to_address)?;
        let accounts = self.accounts.read();
        let sender_account = accounts.get(&wallet.address).cloned().unwrap_or_default();
        drop(accounts);

        // Include pending mempool txs for proper sequencing (submit is mempool-only).
        let (pending_spend, pending_max_nonce) = self.pending_for_sender(&wallet.address);
        let base_nonce = if pending_max_nonce > sender_account.nonce {
            pending_max_nonce
        } else {
            sender_account.nonce
        };

        let fee = MIN_FEE;
        let total = amount.checked_add(fee)
            .ok_or("Amount overflow")?;

        let available = sender_account.available_balance().saturating_sub(pending_spend);
        if available < total {
            return Err(format!(
                "Insufficient balance: have {}, need {}",
                available,
                total
            ));
        }

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut tx = Transaction {
            tx_type: TxType::Transfer,
            from: wallet.address.clone(),
            to,
            amount,
            fee,
            nonce: base_nonce + 1,
            timestamp,
            privacy: PrivacyLevel::Transparent,
            data: Vec::new(),
            public_key: wallet.public_key_bytes(),
            signature: Vec::new(),
            hash: [0u8; 32],
        };

        // Sign the transaction with real Ed25519
        let signing_bytes = tx.signing_bytes();
        tx.signature = wallet.sign_transaction(&signing_bytes);
        tx.hash = tx.compute_hash();

        Ok(tx)
    }

    /// Submit a signed transaction (mempool admission only).
    ///
    /// V2 model: state changes happen ONLY during block application.
    pub fn submit_transaction(&self, mut tx: Transaction) -> TxSubmitResult {
        // Ensure hash is computed (it may be missing when deserialized)
        tx.hash = tx.compute_hash();
        let txid = hex::encode(tx.hash);

        // Centralized security/validation gate
        if let Err(e) = SecurityPipeline::validate_tx(self, &tx) {
            return TxSubmitResult {
                success: false,
                txid,
                error: Some(e),
            };
        }

        // Add to mempool (for next block)
        self.mempool.write().push(tx);

        TxSubmitResult {
            success: true,
            txid,
            error: None,
        }
    }

    // =================== BLOCK PRODUCTION ===================

    /// Produce a new block from mempool transactions
    pub fn produce_block(&self, validator_wallet: &str) -> Result<Block, String> {
        let wallets = self.wallets.read();
        let validator = wallets.get(validator_wallet)
            .ok_or_else(|| format!("Validator wallet '{}' not found", validator_wallet))?;

        let mut mempool = self.mempool.write();
        let txs: Vec<Transaction> = mempool.drain(..).collect();

        if txs.is_empty() {
            return Err("No transactions in mempool".into());
        }

        let blocks = self.blocks.read();
        let prev_block = blocks.last().unwrap();
        let height = blocks.len() as u64;
        let prev_hash = prev_block.header.compute_hash();

        // Simulate execution to compute post-state root (deterministic).
        let mut accounts_sim = self.accounts.read().clone();
        for tx in &txs {
            StateTransitionEngine::execute_transaction(&mut accounts_sim, tx)?;
        }
        let state_root = Self::compute_state_root_from(&accounts_sim);

        let mut block = Block::new(
            height,
            prev_hash,
            validator.address.clone(),
            txs,
            state_root,
        );

        // Sign block header with validator's Ed25519 key
        let header_hash = block.header.compute_hash();
        block.header.validator_sig = validator.sign(&header_hash);
        block.hash = block.header.compute_hash();

        drop(blocks); // Release read lock before apply
        // Apply via unified execution path (also validates + logs)
        self.apply_block(block.clone())?;

        Ok(block)
    }

    // =================== QUERIES ===================

    /// Get chain statistics
    pub fn stats(&self) -> ChainStats {
        let blocks = self.blocks.read();
        let accounts = self.accounts.read();
        let history = self.tx_history.read();

        let total_txs: u64 = history.values().map(|v| v.len() as u64).sum::<u64>() / 2; // Each tx appears twice

        let circulating: u64 = accounts.values().map(|a| a.balance + a.staked).sum();

        ChainStats {
            height: blocks.len() as u64 - 1, // Genesis is height 0
            total_supply: TOTAL_SUPPLY,
            circulating_supply: circulating,
            total_accounts: accounts.len(),
            total_transactions: total_txs,
            genesis_hash: hex::encode(blocks[0].header.compute_hash()),
        }
    }

    /// Get transaction history for an address
    pub fn get_tx_history(&self, address: &Address) -> Vec<TxRecord> {
        let history = self.tx_history.read();
        history.get(address).cloned().unwrap_or_default()
    }

    /// Get block by height
    pub fn get_block(&self, height: u64) -> Option<Block> {
        let blocks = self.blocks.read();
        blocks.get(height as usize).cloned()
    }

    /// Get current block height
    pub fn height(&self) -> u64 {
        self.blocks.read().len() as u64 - 1
    }

    /// Get total registered users
    pub fn user_count(&self) -> u64 {
        *self.user_count.read()
    }

    /// Award mining/earning tokens from the mining pool
    pub fn award_mining_tokens(&self, to_address: &Address, amount: u64) -> Result<(), String> {
        let mining_addr = Address::from_public_key(b"bolh_mining_pool");
        let mut accounts = self.accounts.write();

        let pool = accounts.get_mut(&mining_addr)
            .ok_or("Mining pool not found")?;
        
        if pool.balance < amount {
            return Err("Mining pool depleted".into());
        }

        pool.balance -= amount;

        let receiver = accounts.entry(to_address.clone()).or_insert_with(Account::new);
        receiver.balance += amount;

        Ok(())
    }

    /// Process referral reward
    pub fn process_referral(&self, inviter: &Address, invitee: &Address) -> Result<u64, String> {
        let user_count = *self.user_count.read();
        let reward = distribution::referral::reward_for_user(user_count);
        
        let referral_addr = Address::from_public_key(b"bolh_referral_pool");
        let mut accounts = self.accounts.write();

        let pool = accounts.get_mut(&referral_addr)
            .ok_or("Referral pool not found")?;

        let total_reward = reward * 2; // Both inviter and invitee get rewarded
        if pool.balance < total_reward {
            return Err("Referral pool depleted".into());
        }
        pool.balance -= total_reward;

        // Reward inviter
        let inviter_acct = accounts.entry(inviter.clone()).or_insert_with(Account::new);
        inviter_acct.balance += reward;
        inviter_acct.referral_count += 1;

        // Reward invitee
        let invitee_acct = accounts.entry(invitee.clone()).or_insert_with(Account::new);
        invitee_acct.balance += reward;
        invitee_acct.referred_by = Some(inviter.clone());

        Ok(reward)
    }
}

impl Default for BolhChain {
    fn default() -> Self {
        Self::new()
    }
}

// Thread-safe global chain instance
use std::sync::OnceLock;
static GLOBAL_CHAIN: OnceLock<BolhChain> = OnceLock::new();

/// Get or initialize the global chain instance
/// Tries to load from disk first; if no saved state, creates fresh genesis
pub fn global_chain() -> &'static BolhChain {
    GLOBAL_CHAIN.get_or_init(|| {
        let pm = crate::persistence::PersistenceManager::new(
            crate::persistence::PersistenceManager::default_dir()
        );
        let allow_fresh = std::env::var("BOLH_ALLOW_FRESH_CHAIN_ON_RESTORE_FAILURE")
            .ok()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        let data_dir = crate::persistence::PersistenceManager::default_dir();
        let log_path = crate::storage::append_log::blocks_log_path(&data_dir);

        // Try to load from disk
        let chain = if pm.has_saved_state() {
            match pm.load() {
                Ok(snapshot) => match BolhChain::from_snapshot(snapshot) {
                    Ok(chain) => {
                        eprintln!("[BOLH] Loaded chain state from disk (height: {})", chain.height());
                        chain
                    }
                    Err(e) => {
                        eprintln!("[BOLH] Failed to restore snapshot: {}", e);
                        eprintln!("[BOLH] Refusing to start fresh to avoid accidental data loss.");
                        eprintln!("[BOLH] If this is expected (dev), set BOLH_ALLOW_FRESH_CHAIN_ON_RESTORE_FAILURE=1.");
                        eprintln!("[BOLH] If wallets are encrypted, set BOLH_WALLET_VAULT_PASSWORD to the correct password.");
                        if !allow_fresh {
                            panic!("[BOLH] Cannot restore saved state: {}", e);
                        }
                        BolhChain::new()
                    }
                },
                Err(e) => {
                    eprintln!("[BOLH] Failed to load saved state: {}", e);
                    eprintln!("[BOLH] Refusing to start fresh to avoid accidental data loss.");
                    eprintln!("[BOLH] If this is expected (dev), set BOLH_ALLOW_FRESH_CHAIN_ON_RESTORE_FAILURE=1.");
                    if !allow_fresh {
                        panic!("[BOLH] Cannot load saved state: {}", e);
                    }
                    BolhChain::new()
                }
            }
        } else {
            eprintln!("[BOLH] Creating new chain with Genesis block");
            BolhChain::new()
        };

        // Best-effort recovery from append-only log (crash safety).
        match chain.recover_from_log(&log_path) {
            Ok(applied) if applied > 0 => {
                eprintln!("[BOLH] Replayed {} blocks from blocks.log (new height: {})", applied, chain.height());
            }
            Ok(_) => {}
            Err(e) => {
                eprintln!("[BOLH] blocks.log replay failed: {}", e);
                if !allow_fresh {
                    panic!("[BOLH] Cannot safely recover from blocks.log: {}", e);
                }
            }
        }

        chain
    })
}

/// Save global chain state to disk
pub fn save_global_chain() -> Result<(), String> {
    let chain = global_chain();
    let pm = crate::persistence::PersistenceManager::new(
        crate::persistence::PersistenceManager::default_dir()
    );
    pm.save(chain)?;
    let stats = chain.stats();
    eprintln!("[BOLH] Chain state saved to disk (height: {}, accounts: {})", stats.height, stats.total_accounts);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_genesis_supply() {
        let chain = BolhChain::new();
        let stats = chain.stats();
        assert_eq!(stats.total_supply, TOTAL_SUPPLY);
        assert_eq!(stats.height, 0);
        assert!(stats.circulating_supply > 0);
        // All supply should be distributed across pools
        assert_eq!(stats.circulating_supply, TOTAL_SUPPLY);
    }

    #[test]
    fn test_wallet_and_transfer() {
        let chain = BolhChain::new();

        // Create two wallets
        let alice = chain.create_wallet("alice").unwrap();
        let bob = chain.create_wallet("bob").unwrap();

        // Award tokens to Alice from mining pool
        let alice_addr = Address::from_bech32(&alice.address).unwrap();
        chain.award_mining_tokens(&alice_addr, 1_000_00_000_000).unwrap(); // 1000 BOLH

        // Check balance
        assert_eq!(chain.get_wallet_balance("alice"), 1_000_00_000_000);
        assert_eq!(chain.get_wallet_balance("bob"), 0);

        // Transfer from Alice to Bob
        let tx = chain.create_transfer("alice", &bob.address, 500_00_000_000).unwrap();
        let result = chain.submit_transaction(tx);
        assert!(result.success, "Transfer failed: {:?}", result.error);

        // Include tx in a block (state changes happen on block apply)
        chain.produce_block("alice").unwrap();

        // Check balances after transfer
        let alice_bal = chain.get_wallet_balance("alice");
        let bob_bal = chain.get_wallet_balance("bob");
        assert_eq!(bob_bal, 500_00_000_000);
        assert_eq!(alice_bal, 1_000_00_000_000 - 500_00_000_000 - MIN_FEE);
    }

    #[test]
    fn test_invalid_signature_rejected() {
        let chain = BolhChain::new();
        
        let alice_info = chain.create_wallet("alice").unwrap();
        let alice_addr = Address::from_bech32(&alice_info.address).unwrap();
        chain.award_mining_tokens(&alice_addr, 1_000_00_000_000).unwrap();

        let bob_info = chain.create_wallet("bob").unwrap();

        // Create a valid transaction
        let mut tx = chain.create_transfer("alice", &bob_info.address, 100_00_000_000).unwrap();
        
        // Tamper with signature
        tx.signature = vec![0u8; 64];

        let result = chain.submit_transaction(tx);
        assert!(!result.success);
        assert_eq!(result.error, Some("Invalid signature".into()));
    }

    #[test]
    fn test_block_production() {
        let chain = BolhChain::new();

        let _validator = chain.create_wallet("validator").unwrap();
        let alice = chain.create_wallet("alice").unwrap();
        let bob = chain.create_wallet("bob").unwrap();

        let alice_addr = Address::from_bech32(&alice.address).unwrap();
        chain.award_mining_tokens(&alice_addr, 1_000_00_000_000).unwrap();

        // Create transfer
        let tx = chain.create_transfer("alice", &bob.address, 100_00_000_000).unwrap();
        chain.submit_transaction(tx);

        // Produce block
        let block = chain.produce_block("validator").unwrap();
        assert_eq!(block.header.height, 1);
        assert_eq!(block.transactions.len(), 1);
        assert!(block.is_valid_structure());

        // Chain height should be 1
        assert_eq!(chain.height(), 1);
    }

    #[test]
    fn test_referral_reward() {
        let chain = BolhChain::new();

        let alice = chain.create_wallet("alice").unwrap();
        let bob = chain.create_wallet("bob").unwrap();

        let alice_addr = Address::from_bech32(&alice.address).unwrap();
        let bob_addr = Address::from_bech32(&bob.address).unwrap();

        let reward = chain.process_referral(&alice_addr, &bob_addr).unwrap();
        assert!(reward > 0);

        // Both should have received reward
        assert_eq!(chain.get_balance(&alice_addr), reward);
        assert_eq!(chain.get_balance(&bob_addr), reward);
    }
}
