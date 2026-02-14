//! BOLH Chain — In-memory blockchain state with real crypto
//!
//! Manages: blocks, accounts, balances, transactions, UTXO set
//! Uses Ed25519 for signing and SHA3-256 for hashing

use std::collections::HashMap;
use parking_lot::RwLock;
use sha3::{Digest, Sha3_256};

use crate::types::{Address, Account, Block, Transaction, TxType, PrivacyLevel, Hash};
use crate::wallet::{Wallet, verify_ed25519};
use crate::{TOTAL_SUPPLY, MIN_FEE, distribution};

/// The BOLH blockchain state
pub struct BolhChain {
    /// All blocks in order
    blocks: RwLock<Vec<Block>>,
    /// Account balances and state
    accounts: RwLock<HashMap<Address, Account>>,
    /// Managed wallets (local node)
    wallets: RwLock<HashMap<String, Wallet>>,
    /// Pending transactions (mempool)
    mempool: RwLock<Vec<Transaction>>,
    /// Transaction history by address
    tx_history: RwLock<HashMap<Address, Vec<TxRecord>>>,
    /// Total registered users (for referral tier calculation)
    user_count: RwLock<u64>,
}

/// Simplified transaction record for history
#[derive(Clone, Debug, serde::Serialize)]
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
        };

        chain
    }

    /// Compute state root hash from accounts map
    fn compute_state_root_from(accounts: &HashMap<Address, Account>) -> Hash {
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

        let fee = MIN_FEE;
        let total = amount.checked_add(fee)
            .ok_or("Amount overflow")?;

        if sender_account.available_balance() < total {
            return Err(format!(
                "Insufficient balance: have {}, need {}",
                sender_account.available_balance(),
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
            nonce: sender_account.nonce + 1,
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

    /// Submit a signed transaction
    pub fn submit_transaction(&self, tx: Transaction) -> TxSubmitResult {
        // Validate format
        if !tx.is_valid_format() {
            return TxSubmitResult {
                success: false,
                txid: String::new(),
                error: Some("Invalid transaction format".into()),
            };
        }

        // Verify Ed25519 signature
        let signing_bytes = tx.signing_bytes();
        if !verify_ed25519(&tx.public_key, &signing_bytes, &tx.signature) {
            return TxSubmitResult {
                success: false,
                txid: String::new(),
                error: Some("Invalid signature".into()),
            };
        }

        // Verify public key matches sender address
        let expected_addr = Address::from_public_key(&tx.public_key);
        if expected_addr != tx.from {
            return TxSubmitResult {
                success: false,
                txid: String::new(),
                error: Some("Public key does not match sender address".into()),
            };
        }

        let txid = hex::encode(tx.hash);

        // Execute transaction
        let mut accounts = self.accounts.write();

        // Get or create sender account
        let sender = accounts.entry(tx.from.clone()).or_insert_with(Account::new);

        // Check nonce
        if tx.nonce != sender.nonce + 1 {
            return TxSubmitResult {
                success: false,
                txid,
                error: Some(format!("Invalid nonce: expected {}, got {}", sender.nonce + 1, tx.nonce)),
            };
        }

        // Check balance
        let total_cost = tx.amount.saturating_add(tx.fee);
        if sender.available_balance() < total_cost {
            return TxSubmitResult {
                success: false,
                txid,
                error: Some("Insufficient balance".into()),
            };
        }

        // Debit sender
        sender.balance = sender.balance.saturating_sub(total_cost);
        sender.nonce += 1;

        // Handle staking
        match tx.tx_type {
            TxType::Stake => {
                sender.staked = sender.staked.saturating_add(tx.amount);
                sender.is_validator = true;
            }
            TxType::Unstake => {
                sender.staked = sender.staked.saturating_sub(tx.amount);
                sender.balance = sender.balance.saturating_add(tx.amount);
                if sender.staked == 0 {
                    sender.is_validator = false;
                }
            }
            _ => {
                // Credit receiver
                let receiver = accounts.entry(tx.to.clone()).or_insert_with(Account::new);
                receiver.balance = receiver.balance.saturating_add(tx.amount);
            }
        }

        // Record transaction in history
        let height = self.blocks.read().len() as u64;
        let record = TxRecord {
            txid: txid.clone(),
            from: tx.from.to_bech32(),
            to: tx.to.to_bech32(),
            amount: tx.amount,
            fee: tx.fee,
            tx_type: format!("{:?}", tx.tx_type),
            timestamp: tx.timestamp,
            block_height: height,
        };

        let mut history = self.tx_history.write();
        history.entry(tx.from.clone()).or_default().push(record.clone());
        history.entry(tx.to.clone()).or_default().push(record);

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

        let state_root = self.compute_state_root();

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

        drop(blocks); // Release read lock before write
        self.blocks.write().push(block.clone());

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
pub fn global_chain() -> &'static BolhChain {
    GLOBAL_CHAIN.get_or_init(BolhChain::new)
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

        let validator = chain.create_wallet("validator").unwrap();
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
