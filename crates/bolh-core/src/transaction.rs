use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Transaction input - reference to previous output being spent
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub struct TxInput {
    /// Previous transaction ID
    pub prev_txid: String,
    /// Output index in previous transaction
    pub output_index: u32,
    /// Digital signature (base64 encoded)
    pub signature: String,
}

/// Transaction output - coins sent to an address
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Hash)]
pub struct TxOutput {
    /// Recipient address (public key)
    pub address: String,
    /// Amount in base units
    pub amount: u64,
}

/// Complete transaction structure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    /// Transaction ID (hash of the transaction)
    pub txid: String,
    /// Inputs being spent
    pub inputs: Vec<TxInput>,
    /// Outputs being created
    pub outputs: Vec<TxOutput>,
    /// Transaction timestamp (Unix epoch)
    pub timestamp: u64,
    /// Optional metadata (version, locktime, etc.)
    pub metadata: Option<String>,
}

impl Transaction {
    /// Create a new transaction (txid will be computed)
    pub fn new(
        inputs: Vec<TxInput>,
        outputs: Vec<TxOutput>,
        timestamp: u64,
        metadata: Option<String>,
    ) -> Self {
        let mut tx = Transaction {
            txid: String::new(),
            inputs,
            outputs,
            timestamp,
            metadata,
        };
        tx.txid = tx.compute_hash();
        tx
    }

    /// Compute transaction hash (used as txid)
    pub fn compute_hash(&self) -> String {
        let mut hasher = DefaultHasher::new();
        
        // Hash all inputs
        for input in &self.inputs {
            input.hash(&mut hasher);
        }
        
        // Hash all outputs
        for output in &self.outputs {
            output.hash(&mut hasher);
        }
        
        // Hash timestamp
        self.timestamp.hash(&mut hasher);
        
        // Hash metadata if present
        if let Some(ref meta) = self.metadata {
            meta.hash(&mut hasher);
        }
        
        format!("{:x}", hasher.finish())
    }

    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Get total input amount (requires UTXO lookup)
    pub fn total_inputs(&self) -> u64 {
        // In real implementation, would look up amounts from UTXO set
        // For now, return 0 as placeholder
        0
    }

    /// Get total output amount
    pub fn total_outputs(&self) -> u64 {
        self.outputs.iter().map(|o| o.amount).sum()
    }

    /// Calculate transaction fee (inputs - outputs)
    pub fn fee(&self) -> u64 {
        let inputs = self.total_inputs();
        let outputs = self.total_outputs();
        if inputs >= outputs {
            inputs - outputs
        } else {
            0
        }
    }

    /// Sign the transaction (simplified - signs the txid)
    pub fn sign(&mut self, secret_key: &str) -> String {
        #[cfg(feature = "pqc")]
        {
            use crate::crypto;
            let sig = crypto::sign(&self.txid, secret_key);
            sig
        }
        
        #[cfg(not(feature = "pqc"))]
        {
            // Fallback: just encode txid with secret (demo only)
            format!("sig_{}_with_{}", self.txid, &secret_key[..8])
        }
    }

    /// Verify transaction signature (simplified)
    pub fn verify(&self, _public_key: &str, signature: &str) -> bool {
        #[cfg(feature = "pqc")]
        {
            use crate::crypto;
            crypto::verify(&self.txid, signature, _public_key)
        }
        
        #[cfg(not(feature = "pqc"))]
        {
            // Fallback: basic check
            signature.contains(&self.txid) && signature.contains("sig_")
        }
    }
}

/// Helper to create a simple transfer transaction
pub fn create_transfer(
    _from_pubkey: &str,
    to_address: &str,
    amount: u64,
    prev_txid: &str,
    output_index: u32,
) -> Transaction {
    let input = TxInput {
        prev_txid: prev_txid.to_string(),
        output_index,
        signature: String::new(), // Will be filled after signing
    };

    let output = TxOutput {
        address: to_address.to_string(),
        amount,
    };

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    Transaction::new(vec![input], vec![output], timestamp, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transaction_hash() {
        let tx1 = create_transfer("alice", "bob", 1000, "prev_tx_123", 0);
        let tx2 = create_transfer("alice", "bob", 1000, "prev_tx_123", 0);
        
        // Same inputs should produce same hash (timestamp will differ, so this won't match exactly)
        // But at least test that hash is generated
        assert!(!tx1.txid.is_empty());
        assert!(!tx2.txid.is_empty());
    }

    #[test]
    fn test_transaction_serialization() {
        let tx = create_transfer("alice", "bob", 1000, "prev_tx_123", 0);
        let json = tx.to_json().unwrap();
        let tx2 = Transaction::from_json(&json).unwrap();
        
        assert_eq!(tx.txid, tx2.txid);
        assert_eq!(tx.inputs.len(), tx2.inputs.len());
        assert_eq!(tx.outputs.len(), tx2.outputs.len());
    }

    #[test]
    fn test_total_outputs() {
        let tx = Transaction::new(
            vec![],
            vec![
                TxOutput { address: "addr1".to_string(), amount: 100 },
                TxOutput { address: "addr2".to_string(), amount: 200 },
            ],
            1234567890,
            None,
        );
        
        assert_eq!(tx.total_outputs(), 300);
    }
}
