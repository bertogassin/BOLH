//! State Transition Engine (V2 foundation)
//!
//! Single source of truth for mutating chain state.
//! All execution paths must use this engine:
//! - block production apply
//! - synced block apply
//! - recovery replay
//!
//! This is critical for determinism and crash-safe recovery.

use std::collections::HashMap;

use crate::types::{Account, Address, Transaction, TxType};

pub struct StateTransitionEngine;

impl StateTransitionEngine {
    pub fn execute_transaction(
        accounts: &mut HashMap<Address, Account>,
        tx: &Transaction,
    ) -> Result<(), String> {
        match tx.tx_type {
            TxType::Transfer => Self::execute_transfer(accounts, tx),
            TxType::Stake => Self::execute_stake(accounts, tx),
            TxType::Unstake => Self::execute_unstake(accounts, tx),
            // Reward/system txs are protocol-authored; v2 will formalize these.
            _ => Ok(()),
        }
    }

    fn fee_collector() -> Address {
        // Fees are credited to the mining pool to preserve fixed supply.
        Address::from_public_key(b"bolh_mining_pool")
    }

    fn execute_transfer(
        accounts: &mut HashMap<Address, Account>,
        tx: &Transaction,
    ) -> Result<(), String> {
        if tx.from == tx.to {
            return Err("Self-transfer not allowed".into());
        }

        let total_cost = tx.amount.saturating_add(tx.fee);

        // Sender checks + debit
        {
            let sender = accounts.entry(tx.from.clone()).or_insert_with(Account::new);
            if tx.nonce != sender.nonce + 1 {
                return Err(format!("Invalid nonce: expected {}, got {}", sender.nonce + 1, tx.nonce));
            }
            if sender.available_balance() < total_cost {
                return Err("Insufficient balance".into());
            }

            sender.balance = sender.balance.saturating_sub(total_cost);
            sender.nonce += 1;
        }

        // Receiver credit
        {
            let receiver = accounts.entry(tx.to.clone()).or_insert_with(Account::new);
            receiver.balance = receiver.balance.saturating_add(tx.amount);
        }

        // Fee credit
        if tx.fee > 0 {
            let fee_addr = Self::fee_collector();
            let fee_acct = accounts.entry(fee_addr).or_insert_with(Account::new);
            fee_acct.balance = fee_acct.balance.saturating_add(tx.fee);
        }

        Ok(())
    }

    fn execute_stake(
        accounts: &mut HashMap<Address, Account>,
        tx: &Transaction,
    ) -> Result<(), String> {
        // Convention: stake is self-tx.
        if tx.from != tx.to {
            return Err("Stake tx must be self-transfer".into());
        }

        let total_cost = tx.amount.saturating_add(tx.fee);
        {
            let acc = accounts.entry(tx.from.clone()).or_insert_with(Account::new);
            if tx.nonce != acc.nonce + 1 {
                return Err(format!("Invalid nonce: expected {}, got {}", acc.nonce + 1, tx.nonce));
            }
            if acc.available_balance() < total_cost {
                return Err("Insufficient balance".into());
            }
            acc.balance = acc.balance.saturating_sub(total_cost);
            acc.staked = acc.staked.saturating_add(tx.amount);
            acc.is_validator = true;
            acc.nonce += 1;
        }

        // Fee credit
        if tx.fee > 0 {
            let fee_addr = Self::fee_collector();
            let fee_acct = accounts.entry(fee_addr).or_insert_with(Account::new);
            fee_acct.balance = fee_acct.balance.saturating_add(tx.fee);
        }

        Ok(())
    }

    fn execute_unstake(
        accounts: &mut HashMap<Address, Account>,
        tx: &Transaction,
    ) -> Result<(), String> {
        // Convention: unstake is self-tx; tx.amount is the amount to unstake.
        if tx.from != tx.to {
            return Err("Unstake tx must be self-transfer".into());
        }

        {
            let acc = accounts.entry(tx.from.clone()).or_insert_with(Account::new);
            if tx.nonce != acc.nonce + 1 {
                return Err(format!("Invalid nonce: expected {}, got {}", acc.nonce + 1, tx.nonce));
            }
            if acc.staked < tx.amount {
                return Err("Insufficient staked balance".into());
            }
            // Fee is paid from liquid balance.
            if acc.available_balance() < tx.fee {
                return Err("Insufficient balance for fee".into());
            }

            acc.staked = acc.staked.saturating_sub(tx.amount);
            acc.balance = acc.balance.saturating_add(tx.amount);
            acc.balance = acc.balance.saturating_sub(tx.fee);
            acc.nonce += 1;

            if acc.staked == 0 {
                acc.is_validator = false;
            }
        }

        // Fee credit
        if tx.fee > 0 {
            let fee_addr = Self::fee_collector();
            let fee_acct = accounts.entry(fee_addr).or_insert_with(Account::new);
            fee_acct.balance = fee_acct.balance.saturating_add(tx.fee);
        }

        Ok(())
    }
}

