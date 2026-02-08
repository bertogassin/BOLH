use bolh_core::utxo;

#[test]
fn test_genesis_init() {
    utxo::reset();
    
    let accounts = vec![
        ("alice".to_string(), 10000),
        ("bob".to_string(), 5000),
        ("charlie".to_string(), 2500),
    ];
    
    let result = utxo::init_genesis(accounts);
    assert!(result.is_ok());
    
    assert_eq!(utxo::get_balance("alice"), 10000);
    assert_eq!(utxo::get_balance("bob"), 5000);
    assert_eq!(utxo::get_balance("charlie"), 2500);
}

#[test]
fn test_simple_transfer() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // Alice transfers 100 to Bob
    let result = utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![
            ("bob".to_string(), 100),
            ("alice".to_string(), 900), // change back to alice
        ],
    );
    
    assert!(result.is_ok());
    assert_eq!(utxo::get_balance("alice"), 900);
    assert_eq!(utxo::get_balance("bob"), 100);
}

#[test]
fn test_insufficient_funds_error() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 500)]).unwrap();
    
    // Try to send more than available
    let result = utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![("bob".to_string(), 1000)],
    );
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Insufficient"));
}

#[test]
fn test_double_spend_prevention() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // First transaction spending genesis output
    let tx1_result = utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![("bob".to_string(), 500)],
    );
    assert!(tx1_result.is_ok());
    
    // Second transaction trying to spend same genesis output
    let tx2_result = utxo::process_tx(
        "tx2".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![("charlie".to_string(), 500)],
    );
    assert!(tx2_result.is_err());
    assert!(tx2_result.unwrap_err().contains("already spent"));
}

#[test]
fn test_chain_of_transactions() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // TX1: Alice sends 700 to Bob, change 300
    let tx1 = utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![
            ("bob".to_string(), 700),
            ("alice".to_string(), 300),
        ],
    );
    assert!(tx1.is_ok());
    
    // TX2: Bob sends 200 from tx1 to Charlie
    let tx2 = utxo::process_tx(
        "tx2".to_string(),
        vec![("tx1".to_string(), 0)],
        vec![
            ("charlie".to_string(), 200),
            ("bob".to_string(), 500),
        ],
    );
    assert!(tx2.is_ok());
    
    assert_eq!(utxo::get_balance("alice"), 300);
    assert_eq!(utxo::get_balance("bob"), 500);
    assert_eq!(utxo::get_balance("charlie"), 200);
}

#[test]
fn test_multiple_inputs() {
    utxo::reset();
    utxo::init_genesis(vec![
        ("alice".to_string(), 300),
        ("alice".to_string(), 200),
        ("alice".to_string(), 500),
    ])
    .unwrap();
    
    // Alice spends all 3 genesis outputs (total 1000)
    let result = utxo::process_tx(
        "tx1".to_string(),
        vec![
            ("genesis_tx".to_string(), 0),
            ("genesis_tx".to_string(), 1),
            ("genesis_tx".to_string(), 2),
        ],
        vec![("bob".to_string(), 1000)],
    );
    
    assert!(result.is_ok());
    assert_eq!(utxo::get_balance("alice"), 0);
    assert_eq!(utxo::get_balance("bob"), 1000);
}

#[test]
fn test_multiple_outputs() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // Alice distributes to multiple recipients
    let result = utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![
            ("bob".to_string(), 300),
            ("charlie".to_string(), 400),
            ("dave".to_string(), 300),
        ],
    );
    
    assert!(result.is_ok());
    assert_eq!(utxo::get_balance("bob"), 300);
    assert_eq!(utxo::get_balance("charlie"), 400);
    assert_eq!(utxo::get_balance("dave"), 300);
}

#[test]
fn test_utxo_retrieval() {
    utxo::reset();
    utxo::init_genesis(vec![
        ("alice".to_string(), 500),
        ("alice".to_string(), 300),
    ])
    .unwrap();
    
    let alice_utxos = utxo::get_utxos("alice");
    assert_eq!(alice_utxos.len(), 2);
    
    let total = alice_utxos.iter().map(|u| u.amount).sum::<u64>();
    assert_eq!(total, 800);
}

#[test]
fn test_nonexistent_input() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // Try to spend non-existent UTXO
    let result = utxo::process_tx(
        "tx1".to_string(),
        vec![("nonexistent_tx".to_string(), 0)],
        vec![("bob".to_string(), 100)],
    );
    
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("not found"));
}

#[test]
fn test_utxo_availability_check() {
    utxo::reset();
    utxo::init_genesis(vec![("alice".to_string(), 1000)]).unwrap();
    
    // Genesis output should be available
    assert!(utxo::utxo_available("genesis_tx", 0));
    
    // Spend it
    utxo::process_tx(
        "tx1".to_string(),
        vec![("genesis_tx".to_string(), 0)],
        vec![("bob".to_string(), 1000)],
    )
    .unwrap();
    
    // Now genesis output should not be available
    assert!(!utxo::utxo_available("genesis_tx", 0));
}
