//! Transaction mempool — holds unconfirmed transactions

use std::collections::{BTreeMap, HashMap};
use std::time::{Duration, Instant};
use crate::types::{Address, Hash, Transaction};

/// Rate limit info per address
#[derive(Debug)]
struct RateLimit {
    count: usize,
    window_start: Instant,
}

/// Transaction pool ordered by fee (highest first)
pub struct Mempool {
    /// Transactions indexed by hash
    txs: HashMap<Hash, Transaction>,
    /// Ordered by fee for block production
    by_fee: BTreeMap<std::cmp::Reverse<u64>, Vec<Hash>>,
    /// Maximum pool size
    max_size: usize,
    /// Per-address transaction count
    addr_counts: HashMap<Address, usize>,
    /// Rate limiting per address
    rate_limits: HashMap<Address, RateLimit>,
    /// Max transactions per address in pool
    max_per_address: usize,
    /// Rate limit: max txs per time window
    rate_limit_count: usize,
    /// Rate limit time window
    rate_limit_window: Duration,
}

impl Mempool {
    pub fn new(max_size: usize) -> Self {
        Mempool {
            txs: HashMap::new(),
            by_fee: BTreeMap::new(),
            max_size,
            addr_counts: HashMap::new(),
            rate_limits: HashMap::new(),
            max_per_address: 50, // Max 50 txs per address
            rate_limit_count: 10, // Max 10 txs per window
            rate_limit_window: Duration::from_secs(60), // 1 minute
        }
    }

    /// Check rate limit for address
    fn check_rate_limit(&mut self, addr: &Address) -> Result<(), String> {
        let now = Instant::now();
        
        let should_reset = if let Some(limit) = self.rate_limits.get(addr) {
            now.duration_since(limit.window_start) > self.rate_limit_window
        } else {
            false
        };

        if should_reset {
            self.rate_limits.insert(
                addr.clone(),
                RateLimit {
                    count: 1,
                    window_start: now,
                },
            );
            return Ok(());
        }

        let limit = self.rate_limits.entry(addr.clone()).or_insert(RateLimit {
            count: 0,
            window_start: now,
        });

        if limit.count >= self.rate_limit_count {
            return Err(format!(
                "Rate limit exceeded: {} txs in {}s",
                self.rate_limit_count,
                self.rate_limit_window.as_secs()
            ));
        }

        limit.count += 1;
        Ok(())
    }

    /// Add transaction to pool
    pub fn add(&mut self, tx: Transaction) -> Result<(), String> {
        if self.txs.len() >= self.max_size {
            return Err("Mempool full".into());
        }

        if !tx.is_valid_format() {
            return Err("Invalid transaction format".into());
        }

        // Check rate limit
        self.check_rate_limit(&tx.from)?;

        // Check per-address limit
        let addr_count = self.addr_counts.get(&tx.from).unwrap_or(&0);
        if *addr_count >= self.max_per_address {
            return Err(format!(
                "Address has too many pending transactions: {}",
                addr_count
            ));
        }

        let hash = tx.compute_hash();
        if self.txs.contains_key(&hash) {
            return Err("Transaction already in pool".into());
        }

        // Update address count
        *self.addr_counts.entry(tx.from.clone()).or_insert(0) += 1;

        self.by_fee
            .entry(std::cmp::Reverse(tx.fee))
            .or_default()
            .push(hash);
        self.txs.insert(hash, tx);

        Ok(())
    }

    /// Remove transaction from pool
    pub fn remove(&mut self, hash: &Hash) -> Option<Transaction> {
        if let Some(tx) = self.txs.remove(hash) {
            // Decrement address count
            if let Some(count) = self.addr_counts.get_mut(&tx.from) {
                *count = count.saturating_sub(1);
                if *count == 0 {
                    self.addr_counts.remove(&tx.from);
                }
            }

            if let Some(hashes) = self.by_fee.get_mut(&std::cmp::Reverse(tx.fee)) {
                hashes.retain(|h| h != hash);
                if hashes.is_empty() {
                    self.by_fee.remove(&std::cmp::Reverse(tx.fee));
                }
            }
            Some(tx)
        } else {
            None
        }
    }

    /// Get top N transactions by fee for block production
    pub fn top(&self, n: usize) -> Vec<&Transaction> {
        let mut result = Vec::with_capacity(n);
        for (_fee, hashes) in &self.by_fee {
            for hash in hashes {
                if result.len() >= n {
                    return result;
                }
                if let Some(tx) = self.txs.get(hash) {
                    result.push(tx);
                }
            }
        }
        result
    }

    /// Current pool size
    pub fn len(&self) -> usize {
        self.txs.len()
    }

    /// Is pool empty
    pub fn is_empty(&self) -> bool {
        self.txs.is_empty()
    }
}
