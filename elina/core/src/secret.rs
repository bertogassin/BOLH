//! Elina Secret Emotion Detector
//!
//! The secret emotion is an Easter egg activated by 16 rapid taps.
//! It triggers a unique visual + sound effect not documented anywhere.
//!
//! Rules:
//! - Exactly 16 taps within a time window
//! - Each tap must be within 500ms of the previous one
//! - If too slow, counter resets
//! - After activation, counter resets (can be triggered again)
//! - Going Idle also resets the counter

/// Required number of rapid taps
pub const SECRET_TAP_COUNT: u8 = 16;

/// Maximum time between taps in milliseconds
pub const MAX_TAP_INTERVAL_MS: u64 = 500;

/// Detects the secret 16-tap pattern
pub struct SecretDetector {
    /// Current tap count
    tap_count: u8,
    /// Timestamp of last tap (ms since epoch)
    last_tap_ms: u64,
    /// Total times secret was triggered (lifetime stat)
    total_triggers: u32,
}

impl SecretDetector {
    pub fn new() -> Self {
        Self {
            tap_count: 0,
            last_tap_ms: 0,
            total_triggers: 0,
        }
    }

    /// Register a tap. Returns `true` if secret emotion is activated.
    pub fn register_tap(&mut self) -> bool {
        let now = Self::now_ms();

        // Check if too much time passed since last tap
        if self.last_tap_ms > 0 && (now - self.last_tap_ms) > MAX_TAP_INTERVAL_MS {
            // Too slow — reset
            self.tap_count = 1;
            self.last_tap_ms = now;
            return false;
        }

        self.tap_count += 1;
        self.last_tap_ms = now;

        if self.tap_count >= SECRET_TAP_COUNT {
            // SECRET ACTIVATED!
            self.tap_count = 0;
            self.last_tap_ms = 0;
            self.total_triggers += 1;
            return true;
        }

        false
    }

    /// Reset the detector (e.g., when going idle)
    pub fn reset(&mut self) {
        self.tap_count = 0;
        self.last_tap_ms = 0;
    }

    /// Current tap progress (0-16)
    pub fn progress(&self) -> u8 {
        self.tap_count
    }

    /// How many times has secret been triggered in total
    pub fn total_triggers(&self) -> u32 {
        self.total_triggers
    }

    /// Get current timestamp in ms
    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }
}

impl Default for SecretDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let sd = SecretDetector::new();
        assert_eq!(sd.progress(), 0);
        assert_eq!(sd.total_triggers(), 0);
    }

    #[test]
    fn test_16_rapid_taps_triggers_secret() {
        let mut sd = SecretDetector::new();
        for i in 0..15 {
            assert!(!sd.register_tap(), "Tap {} should not trigger", i + 1);
        }
        // 16th tap
        assert!(sd.register_tap(), "16th tap should trigger secret!");
        assert_eq!(sd.total_triggers(), 1);
        assert_eq!(sd.progress(), 0); // Reset after trigger
    }

    #[test]
    fn test_reset() {
        let mut sd = SecretDetector::new();
        for _ in 0..10 {
            sd.register_tap();
        }
        assert_eq!(sd.progress(), 10);
        sd.reset();
        assert_eq!(sd.progress(), 0);
    }

    #[test]
    fn test_multiple_triggers() {
        let mut sd = SecretDetector::new();
        // First trigger
        for _ in 0..16 {
            sd.register_tap();
        }
        assert_eq!(sd.total_triggers(), 1);

        // Second trigger
        for _ in 0..16 {
            sd.register_tap();
        }
        assert_eq!(sd.total_triggers(), 2);
    }
}
