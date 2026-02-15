//! Elina — Living Brand Mascot Engine
//!
//! Elina is the soul of the BOLH platform.
//! A pomegranate-shaped interactive character that breathes, reacts, and connects with users.
//!
//! # Modules
//! - `state_manager` — Core state machine (Idle, Listening, Guiding, Happy, Alert, Secret)
//! - `behavior` — Behavior controller that interprets states into actions
//! - `skin` — Color and visual customization
//! - `sound` — Sound/emotion mapping
//! - `secret` — Secret emotion system (16-tap Easter egg)

pub mod state_manager;
pub mod behavior;
pub mod skin;
pub mod sound;
pub mod secret;

/// Elina version
pub const VERSION: &str = "0.1.0";

/// The unified Elina instance — combines all engines
pub struct Elina {
    pub state: state_manager::StateManager,
    pub skin: skin::SkinManager,
    pub sound: sound::SoundManager,
    pub secret: secret::SecretDetector,
}

impl Elina {
    /// Create a new Elina with default settings
    pub fn new() -> Self {
        Self {
            state: state_manager::StateManager::new(),
            skin: skin::SkinManager::new("#C0392B"), // Pomegranate red
            sound: sound::SoundManager::new(),
            secret: secret::SecretDetector::new(),
        }
    }

    /// Handle a tap event — the main interaction point
    pub fn tap(&mut self) -> ElinaReaction {
        // Check for secret emotion first
        let secret_triggered = self.secret.register_tap();

        if secret_triggered {
            self.state.set_state(state_manager::ElinaState::Secret);
            return ElinaReaction {
                state: state_manager::ElinaState::Secret,
                animation: "secret_flash".into(),
                sound: Some("secret".into()),
                color: self.skin.get_color(),
                intensity: 1.0,
                message: Some("🔥 Secret emotion unlocked!".into()),
            };
        }

        // Normal tap — make her happy
        self.state.set_state(state_manager::ElinaState::Happy);
        ElinaReaction {
            state: state_manager::ElinaState::Happy,
            animation: "bounce".into(),
            sound: Some("happy".into()),
            color: self.skin.get_color(),
            intensity: 0.7,
            message: None,
        }
    }

    /// Long press — Elina starts listening
    pub fn long_press(&mut self) -> ElinaReaction {
        self.state.set_state(state_manager::ElinaState::Listening);
        ElinaReaction {
            state: state_manager::ElinaState::Listening,
            animation: "pulse_glow".into(),
            sound: Some("listening".into()),
            color: self.skin.get_color(),
            intensity: 0.5,
            message: None,
        }
    }

    /// User is idle — Elina breathes calmly
    pub fn idle(&mut self) -> ElinaReaction {
        self.state.set_state(state_manager::ElinaState::Idle);
        self.secret.reset(); // Reset secret counter on idle
        ElinaReaction {
            state: state_manager::ElinaState::Idle,
            animation: "breathe".into(),
            sound: None,
            color: self.skin.get_color(),
            intensity: 0.3,
            message: None,
        }
    }

    /// Something needs attention
    pub fn alert(&mut self, message: &str) -> ElinaReaction {
        self.state.set_state(state_manager::ElinaState::Alert);
        ElinaReaction {
            state: state_manager::ElinaState::Alert,
            animation: "shake".into(),
            sound: Some("alert".into()),
            color: self.skin.get_color(),
            intensity: 0.9,
            message: Some(message.to_string()),
        }
    }

    /// Elina guides user somewhere
    pub fn guide(&mut self, target: &str) -> ElinaReaction {
        self.state.set_state(state_manager::ElinaState::Guiding);
        ElinaReaction {
            state: state_manager::ElinaState::Guiding,
            animation: "lean_point".into(),
            sound: Some("guide".into()),
            color: self.skin.get_color(),
            intensity: 0.6,
            message: Some(format!("→ {}", target)),
        }
    }

    /// Change Elina's color
    pub fn set_color(&mut self, color: &str) {
        self.skin.set_color(color);
    }

    /// Get current state name
    pub fn state_name(&self) -> &str {
        self.state.current_state.name()
    }
}

impl Default for Elina {
    fn default() -> Self {
        Self::new()
    }
}

/// The result of any interaction with Elina
#[derive(Debug, Clone, serde::Serialize)]
pub struct ElinaReaction {
    pub state: state_manager::ElinaState,
    pub animation: String,
    pub sound: Option<String>,
    pub color: String,
    pub intensity: f32,
    pub message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_elina() {
        let elina = Elina::new();
        assert_eq!(elina.state_name(), "idle");
        assert_eq!(elina.skin.get_color(), "#C0392B");
    }

    #[test]
    fn test_tap_makes_happy() {
        let mut elina = Elina::new();
        let reaction = elina.tap();
        assert_eq!(reaction.animation, "bounce");
        assert_eq!(elina.state_name(), "happy");
    }

    #[test]
    fn test_long_press_listening() {
        let mut elina = Elina::new();
        let reaction = elina.long_press();
        assert_eq!(reaction.animation, "pulse_glow");
        assert_eq!(elina.state_name(), "listening");
    }

    #[test]
    fn test_idle_resets() {
        let mut elina = Elina::new();
        elina.tap();
        let reaction = elina.idle();
        assert_eq!(reaction.animation, "breathe");
        assert_eq!(elina.state_name(), "idle");
    }

    #[test]
    fn test_secret_emotion_16_taps() {
        let mut elina = Elina::new();
        // 15 taps — no secret yet
        for _ in 0..15 {
            let r = elina.tap();
            assert_eq!(r.animation, "bounce");
        }
        // 16th tap — SECRET!
        let r = elina.tap();
        assert_eq!(r.animation, "secret_flash");
        assert_eq!(elina.state_name(), "secret");
        assert!(r.message.is_some());
        assert!(r.message.unwrap().contains("Secret"));
    }

    #[test]
    fn test_secret_resets_on_idle() {
        let mut elina = Elina::new();
        for _ in 0..10 {
            elina.tap();
        }
        elina.idle(); // Reset
        // Now need 16 more taps
        for _ in 0..15 {
            let r = elina.tap();
            assert_eq!(r.animation, "bounce");
        }
        let r = elina.tap();
        assert_eq!(r.animation, "secret_flash"); // 16th tap works again
    }

    #[test]
    fn test_color_customization() {
        let mut elina = Elina::new();
        assert_eq!(elina.skin.get_color(), "#C0392B");
        elina.set_color("#3498DB");
        assert_eq!(elina.skin.get_color(), "#3498DB");
    }

    #[test]
    fn test_alert() {
        let mut elina = Elina::new();
        let r = elina.alert("New order!");
        assert_eq!(r.animation, "shake");
        assert_eq!(elina.state_name(), "alert");
    }

    #[test]
    fn test_guide() {
        let mut elina = Elina::new();
        let r = elina.guide("Wallet");
        assert_eq!(r.animation, "lean_point");
        assert!(r.message.unwrap().contains("Wallet"));
    }
}
