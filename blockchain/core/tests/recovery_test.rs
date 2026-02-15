use std::sync::Mutex;

use bolh_core::chain::BolhChain;
use bolh_core::persistence::PersistenceManager;
use bolh_core::storage::append_log;
use bolh_core::types::Address;

static ENV_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_recovery_from_log_rebuilds_height() {
    // Serialize env var mutations (tests run in parallel by default).
    let _g = ENV_LOCK.lock().unwrap();

    let dir = tempfile::tempdir().unwrap();
    std::env::set_var("BOLH_DATA_DIR", dir.path().to_string_lossy().to_string());
    std::env::set_var("BOLH_ALLOW_FRESH_CHAIN_ON_RESTORE_FAILURE", "1");

    // Build chain and produce a block (this appends blocks.log).
    let chain = BolhChain::new();
    let alice = chain.create_wallet("alice").unwrap();
    let bob = chain.create_wallet("bob").unwrap();

    let alice_addr = Address::from_bech32(&alice.address).unwrap();
    chain.award_mining_tokens(&alice_addr, 1_000__00_000_000).unwrap();

    // Persist a snapshot BEFORE producing the next block.
    // This simulates a crash-safe model: snapshot at height 0, then log has height 1.
    let pm = PersistenceManager::new(dir.path());
    pm.save(&chain).unwrap();

    let tx = chain.create_transfer("alice", &bob.address, 100__00_000_000).unwrap();
    let res = chain.submit_transaction(tx);
    assert!(res.success, "tx failed: {:?}", res.error);

    let _block = chain.produce_block("alice").unwrap();
    assert_eq!(chain.height(), 1);

    // Recover from snapshot + replay blocks.log.
    let snapshot = pm.load().unwrap();
    let recovered = BolhChain::from_snapshot(snapshot).unwrap();
    let log_path = append_log::blocks_log_path(&PersistenceManager::default_dir());
    recovered.recover_from_log(&log_path).unwrap();

    assert_eq!(recovered.height(), 1);
}

