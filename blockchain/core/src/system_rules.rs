//! BOLH System Rules — Universal cancellation law, penalties, and fairness engine
//!
//! ADMIN & AUTOMATION ONLY — internal logic, never exposed to users.
//! Users see only clean messages: "Заказ отменён" or "Удержано: X BOLH".
//! All thresholds, timers, counters, and ban logic are invisible to the user.
//!
//! These rules apply to EVERY order on the platform:
//! delivery, masters, guards, cleaning — everyone.
//!
//! Internal rules (admin/system knowledge):
//! 1. Grace period (90 sec) + monthly/lifetime limits
//! 2. Late cancel (5+ min) — one free pass ever, then penalties
//! 3. Penalty rates: 30% person / 20% business
//! 4. Auto-ban thresholds: 10 (person) / 15 (business)
//! 5. Before acceptance: always free

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

/// Grace period after accepting an order (seconds)
pub const GRACE_PERIOD_SECS: u64 = 90;

/// Time after which cancellation is "late" (seconds)
pub const LATE_CANCEL_SECS: u64 = 300; // 5 minutes

/// Max free early cancellations per month
pub const MAX_FREE_EARLY_PER_MONTH: u32 = 2;

/// Max free early cancellations lifetime
pub const MAX_FREE_EARLY_LIFETIME: u32 = 10;

/// Number of lifetime free late cancellations (ONE for everyone)
pub const FREE_LATE_CANCEL_LIFETIME: u32 = 1;

/// Penalty rate for late cancellations (person) — basis points
pub const LATE_PENALTY_PERSON_BPS: u64 = 3000; // 30%

/// Penalty rate for late cancellations (business) — basis points
pub const LATE_PENALTY_BUSINESS_BPS: u64 = 2000; // 20%

/// Penalty rate for early cancellations after free limit — basis points
pub const EARLY_PENALTY_BPS: u64 = 1000; // 10%

/// Max paid cancellations before ban (person)
pub const MAX_PAID_CANCELS_PERSON: u32 = 10;

/// Max paid cancellations before ban (business)
pub const MAX_PAID_CANCELS_BUSINESS: u32 = 15;

/// Compensation from reserve for the ONE free late cancel — basis points of order
pub const RESERVE_COMPENSATION_BPS: u64 = 1000; // 10%

/// No-response timeout: order auto-reassigned (seconds)
pub const NO_RESPONSE_TIMEOUT_SECS: u64 = 1800; // 30 min

/// Order expires if no one accepts (seconds)
pub const ORDER_EXPIRY_SECS: u64 = 7200; // 2 hours

/// Minimum order price (in raw BOLH with 8 decimals)
pub const MINIMUM_ORDER_PRICE: u64 = 10_00_000_000; // 10 BOLH

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

/// User type — affects penalty rates and limits
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum UserType {
    /// Regular individual
    Person,
    /// Business (restaurant, store, etc.)
    Business,
}

/// Cancellation stage
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum CancelStage {
    /// Order not yet accepted by anyone → free
    BeforeAcceptance,
    /// Within 90 seconds of acceptance → early
    EarlyGrace,
    /// After 5+ minutes → late (serious)
    Late,
}

/// Preview shown BEFORE user confirms cancellation (step 1)
/// User taps "Cancel" → sees this → taps "Confirm" → actual cancel happens
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CancelPreview {
    /// Can the user cancel?
    pub can_cancel: bool,
    /// Will there be a penalty?
    pub will_have_penalty: bool,
    /// Penalty amount that will be charged (in raw BOLH)
    pub penalty_amount: u64,
    /// Confirmation message shown to user (the "are you sure?" screen)
    pub confirm_message: String,
    /// Warning about what happens NEXT time (shown after cancel is done)
    pub next_time_warning: String,
}

/// Result of a cancellation (step 2 — after user confirmed)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CancelResult {
    /// Whether the cancellation was allowed
    pub allowed: bool,
    /// Whether a penalty was charged
    pub penalty_charged: bool,
    /// Penalty amount (in raw BOLH)
    pub penalty_amount: u64,
    /// Compensation to the other party (from penalty or reserve)
    pub compensation_amount: u64,

    // ─── USER-FACING (clean, no internal details) ───
    /// Short result message shown to the user
    pub user_message: String,
    /// Warning about next time (shown after the result)
    pub next_time_warning: String,

    // ─── ADMIN / INTERNAL ONLY (never shown to user) ───
    /// Source of compensation (admin only)
    pub compensation_source: String,
    /// Detailed admin log message with all internal info
    pub admin_log: String,
    /// Whether user is now banned
    pub user_banned: bool,
    /// Remaining free early cancels this month (admin only)
    pub remaining_free_early: u32,
    /// Remaining paid cancels before ban (admin only)
    pub remaining_before_ban: u32,
    /// Cancel stage (admin only)
    pub stage: CancelStage,
}

/// User's cancellation record
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserCancelRecord {
    /// User type
    pub user_type: UserType,
    /// Early cancels this month (within 90 sec)
    pub early_cancels_this_month: u32,
    /// Early cancels lifetime
    pub early_cancels_lifetime: u32,
    /// Late cancels that were free (should be 0 or 1)
    pub free_late_cancels_used: u32,
    /// Paid late cancels lifetime
    pub paid_late_cancels: u32,
    /// Paid early cancels (after free limit exhausted)
    pub paid_early_cancels: u32,
    /// Total penalties paid (in raw BOLH)
    pub total_penalties_paid: u64,
    /// Is user currently banned
    pub is_banned: bool,
    /// Ban reason (if any)
    pub ban_reason: Option<String>,
    /// Month counter for resetting monthly limits (YYYYMM)
    pub current_month: u32,
    /// Full cancellation history
    pub history: Vec<CancelEvent>,
}

/// A single cancellation event
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CancelEvent {
    /// Order ID
    pub order_id: String,
    /// Timestamp
    pub timestamp: u64,
    /// Stage of cancellation
    pub stage: CancelStage,
    /// Was it free or paid
    pub was_free: bool,
    /// Penalty amount (0 if free)
    pub penalty: u64,
    /// Order amount
    pub order_amount: u64,
    /// Seconds elapsed since acceptance
    pub elapsed_secs: u64,
}

// ═══════════════════════════════════════════════════════
// RULES ENGINE
// ═══════════════════════════════════════════════════════

/// The system rules engine — manages cancellation law for all users
pub struct SystemRules {
    /// Cancel records by user ID
    records: RwLock<HashMap<String, UserCancelRecord>>,
    /// Total penalties collected
    total_penalties: RwLock<u64>,
    /// Total compensations paid from reserve
    total_reserve_compensations: RwLock<u64>,
    /// Total cancellations processed
    total_cancellations: RwLock<u64>,
    /// Total bans issued
    total_bans: RwLock<u64>,
}

impl SystemRules {
    pub fn new() -> Self {
        SystemRules {
            records: RwLock::new(HashMap::new()),
            total_penalties: RwLock::new(0),
            total_reserve_compensations: RwLock::new(0),
            total_cancellations: RwLock::new(0),
            total_bans: RwLock::new(0),
        }
    }

    /// Get or create a user's cancel record
    fn get_or_create_record(&self, user_id: &str, user_type: UserType) -> UserCancelRecord {
        let records = self.records.read();
        if let Some(record) = records.get(user_id) {
            return record.clone();
        }
        drop(records);

        let current_month = current_month_code();
        UserCancelRecord {
            user_type,
            early_cancels_this_month: 0,
            early_cancels_lifetime: 0,
            free_late_cancels_used: 0,
            paid_late_cancels: 0,
            paid_early_cancels: 0,
            total_penalties_paid: 0,
            is_banned: false,
            ban_reason: None,
            current_month,
            history: Vec::new(),
        }
    }

    /// Process a cancellation request — THE CORE LAW
    pub fn process_cancellation(
        &self,
        user_id: &str,
        user_type: UserType,
        order_id: &str,
        order_amount: u64,
        stage: CancelStage,
        elapsed_secs: u64,
    ) -> CancelResult {
        let mut record = self.get_or_create_record(user_id, user_type.clone());

        // Reset monthly counter if new month
        let month = current_month_code();
        if record.current_month != month {
            record.current_month = month;
            record.early_cancels_this_month = 0;
        }

        // Check if banned
        if record.is_banned {
            return CancelResult {
                allowed: false,
                penalty_charged: false,
                penalty_amount: 0,
                compensation_amount: 0,
                user_message: "Отмена невозможна. Обратитесь в поддержку.".into(),
                next_time_warning: String::new(),
                compensation_source: String::new(),
                admin_log: format!("BLOCKED: user {} is banned. Reason: {:?}", user_id, record.ban_reason),
                user_banned: true,
                remaining_free_early: 0,
                remaining_before_ban: 0,
                stage: stage.clone(),
            };
        }

        let (penalty_bps, max_paid) = match &user_type {
            UserType::Person => (LATE_PENALTY_PERSON_BPS, MAX_PAID_CANCELS_PERSON),
            UserType::Business => (LATE_PENALTY_BUSINESS_BPS, MAX_PAID_CANCELS_BUSINESS),
        };

        let total_paid = record.paid_late_cancels + record.paid_early_cancels;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let result = match stage {
            // ─── BEFORE ACCEPTANCE: always free ───
            CancelStage::BeforeAcceptance => {
                record.history.push(CancelEvent {
                    order_id: order_id.into(),
                    timestamp: now,
                    stage: CancelStage::BeforeAcceptance,
                    was_free: true,
                    penalty: 0,
                    order_amount,
                    elapsed_secs,
                });

                CancelResult {
                    allowed: true,
                    penalty_charged: false,
                    penalty_amount: 0,
                    compensation_amount: 0,
                    user_message: "Заказ отменён.".into(),
                    next_time_warning: String::new(),
                    compensation_source: String::new(),
                    admin_log: format!("FREE: {} cancelled {} before acceptance", user_id, order_id),
                    user_banned: false,
                    remaining_free_early: MAX_FREE_EARLY_PER_MONTH - record.early_cancels_this_month,
                    remaining_before_ban: max_paid - total_paid,
                    stage: CancelStage::BeforeAcceptance,
                }
            }

            // ─── EARLY GRACE (within 90 sec) ───
            CancelStage::EarlyGrace => {
                let free_monthly_left = MAX_FREE_EARLY_PER_MONTH.saturating_sub(record.early_cancels_this_month);
                let free_lifetime_left = MAX_FREE_EARLY_LIFETIME.saturating_sub(record.early_cancels_lifetime);
                let is_free = free_monthly_left > 0 && free_lifetime_left > 0;

                if is_free {
                    // Free early cancel
                    record.early_cancels_this_month += 1;
                    record.early_cancels_lifetime += 1;

                    record.history.push(CancelEvent {
                        order_id: order_id.into(),
                        timestamp: now,
                        stage: CancelStage::EarlyGrace,
                        was_free: true,
                        penalty: 0,
                        order_amount,
                        elapsed_secs,
                    });

                    let remaining_month = MAX_FREE_EARLY_PER_MONTH.saturating_sub(record.early_cancels_this_month);

                    // Calculate what happens next time for the warning
                    let next_free_month = MAX_FREE_EARLY_PER_MONTH.saturating_sub(record.early_cancels_this_month);
                    let next_free_life = MAX_FREE_EARLY_LIFETIME.saturating_sub(record.early_cancels_lifetime);
                    let next_will_cost = next_free_month == 0 || next_free_life == 0;

                    let next_warning = if next_will_cost {
                        let next_penalty = order_amount * EARLY_PENALTY_BPS / 10_000;
                        format!(
                            "В следующий раз при отмене будет удержано {} BOLH.",
                            next_penalty / 100_000_000
                        )
                    } else {
                        String::new()
                    };

                    CancelResult {
                        allowed: true,
                        penalty_charged: false,
                        penalty_amount: 0,
                        compensation_amount: 0,
                        user_message: "Заказ отменён.".into(),
                        next_time_warning: next_warning,
                        compensation_source: String::new(),
                        admin_log: format!(
                            "FREE_EARLY: {} cancelled {} at {}s. Month: {}/{}, Lifetime: {}/{}",
                            user_id, order_id, elapsed_secs,
                            record.early_cancels_this_month, MAX_FREE_EARLY_PER_MONTH,
                            record.early_cancels_lifetime, MAX_FREE_EARLY_LIFETIME
                        ),
                        user_banned: false,
                        remaining_free_early: remaining_month,
                        remaining_before_ban: max_paid - total_paid,
                        stage: CancelStage::EarlyGrace,
                    }
                } else {
                    // Paid early cancel
                    let penalty = order_amount * EARLY_PENALTY_BPS / 10_000;
                    record.paid_early_cancels += 1;
                    record.total_penalties_paid += penalty;

                    let new_total_paid = record.paid_late_cancels + record.paid_early_cancels;
                    let should_ban = new_total_paid >= max_paid;

                    if should_ban {
                        record.is_banned = true;
                        record.ban_reason = Some(format!(
                            "Paid cancel limit exceeded: {} of {}",
                            new_total_paid, max_paid
                        ));
                        *self.total_bans.write() += 1;
                    }

                    record.history.push(CancelEvent {
                        order_id: order_id.into(),
                        timestamp: now,
                        stage: CancelStage::EarlyGrace,
                        was_free: false,
                        penalty,
                        order_amount,
                        elapsed_secs,
                    });

                    *self.total_penalties.write() += penalty;

                    let next_warning = if should_ban {
                        "Доступ ограничен. Обратитесь в поддержку.".into()
                    } else {
                        "При повторных отменах доступ к сервису может быть ограничен.".into()
                    };

                    CancelResult {
                        allowed: true,
                        penalty_charged: true,
                        penalty_amount: penalty,
                        compensation_amount: penalty,
                        user_message: format!(
                            "Заказ отменён. Удержано: {} BOLH.",
                            penalty / 100_000_000
                        ),
                        next_time_warning: next_warning,
                        compensation_source: "penalty".into(),
                        admin_log: format!(
                            "PAID_EARLY: {} cancelled {} at {}s. Penalty: {} raw. Total paid: {}/{}. Banned: {}",
                            user_id, order_id, elapsed_secs, penalty, new_total_paid, max_paid, should_ban
                        ),
                        user_banned: should_ban,
                        remaining_free_early: 0,
                        remaining_before_ban: max_paid.saturating_sub(new_total_paid),
                        stage: CancelStage::EarlyGrace,
                    }
                }
            }

            // ─── LATE CANCEL (5+ min) — SERIOUS ───
            CancelStage::Late => {
                let has_free_pass = record.free_late_cancels_used < FREE_LATE_CANCEL_LIFETIME;

                if has_free_pass {
                    // THE ONE free late cancel — ever
                    record.free_late_cancels_used += 1;

                    let compensation = order_amount * RESERVE_COMPENSATION_BPS / 10_000;
                    *self.total_reserve_compensations.write() += compensation;

                    record.history.push(CancelEvent {
                        order_id: order_id.into(),
                        timestamp: now,
                        stage: CancelStage::Late,
                        was_free: true,
                        penalty: 0,
                        order_amount,
                        elapsed_secs,
                    });

                    let next_penalty = order_amount * penalty_bps / 10_000;

                    CancelResult {
                        allowed: true,
                        penalty_charged: false,
                        penalty_amount: 0,
                        compensation_amount: compensation,
                        user_message: "Заказ отменён. Другая сторона получит компенсацию.".into(),
                        next_time_warning: format!(
                            "В следующий раз при отмене будет удержано {} BOLH ({}%).",
                            next_penalty / 100_000_000,
                            penalty_bps / 100
                        ),
                        compensation_source: "reserve_fund".into(),
                        admin_log: format!(
                            "FREE_LATE: {} used lifetime free pass on {} at {}s. Comp: {} raw from reserve.",
                            user_id, order_id, elapsed_secs, compensation
                        ),
                        user_banned: false,
                        remaining_free_early: MAX_FREE_EARLY_PER_MONTH.saturating_sub(record.early_cancels_this_month),
                        remaining_before_ban: max_paid - total_paid,
                        stage: CancelStage::Late,
                    }
                } else {
                    // Paid late cancel
                    let penalty = order_amount * penalty_bps / 10_000;
                    record.paid_late_cancels += 1;
                    record.total_penalties_paid += penalty;

                    let new_total_paid = record.paid_late_cancels + record.paid_early_cancels;
                    let should_ban = new_total_paid >= max_paid;

                    if should_ban {
                        record.is_banned = true;
                        record.ban_reason = Some(format!(
                            "Paid cancel limit exceeded: {} of {}",
                            new_total_paid, max_paid
                        ));
                        *self.total_bans.write() += 1;
                    }

                    record.history.push(CancelEvent {
                        order_id: order_id.into(),
                        timestamp: now,
                        stage: CancelStage::Late,
                        was_free: false,
                        penalty,
                        order_amount,
                        elapsed_secs,
                    });

                    *self.total_penalties.write() += penalty;

                    let user_msg = if should_ban {
                        format!("Заказ отменён. Удержано: {} BOLH. Обратитесь в поддержку.", penalty / 100_000_000)
                    } else {
                        format!("Заказ отменён. Удержано: {} BOLH.", penalty / 100_000_000)
                    };

                    let next_warning = if should_ban {
                        "Доступ ограничен. Обратитесь в поддержку.".into()
                    } else {
                        "При повторных отменах доступ к сервису может быть ограничен.".into()
                    };

                    CancelResult {
                        allowed: true,
                        penalty_charged: true,
                        penalty_amount: penalty,
                        compensation_amount: penalty,
                        user_message: user_msg,
                        next_time_warning: next_warning,
                        compensation_source: "penalty".into(),
                        admin_log: format!(
                            "PAID_LATE: {} cancelled {} at {}s. Penalty: {} raw ({}%). Total paid: {}/{}. Banned: {}",
                            user_id, order_id, elapsed_secs, penalty, penalty_bps / 100,
                            new_total_paid, max_paid, should_ban
                        ),
                        user_banned: should_ban,
                        remaining_free_early: MAX_FREE_EARLY_PER_MONTH.saturating_sub(record.early_cancels_this_month),
                        remaining_before_ban: max_paid.saturating_sub(new_total_paid),
                        stage: CancelStage::Late,
                    }
                }
            }
        };

        // Save record
        *self.total_cancellations.write() += 1;
        self.records.write().insert(user_id.to_string(), record);

        result
    }

    // ═══════════════════════════════════════════════════════
    // PUBLIC API — what the app calls when user taps "Cancel"
    // ═══════════════════════════════════════════════════════

    /// STEP 1: User taps "Cancel" → show preview of what will happen.
    /// This does NOT cancel anything — just shows the confirmation screen.
    pub fn preview_cancel(
        &self,
        user_id: &str,
        user_type: UserType,
        order_amount: u64,
        was_accepted: bool,
        accepted_at_ms: u64,
    ) -> CancelPreview {
        let record = self.get_or_create_record(user_id, user_type.clone());

        // Check if banned
        if record.is_banned {
            return CancelPreview {
                can_cancel: false,
                will_have_penalty: false,
                penalty_amount: 0,
                confirm_message: "Отмена невозможна. Обратитесь в поддержку.".into(),
                next_time_warning: String::new(),
            };
        }

        // Auto-detect stage
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        if !was_accepted {
            // Before acceptance — always free, no scary screen needed
            return CancelPreview {
                can_cancel: true,
                will_have_penalty: false,
                penalty_amount: 0,
                confirm_message: "Отменить заказ?".into(),
                next_time_warning: String::new(),
            };
        }

        let elapsed_secs = now_ms.saturating_sub(accepted_at_ms) / 1000;
        let is_early = elapsed_secs <= GRACE_PERIOD_SECS;

        let (penalty_bps_for_type, _max_paid) = match &user_type {
            UserType::Person => (LATE_PENALTY_PERSON_BPS, MAX_PAID_CANCELS_PERSON),
            UserType::Business => (LATE_PENALTY_BUSINESS_BPS, MAX_PAID_CANCELS_BUSINESS),
        };

        if is_early {
            // Early grace period
            let mut rec = record.clone();
            let month = current_month_code();
            if rec.current_month != month {
                rec.early_cancels_this_month = 0;
            }

            let free_monthly_left = MAX_FREE_EARLY_PER_MONTH.saturating_sub(rec.early_cancels_this_month);
            let free_lifetime_left = MAX_FREE_EARLY_LIFETIME.saturating_sub(rec.early_cancels_lifetime);
            let is_free = free_monthly_left > 0 && free_lifetime_left > 0;

            if is_free {
                let penalty_next = order_amount * EARLY_PENALTY_BPS / 10_000;
                CancelPreview {
                    can_cancel: true,
                    will_have_penalty: false,
                    penalty_amount: 0,
                    confirm_message: "Отменить заказ?".into(),
                    next_time_warning: format!(
                        "В следующий раз при отмене будет удержано {} BOLH.",
                        penalty_next / 100_000_000
                    ),
                }
            } else {
                let penalty = order_amount * EARLY_PENALTY_BPS / 10_000;
                CancelPreview {
                    can_cancel: true,
                    will_have_penalty: true,
                    penalty_amount: penalty,
                    confirm_message: format!(
                        "Вы уверены? Будет удержано {} BOLH.",
                        penalty / 100_000_000
                    ),
                    next_time_warning: "При повторной отмене удержание сохранится.".into(),
                }
            }
        } else {
            // Late — serious
            let has_free_pass = record.free_late_cancels_used < FREE_LATE_CANCEL_LIFETIME;

            if has_free_pass {
                let penalty_next = order_amount * penalty_bps_for_type / 10_000;
                CancelPreview {
                    can_cancel: true,
                    will_have_penalty: false,
                    penalty_amount: 0,
                    confirm_message: "Отменить заказ? Другая сторона получит компенсацию.".into(),
                    next_time_warning: format!(
                        "В следующий раз при отмене будет удержано {} BOLH ({}%).",
                        penalty_next / 100_000_000,
                        penalty_bps_for_type / 100
                    ),
                }
            } else {
                let penalty = order_amount * penalty_bps_for_type / 10_000;
                CancelPreview {
                    can_cancel: true,
                    will_have_penalty: true,
                    penalty_amount: penalty,
                    confirm_message: format!(
                        "Вы уверены? Будет удержано {} BOLH ({}%).",
                        penalty / 100_000_000,
                        penalty_bps_for_type / 100
                    ),
                    next_time_warning: "При повторных отменах доступ к сервису может быть ограничен.".into(),
                }
            }
        }
    }

    /// STEP 2: User confirmed cancellation — actually process it.
    pub fn cancel_order(
        &self,
        user_id: &str,
        user_type: UserType,
        order_id: &str,
        order_amount: u64,
        was_accepted: bool,
        accepted_at_ms: u64,
    ) -> CancelResult {
        // Auto-detect stage
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let (stage, elapsed_secs) = if !was_accepted {
            (CancelStage::BeforeAcceptance, 0)
        } else {
            let elapsed_ms = now_ms.saturating_sub(accepted_at_ms);
            let elapsed = elapsed_ms / 1000;
            if elapsed <= GRACE_PERIOD_SECS {
                (CancelStage::EarlyGrace, elapsed)
            } else {
                (CancelStage::Late, elapsed)
            }
        };

        self.process_cancellation(user_id, user_type, order_id, order_amount, stage, elapsed_secs)
    }

    // ═══════════════════════════════════════════════════════
    // ADMIN API — never exposed to users
    // ═══════════════════════════════════════════════════════

    /// Get user's cancel record (for admin view only)
    pub fn get_record(&self, user_id: &str) -> Option<UserCancelRecord> {
        self.records.read().get(user_id).cloned()
    }

    /// Admin: unban a user
    pub fn admin_unban(&self, user_id: &str) -> bool {
        let mut records = self.records.write();
        if let Some(record) = records.get_mut(user_id) {
            record.is_banned = false;
            record.ban_reason = None;
            // Reset paid counters to give a second chance
            record.paid_late_cancels = 0;
            record.paid_early_cancels = 0;
            true
        } else {
            false
        }
    }

    /// Get system statistics
    pub fn stats(&self) -> SystemRulesStats {
        let records = self.records.read();
        let banned = records.values().filter(|r| r.is_banned).count();
        SystemRulesStats {
            total_users_tracked: records.len(),
            total_cancellations: *self.total_cancellations.read(),
            total_penalties_collected: *self.total_penalties.read(),
            total_reserve_compensations: *self.total_reserve_compensations.read(),
            total_bans: *self.total_bans.read(),
            currently_banned: banned,
        }
    }
}

impl Default for SystemRules {
    fn default() -> Self {
        Self::new()
    }
}

/// System rules statistics
#[derive(Debug, Serialize)]
pub struct SystemRulesStats {
    pub total_users_tracked: usize,
    pub total_cancellations: u64,
    pub total_penalties_collected: u64,
    pub total_reserve_compensations: u64,
    pub total_bans: u64,
    pub currently_banned: usize,
}

// ═══════════════════════════════════════════════════════
// LEGAL TEXT — clean terms for public display (if law requires)
// ═══════════════════════════════════════════════════════

/// Returns the cancellation policy as a clean legal text.
/// This is what gets shown in "Terms of Service" or "Cancellation Policy" page.
/// No internal numbers, no thresholds, no implementation details.
pub fn cancellation_policy_ru() -> &'static str {
    r#"Правила отмены заказов

1. Отмена до принятия
   Если ваш заказ ещё не принят исполнителем, вы можете отменить его без каких-либо удержаний.

2. Отмена после принятия
   После того как исполнитель принял ваш заказ, отмена может повлечь удержание части стоимости заказа в качестве компенсации пострадавшей стороне.

3. Размер удержания
   Размер удержания зависит от времени, прошедшего с момента принятия заказа, и определяется системой автоматически. Чем позднее отмена — тем выше удержание.

4. Систематические отмены
   При систематических отменах заказов после их принятия, платформа оставляет за собой право ограничить доступ к сервису до рассмотрения ситуации службой поддержки.

5. Компенсация
   Пострадавшая сторона при отмене получает компенсацию автоматически.

6. Коммерческие аккаунты
   Для коммерческих аккаунтов (рестораны, магазины и т.д.) действуют аналогичные правила с учётом специфики бизнеса.

7. Обжалование
   Вы можете обратиться в службу поддержки для разрешения спорных ситуаций."#
}

/// English version
pub fn cancellation_policy_en() -> &'static str {
    r#"Cancellation Policy

1. Cancellation before acceptance
   If your order has not yet been accepted by a service provider, you may cancel it at no charge.

2. Cancellation after acceptance
   Once a service provider has accepted your order, cancellation may result in a partial charge as compensation to the affected party.

3. Charge amount
   The charge amount depends on the time elapsed since the order was accepted and is determined automatically by the system. Later cancellations result in higher charges.

4. Repeated cancellations
   In case of repeated cancellations after acceptance, the platform reserves the right to restrict access to the service pending review by our support team.

5. Compensation
   The affected party receives automatic compensation upon cancellation.

6. Business accounts
   Business accounts (restaurants, stores, etc.) are subject to similar rules adapted for business operations.

7. Appeals
   You may contact our support team to resolve any disputes."#
}

/// Helper: current month as YYYYMM integer
fn current_month_code() -> u32 {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Approximate: secs / (30.44 * 86400) gives months since epoch
    let months_since_epoch = now / 2_629_744;
    let year = 1970 + months_since_epoch / 12;
    let month = months_since_epoch % 12 + 1;
    (year * 100 + month) as u32
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    fn bolh(amount: u64) -> u64 {
        amount * 100_000_000
    }

    #[test]
    fn test_cancel_before_acceptance_always_free() {
        let rules = SystemRules::new();
        for i in 0..20 {
            let r = rules.process_cancellation(
                "user1", UserType::Person,
                &format!("ORD-{}", i), bolh(1000),
                CancelStage::BeforeAcceptance, 0,
            );
            assert!(r.allowed);
            assert!(!r.penalty_charged);
            assert_eq!(r.penalty_amount, 0);
        }
    }

    #[test]
    fn test_early_cancel_free_limit() {
        let rules = SystemRules::new();

        // 1st early cancel — free, warning
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-1", bolh(500),
            CancelStage::EarlyGrace, 30,
        );
        assert!(r.allowed);
        assert!(!r.penalty_charged);
        assert_eq!(r.remaining_free_early, 1); // 2 - 1 = 1

        // 2nd early cancel — still free
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-2", bolh(500),
            CancelStage::EarlyGrace, 45,
        );
        assert!(r.allowed);
        assert!(!r.penalty_charged);
        assert_eq!(r.remaining_free_early, 0); // exhausted for this month

        // 3rd early cancel — PAID (10%)
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-3", bolh(1000),
            CancelStage::EarlyGrace, 60,
        );
        assert!(r.allowed);
        assert!(r.penalty_charged);
        assert_eq!(r.penalty_amount, bolh(100)); // 10% of 1000
    }

    #[test]
    fn test_late_cancel_one_free_pass() {
        let rules = SystemRules::new();

        // 1st late cancel — THE ONE free pass
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-1", bolh(2000),
            CancelStage::Late, 600,
        );
        assert!(r.allowed);
        assert!(!r.penalty_charged);
        assert_eq!(r.compensation_amount, bolh(200)); // 10% from reserve
        assert_eq!(r.compensation_source, "reserve_fund");

        // 2nd late cancel — PAID (30%)
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-2", bolh(1000),
            CancelStage::Late, 900,
        );
        assert!(r.allowed);
        assert!(r.penalty_charged);
        assert_eq!(r.penalty_amount, bolh(300)); // 30% of 1000
    }

    #[test]
    fn test_business_lower_penalty() {
        let rules = SystemRules::new();

        // Use the one free pass first
        rules.process_cancellation(
            "biz1", UserType::Business,
            "ORD-0", bolh(1000),
            CancelStage::Late, 600,
        );

        // Business pays 20% instead of 30%
        let r = rules.process_cancellation(
            "biz1", UserType::Business,
            "ORD-1", bolh(1000),
            CancelStage::Late, 600,
        );
        assert!(r.penalty_charged);
        assert_eq!(r.penalty_amount, bolh(200)); // 20% for business
    }

    #[test]
    fn test_ban_after_max_paid_cancels() {
        let rules = SystemRules::new();

        // Use free pass first
        rules.process_cancellation(
            "bad_user", UserType::Person,
            "ORD-FREE", bolh(100),
            CancelStage::Late, 600,
        );

        // 10 paid late cancels → ban
        for i in 0..10 {
            let r = rules.process_cancellation(
                "bad_user", UserType::Person,
                &format!("ORD-{}", i), bolh(100),
                CancelStage::Late, 600,
            );
            if i < 9 {
                assert!(!r.user_banned, "Should not be banned at cancel {}", i);
            } else {
                assert!(r.user_banned, "Should be banned at cancel {}", i);
            }
        }

        // Next attempt should be blocked
        let r = rules.process_cancellation(
            "bad_user", UserType::Person,
            "ORD-BLOCKED", bolh(100),
            CancelStage::Late, 600,
        );
        assert!(!r.allowed);
    }

    #[test]
    fn test_admin_unban() {
        let rules = SystemRules::new();

        // Use free pass then get banned
        rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-0", bolh(100), CancelStage::Late, 600,
        );
        for i in 0..10 {
            rules.process_cancellation(
                "user1", UserType::Person,
                &format!("ORD-{}", i), bolh(100), CancelStage::Late, 600,
            );
        }

        let record = rules.get_record("user1").unwrap();
        assert!(record.is_banned);

        // Admin unbans
        assert!(rules.admin_unban("user1"));

        let record = rules.get_record("user1").unwrap();
        assert!(!record.is_banned);
        assert_eq!(record.paid_late_cancels, 0); // Reset

        // User can cancel again
        let r = rules.process_cancellation(
            "user1", UserType::Person,
            "ORD-NEW", bolh(500), CancelStage::Late, 600,
        );
        assert!(r.allowed);
        assert!(r.penalty_charged); // But still pays (free pass already used)
    }

    #[test]
    fn test_stats() {
        let rules = SystemRules::new();

        rules.process_cancellation("u1", UserType::Person, "O1", bolh(100), CancelStage::BeforeAcceptance, 0);
        rules.process_cancellation("u2", UserType::Business, "O2", bolh(200), CancelStage::EarlyGrace, 30);

        let stats = rules.stats();
        assert_eq!(stats.total_cancellations, 2);
        assert_eq!(stats.total_users_tracked, 2);
    }

    #[test]
    fn test_preview_then_cancel_flow() {
        let rules = SystemRules::new();
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // ── 1st cancel: preview shows no penalty, then execute ──
        let preview = rules.preview_cancel(
            "user1", UserType::Person, bolh(1000),
            true, now_ms - 30_000, // accepted 30s ago (early grace)
        );
        assert!(preview.can_cancel);
        assert!(!preview.will_have_penalty);
        assert_eq!(preview.penalty_amount, 0);
        assert_eq!(preview.confirm_message, "Отменить заказ?");

        // Actually cancel
        let result = rules.cancel_order(
            "user1", UserType::Person, "ORD-1", bolh(1000),
            true, now_ms - 30_000,
        );
        assert!(result.allowed);
        assert!(!result.penalty_charged);
        assert_eq!(result.user_message, "Заказ отменён.");

        // ── 2nd cancel: still free (2 per month) ──
        let preview2 = rules.preview_cancel(
            "user1", UserType::Person, bolh(1000),
            true, now_ms - 20_000,
        );
        assert!(preview2.can_cancel);
        assert!(!preview2.will_have_penalty);

        let result2 = rules.cancel_order(
            "user1", UserType::Person, "ORD-2", bolh(1000),
            true, now_ms - 20_000,
        );
        assert!(result2.allowed);
        assert!(!result2.penalty_charged);
        // After 2nd free cancel, next_time_warning should warn about penalty
        assert!(!result2.next_time_warning.is_empty(), "Should warn about next penalty");

        // ── 3rd cancel: preview NOW shows penalty! ──
        let preview3 = rules.preview_cancel(
            "user1", UserType::Person, bolh(1000),
            true, now_ms - 50_000,
        );
        assert!(preview3.can_cancel);
        assert!(preview3.will_have_penalty);
        assert!(preview3.penalty_amount > 0);
        assert!(preview3.confirm_message.contains("уверены"));

        let result3 = rules.cancel_order(
            "user1", UserType::Person, "ORD-3", bolh(1000),
            true, now_ms - 50_000,
        );
        assert!(result3.allowed);
        assert!(result3.penalty_charged);
        assert_eq!(result3.penalty_amount, bolh(100)); // 10%
    }

    #[test]
    fn test_preview_before_acceptance_always_free() {
        let rules = SystemRules::new();

        let preview = rules.preview_cancel(
            "user1", UserType::Person, bolh(5000),
            false, 0, // not accepted
        );
        assert!(preview.can_cancel);
        assert!(!preview.will_have_penalty);
        assert_eq!(preview.penalty_amount, 0);
    }

    #[test]
    fn test_preview_banned_user() {
        let rules = SystemRules::new();

        // Get user banned: use free pass + 10 paid cancels
        rules.process_cancellation("bad", UserType::Person, "F0", bolh(100), CancelStage::Late, 600);
        for i in 0..10 {
            rules.process_cancellation("bad", UserType::Person, &format!("P{}", i), bolh(100), CancelStage::Late, 600);
        }

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let preview = rules.preview_cancel("bad", UserType::Person, bolh(1000), true, now_ms - 10_000);
        assert!(!preview.can_cancel);
        assert!(preview.confirm_message.contains("Обратитесь в поддержку"));
    }
}
