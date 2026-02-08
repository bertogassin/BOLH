use std::sync::{Mutex, OnceLock};
use crate::transaction::Transaction;

static MEMPOOL: OnceLock<Mutex<Vec<Transaction>>> = OnceLock::new();

fn pool() -> &'static Mutex<Vec<Transaction>> {
    MEMPOOL.get_or_init(|| Mutex::new(Vec::new()))
}

/// Submit a transaction to the mempool
pub fn submit_tx(tx: Transaction) -> usize {
    let mut p = pool().lock().unwrap();
    p.push(tx);
    p.len()
}

/// Submit from JSON string
pub fn submit_tx_json(tx_json: &str) -> Result<usize, String> {
    let tx = Transaction::from_json(tx_json)
        .map_err(|e| format!("Invalid transaction JSON: {}", e))?;
    Ok(submit_tx(tx))
}

pub fn size() -> usize {
    let p = pool().lock().unwrap();
    p.len()
}

pub fn drain_all() -> Vec<Transaction> {
    let mut p = pool().lock().unwrap();
    let drained = p.drain(..).collect::<Vec<_>>();
    drained
}

/// Get all transactions as JSON array
pub fn get_all_json() -> String {
    let p = pool().lock().unwrap();
    let txs: Vec<String> = p.iter()
        .filter_map(|tx| tx.to_json().ok())
        .collect();
    format!("[{}]", txs.join(","))
}
