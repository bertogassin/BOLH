use serde::{Deserialize, Serialize};
use crate::crypto;
use crate::transaction::{Transaction, TxInput, TxOutput};
use crate::utxo::{self, UTXO};

/// A wallet for managing keys and transactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    /// Wallet name/identifier
    pub name: String,
    /// Public key (address)
    pub public_key: String,
    /// Secret key (for signing)
    #[serde(skip)]
    pub secret_key: String,
    /// Wallet creation timestamp
    pub created_at: u64,
}

impl Wallet {
    /// Create a new wallet
    pub fn new(name: String) -> Self {
        let (pk, sk) = crypto::generate_keypair();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Wallet {
            name,
            public_key: pk,
            secret_key: sk,
            created_at: timestamp,
        }
    }

    /// Create a wallet from existing keys
    pub fn from_keys(name: String, public_key: String, secret_key: String) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Wallet {
            name,
            public_key,
            secret_key,
            created_at: timestamp,
        }
    }

    /// Get wallet address (public key)
    pub fn address(&self) -> String {
        self.public_key.clone()
    }

    /// Get current balance
    pub fn balance(&self) -> u64 {
        utxo::get_balance(&self.public_key)
    }

    /// Get all UTXOs owned by wallet
    pub fn utxos(&self) -> Vec<UTXO> {
        utxo::get_utxos(&self.public_key)
    }

    /// Select UTXOs to spend (simple greedy algorithm)
    pub fn select_utxos(&self, amount: u64) -> Result<Vec<UTXO>, String> {
        let available = self.utxos();

        if available.is_empty() {
            return Err("No unspent outputs available".to_string());
        }

        let total_available: u64 = available.iter().map(|u| u.amount).sum();
        if total_available < amount {
            return Err(format!(
                "Insufficient balance: have {}, need {}",
                total_available, amount
            ));
        }

        // Greedy selection: sort by amount descending and pick until we have enough
        let mut sorted = available.clone();
        sorted.sort_by(|a, b| b.amount.cmp(&a.amount));

        let mut selected = Vec::new();
        let mut sum = 0u64;

        for utxo in sorted {
            selected.push(utxo.clone());
            sum += utxo.amount;
            if sum >= amount {
                return Ok(selected);
            }
        }

        Ok(selected)
    }

    /// Create a transaction to an address
    pub fn create_transaction(
        &self,
        recipient: String,
        amount: u64,
        fee: u64,
    ) -> Result<Transaction, String> {
        let total_needed = amount + fee;

        // Select UTXOs
        let selected = self.select_utxos(total_needed)?;

        // Create inputs
        let inputs: Vec<TxInput> = selected
            .iter()
            .map(|utxo| TxInput {
                prev_txid: utxo.txid.clone(),
                output_index: utxo.output_index,
                signature: String::new(), // Will be filled by signing
            })
            .collect();

        // Calculate change
        let total_input: u64 = selected.iter().map(|u| u.amount).sum();
        let change = total_input - amount - fee;

        // Create outputs
        let mut outputs = vec![TxOutput {
            address: recipient,
            amount,
        }];

        // Add change output if needed
        if change > 0 {
            outputs.push(TxOutput {
                address: self.public_key.clone(),
                amount: change,
            });
        }

        // Create transaction
        let tx = Transaction::new(inputs, outputs, 0, None);

        // Note: We'd need to modify Transaction struct to allow updating timestamp
        // For now, the transaction is created with default timestamp
        let _signature = self.sign_transaction(&tx.txid);

        Ok(tx)
    }

    /// Sign a transaction
    pub fn sign_transaction(&self, message: &str) -> String {
        crypto::sign(message, &self.secret_key)
    }

    /// Verify a signature
    pub fn verify_signature(&self, message: &str, signature: &str) -> bool {
        crypto::verify(message, signature, &self.public_key)
    }

    /// Export wallet (public info only, no secret key)
    pub fn export_public(&self) -> WalletPublic {
        WalletPublic {
            name: self.name.clone(),
            public_key: self.public_key.clone(),
            created_at: self.created_at,
        }
    }
}

/// Public wallet info (safe to serialize without secret key)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletPublic {
    pub name: String,
    pub public_key: String,
    pub created_at: u64,
}

/// Fee estimation based on transaction size
pub fn estimate_fee(inputs: usize, outputs: usize) -> u64 {
    // Simple fee: 1 satoshi per byte
    // Assuming 150 bytes per input, 34 bytes per output, 10 bytes overhead
    let input_bytes = inputs as u64 * 150;
    let output_bytes = outputs as u64 * 34;
    let overhead = 10;
    input_bytes + output_bytes + overhead
}

/// Default fee for a transaction
pub fn default_fee() -> u64 {
    1000 // 1000 satoshis
}

use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;

static WALLETS: OnceLock<Mutex<HashMap<String, Wallet>>> = OnceLock::new();

fn wallets() -> &'static Mutex<HashMap<String, Wallet>> {
    WALLETS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Create a new wallet and store it
pub fn create_wallet(name: String) -> Result<String, String> {
    let wallet = Wallet::new(name.clone());
    let address = wallet.public_key.clone();

    let mut w = wallets().lock().unwrap();
    w.insert(name, wallet);

    Ok(address)
}

/// Get wallet by name
pub fn get_wallet(name: &str) -> Option<Wallet> {
    let w = wallets().lock().unwrap();
    w.get(name).cloned()
}

/// Import a wallet from keys
pub fn import_wallet(name: String, public_key: String, secret_key: String) -> Result<String, String> {
    let wallet = Wallet::from_keys(name.clone(), public_key, secret_key);
    let address = wallet.public_key.clone();

    let mut w = wallets().lock().unwrap();
    w.insert(name, wallet);

    Ok(address)
}

/// Get wallet balance
pub fn get_wallet_balance(name: &str) -> Result<u64, String> {
    let wallet = get_wallet(name).ok_or(format!("Wallet {} not found", name))?;
    Ok(wallet.balance())
}

/// List all wallet names
pub fn list_wallets() -> Vec<String> {
    let w = wallets().lock().unwrap();
    w.keys().cloned().collect()
}

/// Delete a wallet
pub fn delete_wallet(name: &str) -> Result<(), String> {
    let mut w = wallets().lock().unwrap();
    w.remove(name).ok_or(format!("Wallet {} not found", name))?;
    Ok(())
}

/// Reset wallet state (for testing)
pub fn reset() {
    let mut w = wallets().lock().unwrap();
    w.clear();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wallet_creation() {
        let wallet = Wallet::new("alice".to_string());
        assert!(!wallet.public_key.is_empty());
        assert!(!wallet.secret_key.is_empty());
        assert_eq!(wallet.address(), wallet.public_key);
    }

    #[test]
    fn test_wallet_from_keys() {
        let wallet = Wallet::new("bob".to_string());
        let pk = wallet.public_key.clone();
        let sk = wallet.secret_key.clone();

        let wallet2 = Wallet::from_keys("bob2".to_string(), pk.clone(), sk.clone());
        assert_eq!(wallet2.public_key, pk);
        assert_eq!(wallet2.secret_key, sk);
    }

    #[test]
    fn test_wallet_signing() {
        let wallet = Wallet::new("charlie".to_string());
        let message = "test message";
        let signature = wallet.sign_transaction(message);

        assert!(!signature.is_empty());
        assert!(wallet.verify_signature(message, &signature));
    }

    #[test]
    fn test_fee_estimation() {
        let fee = estimate_fee(1, 2);
        assert!(fee > 0);
        assert_eq!(fee, 150 + 68 + 10); // 1 input + 2 outputs + overhead
    }

    #[test]
    fn test_create_wallet() {
        reset();
        let result = create_wallet("test_wallet".to_string());
        assert!(result.is_ok());

        let wallet = get_wallet("test_wallet");
        assert!(wallet.is_some());
        assert_eq!(wallet.unwrap().name, "test_wallet");
    }

    #[test]
    fn test_list_wallets() {
        reset();
        create_wallet("wallet1".to_string()).unwrap();
        create_wallet("wallet2".to_string()).unwrap();

        let list = list_wallets();
        assert_eq!(list.len(), 2);
        assert!(list.contains(&"wallet1".to_string()));
        assert!(list.contains(&"wallet2".to_string()));
    }

    #[test]
    fn test_delete_wallet() {
        reset();
        create_wallet("to_delete".to_string()).unwrap();
        assert_eq!(list_wallets().len(), 1);

        let result = delete_wallet("to_delete");
        assert!(result.is_ok());
        assert_eq!(list_wallets().len(), 0);
    }

    #[test]
    fn test_import_wallet() {
        reset();
        let original = Wallet::new("original".to_string());
        let pk = original.public_key.clone();
        let sk = original.secret_key.clone();

        let result = import_wallet("imported".to_string(), pk.clone(), sk.clone());
        assert!(result.is_ok());

        let imported = get_wallet("imported").unwrap();
        assert_eq!(imported.public_key, pk);
    }

    #[test]
    fn test_wallet_export_public() {
        let wallet = Wallet::new("test".to_string());
        let public = wallet.export_public();

        assert_eq!(public.name, "test");
        assert_eq!(public.public_key, wallet.public_key);
        assert_eq!(public.created_at, wallet.created_at);
    }

    #[test]
    fn test_utxo_selection() {
        reset();
        utxo::reset();
        
        // Initialize with some funds
        utxo::init_genesis(vec![("test_addr".to_string(), 1000)]).unwrap();
        
        let wallet = Wallet::from_keys(
            "test".to_string(),
            "test_addr".to_string(),
            "secret".to_string(),
        );

        let selected = wallet.select_utxos(500).unwrap();
        assert!(!selected.is_empty());
        let total: u64 = selected.iter().map(|u| u.amount).sum();
        assert!(total >= 500);
    }

    #[test]
    fn test_insufficient_balance() {
        reset();
        utxo::reset();
        
        utxo::init_genesis(vec![("test_addr".to_string(), 100)]).unwrap();
        
        let wallet = Wallet::from_keys(
            "test".to_string(),
            "test_addr".to_string(),
            "secret".to_string(),
        );

        let result = wallet.select_utxos(1000);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient"));
    }
}
