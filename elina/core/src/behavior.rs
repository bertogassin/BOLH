//! Elina Behavior Controller
//!
//! Interprets Elina's current state and determines what actions to perform.
//! This is the "brain" that connects state → visual + sound + message.

use crate::state_manager::ElinaState;
use serde::Serialize;

/// A behavior instruction generated from the current state
#[derive(Debug, Clone, Serialize)]
pub struct BehaviorInstruction {
    /// CSS animation to play
    pub animation: String,
    /// Sound to play (if any)
    pub sound: Option<String>,
    /// Scale factor for the shape (1.0 = normal)
    pub scale: f32,
    /// Glow intensity (0.0 = none, 1.0 = max)
    pub glow: f32,
    /// Rotation angle in degrees
    pub rotation: f32,
    /// Should we show particles/sparkles?
    pub particles: bool,
    /// Optional message to display
    pub message: Option<String>,
}

/// Generate behavior instructions for a given state
pub fn behavior_for_state(state: ElinaState) -> BehaviorInstruction {
    match state {
        ElinaState::Idle => BehaviorInstruction {
            animation: "breathe".into(),
            sound: None,
            scale: 1.0,
            glow: 0.1,
            rotation: 0.0,
            particles: false,
            message: None,
        },
        ElinaState::Listening => BehaviorInstruction {
            animation: "pulse_glow".into(),
            sound: Some("soft_hum".into()),
            scale: 1.05,
            glow: 0.6,
            rotation: 0.0,
            particles: false,
            message: None,
        },
        ElinaState::Guiding => BehaviorInstruction {
            animation: "lean_point".into(),
            sound: Some("gentle_chime".into()),
            scale: 1.0,
            glow: 0.3,
            rotation: 15.0,
            particles: false,
            message: Some("Следуй за мной".into()),
        },
        ElinaState::Happy => BehaviorInstruction {
            animation: "bounce".into(),
            sound: Some("happy_pop".into()),
            scale: 1.15,
            glow: 0.5,
            rotation: 0.0,
            particles: true,
            message: None,
        },
        ElinaState::Alert => BehaviorInstruction {
            animation: "shake".into(),
            sound: Some("alert_ping".into()),
            scale: 1.1,
            glow: 0.8,
            rotation: -5.0,
            particles: false,
            message: Some("Внимание!".into()),
        },
        ElinaState::Secret => BehaviorInstruction {
            animation: "secret_flash".into(),
            sound: Some("secret_reveal".into()),
            scale: 1.3,
            glow: 1.0,
            rotation: 360.0,
            particles: true,
            message: Some("🔥".into()),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_idle_behavior() {
        let b = behavior_for_state(ElinaState::Idle);
        assert_eq!(b.animation, "breathe");
        assert!(b.sound.is_none());
        assert!(!b.particles);
    }

    #[test]
    fn test_secret_behavior() {
        let b = behavior_for_state(ElinaState::Secret);
        assert_eq!(b.animation, "secret_flash");
        assert_eq!(b.scale, 1.3);
        assert_eq!(b.glow, 1.0);
        assert!(b.particles);
        assert_eq!(b.rotation, 360.0);
    }

    #[test]
    fn test_happy_has_particles() {
        let b = behavior_for_state(ElinaState::Happy);
        assert!(b.particles);
        assert!(b.sound.is_some());
    }
}
