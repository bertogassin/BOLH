use bolh_core::{mempool, transaction};

#[test]
fn mempool_basic() {
    // ensure clean state
    let drained = mempool::drain_all();
    assert!(drained.is_empty());
    assert_eq!(mempool::size(), 0);

    // Create a test transaction
    let tx = transaction::create_transfer("alice", "bob", 100, "prev_tx_1", 0);
    let s = mempool::submit_tx(tx);
    assert_eq!(s, 1);
    assert_eq!(mempool::size(), 1);

    let drained2 = mempool::drain_all();
    assert_eq!(drained2.len(), 1);
    assert_eq!(mempool::size(), 0);
}

#[test]
fn mempool_json_submit() {
    // Clean state
    let _ = mempool::drain_all();
    
    // Create transaction and convert to JSON
    let tx = transaction::create_transfer("alice", "bob", 500, "prev_tx_2", 1);
    let tx_json = tx.to_json().unwrap();
    
    // Submit via JSON
    let result = mempool::submit_tx_json(&tx_json);
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), 1);
    
    // Clean up
    let _ = mempool::drain_all();
}
