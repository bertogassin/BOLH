//! Elina Sound Manager
//!
//! Maps emotional states to sound cues.
//! Sounds adapt based on personality mode: Professional vs Friendly.

use serde::{Deserialize, Serialize};

/// Sound personality mode
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum SoundMode {
    /// Professional — subtle, clean tones
    Professional,
    /// Friendly — warm, playful tones
    Friendly,
    /// Silent — no sounds
    Silent,
}

/// Sound event descriptor
#[derive(Debug, Clone, Serialize)]
pub struct SoundEvent {
    /// Sound file identifier
    pub id: String,
    /// Volume (0.0 - 1.0)
    pub volume: f32,
    /// Playback speed (1.0 = normal)
    pub speed: f32,
    /// Should loop?
    pub looping: bool,
}

/// Manages sound effects for Elina
pub struct SoundManager {
    /// Current sound mode
    pub mode: SoundMode,
    /// Master volume
    pub volume: f32,
}

impl SoundManager {
    pub fn new() -> Self {
        Self {
            mode: SoundMode::Friendly,
            volume: 0.7,
        }
    }

    /// Get sound event for an emotion
    pub fn sound_for_emotion(&self, emotion: &str) -> Option<SoundEvent> {
        if self.mode == SoundMode::Silent {
            return None;
        }

        let base = match emotion {
            "happy" => SoundEvent {
                id: match self.mode {
                    SoundMode::Professional => "tone_success".into(),
                    SoundMode::Friendly => "pop_happy".into(),
                    SoundMode::Silent => return None,
                },
                volume: self.volume * 0.8,
                speed: 1.0,
                looping: false,
            },
            "alert" => SoundEvent {
                id: match self.mode {
                    SoundMode::Professional => "tone_alert".into(),
                    SoundMode::Friendly => "ding_alert".into(),
                    SoundMode::Silent => return None,
                },
                volume: self.volume,
                speed: 1.0,
                looping: false,
            },
            "listening" => SoundEvent {
                id: "soft_hum".into(),
                volume: self.volume * 0.3,
                speed: 1.0,
                looping: true,
            },
            "guide" => SoundEvent {
                id: "gentle_chime".into(),
                volume: self.volume * 0.6,
                speed: 1.0,
                looping: false,
            },
            "secret" => SoundEvent {
                id: "secret_reveal".into(),
                volume: self.volume,
                speed: 1.0,
                looping: false,
            },
            _ => return None,
        };

        Some(base)
    }

    /// Set sound mode
    pub fn set_mode(&mut self, mode: SoundMode) {
        self.mode = mode;
    }

    /// Set master volume
    pub fn set_volume(&mut self, vol: f32) {
        self.volume = vol.clamp(0.0, 1.0);
    }
}

impl Default for SoundManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_happy_sound() {
        let sm = SoundManager::new();
        let event = sm.sound_for_emotion("happy").unwrap();
        assert_eq!(event.id, "pop_happy"); // Friendly mode
        assert!(!event.looping);
    }

    #[test]
    fn test_professional_mode() {
        let mut sm = SoundManager::new();
        sm.set_mode(SoundMode::Professional);
        let event = sm.sound_for_emotion("happy").unwrap();
        assert_eq!(event.id, "tone_success");
    }

    #[test]
    fn test_silent_mode() {
        let mut sm = SoundManager::new();
        sm.set_mode(SoundMode::Silent);
        assert!(sm.sound_for_emotion("happy").is_none());
        assert!(sm.sound_for_emotion("secret").is_none());
    }

    #[test]
    fn test_secret_sound() {
        let sm = SoundManager::new();
        let event = sm.sound_for_emotion("secret").unwrap();
        assert_eq!(event.id, "secret_reveal");
    }

    #[test]
    fn test_volume_clamp() {
        let mut sm = SoundManager::new();
        sm.set_volume(2.0);
        assert_eq!(sm.volume, 1.0);
        sm.set_volume(-0.5);
        assert_eq!(sm.volume, 0.0);
    }
}
