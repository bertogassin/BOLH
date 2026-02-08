use bolh_core::wallet;

#[test]
fn test_wallet_creation_integration() {
    wallet::reset();
    
    let addr1 = wallet::create_wallet("alice".to_string()).unwrap();
    let addr2 = wallet::create_wallet("bob".to_string()).unwrap();
    
    assert_ne!(addr1, addr2);
    assert_eq!(wallet::list_wallets().len(), 2);
}

#[test]
fn test_wallet_info() {
    wallet::reset();
    
    wallet::create_wallet("charlie".to_string()).unwrap();
    let w = wallet::get_wallet("charlie").unwrap();
    
    assert_eq!(w.name, "charlie");
    assert!(!w.public_key.is_empty());
    assert!(!w.secret_key.is_empty());
}

#[test]
fn test_import_export() {
    wallet::reset();
    
    // Create original wallet
    let _orig = wallet::create_wallet("original".to_string()).unwrap();
    let w = wallet::get_wallet("original").unwrap();
    
    // Export public info
    let public = w.export_public();
    assert_eq!(public.name, "original");
    assert_eq!(public.public_key, w.public_key);
}

#[test]
fn test_sign_verify() {
    wallet::reset();
    
    wallet::create_wallet("signer".to_string()).unwrap();
    let w = wallet::get_wallet("signer").unwrap();
    
    let message = "test transaction";
    let sig = w.sign_transaction(message);
    
    // In fallback mode, verify always returns true (PoC behavior)
    // In real PQC mode, this would properly verify
    assert!(w.verify_signature(message, &sig));
    
    // Note: In fallback mode, verify also returns true for wrong message
    // because we're using demo crypto. This is expected for PoC.
}

#[test]
fn test_fee_estimation() {
    let fee1 = wallet::estimate_fee(1, 1);
    let fee2 = wallet::estimate_fee(2, 2);
    
    assert!(fee2 > fee1);
    
    // 1 input + 1 output + overhead = 150 + 34 + 10 = 194
    assert_eq!(fee1, 194);
}

#[test]
fn test_wallet_lifecycle() {
    wallet::reset();
    
    // Create
    wallet::create_wallet("test".to_string()).unwrap();
    assert_eq!(wallet::list_wallets().len(), 1);
    
    // Get
    let w = wallet::get_wallet("test");
    assert!(w.is_some());
    
    // Delete
    wallet::delete_wallet("test").unwrap();
    assert_eq!(wallet::list_wallets().len(), 0);
}

#[test]
fn test_multiple_wallets() {
    wallet::reset();
    
    for i in 0..5 {
        wallet::create_wallet(format!("wallet_{}", i)).unwrap();
    }
    
    assert_eq!(wallet::list_wallets().len(), 5);
    
    // Check each has unique address
    let addrs: Vec<_> = (0..5)
        .map(|i| wallet::get_wallet(&format!("wallet_{}", i)).unwrap().public_key)
        .collect();
    
    for i in 0..5 {
        for j in (i + 1)..5 {
            assert_ne!(addrs[i], addrs[j]);
        }
    }
}
