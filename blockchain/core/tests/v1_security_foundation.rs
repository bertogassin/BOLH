use bolh_core::chain::BolhChain;
use bolh_core::types::Address;

#[test]
fn v1_tx_pipeline_accepts_valid_tx() {
    let chain = BolhChain::new();

    let alice = chain.create_wallet("alice").unwrap();
    let bob = chain.create_wallet("bob").unwrap();

    let alice_addr = Address::from_bech32(&alice.address).unwrap();
    chain.award_mining_tokens(&alice_addr, 1_000__00_000_000).unwrap(); // 1000 BOLH

    let tx = chain.create_transfer("alice", &bob.address, 100__00_000_000).unwrap(); // 100 BOLH
    let res = chain.submit_transaction(tx);
    assert!(res.success, "tx rejected: {:?}", res.error);
}

#[test]
fn v1_replay_is_rejected_by_policy() {
    let chain = BolhChain::new();

    let alice = chain.create_wallet("alice").unwrap();
    let bob = chain.create_wallet("bob").unwrap();

    let alice_addr = Address::from_bech32(&alice.address).unwrap();
    chain.award_mining_tokens(&alice_addr, 1_000__00_000_000).unwrap();

    // Replay test: submit the exact same signed tx twice.
    let tx = chain.create_transfer("alice", &bob.address, 1__00_000_000).unwrap();

    // Submit once — OK
    let r1 = chain.submit_transaction(tx.clone());
    assert!(r1.success, "first submission failed: {:?}", r1.error);

    // Submit again — should be blocked by replay detection (SecurityEngine).
    let r2 = chain.submit_transaction(tx);
    assert!(!r2.success, "replay must be rejected");
    let msg = r2.error.unwrap_or_default().to_lowercase();
    assert!(msg.contains("replay") || msg.contains("duplicate"), "unexpected error: {}", msg);
}

