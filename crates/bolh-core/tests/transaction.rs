use bolh_core::transaction::{Transaction, TxInput, TxOutput, create_transfer};

#[test]
fn test_create_transfer() {
    let tx = create_transfer("alice_pubkey", "bob_address", 1000, "prev_txid_abc", 0);
    
    assert!(!tx.txid.is_empty());
    assert_eq!(tx.inputs.len(), 1);
    assert_eq!(tx.outputs.len(), 1);
    assert_eq!(tx.outputs[0].amount, 1000);
    assert_eq!(tx.outputs[0].address, "bob_address");
}

#[test]
fn test_transaction_json_roundtrip() {
    let tx = create_transfer("alice", "bob", 500, "prev_123", 2);
    
    let json = tx.to_json().unwrap();
    let tx2 = Transaction::from_json(&json).unwrap();
    
    assert_eq!(tx.txid, tx2.txid);
    assert_eq!(tx.inputs.len(), tx2.inputs.len());
    assert_eq!(tx.outputs.len(), tx2.outputs.len());
    assert_eq!(tx.outputs[0].amount, tx2.outputs[0].amount);
}

#[test]
fn test_transaction_with_multiple_outputs() {
    let inputs = vec![TxInput {
        prev_txid: "prev_tx_1".to_string(),
        output_index: 0,
        signature: String::new(),
    }];
    
    let outputs = vec![
        TxOutput {
            address: "recipient_1".to_string(),
            amount: 300,
        },
        TxOutput {
            address: "recipient_2".to_string(),
            amount: 700,
        },
    ];
    
    let tx = Transaction::new(inputs, outputs, 1234567890, None);
    
    assert_eq!(tx.total_outputs(), 1000);
    assert_eq!(tx.inputs.len(), 1);
    assert_eq!(tx.outputs.len(), 2);
}

#[test]
fn test_transaction_hash_consistency() {
    let tx1 = Transaction::new(
        vec![TxInput {
            prev_txid: "abc".to_string(),
            output_index: 0,
            signature: "sig1".to_string(),
        }],
        vec![TxOutput {
            address: "addr1".to_string(),
            amount: 100,
        }],
        1000000,
        None,
    );
    
    let hash1 = tx1.compute_hash();
    let hash2 = tx1.compute_hash();
    
    // Same transaction should produce same hash
    assert_eq!(hash1, hash2);
    assert_eq!(tx1.txid, hash1);
}

#[test]
fn test_transaction_signature() {
    let mut tx = create_transfer("alice", "bob", 250, "prev_xyz", 1);
    
    // Sign transaction
    let sig = tx.sign("secret_key_demo");
    assert!(!sig.is_empty());
    
    // In fallback mode, verify should pass if signature contains txid
    #[cfg(not(feature = "pqc"))]
    assert!(tx.verify("alice", &sig));
}
