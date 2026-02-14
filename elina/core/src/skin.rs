//! Elina Skin Manager
//!
//! Controls Elina's visual appearance: colors, gradients, glow effects.
//! The SHAPE never changes (pomegranate octagon) — only colors and effects do.

use serde::{Deserialize, Serialize};

/// Predefined color profiles
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ColorProfile {
    /// Classic pomegranate red (default)
    Pomegranate,
    /// Ocean blue
    Ocean,
    /// Forest green
    Forest,
    /// Sunset gold
    Sunset,
    /// Midnight purple
    Midnight,
    /// Snow white
    Snow,
    /// Custom hex color
    Custom(String),
}

impl ColorProfile {
    /// Get the primary hex color
    pub fn primary(&self) -> &str {
        match self {
            ColorProfile::Pomegranate => "#C0392B",
            ColorProfile::Ocean => "#2980B9",
            ColorProfile::Forest => "#27AE60",
            ColorProfile::Sunset => "#F39C12",
            ColorProfile::Midnight => "#8E44AD",
            ColorProfile::Snow => "#ECF0F1",
            ColorProfile::Custom(hex) => hex.as_str(),
        }
    }

    /// Get the gradient end color (lighter variant)
    pub fn secondary(&self) -> &str {
        match self {
            ColorProfile::Pomegranate => "#E74C3C",
            ColorProfile::Ocean => "#3498DB",
            ColorProfile::Forest => "#2ECC71",
            ColorProfile::Sunset => "#F1C40F",
            ColorProfile::Midnight => "#9B59B6",
            ColorProfile::Snow => "#FFFFFF",
            ColorProfile::Custom(_) => "#FFFFFF",
        }
    }

    /// Glow color for animations
    pub fn glow(&self) -> &str {
        match self {
            ColorProfile::Pomegranate => "rgba(192, 57, 43, 0.4)",
            ColorProfile::Ocean => "rgba(41, 128, 185, 0.4)",
            ColorProfile::Forest => "rgba(39, 174, 96, 0.4)",
            ColorProfile::Sunset => "rgba(243, 156, 18, 0.4)",
            ColorProfile::Midnight => "rgba(142, 68, 173, 0.4)",
            ColorProfile::Snow => "rgba(236, 240, 241, 0.4)",
            ColorProfile::Custom(_) => "rgba(255, 255, 255, 0.3)",
        }
    }

    /// Name for display
    pub fn display_name(&self) -> &str {
        match self {
            ColorProfile::Pomegranate => "Гранат",
            ColorProfile::Ocean => "Океан",
            ColorProfile::Forest => "Лес",
            ColorProfile::Sunset => "Закат",
            ColorProfile::Midnight => "Полночь",
            ColorProfile::Snow => "Снег",
            ColorProfile::Custom(_) => "Свой цвет",
        }
    }
}

/// Manages Elina's visual skin
pub struct SkinManager {
    /// Base color profile
    profile: ColorProfile,
    /// Override color (user-selected)
    custom_override: Option<String>,
}

impl SkinManager {
    pub fn new(base_color: &str) -> Self {
        let profile = match base_color {
            "#C0392B" => ColorProfile::Pomegranate,
            "#2980B9" => ColorProfile::Ocean,
            "#27AE60" => ColorProfile::Forest,
            "#F39C12" => ColorProfile::Sunset,
            "#8E44AD" => ColorProfile::Midnight,
            "#ECF0F1" => ColorProfile::Snow,
            other => ColorProfile::Custom(other.to_string()),
        };
        Self {
            profile,
            custom_override: None,
        }
    }

    /// Set a custom color override
    pub fn set_color(&mut self, color: &str) {
        self.custom_override = Some(color.to_string());
        self.profile = match color {
            "#C0392B" => ColorProfile::Pomegranate,
            "#2980B9" => ColorProfile::Ocean,
            "#27AE60" => ColorProfile::Forest,
            "#F39C12" => ColorProfile::Sunset,
            "#8E44AD" => ColorProfile::Midnight,
            "#ECF0F1" => ColorProfile::Snow,
            other => ColorProfile::Custom(other.to_string()),
        };
    }

    /// Get current display color
    pub fn get_color(&self) -> String {
        self.custom_override.clone().unwrap_or_else(|| self.profile.primary().to_string())
    }

    /// Get current profile
    pub fn get_profile(&self) -> &ColorProfile {
        &self.profile
    }

    /// Get gradient CSS string
    pub fn gradient_css(&self) -> String {
        format!(
            "linear-gradient(135deg, {}, {})",
            self.profile.primary(),
            self.profile.secondary()
        )
    }

    /// Get glow CSS
    pub fn glow_css(&self) -> String {
        format!("0 0 30px {}", self.profile.glow())
    }

    /// List all available profiles
    pub fn available_profiles() -> Vec<ColorProfile> {
        vec![
            ColorProfile::Pomegranate,
            ColorProfile::Ocean,
            ColorProfile::Forest,
            ColorProfile::Sunset,
            ColorProfile::Midnight,
            ColorProfile::Snow,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_color() {
        let skin = SkinManager::new("#C0392B");
        assert_eq!(skin.get_color(), "#C0392B");
        assert_eq!(*skin.get_profile(), ColorProfile::Pomegranate);
    }

    #[test]
    fn test_set_color() {
        let mut skin = SkinManager::new("#C0392B");
        skin.set_color("#2980B9");
        assert_eq!(skin.get_color(), "#2980B9");
        assert_eq!(*skin.get_profile(), ColorProfile::Ocean);
    }

    #[test]
    fn test_custom_color() {
        let mut skin = SkinManager::new("#C0392B");
        skin.set_color("#FF5733");
        assert_eq!(skin.get_color(), "#FF5733");
        assert_eq!(skin.get_profile().display_name(), "Свой цвет");
    }

    #[test]
    fn test_gradient() {
        let skin = SkinManager::new("#C0392B");
        let gradient = skin.gradient_css();
        assert!(gradient.contains("#C0392B"));
        assert!(gradient.contains("#E74C3C"));
    }

    #[test]
    fn test_available_profiles() {
        let profiles = SkinManager::available_profiles();
        assert_eq!(profiles.len(), 6);
    }
}
