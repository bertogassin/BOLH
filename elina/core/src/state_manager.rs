//! Elina State Manager
//!
//! Core state machine that drives Elina's behavior.
//! Each state maps to a visual animation, sound, and behavior.

use serde::{Deserialize, Serialize};

/// All possible states of Elina
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ElinaState {
    /// Default — Elina breathes calmly, subtle floating animation
    Idle,
    /// User is interacting — Elina listens with a soft glow
    Listening,
    /// Elina is pointing/leading the user somewhere
    Guiding,
    /// Positive reaction — bounce, sparkle
    Happy,
    /// Something needs attention — shake, color pulse
    Alert,
    /// Secret emotion — activated by 16 rapid taps. Explosive visual + unique sound
    Secret,
}

impl ElinaState {
    /// Human-readable name
    pub fn name(&self) -> &str {
        match self {
            ElinaState::Idle => "idle",
            ElinaState::Listening => "listening",
            ElinaState::Guiding => "guiding",
            ElinaState::Happy => "happy",
            ElinaState::Alert => "alert",
            ElinaState::Secret => "secret",
        }
    }

    /// CSS animation class name
    pub fn animation_class(&self) -> &str {
        match self {
            ElinaState::Idle => "elina-breathe",
            ElinaState::Listening => "elina-pulse-glow",
            ElinaState::Guiding => "elina-lean",
            ElinaState::Happy => "elina-bounce",
            ElinaState::Alert => "elina-shake",
            ElinaState::Secret => "elina-secret-flash",
        }
    }

    /// Animation duration in ms
    pub fn animation_duration_ms(&self) -> u32 {
        match self {
            ElinaState::Idle => 3000,       // Slow, calm breathing
            ElinaState::Listening => 1500,   // Gentle pulse
            ElinaState::Guiding => 800,      // Quick lean
            ElinaState::Happy => 400,        // Snappy bounce
            ElinaState::Alert => 200,        // Fast shake
            ElinaState::Secret => 600,       // Dramatic flash
        }
    }

    /// Whether this state should auto-return to Idle
    pub fn auto_return(&self) -> bool {
        match self {
            ElinaState::Idle => false,       // Already idle
            ElinaState::Listening => false,  // Stays until released
            ElinaState::Guiding => false,    // Stays until dismissed
            ElinaState::Happy => true,       // Returns to idle after animation
            ElinaState::Alert => true,       // Returns after attention
            ElinaState::Secret => true,      // Returns after secret plays
        }
    }

    /// Time (ms) before auto-returning to Idle
    pub fn auto_return_delay_ms(&self) -> u32 {
        match self {
            ElinaState::Happy => 1200,
            ElinaState::Alert => 3000,
            ElinaState::Secret => 4000,
            _ => 0,
        }
    }
}

/// Manages Elina's current state and transition history
pub struct StateManager {
    pub current_state: ElinaState,
    pub previous_state: ElinaState,
    transition_count: u64,
}

impl StateManager {
    pub fn new() -> Self {
        Self {
            current_state: ElinaState::Idle,
            previous_state: ElinaState::Idle,
            transition_count: 0,
        }
    }

    /// Transition to a new state
    pub fn set_state(&mut self, new_state: ElinaState) {
        if self.current_state != new_state {
            self.previous_state = self.current_state;
            self.current_state = new_state;
            self.transition_count += 1;
        }
    }

    /// Check if current state should auto-return to Idle
    pub fn should_auto_return(&self) -> bool {
        self.current_state.auto_return()
    }

    /// Get total state transitions (for analytics)
    pub fn total_transitions(&self) -> u64 {
        self.transition_count
    }
}

impl Default for StateManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let sm = StateManager::new();
        assert_eq!(sm.current_state, ElinaState::Idle);
    }

    #[test]
    fn test_state_transition() {
        let mut sm = StateManager::new();
        sm.set_state(ElinaState::Happy);
        assert_eq!(sm.current_state, ElinaState::Happy);
        assert_eq!(sm.previous_state, ElinaState::Idle);
        assert_eq!(sm.total_transitions(), 1);
    }

    #[test]
    fn test_same_state_no_transition() {
        let mut sm = StateManager::new();
        sm.set_state(ElinaState::Idle);
        assert_eq!(sm.total_transitions(), 0); // No change
    }

    #[test]
    fn test_auto_return() {
        assert!(ElinaState::Happy.auto_return());
        assert!(ElinaState::Alert.auto_return());
        assert!(ElinaState::Secret.auto_return());
        assert!(!ElinaState::Idle.auto_return());
        assert!(!ElinaState::Listening.auto_return());
    }

    #[test]
    fn test_state_names() {
        assert_eq!(ElinaState::Idle.name(), "idle");
        assert_eq!(ElinaState::Secret.name(), "secret");
        assert_eq!(ElinaState::Happy.name(), "happy");
    }
}
