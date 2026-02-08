use bolh_core::crypto;

#[test]
fn demo_key_and_sign() {
    let (pk, sk) = crypto::generate_keypair();
    assert!(pk.starts_with("BOLH_DEMO_PUBKEY") || pk.len() > 0);
    let sig = crypto::sign("hello", &sk);
    assert!(!sig.is_empty());
    assert!(crypto::verify("hello", &pk, &sig));
}
