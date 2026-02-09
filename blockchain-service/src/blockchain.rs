use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

const TOTAL_SUPPLY: u64 = 10_000_000_000__00_000_000; // 10B with 8 decimals
const INITIAL_BALANCE: u64 = 10_000__00_000_000; // 10,000 BOLH

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Wallet {
    pub name: String,
    pub address: String,
    pub balance: u64,
    pub pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seckey: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub txid: String,
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub fee: u64,
    pub status: String,
    pub timestamp: String,
    pub block_height: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UTXO {
    pub txid: String,
    pub output_index: u32,
    pub address: String,
    pub amount: u64,
    pub block_height: u64,
    pub spent: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub height: u64,
    pub hash: String,
    pub prev_hash: String,
    pub timestamp: String,
    pub transactions: Vec<String>,
    pub validator: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Validator {
    pub name: String,
    pub stake: i64,
    pub address: String,
}

pub struct BlockchainState {
    pub wallets: Arc<RwLock<HashMap<String, Wallet>>>,
    pub transactions: Arc<RwLock<Vec<Transaction>>>,
    pub utxos: Arc<RwLock<Vec<UTXO>>>,
    pub blocks: Arc<RwLock<Vec<Block>>>,
    pub current_height: Arc<RwLock<u64>>,
}

impl BlockchainState {
    pub fn new() -> Self {
        Self {
            wallets: Arc::new(RwLock::new(HashMap::new())),
            transactions: Arc::new(RwLock::new(Vec::new())),
            utxos: Arc::new(RwLock::new(Vec::new())),
            blocks: Arc::new(RwLock::new(Vec::new())),
            current_height: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn initialize(&self) {
        // Create genesis block
        let genesis = Block {
            height: 0,
            hash: Self::hash_block(0, "0", &[], "genesis"),
            prev_hash: "0".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            transactions: vec![],
            validator: "genesis".to_string(),
        };

        let mut blocks = self.blocks.write().await;
        blocks.push(genesis);
    }

    pub fn generate_address(pubkey: &str) -> String {
        let mut hasher = Sha3_256::new();
        hasher.update(pubkey.as_bytes());
        let hash = hasher.finalize();
        format!("bolh_{}", hex::encode(&hash[..16]))
    }

    pub fn hash_transaction(from: &str, to: &str, amount: u64, timestamp: &str) -> String {
        let mut hasher = Sha3_256::new();
        hasher.update(from.as_bytes());
        hasher.update(to.as_bytes());
        hasher.update(&amount.to_le_bytes());
        hasher.update(timestamp.as_bytes());
        hex::encode(hasher.finalize())
    }

    pub fn hash_block(height: u64, prev_hash: &str, txs: &[String], validator: &str) -> String {
        let mut hasher = Sha3_256::new();
        hasher.update(&height.to_le_bytes());
        hasher.update(prev_hash.as_bytes());
        for tx in txs {
            hasher.update(tx.as_bytes());
        }
        hasher.update(validator.as_bytes());
        hex::encode(hasher.finalize())
    }

    pub async fn create_wallet(&self, name: String) -> Wallet {
        use rand::SeedableRng;
        use rand::RngCore;
        use rand::rngs::StdRng;

        // Create seeded RNG - Send-safe for async
        let random_bytes: [u8; 32] = uuid::Uuid::new_v4()
            .as_bytes()
            .iter()
            .chain(&uuid::Uuid::new_v4().as_bytes()[..])
            .take(32)
            .copied()
            .collect::<Vec<u8>>()
            .try_into()
            .unwrap_or([0u8; 32]);
        
        let mut rng = StdRng::from_seed(random_bytes);

        let secret_key: Vec<u8> = (0..32).map(|_| rng.next_u32() as u8).collect();
        let public_key: Vec<u8> = (0..32).map(|_| rng.next_u32() as u8).collect();

        let pubkey = hex::encode(&public_key);
        let seckey = hex::encode(&secret_key);
        let address = Self::generate_address(&pubkey);

        let wallet = Wallet {
            name: name.clone(),
            address: address.clone(),
            balance: INITIAL_BALANCE,
            pubkey: pubkey.clone(),
            seckey: Some(seckey),
            created_at: chrono::Utc::now().to_rfc3339(),
        };

        // Create initial UTXO for new wallet
        let utxo = UTXO {
            txid: format!("genesis_{}", uuid::Uuid::new_v4()),
            output_index: 0,
            address: address.clone(),
            amount: INITIAL_BALANCE,
            block_height: 0,
            spent: false,
        };

        // Now do async operations
        let mut wallets = self.wallets.write().await;
        wallets.insert(name.clone(), wallet.clone());

        let mut utxos = self.utxos.write().await;
        utxos.push(utxo);

        wallet
    }

    pub async fn get_wallet(&self, name: &str) -> Option<Wallet> {
        let wallets = self.wallets.read().await;
        wallets.get(name).cloned()
    }

    pub async fn list_wallets(&self) -> Vec<Wallet> {
        let wallets = self.wallets.read().await;
        wallets.values().cloned().collect()
    }

    pub async fn delete_wallet(&self, name: &str) -> bool {
        let mut wallets = self.wallets.write().await;
        wallets.remove(name).is_some()
    }

    pub async fn get_balance(&self, address: &str) -> u64 {
        let utxos = self.utxos.read().await;
        utxos
            .iter()
            .filter(|u| u.address == address && !u.spent)
            .map(|u| u.amount)
            .sum()
    }

    pub async fn submit_transaction(&self, from: String, to: String, amount: u64, fee: u64) -> Transaction {
        let timestamp = chrono::Utc::now().to_rfc3339();
        let txid = Self::hash_transaction(&from, &to, amount, &timestamp);

        // Update UTXOs
        let mut utxos = self.utxos.write().await;
        
        // Mark old UTXOs as spent
        let mut remaining = amount + fee;
        for utxo in utxos.iter_mut() {
            if utxo.address == from && !utxo.spent && remaining > 0 {
                let take = remaining.min(utxo.amount);
                utxo.spent = true;
                remaining -= take;
            }
        }

        // Create new UTXOs
        let height = *self.current_height.read().await;
        utxos.push(UTXO {
            txid: txid.clone(),
            output_index: 0,
            address: to.clone(),
            amount,
            block_height: height,
            spent: false,
        });

        if amount + fee < INITIAL_BALANCE {
            // Change UTXO
            utxos.push(UTXO {
                txid: txid.clone(),
                output_index: 1,
                address: from.clone(),
                amount: INITIAL_BALANCE - amount - fee,
                block_height: height,
                spent: false,
            });
        }

        drop(utxos);

        // Update wallet balances
        let mut wallets = self.wallets.write().await;
        if let Some(sender) = wallets.values_mut().find(|w| w.address == from) {
            sender.balance = sender.balance.saturating_sub(amount + fee);
        }
        if let Some(receiver) = wallets.values_mut().find(|w| w.address == to) {
            receiver.balance += amount;
        }
        drop(wallets);

        let tx = Transaction {
            txid: txid.clone(),
            from,
            to,
            amount,
            fee,
            status: "confirmed".to_string(),
            timestamp,
            block_height: Some(height),
        };

        let mut transactions = self.transactions.write().await;
        transactions.push(tx.clone());

        tx
    }

    pub async fn get_utxos(&self, address: &str) -> Vec<UTXO> {
        let utxos = self.utxos.read().await;
        utxos
            .iter()
            .filter(|u| u.address == address && !u.spent)
            .cloned()
            .collect()
    }

    pub async fn get_consensus_state(&self) -> (u64, Vec<Validator>) {
        let height = *self.current_height.read().await;
        let validators = vec![
            Validator {
                name: "validator_1".to_string(),
                stake: 100_000_000_000,
                address: "bolh_validator1".to_string(),
            },
            Validator {
                name: "validator_2".to_string(),
                stake: 100_000_000_000,
                address: "bolh_validator2".to_string(),
            },
        ];
        (height, validators)
    }

    pub async fn mine_block(&self) {
        let mut height = self.current_height.write().await;
        *height += 1;

        let transactions = self.transactions.read().await;
        let tx_ids: Vec<String> = transactions.iter().map(|t| t.txid.clone()).collect();

        let blocks = self.blocks.read().await;
        let prev_hash = blocks.last().map(|b| b.hash.clone()).unwrap_or_else(|| "0".to_string());
        drop(blocks);

        let block = Block {
            height: *height,
            hash: Self::hash_block(*height, &prev_hash, &tx_ids, "validator_1"),
            prev_hash,
            timestamp: chrono::Utc::now().to_rfc3339(),
            transactions: tx_ids,
            validator: "validator_1".to_string(),
        };

        let mut blocks = self.blocks.write().await;
        blocks.push(block);
    }
}
