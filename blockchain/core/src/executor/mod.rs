//! Parallel transaction executor
//! Uses rayon for parallel execution of independent transactions

use crate::types::{Account, Address, Transaction, TxType};
use crate::storage::StateStore;
use std::collections::HashMap;

/// Transaction execution result
#[derive(Debug)]
pub enum ExecResult {
    Success,
    InsufficientBalance,
    InvalidNonce,
    InvalidSignature,
    Error(String),
}

/// Execute a batch of transactions, updating state
pub fn execute_batch(
    txs: &[Transaction],
    state: &StateStore,
) -> Vec<(usize, ExecResult)> {
    // For now, sequential execution (parallel requires conflict detection)
    let mut results = Vec::with_capacity(txs.len());
    let mut cache: HashMap<Address, Account> = HashMap::new();

    for (i, tx) in txs.iter().enumerate() {
        let result = execute_single(tx, state, &mut cache);
        results.push((i, result));
    }

    // Flush cache to state store
    for (addr, account) in &cache {
        let _ = state.put_account(addr, account);
    }

    results
}

/// Execute a single transaction
fn execute_single(
    tx: &Transaction,
    state: &StateStore,
    cache: &mut HashMap<Address, Account>,
) -> ExecResult {
    // Validate transaction format first
    if !tx.is_valid_format() {
        return ExecResult::Error("Invalid transaction format".into());
    }

    // Verify signature (structural check for now)
    if !tx.verify_signature() {
        return ExecResult::InvalidSignature;
    }

    // Get sender account (from cache or storage)
    let sender = cache
        .entry(tx.from.clone())
        .or_insert_with(|| state.get_account(&tx.from).unwrap_or_default());

    // System and mining txs skip balance/nonce checks
    match tx.tx_type {
        TxType::System | TxType::MiningReward | TxType::ReferralReward => {
            // Fixed supply: minting is only allowed from the zero address.
            if !tx.from.is_zero() {
                return ExecResult::Error("System/reward tx must originate from zero address".into());
            }
            // Credit receiver
            let receiver = cache
                .entry(tx.to.clone())
                .or_insert_with(|| state.get_account(&tx.to).unwrap_or_default());
            receiver.balance = receiver.balance.saturating_add(tx.amount);
            return ExecResult::Success;
        }
        _ => {}
    }

    // Check nonce
    if tx.nonce != sender.nonce + 1 {
        return ExecResult::InvalidNonce;
    }

    // Check balance (amount + fee)
    let total_cost = tx.amount.saturating_add(tx.fee);
    if sender.available_balance() < total_cost {
        return ExecResult::InsufficientBalance;
    }

    // Debit sender
    sender.balance = sender.balance.saturating_sub(total_cost);
    sender.nonce += 1;

    // Handle staking
    if tx.tx_type == TxType::Stake {
        sender.staked = sender.staked.saturating_add(tx.amount);
        sender.is_validator = true;
        return ExecResult::Success;
    }

    if tx.tx_type == TxType::Unstake {
        sender.staked = sender.staked.saturating_sub(tx.amount);
        sender.balance = sender.balance.saturating_add(tx.amount);
        if sender.staked == 0 {
            sender.is_validator = false;
        }
        return ExecResult::Success;
    }

    // Credit receiver
    let receiver = cache
        .entry(tx.to.clone())
        .or_insert_with(|| state.get_account(&tx.to).unwrap_or_default());
    receiver.balance = receiver.balance.saturating_add(tx.amount);

    ExecResult::Success
}
