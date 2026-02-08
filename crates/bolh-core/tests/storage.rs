use bolh_core::storage;

#[test]
fn storage_block_roundtrip() {
    let block_id = "block_test_001";
    let block_data = r#"{"txs":["tx1","tx2"]}"#;
    
    assert!(storage::save_block(block_id, block_data).is_ok());
    let loaded = storage::get_block(block_id).unwrap();
    assert!(loaded.is_some());
    assert_eq!(loaded.unwrap(), block_data);
}

#[test]
fn storage_balance() {
    let addr = "test_addr_001";
    assert!(storage::set_balance(addr, 5000).is_ok());
    let bal = storage::get_balance(addr).unwrap();
    assert_eq!(bal, 5000);
}

#[test]
fn storage_tx_roundtrip() {
    let txid = "tx_test_001";
    let tx_data = r#"{"from":"A","to":"B","amount":100}"#;
    
    assert!(storage::save_tx(txid, tx_data).is_ok());
    let loaded = storage::get_tx(txid).unwrap();
    assert!(loaded.is_some());
    assert_eq!(loaded.unwrap(), tx_data);
}
