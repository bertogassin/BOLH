//! BOLH Referral Program
//!
//! Fair referral system with on-chain rewards — equal for everyone.
//!
//! How it works:
//! 1. Each user gets a unique referral code on registration
//! 2. When a new user registers with a code, BOTH get the same reward
//! 3. Rewards come from the Referral Pool (20% of total supply = 2B BOLH)
//! 4. Rewards decrease as more users join (4 tiers)
//! 5. No hidden fees or commissions — 100% of reward goes to both parties
//!
//! Anti-fraud:
//! - One referral code per account
//! - Can't refer yourself
//! - Each account can only be referred once
//! - Referral code must exist to be used
//! - Daily referral limit per inviter (prevents bot farms)
//!
//! Pool distribution (2,000,000,000 BOLH):
//!   Tier 1 (first 1K users):    10,000 BOLH each × 2 × 1,000 = 20M BOLH
//!   Tier 2 (1K-10K users):       2,500 BOLH each × 2 × 9,000 = 45M BOLH
//!   Tier 3 (10K-100K users):     1,000 BOLH each × 2 × 90,000 = 180M BOLH
//!   Tier 4 (100K+ users):          500 BOLH each × 2 × unlimited
//!   Total reserved for direct rewards: ~245M BOLH (12% of pool)
//!   Remaining: future campaigns and community rewards

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use crate::types::Address;
use crate::distribution;

/// Max referrals per inviter per day (anti-bot)
pub const MAX_DAILY_REFERRALS: u64 = 50;

/// A referral record
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReferralRecord {
    /// Who invited
    pub inviter: String,
    /// Who was invited
    pub invitee: String,
    /// Referral code used
    pub code: String,
    /// Reward amount (per person) — same for both inviter and invitee
    pub reward: u64,
    /// Timestamp
    pub timestamp: u64,
    /// User count at time of referral (determines tier)
    pub user_count_at_time: u64,
    /// Tier applied
    pub tier: u8,
}

/// Referral code info
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReferralCode {
    /// The code itself
    pub code: String,
    /// Owner address
    pub owner: String,
    /// How many times used
    pub times_used: u64,
    /// Total rewards generated
    pub total_rewards_generated: u64,
    /// Created at
    pub created_at: u64,
    /// Is active
    pub active: bool,
}

/// Referral program statistics
#[derive(Debug, Serialize)]
pub struct ReferralStats {
    pub total_referrals: u64,
    pub total_rewards_distributed: u64,
    pub pool_remaining: u64,
    pub pool_total: u64,
    pub pool_used_percent: f64,
    pub current_tier: u8,
    pub current_reward_per_person: u64,
    pub total_codes_created: u64,
    pub top_referrers: Vec<TopReferrer>,
}

/// Top referrer info
#[derive(Debug, Serialize, Clone)]
pub struct TopReferrer {
    pub address: String,
    pub code: String,
    pub referral_count: u64,
    pub total_earned: u64,
}

/// Result of processing a referral
#[derive(Debug, Serialize)]
pub struct ReferralResult {
    pub success: bool,
    pub inviter_reward: u64,
    pub invitee_reward: u64,
    pub tier: u8,
    pub message: String,
}

/// Referral engine
pub struct ReferralEngine {
    /// Referral codes: code -> ReferralCode
    codes: RwLock<HashMap<String, ReferralCode>>,
    /// Address -> their referral code
    address_to_code: RwLock<HashMap<String, String>>,
    /// Who referred whom: invitee_address -> inviter_address
    referred_by: RwLock<HashMap<String, String>>,
    /// Daily referral counter: (address, day_key) -> count
    daily_counter: RwLock<HashMap<(String, u64), u64>>,
    /// All referral records (history)
    history: RwLock<Vec<ReferralRecord>>,
    /// Pool balance tracker
    pool_used: RwLock<u64>,
    /// Total referrals processed
    total_referrals: RwLock<u64>,
}

impl ReferralEngine {
    pub fn new() -> Self {
        ReferralEngine {
            codes: RwLock::new(HashMap::new()),
            address_to_code: RwLock::new(HashMap::new()),
            referred_by: RwLock::new(HashMap::new()),
            daily_counter: RwLock::new(HashMap::new()),
            history: RwLock::new(Vec::new()),
            pool_used: RwLock::new(0),
            total_referrals: RwLock::new(0),
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    fn day_key(ts: u64) -> u64 {
        ts / (24 * 60 * 60 * 1000)
    }

    /// Generate a unique referral code for an address
    pub fn generate_code(&self, address: &Address) -> Result<String, String> {
        let addr_str = address.to_bech32();

        // Check if already has a code
        let existing = self.address_to_code.read();
        if let Some(code) = existing.get(&addr_str) {
            return Ok(code.clone());
        }
        drop(existing);

        // Generate code: first 8 chars of SHA3(address + timestamp)
        let now = Self::now_ms();
        let mut hasher = Sha3_256::new();
        hasher.update(addr_str.as_bytes());
        hasher.update(now.to_le_bytes());
        let hash = hasher.finalize();
        let code = format!("BOLH-{}", &hex::encode(&hash[..4]).to_uppercase());

        let referral_code = ReferralCode {
            code: code.clone(),
            owner: addr_str.clone(),
            times_used: 0,
            total_rewards_generated: 0,
            created_at: now,
            active: true,
        };

        self.codes.write().insert(code.clone(), referral_code);
        self.address_to_code.write().insert(addr_str, code.clone());

        Ok(code)
    }

    /// Process a referral: new user signs up with a code
    /// Both inviter and invitee get the SAME reward — fair and simple.
    pub fn process_referral(
        &self,
        invitee_address: &Address,
        referral_code: &str,
        user_count: u64,
    ) -> ReferralResult {
        let now = Self::now_ms();
        let invitee_str = invitee_address.to_bech32();

        // Validate: invitee not already referred
        if self.referred_by.read().contains_key(&invitee_str) {
            return ReferralResult {
                success: false,
                inviter_reward: 0,
                invitee_reward: 0,
                tier: 0,
                message: "Account already referred".into(),
            };
        }

        // Validate: code exists and is active
        let mut codes = self.codes.write();
        let Some(code_info) = codes.get_mut(referral_code) else {
            return ReferralResult {
                success: false,
                inviter_reward: 0,
                invitee_reward: 0,
                tier: 0,
                message: "Invalid referral code".into(),
            };
        };

        if !code_info.active {
            return ReferralResult {
                success: false,
                inviter_reward: 0,
                invitee_reward: 0,
                tier: 0,
                message: "Referral code is deactivated".into(),
            };
        }

        let inviter_str = code_info.owner.clone();

        // Can't refer yourself
        if inviter_str == invitee_str {
            return ReferralResult {
                success: false,
                inviter_reward: 0,
                invitee_reward: 0,
                tier: 0,
                message: "Cannot refer yourself".into(),
            };
        }

        // Daily limit check
        let today = Self::day_key(now);
        {
            let counter = self.daily_counter.read();
            let count = counter.get(&(inviter_str.clone(), today)).copied().unwrap_or(0);
            if count >= MAX_DAILY_REFERRALS {
                return ReferralResult {
                    success: false,
                    inviter_reward: 0,
                    invitee_reward: 0,
                    tier: 0,
                    message: format!("Daily referral limit reached ({}/day)", MAX_DAILY_REFERRALS),
                };
            }
        }

        // Calculate reward based on tier
        let reward = distribution::referral::reward_for_user(user_count);
        let tier = if user_count <= 1_000 { 1 }
            else if user_count <= 10_000 { 2 }
            else if user_count <= 100_000 { 3 }
            else { 4 };

        // Check pool has enough — both get the same, no hidden fees
        let total_needed = reward * 2; // inviter + invitee (equal)
        let pool_used = *self.pool_used.read();
        if pool_used + total_needed > distribution::REFERRAL_POOL {
            return ReferralResult {
                success: false,
                inviter_reward: 0,
                invitee_reward: 0,
                tier,
                message: "Referral pool exhausted".into(),
            };
        }

        // All checks passed — execute (fair distribution, no commissions)

        // Update code usage
        code_info.times_used += 1;
        code_info.total_rewards_generated += total_needed;
        drop(codes);

        // Record referral relationship
        self.referred_by.write().insert(invitee_str.clone(), inviter_str.clone());

        // Update daily counter
        *self.daily_counter.write().entry((inviter_str.clone(), today)).or_insert(0) += 1;

        // Update pool usage
        *self.pool_used.write() += total_needed;

        // Update total referrals
        *self.total_referrals.write() += 1;

        // Record history
        let record = ReferralRecord {
            inviter: inviter_str,
            invitee: invitee_str,
            code: referral_code.to_string(),
            reward,
            timestamp: now,
            user_count_at_time: user_count,
            tier,
        };
        self.history.write().push(record);

        ReferralResult {
            success: true,
            inviter_reward: reward,
            invitee_reward: reward,
            tier,
            message: format!(
                "Referral successful! Tier {} — {} BOLH each (equal for both)",
                tier,
                reward / 100_000_000
            ),
        }
    }

    /// Get referral code for an address
    pub fn get_code(&self, address: &Address) -> Option<String> {
        self.address_to_code.read().get(&address.to_bech32()).cloned()
    }

    /// Get referral code info
    pub fn get_code_info(&self, code: &str) -> Option<ReferralCode> {
        self.codes.read().get(code).cloned()
    }

    /// Get who referred this address
    pub fn get_inviter(&self, address: &Address) -> Option<String> {
        self.referred_by.read().get(&address.to_bech32()).cloned()
    }

    /// Get all referrals made by an address
    pub fn get_referrals_by(&self, address: &Address) -> Vec<ReferralRecord> {
        let addr_str = address.to_bech32();
        self.history.read()
            .iter()
            .filter(|r| r.inviter == addr_str)
            .cloned()
            .collect()
    }

    /// Get referral count for an address
    pub fn get_referral_count(&self, address: &Address) -> u64 {
        let addr_str = address.to_bech32();
        self.history.read()
            .iter()
            .filter(|r| r.inviter == addr_str)
            .count() as u64
    }

    /// Get total earned through referrals
    pub fn get_total_earned(&self, address: &Address) -> u64 {
        let addr_str = address.to_bech32();
        let history = self.history.read();

        let as_inviter: u64 = history.iter()
            .filter(|r| r.inviter == addr_str)
            .map(|r| r.reward)
            .sum();

        let as_invitee: u64 = history.iter()
            .filter(|r| r.invitee == addr_str)
            .map(|r| r.reward)
            .sum();

        as_inviter + as_invitee
    }

    /// Deactivate a referral code (e.g., for abuse)
    pub fn deactivate_code(&self, code: &str) -> bool {
        let mut codes = self.codes.write();
        if let Some(info) = codes.get_mut(code) {
            info.active = false;
            true
        } else {
            false
        }
    }

    /// Get program statistics
    pub fn stats(&self, user_count: u64) -> ReferralStats {
        let pool_used = *self.pool_used.read();
        let pool_total = distribution::REFERRAL_POOL;
        let current_reward = distribution::referral::reward_for_user(user_count);
        let current_tier = if user_count <= 1_000 { 1 }
            else if user_count <= 10_000 { 2 }
            else if user_count <= 100_000 { 3 }
            else { 4 };

        // Top referrers
        let history = self.history.read();
        let codes = self.codes.read();
        let mut referrer_stats: HashMap<String, (u64, u64)> = HashMap::new();

        for record in history.iter() {
            let entry = referrer_stats.entry(record.inviter.clone()).or_default();
            entry.0 += 1; // count
            entry.1 += record.reward; // earned
        }

        let mut top: Vec<TopReferrer> = referrer_stats.iter().map(|(addr, (count, earned))| {
            let code = codes.values()
                .find(|c| c.owner == *addr)
                .map(|c| c.code.clone())
                .unwrap_or_default();
            TopReferrer {
                address: addr.clone(),
                code,
                referral_count: *count,
                total_earned: *earned,
            }
        }).collect();

        top.sort_by(|a, b| b.referral_count.cmp(&a.referral_count));
        top.truncate(10);

        ReferralStats {
            total_referrals: *self.total_referrals.read(),
            total_rewards_distributed: pool_used,
            pool_remaining: pool_total.saturating_sub(pool_used),
            pool_total,
            pool_used_percent: if pool_total > 0 {
                (pool_used as f64 / pool_total as f64) * 100.0
            } else { 0.0 },
            current_tier,
            current_reward_per_person: current_reward,
            total_codes_created: codes.len() as u64,
            top_referrers: top,
        }
    }
}

impl Default for ReferralEngine {
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
    fn test_generate_code() {
        let engine = ReferralEngine::new();
        let alice = addr(1);

        let code = engine.generate_code(&alice).unwrap();
        assert!(code.starts_with("BOLH-"));
        assert_eq!(code.len(), 13); // "BOLH-" + 8 hex chars

        // Same address returns same code
        let code2 = engine.generate_code(&alice).unwrap();
        assert_eq!(code, code2);
    }

    #[test]
    fn test_basic_referral() {
        let engine = ReferralEngine::new();
        let alice = addr(1);
        let bob = addr(2);

        let code = engine.generate_code(&alice).unwrap();
        let result = engine.process_referral(&bob, &code, 500); // Tier 1

        assert!(result.success);
        assert_eq!(result.tier, 1);
        assert_eq!(result.inviter_reward, 10_000__00_000_000); // 10,000 BOLH
        assert_eq!(result.invitee_reward, 10_000__00_000_000);
    }

    #[test]
    fn test_cant_refer_self() {
        let engine = ReferralEngine::new();
        let alice = addr(1);

        let code = engine.generate_code(&alice).unwrap();
        let result = engine.process_referral(&alice, &code, 100);

        assert!(!result.success);
        assert!(result.message.contains("yourself"));
    }

    #[test]
    fn test_cant_be_referred_twice() {
        let engine = ReferralEngine::new();
        let alice = addr(1);
        let bob = addr(2);
        let charlie = addr(3);

        let code_alice = engine.generate_code(&alice).unwrap();
        let code_charlie = engine.generate_code(&charlie).unwrap();

        // Bob gets referred by Alice
        let r1 = engine.process_referral(&bob, &code_alice, 100);
        assert!(r1.success);

        // Bob tries to use Charlie's code too
        let r2 = engine.process_referral(&bob, &code_charlie, 101);
        assert!(!r2.success);
        assert!(r2.message.contains("already referred"));
    }

    #[test]
    fn test_invalid_code() {
        let engine = ReferralEngine::new();
        let bob = addr(2);

        let result = engine.process_referral(&bob, "FAKE-CODE", 100);
        assert!(!result.success);
        assert!(result.message.contains("Invalid"));
    }

    #[test]
    fn test_tier_progression() {
        let engine = ReferralEngine::new();

        // Tier 1
        let a1 = addr(1);
        let b1 = addr(10);
        let code1 = engine.generate_code(&a1).unwrap();
        let r1 = engine.process_referral(&b1, &code1, 500);
        assert_eq!(r1.tier, 1);
        assert_eq!(r1.inviter_reward, 10_000__00_000_000);

        // Tier 2
        let a2 = addr(2);
        let b2 = addr(20);
        let code2 = engine.generate_code(&a2).unwrap();
        let r2 = engine.process_referral(&b2, &code2, 5_000);
        assert_eq!(r2.tier, 2);
        assert_eq!(r2.inviter_reward, 2_500__00_000_000);

        // Tier 3
        let a3 = addr(3);
        let b3 = addr(30);
        let code3 = engine.generate_code(&a3).unwrap();
        let r3 = engine.process_referral(&b3, &code3, 50_000);
        assert_eq!(r3.tier, 3);
        assert_eq!(r3.inviter_reward, 1_000__00_000_000);

        // Tier 4
        let a4 = addr(4);
        let b4 = addr(40);
        let code4 = engine.generate_code(&a4).unwrap();
        let r4 = engine.process_referral(&b4, &code4, 200_000);
        assert_eq!(r4.tier, 4);
        assert_eq!(r4.inviter_reward, 500__00_000_000);
    }

    #[test]
    fn test_fair_rewards_no_commission() {
        let engine = ReferralEngine::new();
        let grandpa = addr(1);
        let parent = addr(2);
        let child = addr(3);

        // Grandpa invites Parent
        let code_g = engine.generate_code(&grandpa).unwrap();
        let r1 = engine.process_referral(&parent, &code_g, 100);
        assert!(r1.success);
        assert_eq!(r1.inviter_reward, r1.invitee_reward); // Equal!

        // Parent invites Child — NO commission taken, fair for everyone
        let code_p = engine.generate_code(&parent).unwrap();
        let r2 = engine.process_referral(&child, &code_p, 101);
        assert!(r2.success);
        assert_eq!(r2.inviter_reward, r2.invitee_reward); // Equal!
        // No hidden fees — grandpa gets nothing from this transaction
    }

    #[test]
    fn test_chain_of_referrals() {
        let engine = ReferralEngine::new();
        
        // Create a chain: A invites B, B invites C, C invites D
        let a = addr(1);
        let b = addr(2);
        let c = addr(3);
        let d = addr(4);

        let code_a = engine.generate_code(&a).unwrap();
        let r1 = engine.process_referral(&b, &code_a, 100);
        assert!(r1.success);

        let code_b = engine.generate_code(&b).unwrap();
        let r2 = engine.process_referral(&c, &code_b, 101);
        assert!(r2.success);

        let code_c = engine.generate_code(&c).unwrap();
        let r3 = engine.process_referral(&d, &code_c, 102);
        assert!(r3.success);

        // Each person earned fairly — only from their own referrals
        assert_eq!(engine.get_referral_count(&a), 1);
        assert_eq!(engine.get_referral_count(&b), 1);
        assert_eq!(engine.get_referral_count(&c), 1);
        assert_eq!(engine.get_referral_count(&d), 0);
    }

    #[test]
    fn test_referral_count_and_earnings() {
        let engine = ReferralEngine::new();
        let alice = addr(1);
        let bob = addr(2);
        let charlie = addr(3);

        let code = engine.generate_code(&alice).unwrap();
        engine.process_referral(&bob, &code, 100);
        engine.process_referral(&charlie, &code, 101);

        assert_eq!(engine.get_referral_count(&alice), 2);
        assert!(engine.get_total_earned(&alice) > 0);
    }

    #[test]
    fn test_deactivate_code() {
        let engine = ReferralEngine::new();
        let alice = addr(1);
        let bob = addr(2);

        let code = engine.generate_code(&alice).unwrap();
        engine.deactivate_code(&code);

        let result = engine.process_referral(&bob, &code, 100);
        assert!(!result.success);
        assert!(result.message.contains("deactivated"));
    }

    #[test]
    fn test_stats() {
        let engine = ReferralEngine::new();
        let alice = addr(1);
        let bob = addr(2);

        let code = engine.generate_code(&alice).unwrap();
        engine.process_referral(&bob, &code, 100);

        let stats = engine.stats(100);
        assert_eq!(stats.total_referrals, 1);
        assert!(stats.total_rewards_distributed > 0);
        assert!(stats.pool_remaining < stats.pool_total);
        assert_eq!(stats.current_tier, 1);
        assert_eq!(stats.top_referrers.len(), 1);
    }
}
