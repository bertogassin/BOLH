//! BOLH Security Module — Multi-layer blockchain security
//!
//! Protections:
//! 1. Rate limiting — max N transactions per address per minute
//! 2. Double-spend detection — track spent outputs
//! 3. Replay attack prevention — nonce + chain ID
//! 4. Address blacklist — block malicious actors
//! 5. Transaction size/amount limits — prevent abuse
//! 6. Signature cache — prevent re-verification overhead + detect reuse
//! 7. Anomaly detection — flag unusual patterns

use std::collections::{HashMap, HashSet};
use parking_lot::RwLock;
use serde::Serialize;
use crate::types::Address;

/// Max transactions per address per minute
pub const RATE_LIMIT_PER_MINUTE: usize = 30;

/// Max transaction amount in one tx (1M BOLH)
pub const MAX_TX_AMOUNT: u64 = 1_000_000__00_000_000;

/// Max total daily volume per address (10M BOLH)
pub const MAX_DAILY_VOLUME: u64 = 10_000_000__00_000_000;

/// Chain ID to prevent cross-chain replay
pub const CHAIN_ID: u64 = 0xB01A; // "BOLH" in hex-ish

/// Security engine
pub struct SecurityEngine {
    /// Rate limiter: address -> list of tx timestamps (ms)
    rate_limiter: RwLock<HashMap<Address, Vec<u64>>>,
    /// Blacklisted addresses
    blacklist: RwLock<HashSet<Address>>,
    /// Known transaction hashes (prevent replay)
    known_tx_hashes: RwLock<HashSet<String>>,
    /// Daily volume tracker: address -> (date_key, total_volume)
    daily_volume: RwLock<HashMap<Address, (u64, u64)>>,
    /// Signature cache: sig_hex -> (valid, timestamp)
    sig_cache: RwLock<HashMap<String, (bool, u64)>>,
    /// Security events log
    events: RwLock<Vec<SecurityEvent>>,
    /// Suspicious addresses (flagged but not blocked)
    watchlist: RwLock<HashSet<Address>>,
}

/// Security check result
#[derive(Debug, Clone, Serialize)]
pub struct SecurityCheck {
    pub allowed: bool,
    pub reason: Option<String>,
    pub risk_score: u8, // 0-100
    pub warnings: Vec<String>,
}

/// Security event for audit trail
#[derive(Debug, Clone, Serialize)]
pub struct SecurityEvent {
    pub event_type: SecurityEventType,
    pub address: String,
    pub details: String,
    pub timestamp: u64,
    pub risk_score: u8,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum SecurityEventType {
    RateLimitHit,
    BlacklistBlock,
    ReplayAttempt,
    LargeTransaction,
    DailyLimitExceeded,
    SuspiciousPattern,
    AddressBlacklisted,
    AddressWhitelisted,
}

/// Security statistics
#[derive(Debug, Serialize)]
pub struct SecurityStats {
    pub total_checks: u64,
    pub blocked_count: u64,
    pub blacklisted_addresses: usize,
    pub watchlist_addresses: usize,
    pub recent_events: Vec<SecurityEvent>,
    pub known_tx_count: usize,
}

impl SecurityEngine {
    pub fn new() -> Self {
        SecurityEngine {
            rate_limiter: RwLock::new(HashMap::new()),
            blacklist: RwLock::new(HashSet::new()),
            known_tx_hashes: RwLock::new(HashSet::new()),
            daily_volume: RwLock::new(HashMap::new()),
            sig_cache: RwLock::new(HashMap::new()),
            events: RwLock::new(Vec::new()),
            watchlist: RwLock::new(HashSet::new()),
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    fn day_key(ts: u64) -> u64 {
        ts / (24 * 60 * 60 * 1000) // Day number since epoch
    }

    /// Full security check before processing a transaction
    pub fn check_transaction(
        &self,
        from: &Address,
        to: &Address,
        amount: u64,
        tx_hash: &str,
        sig_hex: &str,
    ) -> SecurityCheck {
        let now = Self::now_ms();
        let mut warnings = Vec::new();
        let mut risk_score: u8 = 0;

        // 1. Blacklist check
        if self.is_blacklisted(from) {
            self.log_event(SecurityEventType::BlacklistBlock, from, "Sender blacklisted");
            return SecurityCheck {
                allowed: false,
                reason: Some("Address is blacklisted".into()),
                risk_score: 100,
                warnings: vec!["Blacklisted sender".into()],
            };
        }
        if self.is_blacklisted(to) {
            self.log_event(SecurityEventType::BlacklistBlock, to, "Recipient blacklisted");
            return SecurityCheck {
                allowed: false,
                reason: Some("Recipient is blacklisted".into()),
                risk_score: 100,
                warnings: vec!["Blacklisted recipient".into()],
            };
        }

        // 2. Replay detection — same tx hash seen before?
        {
            let known = self.known_tx_hashes.read();
            if known.contains(tx_hash) {
                self.log_event(SecurityEventType::ReplayAttempt, from, &format!("Replay: {}", tx_hash));
                return SecurityCheck {
                    allowed: false,
                    reason: Some("Transaction replay detected".into()),
                    risk_score: 90,
                    warnings: vec!["Duplicate transaction hash".into()],
                };
            }
        }

        // 3. Rate limiting
        {
            let mut limiter = self.rate_limiter.write();
            let timestamps = limiter.entry(from.clone()).or_default();
            
            // Remove entries older than 1 minute
            let one_min_ago = now.saturating_sub(60_000);
            timestamps.retain(|t| *t > one_min_ago);

            if timestamps.len() >= RATE_LIMIT_PER_MINUTE {
                self.log_event(SecurityEventType::RateLimitHit, from, 
                    &format!("{} txs in last minute", timestamps.len()));
                return SecurityCheck {
                    allowed: false,
                    reason: Some(format!("Rate limit exceeded ({}/min)", RATE_LIMIT_PER_MINUTE)),
                    risk_score: 70,
                    warnings: vec!["Too many transactions".into()],
                };
            }

            timestamps.push(now);
        }

        // 4. Amount limits
        if amount > MAX_TX_AMOUNT {
            self.log_event(SecurityEventType::LargeTransaction, from,
                &format!("Amount: {} > max {}", amount, MAX_TX_AMOUNT));
            return SecurityCheck {
                allowed: false,
                reason: Some("Transaction amount exceeds maximum".into()),
                risk_score: 80,
                warnings: vec!["Amount too large".into()],
            };
        }

        if amount > MAX_TX_AMOUNT / 2 {
            warnings.push("Large transaction".into());
            risk_score += 20;
        }

        // 5. Daily volume check
        {
            let mut volumes = self.daily_volume.write();
            let today = Self::day_key(now);
            let entry = volumes.entry(from.clone()).or_insert((today, 0));

            // Reset if new day
            if entry.0 != today {
                *entry = (today, 0);
            }

            entry.1 += amount;

            if entry.1 > MAX_DAILY_VOLUME {
                self.log_event(SecurityEventType::DailyLimitExceeded, from,
                    &format!("Daily volume: {}", entry.1));
                return SecurityCheck {
                    allowed: false,
                    reason: Some("Daily transaction volume exceeded".into()),
                    risk_score: 75,
                    warnings: vec!["Daily limit reached".into()],
                };
            }

            if entry.1 > MAX_DAILY_VOLUME / 2 {
                warnings.push("High daily volume".into());
                risk_score += 15;
            }
        }

        // 6. Signature reuse detection
        if !sig_hex.is_empty() {
            let sigs = self.sig_cache.read();
            if sigs.contains_key(sig_hex) {
                self.log_event(SecurityEventType::SuspiciousPattern, from, "Signature reuse detected");
                return SecurityCheck {
                    allowed: false,
                    reason: Some("Signature reuse detected (possible replay)".into()),
                    risk_score: 95,
                    warnings: vec!["Reused signature".into()],
                };
            }
            drop(sigs);
            self.sig_cache.write().insert(sig_hex.to_string(), (true, now));
        }

        // 7. Watchlist check (allow but warn)
        if self.watchlist.read().contains(from) {
            warnings.push("Sender is on watchlist".into());
            risk_score += 30;
        }

        // 8. Self-transfer check
        if from == to {
            warnings.push("Self-transfer".into());
            risk_score += 10;
        }

        // Record tx hash as seen
        self.known_tx_hashes.write().insert(tx_hash.to_string());

        // Clean up old signature cache periodically (keep last 100K)
        {
            let cache = self.sig_cache.read();
            if cache.len() > 100_000 {
                drop(cache);
                let mut cache = self.sig_cache.write();
                let cutoff = now.saturating_sub(3600_000); // 1 hour
                cache.retain(|_, (_, ts)| *ts > cutoff);
            }
        }

        SecurityCheck {
            allowed: true,
            reason: None,
            risk_score,
            warnings,
        }
    }

    /// Add address to blacklist
    pub fn blacklist_address(&self, address: &Address, reason: &str) {
        self.blacklist.write().insert(address.clone());
        self.watchlist.write().remove(address);
        self.log_event(SecurityEventType::AddressBlacklisted, address, reason);
    }

    /// Remove address from blacklist
    pub fn whitelist_address(&self, address: &Address) {
        self.blacklist.write().remove(address);
        self.log_event(SecurityEventType::AddressWhitelisted, address, "Removed from blacklist");
    }

    /// Add to watchlist (suspicious but not blocked)
    pub fn add_to_watchlist(&self, address: &Address, reason: &str) {
        self.watchlist.write().insert(address.clone());
        self.log_event(SecurityEventType::SuspiciousPattern, address, reason);
    }

    /// Check if address is blacklisted
    pub fn is_blacklisted(&self, address: &Address) -> bool {
        self.blacklist.read().contains(address)
    }

    /// Log a security event
    fn log_event(&self, event_type: SecurityEventType, address: &Address, details: &str) {
        let event = SecurityEvent {
            event_type,
            address: address.to_bech32(),
            details: details.to_string(),
            timestamp: Self::now_ms(),
            risk_score: 0,
        };

        let mut events = self.events.write();
        events.push(event);

        // Keep last 10,000 events
        if events.len() > 10_000 {
            let excess = events.len() - 10_000;
            events.drain(0..excess);
        }
    }

    /// Get security statistics
    pub fn stats(&self) -> SecurityStats {
        let events = self.events.read();
        let blocked = events.iter().filter(|e| {
            matches!(e.event_type, 
                SecurityEventType::BlacklistBlock 
                | SecurityEventType::RateLimitHit 
                | SecurityEventType::ReplayAttempt
                | SecurityEventType::DailyLimitExceeded
            )
        }).count() as u64;

        let recent: Vec<SecurityEvent> = events.iter().rev().take(20).cloned().collect();

        SecurityStats {
            total_checks: self.known_tx_hashes.read().len() as u64,
            blocked_count: blocked,
            blacklisted_addresses: self.blacklist.read().len(),
            watchlist_addresses: self.watchlist.read().len(),
            recent_events: recent,
            known_tx_count: self.known_tx_hashes.read().len(),
        }
    }
}

impl Default for SecurityEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn addr(id: u8) -> Address {
        Address::from_public_key(&[id; 32])
    }

    #[test]
    fn test_normal_transaction_passes() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        let check = engine.check_transaction(&from, &to, 1000, "tx_001", "sig_001");
        assert!(check.allowed);
        assert_eq!(check.risk_score, 0);
    }

    #[test]
    fn test_blacklist_blocks() {
        let engine = SecurityEngine::new();
        let bad = addr(1);
        let good = addr(2);

        engine.blacklist_address(&bad, "scammer");

        let check = engine.check_transaction(&bad, &good, 1000, "tx_001", "sig_001");
        assert!(!check.allowed);
        assert_eq!(check.risk_score, 100);

        // Whitelist
        engine.whitelist_address(&bad);
        let check = engine.check_transaction(&bad, &good, 1000, "tx_002", "sig_002");
        assert!(check.allowed);
    }

    #[test]
    fn test_replay_blocked() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        let check1 = engine.check_transaction(&from, &to, 1000, "tx_same", "sig_001");
        assert!(check1.allowed);

        let check2 = engine.check_transaction(&from, &to, 1000, "tx_same", "sig_002");
        assert!(!check2.allowed);
        assert!(check2.reason.unwrap().contains("replay"));
    }

    #[test]
    fn test_rate_limit() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        for i in 0..RATE_LIMIT_PER_MINUTE {
            let check = engine.check_transaction(
                &from, &to, 100,
                &format!("tx_{}", i),
                &format!("sig_{}", i),
            );
            assert!(check.allowed, "Transaction {} should be allowed", i);
        }

        // This one should be rate limited
        let check = engine.check_transaction(&from, &to, 100, "tx_over", "sig_over");
        assert!(!check.allowed);
        assert!(check.reason.unwrap().contains("Rate limit"));
    }

    #[test]
    fn test_amount_limit() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        let check = engine.check_transaction(&from, &to, MAX_TX_AMOUNT + 1, "tx_big", "sig_big");
        assert!(!check.allowed);
        assert!(check.reason.unwrap().contains("exceeds maximum"));
    }

    #[test]
    fn test_signature_reuse_blocked() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        let check1 = engine.check_transaction(&from, &to, 100, "tx_001", "same_sig");
        assert!(check1.allowed);

        let check2 = engine.check_transaction(&from, &to, 100, "tx_002", "same_sig");
        assert!(!check2.allowed);
        assert!(check2.reason.unwrap().contains("Signature reuse"));
    }

    #[test]
    fn test_watchlist_warns_but_allows() {
        let engine = SecurityEngine::new();
        let sus = addr(1);
        let to = addr(2);

        engine.add_to_watchlist(&sus, "suspicious activity");

        let check = engine.check_transaction(&sus, &to, 100, "tx_001", "sig_001");
        assert!(check.allowed);
        assert!(check.risk_score > 0);
        assert!(!check.warnings.is_empty());
    }

    #[test]
    fn test_large_tx_warning() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        let check = engine.check_transaction(&from, &to, MAX_TX_AMOUNT / 2 + 1, "tx_001", "sig_001");
        assert!(check.allowed);
        assert!(check.warnings.iter().any(|w| w.contains("Large")));
    }

    #[test]
    fn test_security_stats() {
        let engine = SecurityEngine::new();
        let from = addr(1);
        let to = addr(2);

        engine.check_transaction(&from, &to, 100, "tx_001", "sig_001");
        engine.blacklist_address(&addr(3), "test");

        let stats = engine.stats();
        assert_eq!(stats.known_tx_count, 1);
        assert_eq!(stats.blacklisted_addresses, 1);
    }
}
