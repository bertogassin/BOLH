use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::storage;

/// Unspent Transaction Output (UTXO)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UTXO {
    /// Transaction ID that created this output
    pub txid: String,
    /// Output index in that transaction
    pub output_index: u32,
    /// Recipient address (public key)
    pub address: String,
    /// Amount in base units
    pub amount: u64,
    /// Block height when this UTXO was created
    pub block_height: u64,
    /// Whether this UTXO is spent
    pub spent: bool,
}

impl UTXO {
    /// Get UTXO identifier (txid:output_index)
    pub fn id(&self) -> String {
        format!("{}:{}", self.txid, self.output_index)
    }
}

/// UTXO set state
#[derive(Debug, Clone)]
pub struct UTXOSet {
    /// All UTXOs: id -> UTXO
    utxos: HashMap<String, UTXO>,
    /// Current block height
    pub block_height: u64,
}

impl UTXOSet {
    fn new() -> Self {
        UTXOSet {
            utxos: HashMap::new(),
            block_height: 0,
        }
    }

    /// Get all unspent outputs for an address
    pub fn utxos_for_address(&self, address: &str) -> Vec<UTXO> {
        self.utxos
            .values()
            .filter(|u| u.address == address && !u.spent)
            .cloned()
            .collect()
    }

    /// Get total unspent amount for an address
    pub fn balance(&self, address: &str) -> u64 {
        self.utxos_for_address(address)
            .iter()
            .map(|u| u.amount)
            .sum()
    }

    /// Get a specific UTXO
    fn get_utxo(&self, txid: &str, output_index: u32) -> Option<UTXO> {
        let id = format!("{}:{}", txid, output_index);
        self.utxos.get(&id).cloned()
    }

    /// Check if UTXO exists and is unspent
    pub fn utxo_exists_and_unspent(&self, txid: &str, output_index: u32) -> bool {
        if let Some(utxo) = self.get_utxo(txid, output_index) {
            !utxo.spent
        } else {
            false
        }
    }

    /// Add a new UTXO (from transaction output)
    fn add_utxo(&mut self, txid: String, output_index: u32, address: String, amount: u64) {
        let utxo = UTXO {
            txid: txid.clone(),
            output_index,
            address,
            amount,
            block_height: self.block_height,
            spent: false,
        };
        self.utxos.insert(utxo.id(), utxo);
    }

    /// Mark a UTXO as spent
    fn spend_utxo(&mut self, txid: &str, output_index: u32) -> Result<(), String> {
        let id = format!("{}:{}", txid, output_index);
        if let Some(utxo) = self.utxos.get_mut(&id) {
            if utxo.spent {
                return Err(format!("UTXO {}:{} already spent", txid, output_index));
            }
            utxo.spent = true;
            Ok(())
        } else {
            Err(format!("UTXO {}:{} not found", txid, output_index))
        }
    }

    /// Validate transaction inputs and outputs
    pub fn validate_transaction(
        &self,
        _txid: &str,
        inputs: &[(String, u32)], // (prev_txid, output_index)
        outputs: &[(String, u64)], // (address, amount)
    ) -> Result<(), String> {
        // Check all inputs exist and are unspent
        let mut total_input = 0u64;
        for (prev_txid, output_index) in inputs {
            if let Some(utxo) = self.get_utxo(prev_txid, *output_index) {
                if utxo.spent {
                    return Err(format!("Input {}:{} is already spent", prev_txid, output_index));
                }
                total_input = total_input
                    .checked_add(utxo.amount)
                    .ok_or("Input amount overflow")?;
            } else {
                return Err(format!("Input {}:{} not found in UTXO set", prev_txid, output_index));
            }
        }

        // Calculate total output
        let total_output: u64 = outputs.iter().map(|(_, amount)| amount).sum();

        // Check balance
        if total_input < total_output {
            return Err(format!(
                "Insufficient inputs: {} < {}",
                total_input, total_output
            ));
        }

        // Fee is implicitly total_input - total_output
        let _fee = total_input - total_output;

        Ok(())
    }

    /// Process transaction: consume inputs and create outputs
    pub fn process_transaction(
        &mut self,
        txid: String,
        inputs: Vec<(String, u32)>,
        outputs: Vec<(String, u64)>,
    ) -> Result<(), String> {
        // Validate first
        let input_refs: Vec<_> = inputs.iter().map(|(t, i)| (t.clone(), *i)).collect();
        let output_refs: Vec<_> = outputs.iter().map(|(a, am)| (a.clone(), *am)).collect();
        self.validate_transaction(&txid, &input_refs, &output_refs)?;

        // Consume inputs
        for (prev_txid, output_index) in inputs {
            self.spend_utxo(&prev_txid, output_index)
                .map_err(|e| format!("Failed to spend input: {}", e))?;
        }

        // Create outputs
        for (output_index, (address, amount)) in outputs.into_iter().enumerate() {
            self.add_utxo(txid.clone(), output_index as u32, address, amount);
        }

        Ok(())
    }

    /// Advance block height (called when block is finalized)
    pub fn advance_height(&mut self) {
        self.block_height += 1;
    }

    /// Persist UTXO set to storage
    pub fn persist(&self) -> Result<(), Box<dyn std::error::Error>> {
        let serialized = serde_json::to_string(&self.utxos)?;
        storage::save_block("_utxo_set", &serialized)?;
        Ok(())
    }

    /// Load UTXO set from storage
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        match storage::get_block("_utxo_set") {
            Ok(Some(data)) => {
                let utxos: HashMap<String, UTXO> = serde_json::from_str(&data)?;
                Ok(UTXOSet {
                    utxos,
                    block_height: 0, // Would need to track this separately or load from genesis
                })
            },
            Ok(None) => Ok(UTXOSet::new()),
            Err(_) => Ok(UTXOSet::new()),
        }
    }
}

use std::sync::{Mutex, OnceLock};

static UTXO_STATE: OnceLock<Mutex<UTXOSet>> = OnceLock::new();

fn utxo_set() -> &'static Mutex<UTXOSet> {
    UTXO_STATE.get_or_init(|| {
        let set = UTXOSet::load().unwrap_or_else(|_| UTXOSet::new());
        Mutex::new(set)
    })
}

/// Get balance for an address
pub fn get_balance(address: &str) -> u64 {
    let set = utxo_set().lock().unwrap();
    set.balance(address)
}

/// Get all UTXOs for an address
pub fn get_utxos(address: &str) -> Vec<UTXO> {
    let set = utxo_set().lock().unwrap();
    set.utxos_for_address(address)
}

/// Validate and process a transaction
pub fn process_tx(
    txid: String,
    inputs: Vec<(String, u32)>,
    outputs: Vec<(String, u64)>,
) -> Result<(), String> {
    let mut set = utxo_set().lock().unwrap();
    set.process_transaction(txid, inputs, outputs)
}

/// Check if a UTXO is available
pub fn utxo_available(txid: &str, output_index: u32) -> bool {
    let set = utxo_set().lock().unwrap();
    set.utxo_exists_and_unspent(txid, output_index)
}

/// Initialize with some genesis UTXOs
pub fn init_genesis(accounts: Vec<(String, u64)>) -> Result<(), String> {
    let mut set = utxo_set().lock().unwrap();

    // Create genesis transaction
    let genesis_txid = "genesis_tx".to_string();
    for (index, (address, amount)) in accounts.into_iter().enumerate() {
        set.add_utxo(genesis_txid.clone(), index as u32, address, amount);
    }

    set.persist().map_err(|e| e.to_string())?;
    Ok(())
}

/// Persist current UTXO state
pub fn persist() -> Result<(), String> {
    let set = utxo_set().lock().unwrap();
    set.persist().map_err(|e| e.to_string())
}

/// Reset UTXO state (for testing)
pub fn reset() {
    let mut set = utxo_set().lock().unwrap();
    *set = UTXOSet::new();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utxo_creation() {
        reset();

        let utxo = UTXO {
            txid: "tx1".to_string(),
            output_index: 0,
            address: "alice".to_string(),
            amount: 1000,
            block_height: 0,
            spent: false,
        };

        assert_eq!(utxo.id(), "tx1:0");
        assert!(!utxo.spent);
    }

    #[test]
    fn test_utxo_balance() {
        reset();
        init_genesis(vec![
            ("alice".to_string(), 1000),
            ("bob".to_string(), 500),
        ])
        .unwrap();

        assert_eq!(get_balance("alice"), 1000);
        assert_eq!(get_balance("bob"), 500);
        assert_eq!(get_balance("charlie"), 0);
    }

    #[test]
    fn test_transaction_validation() {
        reset();
        init_genesis(vec![("alice".to_string(), 1000)]).unwrap();

        // Valid transaction: alice sends 100 to bob
        let result = process_tx(
            "tx1".to_string(),
            vec![("genesis_tx".to_string(), 0)],
            vec![
                ("bob".to_string(), 100),
                ("alice".to_string(), 900), // change
            ],
        );

        assert!(result.is_ok());
        assert_eq!(get_balance("alice"), 900);
        assert_eq!(get_balance("bob"), 100);
    }

    #[test]
    fn test_insufficient_funds() {
        reset();
        init_genesis(vec![("alice".to_string(), 500)]).unwrap();

        // Try to send 1000 (insufficient)
        let result = process_tx(
            "tx1".to_string(),
            vec![("genesis_tx".to_string(), 0)],
            vec![("bob".to_string(), 1000)],
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Insufficient"));
    }

    #[test]
    fn test_double_spend_prevention() {
        reset();
        init_genesis(vec![("alice".to_string(), 1000)]).unwrap();

        // First transaction - valid
        let result1 = process_tx(
            "tx1".to_string(),
            vec![("genesis_tx".to_string(), 0)],
            vec![("bob".to_string(), 500)],
        );
        assert!(result1.is_ok());

        // Second transaction - try to spend same input again
        let result2 = process_tx(
            "tx2".to_string(),
            vec![("genesis_tx".to_string(), 0)],
            vec![("charlie".to_string(), 500)],
        );
        assert!(result2.is_err());
        assert!(result2.unwrap_err().contains("already spent"));
    }

    #[test]
    fn test_multiple_inputs() {
        reset();
        init_genesis(vec![
            ("alice".to_string(), 500),
            ("alice".to_string(), 300),
        ])
        .unwrap();

        // Spend both alice UTXOs
        let result = process_tx(
            "tx1".to_string(),
            vec![
                ("genesis_tx".to_string(), 0),
                ("genesis_tx".to_string(), 1),
            ],
            vec![("bob".to_string(), 800)],
        );

        assert!(result.is_ok());
        assert_eq!(get_balance("alice"), 0);
        assert_eq!(get_balance("bob"), 800);
    }

    #[test]
    fn test_utxo_retrieval() {
        reset();
        init_genesis(vec![("alice".to_string(), 1000)]).unwrap();

        let utxos = get_utxos("alice");
        assert_eq!(utxos.len(), 1);
        assert_eq!(utxos[0].amount, 1000);
        assert_eq!(utxos[0].address, "alice");
    }
}
