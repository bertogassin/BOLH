use bolh_core::types::*;
use bolh_core::storage::{BlockStore, StateStore};
use bolh_core::mempool::Mempool;
use bolh_core::consensus;
use bolh_core::metrics::Metrics;
use bolh_core::*;
use std::time::Duration;

#[test]
fn test_address_from_public_key() {
    let pubkey = vec![1u8; 32];
    let addr = Address::from_public_key(&pubkey);
    assert!(!addr.is_zero());

    let bech32 = addr.to_bech32();
    assert!(bech32.starts_with("bolh1"));
    assert_eq!(bech32.len(), 45); // "bolh1" + 40 hex chars

    let parsed = Address::from_bech32(&bech32).unwrap();
    assert_eq!(addr, parsed);
}

#[test]
fn test_zero_address() {
    let zero = Address::zero();
    assert!(zero.is_zero());
    assert_eq!(zero.to_bech32(), "bolh10000000000000000000000000000000000000000");
}

#[test]
fn test_account_balance() {
    let mut account = Account::with_balance(1_000_000);
    assert_eq!(account.available_balance(), 1_000_000);

    account.staked = 400_000;
    assert_eq!(account.available_balance(), 600_000);

    account.staked = 2_000_000; // More than balance
    assert_eq!(account.available_balance(), 0); // saturating_sub
}

#[test]
fn test_transaction_hash() {
    let tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::zero(),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: 1234567890,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };

    let hash1 = tx.compute_hash();
    let hash2 = tx.compute_hash();
    assert_eq!(hash1, hash2); // Deterministic
    assert_ne!(hash1, [0u8; 32]); // Non-zero
}

#[test]
fn test_transaction_validity() {
    let valid_tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::zero(),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: 1234567890,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(valid_tx.is_valid_format());

    // Fee too low
    let low_fee_tx = Transaction {
        fee: 0,
        ..valid_tx.clone()
    };
    assert!(!low_fee_tx.is_valid_format());

    // System tx with zero fee is ok
    let system_tx = Transaction {
        tx_type: TxType::System,
        fee: 0,
        signature: Vec::new(),
        ..valid_tx.clone()
    };
    assert!(system_tx.is_valid_format());
}

#[test]
fn test_genesis_block() {
    let genesis = Block::genesis([0u8; 32]);
    assert_eq!(genesis.header.height, 0);
    assert_eq!(genesis.header.prev_hash, [0u8; 32]);
    assert!(genesis.transactions.is_empty());
    assert!(genesis.is_valid_structure());
}

#[test]
fn test_block_creation() {
    let validator = Address::from_public_key(&[1u8; 32]);
    let block = Block::new(1, [0u8; 32], validator, Vec::new(), [0u8; 32]);
    assert_eq!(block.header.height, 1);
    assert_eq!(block.header.tx_count, 0);
    assert!(block.is_valid_structure());
}

#[test]
fn test_block_store() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("blocks");
    let store = BlockStore::new(p.to_str().unwrap()).unwrap();

    let genesis = Block::genesis([0u8; 32]);
    store.put_block(&genesis).unwrap();

    let loaded = store.get_block(0).unwrap();
    assert_eq!(loaded.header.height, 0);
    assert_eq!(store.get_height(), 0);
}

#[test]
fn test_state_store() {
    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("state");
    let store = StateStore::new(p.to_str().unwrap()).unwrap();

    let addr = Address::from_public_key(&[42u8; 32]);

    // New account should be empty
    let account = store.get_account(&addr).unwrap();
    assert_eq!(account.balance, 0);

    // Store account with balance
    let mut account = Account::with_balance(1_000_000);
    account.referral_code = Some("REF123".to_string());
    store.put_account(&addr, &account).unwrap();

    // Load it back
    let loaded = store.get_account(&addr).unwrap();
    assert_eq!(loaded.balance, 1_000_000);
    assert_eq!(loaded.referral_code, Some("REF123".to_string()));
}

#[test]
fn test_mempool() {
    let mut pool = Mempool::new(1000);
    assert!(pool.is_empty());

    let tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::zero(),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: 5_000,
        nonce: 1,
        timestamp: 1234567890,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };

    pool.add(tx).unwrap();
    assert_eq!(pool.len(), 1);

    let top = pool.top(10);
    assert_eq!(top.len(), 1);
}

#[test]
fn test_distribution_constants() {
    use bolh_core::distribution::*;

    // Sum should equal total supply
    assert_eq!(
        MINING_POOL + REFERRAL_POOL + ADVERTISING_POOL + RESERVE_POOL,
        TOTAL_SUPPLY
    );

    // Referral tiers
    assert_eq!(referral::reward_for_user(1), referral::TIER1_REWARD);
    assert_eq!(referral::reward_for_user(1_000), referral::TIER1_REWARD);
    assert_eq!(referral::reward_for_user(1_001), referral::TIER2_REWARD);
    assert_eq!(referral::reward_for_user(10_000), referral::TIER2_REWARD);
    assert_eq!(referral::reward_for_user(10_001), referral::TIER3_REWARD);
    assert_eq!(referral::reward_for_user(100_001), referral::TIER4_REWARD);
}

#[test]
fn test_validator_selection() {
    let validators = vec![
        consensus::ValidatorInfo {
            address: Address::from_public_key(&[1u8; 32]),
            stake: 100_000,
            is_active: true,
            blocks_produced: 0,
            last_block_height: 0,
            slash_count: 0,
            jailed_until: None,
        },
        consensus::ValidatorInfo {
            address: Address::from_public_key(&[2u8; 32]),
            stake: 200_000,
            is_active: true,
            blocks_produced: 0,
            last_block_height: 0,
            slash_count: 0,
            jailed_until: None,
        },
    ];

    let selected = consensus::select_validator(&validators, 1);
    assert!(selected.is_some());
}

#[test]
fn test_block_validation() {
    let genesis = Block::genesis([0u8; 32]);
    let validator = Address::from_public_key(&[1u8; 32]);
    let block1 = Block::new(1, genesis.hash, validator, Vec::new(), [0u8; 32]);

    let result = consensus::validate_block(&block1, &genesis);
    assert!(result.is_ok());

    // Wrong height
    let bad_block = Block::new(5, genesis.hash, Address::zero(), Vec::new(), [0u8; 32]);
    let result = consensus::validate_block(&bad_block, &genesis);
    assert!(result.is_err());
}

#[test]
fn test_transaction_size_limits() {
    let mut tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::from_public_key(&[1u8; 32]),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 1312], // Dilithium pubkey size
        signature: vec![0u8; 2420],  // Dilithium signature size
        hash: [0u8; 32],
    };
    assert!(tx.is_valid_format());

    // Data too large
    tx.data = vec![0u8; Transaction::MAX_DATA_SIZE + 1];
    assert!(!tx.is_valid_format());

    // Signature too large
    tx.data = Vec::new();
    tx.signature = vec![0u8; Transaction::DILITHIUM_SIG_LENGTH * 3];
    assert!(!tx.is_valid_format());
}

#[test]
fn test_transaction_timestamp_validation() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let mut tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::from_public_key(&[1u8; 32]),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: now,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(tx.is_valid_format());
    assert!(tx.is_timely(now));

    // Far future timestamp
    tx.timestamp = now + Transaction::MAX_FUTURE_OFFSET_MS + 1000;
    assert!(!tx.is_valid_format());
    assert!(!tx.is_timely(now));

    // Old timestamp (1 hour + 1 second ago)
    tx.timestamp = now - 3600_001;
    assert!(!tx.is_timely(now));
}

#[test]
fn test_transaction_amount_validation() {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Zero amount transfer should fail
    let zero_tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::from_public_key(&[1u8; 32]),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 0,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: now,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(!zero_tx.is_valid_format());

    // Self-transfer should fail (except staking)
    let self_tx = Transaction {
        tx_type: TxType::Transfer,
        from: Address::from_public_key(&[1u8; 32]),
        to: Address::from_public_key(&[1u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 1,
        timestamp: now,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(!self_tx.is_valid_format());

    // Self-staking should be allowed
    let stake_tx = Transaction {
        tx_type: TxType::Stake,
        from: Address::from_public_key(&[1u8; 32]),
        to: Address::from_public_key(&[1u8; 32]),
        amount: 10_000__00_000_000, // 10,000 BOLH
        fee: MIN_FEE,
        nonce: 1,
        timestamp: now,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(stake_tx.is_valid_format());
}

#[test]
fn test_fixed_supply_enforcement() {
    // Verify total supply constant is immutable
    assert_eq!(TOTAL_SUPPLY, 10_000_000_000__00_000_000);
    
    // Verify distribution pools sum to total supply
    let total_distributed = distribution::MINING_POOL 
        + distribution::REFERRAL_POOL 
        + distribution::ADVERTISING_POOL 
        + distribution::RESERVE_POOL;
    assert_eq!(total_distributed, TOTAL_SUPPLY);
}

#[test]
fn test_consensus_config_validation() {
    let config = consensus::ConsensusConfig::default();
    assert!(config.validate().is_ok());

    // Invalid min_stake
    let bad_config = consensus::ConsensusConfig {
        min_stake: 0,
        ..config.clone()
    };
    assert!(bad_config.validate().is_err());

    // Invalid finality_threshold
    let bad_config = consensus::ConsensusConfig {
        finality_threshold: 0.5, // Too low
        ..config.clone()
    };
    assert!(bad_config.validate().is_err());

    let bad_config = consensus::ConsensusConfig {
        finality_threshold: 0.95, // Too high
        ..config
    };
    assert!(bad_config.validate().is_err());
}

#[test]
fn test_slashing_double_sign() {
    let mut validator = consensus::ValidatorInfo {
        address: Address::from_public_key(&[1u8; 32]),
        stake: 100_000__00_000_000, // 100,000 BOLH
        is_active: true,
        blocks_produced: 10,
        last_block_height: 100,
        slash_count: 0,
        jailed_until: None,
    };

    let config = consensus::ConsensusConfig::default();
    let event = consensus::slash_validator(
        &mut validator,
        consensus::SlashingReason::DoubleSign,
        &config,
        100,
    );

    // Should slash 5% of stake
    assert_eq!(event.slash_amount, 5_000__00_000_000); // 5,000 BOLH
    assert_eq!(validator.stake, 95_000__00_000_000); // 95,000 BOLH remaining
    assert_eq!(validator.slash_count, 1);
    assert!(!validator.is_active);
    assert!(validator.jailed_until.is_some());
}

#[test]
fn test_slashing_downtime() {
    let mut validator = consensus::ValidatorInfo {
        address: Address::from_public_key(&[1u8; 32]),
        stake: 50_000__00_000_000,
        is_active: true,
        blocks_produced: 5,
        last_block_height: 50,
        slash_count: 0,
        jailed_until: None,
    };

    let config = consensus::ConsensusConfig::default();
    let event = consensus::slash_validator(
        &mut validator,
        consensus::SlashingReason::Downtime,
        &config,
        100,
    );

    // Should slash 1% of stake
    assert_eq!(event.slash_amount, 500__00_000_000); // 500 BOLH
    assert_eq!(validator.stake, 49_500__00_000_000);
}

#[test]
fn test_unjail_validator() {
    let validator = consensus::ValidatorInfo {
        address: Address::from_public_key(&[1u8; 32]),
        stake: 15_000__00_000_000,
        is_active: false,
        blocks_produced: 0,
        last_block_height: 0,
        slash_count: 1,
        jailed_until: Some(1000),
    };

    // Cannot unjail before jail period ends
    assert!(!consensus::can_unjail(&validator, 500));
    
    // Can unjail after jail period if stake is sufficient
    assert!(consensus::can_unjail(&validator, 1000));

    // Cannot unjail if stake too low
    let low_stake_validator = consensus::ValidatorInfo {
        stake: 5_000__00_000_000, // Below minimum
        jailed_until: Some(1000),
        ..validator.clone()
    };
    assert!(!consensus::can_unjail(&low_stake_validator, 1000));
}

#[test]
fn test_double_sign_detection() {
    let validator = Address::from_public_key(&[1u8; 32]);
    let block_signatures = vec![
        (100, validator.clone()),
        (100, validator.clone()), // Double sign!
        (101, validator.clone()),
    ];

    assert!(consensus::detect_double_sign(&validator, 100, &block_signatures));
    assert!(!consensus::detect_double_sign(&validator, 101, &block_signatures));
}

#[test]
fn test_mempool_rate_limiting() {
    let mut mempool = Mempool::new(1000);
    let addr = Address::from_public_key(&[1u8; 32]);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    // Add 10 transactions (should succeed)
    for i in 0..10 {
        let tx = Transaction {
            tx_type: TxType::Transfer,
            from: addr.clone(),
            to: Address::from_public_key(&[2u8; 32]),
            amount: 100_000,
            fee: MIN_FEE,
            nonce: i + 1,
            timestamp: now,
            privacy: PrivacyLevel::Transparent,
            data: Vec::new(),
            public_key: vec![1u8; 32],
            signature: vec![0u8; 64],
            hash: [0u8; 32],
        };
        assert!(mempool.add(tx).is_ok());
    }

    // 11th transaction should fail (rate limit)
    let tx = Transaction {
        tx_type: TxType::Transfer,
        from: addr.clone(),
        to: Address::from_public_key(&[2u8; 32]),
        amount: 100_000,
        fee: MIN_FEE,
        nonce: 11,
        timestamp: now,
        privacy: PrivacyLevel::Transparent,
        data: Vec::new(),
        public_key: vec![1u8; 32],
        signature: vec![0u8; 64],
        hash: [0u8; 32],
    };
    assert!(mempool.add(tx).is_err());
}

#[test]
fn test_metrics_tps_calculation() {
    let mut metrics = Metrics::new();

    // Record some transactions
    metrics.record_txs(100);
    std::thread::sleep(std::time::Duration::from_millis(100));
    metrics.record_txs(200);

    let tps = metrics.current_tps();
    assert!(tps > 0.0);

    let summary = metrics.summary();
    assert_eq!(summary.total_txs, 300);
}

#[test]
fn test_metrics_block_tracking() {
    let mut metrics = Metrics::new();
    let validator = Address::from_public_key(&[1u8; 32]);

    // Record block production
    metrics.record_block(1, &validator, Duration::from_millis(500), 50);
    metrics.record_block(2, &validator, Duration::from_millis(600), 75);

    let summary = metrics.summary();
    assert_eq!(summary.total_blocks, 2);
    assert_eq!(summary.total_txs, 125); // 50 + 75
    assert!(summary.avg_block_time_ms > 0);

    let stats = metrics.validator_stats(&validator).unwrap();
    assert_eq!(stats.blocks_produced, 2);
    assert_eq!(stats.last_block_height, 2);
}

#[test]
fn test_metrics_validator_ranking() {
    let mut metrics = Metrics::new();
    let v1 = Address::from_public_key(&[1u8; 32]);
    let v2 = Address::from_public_key(&[2u8; 32]);

    metrics.record_block(1, &v1, Duration::from_millis(500), 10);
    metrics.record_block(2, &v1, Duration::from_millis(500), 10);
    metrics.record_block(3, &v2, Duration::from_millis(500), 10);

    let top = metrics.top_validators(2);
    assert_eq!(top.len(), 2);
    assert_eq!(top[0].0, &v1); // v1 should be first (2 blocks)
    assert_eq!(top[0].1.blocks_produced, 2);
}
