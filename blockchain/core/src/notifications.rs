//! BOLH Notification Priority System
//!
//! Classifies orders by rarity/urgency and determines vibration intensity.
//! Rare orders (e.g. airplane cleaning, exotic repairs) get escalating
//! vibrations until the worker either accepts or goes offline.
//!
//! Workers can customize their vibration preferences in settings.

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// VIBRATION PATTERNS
// ═══════════════════════════════════════════════════════

/// Vibration pattern — sequence of (vibrate_ms, pause_ms) pairs
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct VibrationPattern {
    /// Human-readable name
    pub name: String,
    /// Sequence of durations: [vibrate, pause, vibrate, pause, ...]
    pub pattern_ms: Vec<u64>,
    /// How many times to repeat the full pattern
    pub repeat: u32,
    /// Delay between repeats (ms)
    pub repeat_delay_ms: u64,
}

impl VibrationPattern {
    /// Normal notification — single short buzz
    pub fn normal() -> Self {
        VibrationPattern {
            name: "Normal".into(),
            pattern_ms: vec![200],
            repeat: 1,
            repeat_delay_ms: 0,
        }
    }

    /// Urgent — double buzz
    pub fn urgent() -> Self {
        VibrationPattern {
            name: "Urgent".into(),
            pattern_ms: vec![300, 100, 300],
            repeat: 2,
            repeat_delay_ms: 500,
        }
    }

    /// Rare order — aggressive triple pulse, repeated
    pub fn rare() -> Self {
        VibrationPattern {
            name: "Rare".into(),
            pattern_ms: vec![400, 100, 400, 100, 400],
            repeat: 3,
            repeat_delay_ms: 800,
        }
    }

    /// Critical / escalated — long continuous buzz + pulses
    pub fn critical() -> Self {
        VibrationPattern {
            name: "Critical".into(),
            pattern_ms: vec![600, 150, 300, 150, 300, 150, 600],
            repeat: 5,
            repeat_delay_ms: 1000,
        }
    }

    /// Silent — no vibration (user disabled it)
    pub fn silent() -> Self {
        VibrationPattern {
            name: "Silent".into(),
            pattern_ms: vec![],
            repeat: 0,
            repeat_delay_ms: 0,
        }
    }

    /// Total duration of one cycle in ms
    pub fn cycle_duration_ms(&self) -> u64 {
        self.pattern_ms.iter().sum()
    }

    /// Total duration including all repeats
    pub fn total_duration_ms(&self) -> u64 {
        if self.repeat == 0 { return 0; }
        let cycle = self.cycle_duration_ms();
        cycle * self.repeat as u64 + self.repeat_delay_ms * (self.repeat.saturating_sub(1)) as u64
    }
}

// ═══════════════════════════════════════════════════════
// ORDER PRIORITY / RARITY
// ═══════════════════════════════════════════════════════

/// How rare/urgent is this order type
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum OrderPriority {
    /// Common services (plumbing, cleaning, etc.) — many workers available
    Normal,
    /// Time-sensitive (urgent locksmith, emergency plumbing)
    Urgent,
    /// Rare specialty — few workers, order may wait a long time
    Rare,
    /// Critical — rare + been waiting too long, needs escalation
    Critical,
}

impl OrderPriority {
    pub fn vibration_pattern(&self) -> VibrationPattern {
        match self {
            OrderPriority::Normal => VibrationPattern::normal(),
            OrderPriority::Urgent => VibrationPattern::urgent(),
            OrderPriority::Rare => VibrationPattern::rare(),
            OrderPriority::Critical => VibrationPattern::critical(),
        }
    }
}

// ═══════════════════════════════════════════════════════
// RARITY CLASSIFIER
// ═══════════════════════════════════════════════════════

/// Tracks how many online workers exist per skill to determine rarity
pub struct RarityClassifier {
    /// skill_id → number of online workers with that skill
    online_workers_per_skill: RwLock<HashMap<String, u32>>,
    /// Thresholds
    rare_threshold: u32,    // below this = rare
    #[allow(dead_code)]
    normal_threshold: u32,  // above this = normal (reserved for future use)
}

/// Rarity thresholds
const DEFAULT_RARE_THRESHOLD: u32 = 3;    // 3 or fewer workers = rare
const DEFAULT_NORMAL_THRESHOLD: u32 = 10;  // 10+ workers = definitely normal

impl RarityClassifier {
    pub fn new() -> Self {
        RarityClassifier {
            online_workers_per_skill: RwLock::new(HashMap::new()),
            rare_threshold: DEFAULT_RARE_THRESHOLD,
            normal_threshold: DEFAULT_NORMAL_THRESHOLD,
        }
    }

    /// Update the number of online workers for a skill
    pub fn update_online_count(&self, skill_id: &str, count: u32) {
        self.online_workers_per_skill.write().insert(skill_id.into(), count);
    }

    /// Worker went online for these skills
    pub fn worker_online(&self, skill_ids: &[String]) {
        let mut map = self.online_workers_per_skill.write();
        for id in skill_ids {
            *map.entry(id.clone()).or_insert(0) += 1;
        }
    }

    /// Worker went offline
    pub fn worker_offline(&self, skill_ids: &[String]) {
        let mut map = self.online_workers_per_skill.write();
        for id in skill_ids {
            if let Some(count) = map.get_mut(id) {
                *count = count.saturating_sub(1);
            }
        }
    }

    /// How many workers are online for this skill?
    pub fn online_count(&self, skill_id: &str) -> u32 {
        *self.online_workers_per_skill.read().get(skill_id).unwrap_or(&0)
    }

    /// Is this skill considered rare right now?
    pub fn is_rare(&self, skill_id: &str) -> bool {
        self.online_count(skill_id) <= self.rare_threshold
    }

    /// Classify an order's priority based on skill rarity and wait time
    pub fn classify_order(
        &self,
        skill_id: &str,
        is_urgent: bool,
        waiting_since_ms: u64,
    ) -> OrderPriority {
        let online = self.online_count(skill_id);
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let waited_secs = (now_ms.saturating_sub(waiting_since_ms)) / 1000;

        // Escalation: rare + waiting 10+ min → critical
        if online <= self.rare_threshold && waited_secs > 600 {
            return OrderPriority::Critical;
        }

        // Rare: few workers available
        if online <= self.rare_threshold {
            return OrderPriority::Rare;
        }

        // Urgent: time-sensitive flag
        if is_urgent {
            return OrderPriority::Urgent;
        }

        // Normal order that's been waiting too long → escalate
        if waited_secs > 1800 {
            return OrderPriority::Urgent; // 30 min wait = bump to urgent
        }

        OrderPriority::Normal
    }
}

// ═══════════════════════════════════════════════════════
// USER NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════

/// Per-user notification settings
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NotificationPrefs {
    /// Enable vibration at all
    pub vibration_enabled: bool,
    /// Custom vibration intensity multiplier (0.5 = gentle, 1.0 = normal, 2.0 = strong)
    pub vibration_intensity: f32,
    /// Override: always use this pattern regardless of priority
    pub custom_pattern: Option<VibrationPattern>,
    /// Enable sound with vibration
    pub sound_enabled: bool,
    /// Do Not Disturb hours (24h format)
    pub dnd_start_hour: Option<u8>,
    pub dnd_end_hour: Option<u8>,
    /// Accept rare order escalation (stronger vibrations for rare orders)
    /// Default: true for all workers
    pub rare_escalation_enabled: bool,
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        NotificationPrefs {
            vibration_enabled: true,
            vibration_intensity: 1.0,
            custom_pattern: None,
            sound_enabled: true,
            dnd_start_hour: None,
            dnd_end_hour: None,
            rare_escalation_enabled: true,
        }
    }
}

impl NotificationPrefs {
    /// Check if we're in DND period
    pub fn is_dnd_active(&self, current_hour: u8) -> bool {
        match (self.dnd_start_hour, self.dnd_end_hour) {
            (Some(start), Some(end)) => {
                if start <= end {
                    current_hour >= start && current_hour < end
                } else {
                    // Wraps midnight: e.g. 23:00 → 07:00
                    current_hour >= start || current_hour < end
                }
            }
            _ => false,
        }
    }
}

// ═══════════════════════════════════════════════════════
// NOTIFICATION ENGINE
// ═══════════════════════════════════════════════════════

/// What to actually send to the device
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NotificationPayload {
    /// Title text
    pub title: String,
    /// Body text
    pub body: String,
    /// Priority level
    pub priority: OrderPriority,
    /// Vibration pattern to play
    pub vibration: VibrationPattern,
    /// Play sound?
    pub play_sound: bool,
    /// Flat array of ms durations for the device API: [vibrate, pause, vibrate, ...]
    pub vibration_flat_ms: Vec<u64>,
}

pub struct NotificationEngine {
    pub classifier: RarityClassifier,
    user_prefs: RwLock<HashMap<String, NotificationPrefs>>,
}

impl NotificationEngine {
    pub fn new() -> Self {
        NotificationEngine {
            classifier: RarityClassifier::new(),
            user_prefs: RwLock::new(HashMap::new()),
        }
    }

    /// Set user's notification preferences
    pub fn set_prefs(&self, user_id: &str, prefs: NotificationPrefs) {
        self.user_prefs.write().insert(user_id.into(), prefs);
    }

    /// Get user's preferences (defaults if not set)
    pub fn get_prefs(&self, user_id: &str) -> NotificationPrefs {
        self.user_prefs.read().get(user_id).cloned().unwrap_or_default()
    }

    /// Build the notification payload for a specific worker receiving an order
    pub fn build_notification(
        &self,
        worker_id: &str,
        skill_id: &str,
        is_urgent: bool,
        waiting_since_ms: u64,
        title: &str,
        body: &str,
    ) -> Option<NotificationPayload> {
        let prefs = self.get_prefs(worker_id);

        // Check DND
        let hour = {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            ((now % 86400) / 3600) as u8
        };
        if prefs.is_dnd_active(hour) {
            return None; // Silent during DND
        }

        // Classify order priority
        let priority = self.classifier.classify_order(skill_id, is_urgent, waiting_since_ms);

        // Determine vibration pattern
        let base_pattern = if let Some(ref custom) = prefs.custom_pattern {
            custom.clone()
        } else if prefs.rare_escalation_enabled {
            priority.vibration_pattern()
        } else {
            // User disabled escalation — cap at urgent
            match priority {
                OrderPriority::Rare | OrderPriority::Critical => VibrationPattern::urgent(),
                other => other.vibration_pattern(),
            }
        };

        // Apply intensity multiplier
        let pattern = if prefs.vibration_enabled {
            let intensity = prefs.vibration_intensity.clamp(0.3, 3.0);
            VibrationPattern {
                name: base_pattern.name.clone(),
                pattern_ms: base_pattern.pattern_ms.iter()
                    .map(|&ms| (ms as f32 * intensity) as u64)
                    .collect(),
                repeat: base_pattern.repeat,
                repeat_delay_ms: base_pattern.repeat_delay_ms,
            }
        } else {
            VibrationPattern::silent()
        };

        // Build flat array for device API: [vib, pause, vib, pause, ...]
        let mut flat = Vec::new();
        for i in 0..pattern.repeat {
            flat.extend_from_slice(&pattern.pattern_ms);
            // Add inter-repeat gap (not after the last repeat)
            if pattern.repeat_delay_ms > 0 && i < pattern.repeat - 1 {
                flat.push(pattern.repeat_delay_ms);
            }
        }

        Some(NotificationPayload {
            title: title.into(),
            body: body.into(),
            priority,
            vibration: pattern,
            play_sound: prefs.sound_enabled,
            vibration_flat_ms: flat,
        })
    }
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vibration_patterns() {
        let normal = VibrationPattern::normal();
        assert_eq!(normal.cycle_duration_ms(), 200);
        assert_eq!(normal.total_duration_ms(), 200);

        let rare = VibrationPattern::rare();
        assert_eq!(rare.pattern_ms.len(), 5);
        assert_eq!(rare.repeat, 3);
        assert!(rare.total_duration_ms() > 3000);

        let silent = VibrationPattern::silent();
        assert_eq!(silent.total_duration_ms(), 0);
    }

    #[test]
    fn test_rarity_classification() {
        let classifier = RarityClassifier::new();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // No workers online → rare (just created now)
        assert!(classifier.is_rare("exotic_skill"));
        assert_eq!(
            classifier.classify_order("exotic_skill", false, now),
            OrderPriority::Rare
        );

        // Add 20 workers → normal
        classifier.update_online_count("common_skill", 20);
        assert!(!classifier.is_rare("common_skill"));
        assert_eq!(
            classifier.classify_order("common_skill", false, now),
            OrderPriority::Normal
        );

        // Urgent flag
        assert_eq!(
            classifier.classify_order("common_skill", true, now),
            OrderPriority::Urgent
        );
    }

    #[test]
    fn test_escalation_by_wait_time() {
        let classifier = RarityClassifier::new();
        classifier.update_online_count("rare_skill", 2); // below threshold

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // Just created → rare
        assert_eq!(
            classifier.classify_order("rare_skill", false, now),
            OrderPriority::Rare
        );

        // Waited 11 minutes → critical
        let eleven_min_ago = now - 11 * 60 * 1000;
        assert_eq!(
            classifier.classify_order("rare_skill", false, eleven_min_ago),
            OrderPriority::Critical
        );

        // Normal skill waited 31 min → bumped to urgent
        classifier.update_online_count("normal_skill", 15);
        let thirty_one_min_ago = now - 31 * 60 * 1000;
        assert_eq!(
            classifier.classify_order("normal_skill", false, thirty_one_min_ago),
            OrderPriority::Urgent
        );
    }

    #[test]
    fn test_worker_online_offline() {
        let classifier = RarityClassifier::new();

        let skills = vec!["clean_deep".to_string(), "clean_home".to_string()];
        classifier.worker_online(&skills);
        assert_eq!(classifier.online_count("clean_deep"), 1);

        classifier.worker_online(&skills);
        assert_eq!(classifier.online_count("clean_deep"), 2);

        classifier.worker_offline(&skills);
        assert_eq!(classifier.online_count("clean_deep"), 1);
    }

    #[test]
    fn test_notification_engine_normal() {
        let engine = NotificationEngine::new();
        engine.classifier.update_online_count("plumb_general", 15);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let payload = engine.build_notification(
            "worker1", "plumb_general", false, now,
            "Новый заказ", "Сантехник нужен на ул. Пушкина",
        ).unwrap();

        assert_eq!(payload.priority, OrderPriority::Normal);
        assert_eq!(payload.vibration.name, "Normal");
        assert!(payload.vibration_flat_ms.len() >= 1);
    }

    #[test]
    fn test_notification_engine_rare() {
        let engine = NotificationEngine::new();
        // Only 1 worker for this skill
        engine.classifier.update_online_count("rent_medical", 1);

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let payload = engine.build_notification(
            "worker1", "rent_medical", false, now,
            "Редкий заказ!", "Медтехника — аренда кислородного аппарата",
        ).unwrap();

        assert_eq!(payload.priority, OrderPriority::Rare);
        assert_eq!(payload.vibration.name, "Rare");
        assert!(payload.vibration.repeat >= 3);
        // Should be much longer than normal
        assert!(payload.vibration.total_duration_ms() > 2000);
    }

    #[test]
    fn test_user_disables_escalation() {
        let engine = NotificationEngine::new();
        engine.classifier.update_online_count("exotic_skill", 0);

        engine.set_prefs("worker2", NotificationPrefs {
            rare_escalation_enabled: false,
            ..Default::default()
        });

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let payload = engine.build_notification(
            "worker2", "exotic_skill", false, now,
            "Заказ", "Test",
        ).unwrap();

        // Priority is still Rare but vibration capped at Urgent
        assert_eq!(payload.priority, OrderPriority::Rare);
        assert_eq!(payload.vibration.name, "Urgent");
    }

    #[test]
    fn test_dnd_blocks_notification() {
        let prefs = NotificationPrefs {
            dnd_start_hour: Some(23),
            dnd_end_hour: Some(7),
            ..Default::default()
        };

        assert!(prefs.is_dnd_active(0));   // midnight
        assert!(prefs.is_dnd_active(3));   // 3am
        assert!(prefs.is_dnd_active(6));   // 6am
        assert!(!prefs.is_dnd_active(7));  // 7am - DND ends
        assert!(!prefs.is_dnd_active(12)); // noon
        assert!(prefs.is_dnd_active(23));  // 11pm - DND starts
    }

    #[test]
    fn test_vibration_intensity() {
        let engine = NotificationEngine::new();
        engine.classifier.update_online_count("test_skill", 15);

        // User sets 2x intensity
        engine.set_prefs("strong_worker", NotificationPrefs {
            vibration_intensity: 2.0,
            ..Default::default()
        });

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let payload = engine.build_notification(
            "strong_worker", "test_skill", false, now,
            "Test", "Test",
        ).unwrap();

        // Normal pattern is 200ms, with 2x should be 400ms
        assert_eq!(payload.vibration.pattern_ms[0], 400);
    }
}
