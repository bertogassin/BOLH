//! BOLH Expert Mission System
//!
//! Hire an expert to do anything on your behalf: inspect, buy, deliver,
//! represent, check — whatever you need, wherever you need it.
//!
//! Examples:
//! - Buy a car in another city → expert inspects, buys, insures, delivers.
//! - Check an apartment before renting → expert visits, takes photos/video.
//! - Need tech diagnosed before purchase → expert runs full diagnostics.
//!
//! Works across ALL departments — auto, rental, delivery, repairs, etc.
//!
//! Mission lifecycle:
//!   Created → Accepted → InProgress → [SubTasks] → Reporting → Confirmed
//!
//! Integrates with:
//! - delivery.rs (expert needs transport)
//! - rental.rs (temporary insurance, equipment)
//! - system_rules.rs (cancellation law)
//! - contract.rs (escrow for purchases)

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// MISSION TYPES
// ═══════════════════════════════════════════════════════

/// What the expert needs to do
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum MissionType {
    /// Go look at something and report back (photos, video, assessment)
    Inspect,
    /// Inspect + negotiate + purchase on behalf of client
    InspectAndBuy,
    /// Pick up / deliver something the client can't do themselves
    PickupDeliver,
    /// Full service: inspect, buy, insure, deliver
    FullService,
    /// Represent client at a meeting, signing, viewing
    Represent,
    /// Technical check (car diagnostics, apartment inspection, etc.)
    TechnicalCheck,
    /// Custom mission — client describes what they need
    Custom,
}

impl MissionType {
    pub fn name_ru(&self) -> &'static str {
        match self {
            MissionType::Inspect => "Осмотр",
            MissionType::InspectAndBuy => "Осмотр + Покупка",
            MissionType::PickupDeliver => "Забрать + Доставить",
            MissionType::FullService => "Полный сервис",
            MissionType::Represent => "Представительство",
            MissionType::TechnicalCheck => "Техническая проверка",
            MissionType::Custom => "Индивидуальное задание",
        }
    }

    pub fn name_en(&self) -> &'static str {
        match self {
            MissionType::Inspect => "Inspection",
            MissionType::InspectAndBuy => "Inspect & Buy",
            MissionType::PickupDeliver => "Pickup & Deliver",
            MissionType::FullService => "Full Service",
            MissionType::Represent => "Representation",
            MissionType::TechnicalCheck => "Technical Check",
            MissionType::Custom => "Custom Mission",
        }
    }

    /// Base complexity multiplier for pricing
    pub fn complexity(&self) -> f64 {
        match self {
            MissionType::Inspect => 1.0,
            MissionType::InspectAndBuy => 2.5,
            MissionType::PickupDeliver => 1.8,
            MissionType::FullService => 4.0,
            MissionType::Represent => 2.0,
            MissionType::TechnicalCheck => 1.5,
            MissionType::Custom => 2.0,
        }
    }
}

// ═══════════════════════════════════════════════════════
// MISSION SUB-TASKS
// ═══════════════════════════════════════════════════════

/// Individual step within a mission
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SubTask {
    pub id: String,
    pub description: String,
    pub completed: bool,
    pub completed_at_ms: Option<u64>,
    /// Evidence: photo/video hashes, notes
    pub evidence: Vec<String>,
    pub notes: String,
}

// ═══════════════════════════════════════════════════════
// PURCHASE AUTHORITY
// ═══════════════════════════════════════════════════════

/// If the expert is authorized to buy something
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PurchaseAuthority {
    /// Maximum amount the expert can spend (in raw BOLH)
    pub max_budget: u64,
    /// What to buy (description)
    pub target_description: String,
    /// Minimum acceptable condition (1-5)
    pub min_condition: u8,
    /// Must get client approval before purchasing?
    pub requires_approval: bool,
    /// Temporary insurance budget (for vehicle transport, etc.)
    pub insurance_budget: u64,
    /// Delivery method after purchase
    pub delivery_method: String, // "drive", "tow", "courier", "ship"
}

// ═══════════════════════════════════════════════════════
// MISSION STATE
// ═══════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum MissionState {
    /// Client created the mission, waiting for expert
    Created,
    /// Expert accepted
    Accepted,
    /// Expert is on the way / working
    InProgress,
    /// Expert needs client decision (e.g. "should I buy this car?")
    AwaitingDecision,
    /// Expert submitting final report
    Reporting,
    /// Client confirmed completion
    Confirmed,
    /// Dispute
    Disputed,
    /// Cancelled
    Cancelled,
}

// ═══════════════════════════════════════════════════════
// MISSION
// ═══════════════════════════════════════════════════════

/// An expert proxy mission
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Mission {
    pub id: String,
    /// Client who ordered the mission
    pub client_id: String,
    /// Assigned expert (None until accepted)
    pub expert_id: Option<String>,
    /// Mission details
    pub mission_type: MissionType,
    pub title: String,
    pub description: String,
    /// Optional private note (not displayed publicly)
    pub client_note: Option<String>,
    /// Which department / skill this relates to
    pub department_id: String,
    pub skill_id: String,
    /// Location where the expert needs to go
    pub target_lat: f64,
    pub target_lon: f64,
    pub target_address: String,
    /// Client's location (may be different city/country)
    pub client_lat: f64,
    pub client_lon: f64,
    pub client_city: String,
    /// Purchase authority (if applicable)
    pub purchase_authority: Option<PurchaseAuthority>,
    /// Sub-tasks (checklist)
    pub subtasks: Vec<SubTask>,
    /// Pricing
    pub expert_fee: u64,          // Expert's service fee
    pub travel_budget: u64,       // Budget for travel
    pub purchase_escrow: u64,     // Locked funds for potential purchase
    pub total_locked: u64,        // Total in escrow
    /// State
    pub state: MissionState,
    pub escrow_id: Option<String>,
    /// Communication
    pub live_updates: Vec<MissionUpdate>,
    /// Timestamps
    pub created_at_ms: u64,
    pub accepted_at_ms: Option<u64>,
    pub started_at_ms: Option<u64>,
    pub completed_at_ms: Option<u64>,
    /// Rating
    pub client_rating: Option<f32>,
    pub expert_rating: Option<f32>,
}

/// Real-time update from expert to client
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MissionUpdate {
    pub timestamp_ms: u64,
    pub update_type: UpdateType,
    pub message: String,
    /// Photo/video evidence
    pub media: Vec<String>,
    /// GPS location when update was sent
    pub lat: Option<f64>,
    pub lon: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum UpdateType {
    /// Expert arrived at location
    Arrived,
    /// Photo/video of the item
    MediaReport,
    /// Expert's professional assessment
    Assessment,
    /// Asking client for a decision
    DecisionNeeded,
    /// Purchase completed
    Purchased,
    /// On the way to deliver
    Delivering,
    /// General text update
    TextUpdate,
}

// ═══════════════════════════════════════════════════════
// EXPERT PROFILE (proxy capabilities)
// ═══════════════════════════════════════════════════════

/// Expert's proxy profile — what they can do on behalf of others
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExpertProfile {
    pub user_id: String,
    /// Departments/skills the expert covers
    pub skills: Vec<String>,
    /// Mission types they accept
    pub accepted_missions: Vec<MissionType>,
    /// Max distance they're willing to travel (km)
    pub max_travel_km: f64,
    /// Can handle purchases (needs verified identity)
    pub purchase_capable: bool,
    /// Has vehicle for transport missions
    pub has_vehicle: bool,
    /// Languages spoken
    pub languages: Vec<String>,
    /// Rating
    pub total_missions: u32,
    pub avg_rating: f32,
    /// Verified identity (required for purchase missions)
    pub identity_verified: bool,
    /// Online status
    pub is_online: bool,
    /// Hourly rate (raw BOLH)
    pub hourly_rate: u64,
}

// ═══════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════

pub struct ProxyExpertEngine {
    missions: RwLock<HashMap<String, Mission>>,
    experts: RwLock<HashMap<String, ExpertProfile>>,
    /// client_id → mission IDs
    client_missions: RwLock<HashMap<String, Vec<String>>>,
    /// expert_id → mission IDs
    expert_missions: RwLock<HashMap<String, Vec<String>>>,
    mission_counter: RwLock<u64>,
}

impl ProxyExpertEngine {
    pub fn new() -> Self {
        ProxyExpertEngine {
            missions: RwLock::new(HashMap::new()),
            experts: RwLock::new(HashMap::new()),
            client_missions: RwLock::new(HashMap::new()),
            expert_missions: RwLock::new(HashMap::new()),
            mission_counter: RwLock::new(0),
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    // ─── EXPERT REGISTRATION ────────────────────────────

    /// Register as a proxy expert
    pub fn register_expert(&self, profile: ExpertProfile) {
        let id = profile.user_id.clone();
        self.experts.write().insert(id, profile);
    }

    /// Update expert's online status
    pub fn set_expert_online(&self, user_id: &str, online: bool) -> bool {
        if let Some(expert) = self.experts.write().get_mut(user_id) {
            expert.is_online = online;
            true
        } else {
            false
        }
    }

    /// Find experts matching a mission
    pub fn find_experts(
        &self,
        skill_id: &str,
        mission_type: &MissionType,
        _target_lat: f64,
        _target_lon: f64,
        needs_purchase: bool,
    ) -> Vec<ExpertProfile> {
        let experts = self.experts.read();
        experts.values()
            .filter(|e| e.is_online)
            .filter(|e| e.skills.contains(&skill_id.to_string()))
            .filter(|e| e.accepted_missions.contains(mission_type))
            .filter(|e| !needs_purchase || (e.purchase_capable && e.identity_verified))
            .filter(|e| {
                // Check if within travel range (rough check from 0,0 — 
                // in production, use expert's actual location)
                e.max_travel_km > 0.0 // simplified: accept if they have any range
            })
            .cloned()
            .collect()
    }

    // ─── MISSION LIFECYCLE ──────────────────────────────

    /// Client creates a new mission
    pub fn create_mission(
        &self,
        client_id: &str,
        mission_type: MissionType,
        title: &str,
        description: &str,
        client_note: Option<&str>,
        department_id: &str,
        skill_id: &str,
        target_lat: f64,
        target_lon: f64,
        target_address: &str,
        client_lat: f64,
        client_lon: f64,
        client_city: &str,
        expert_fee: u64,
        travel_budget: u64,
        purchase_authority: Option<PurchaseAuthority>,
        subtasks: Vec<String>,
    ) -> String {
        let mut counter = self.mission_counter.write();
        *counter += 1;
        let id = format!("MISSION-{:06}", *counter);

        let purchase_escrow = purchase_authority.as_ref()
            .map(|pa| pa.max_budget + pa.insurance_budget)
            .unwrap_or(0);

        let total_locked = expert_fee + travel_budget + purchase_escrow;

        let subtask_items: Vec<SubTask> = subtasks.iter().enumerate().map(|(i, desc)| {
            SubTask {
                id: format!("{}-ST-{}", id, i + 1),
                description: desc.clone(),
                completed: false,
                completed_at_ms: None,
                evidence: vec![],
                notes: String::new(),
            }
        }).collect();

        let now = Self::now_ms();

        let mission = Mission {
            id: id.clone(),
            client_id: client_id.into(),
            expert_id: None,
            mission_type,
            title: title.into(),
            description: description.into(),
            client_note: client_note.map(|s| s.to_string()),
            department_id: department_id.into(),
            skill_id: skill_id.into(),
            target_lat,
            target_lon,
            target_address: target_address.into(),
            client_lat,
            client_lon,
            client_city: client_city.into(),
            purchase_authority,
            subtasks: subtask_items,
            expert_fee,
            travel_budget,
            purchase_escrow,
            total_locked,
            state: MissionState::Created,
            escrow_id: None,
            live_updates: vec![],
            created_at_ms: now,
            accepted_at_ms: None,
            started_at_ms: None,
            completed_at_ms: None,
            client_rating: None,
            expert_rating: None,
        };

        self.missions.write().insert(id.clone(), mission);
        self.client_missions.write()
            .entry(client_id.into())
            .or_default()
            .push(id.clone());

        id
    }

    /// Expert accepts a mission
    pub fn accept_mission(&self, mission_id: &str, expert_id: &str, escrow_id: &str) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::Created {
            return Err("Mission is not available".into());
        }

        // Verify expert exists and is qualified
        let experts = self.experts.read();
        let expert = experts.get(expert_id)
            .ok_or("Expert not registered")?;

        if !expert.skills.contains(&mission.skill_id) {
            return Err("Expert doesn't have the required skill".into());
        }

        if mission.purchase_authority.is_some() && (!expert.purchase_capable || !expert.identity_verified) {
            return Err("Expert not authorized for purchases (identity not verified)".into());
        }

        drop(experts);

        mission.expert_id = Some(expert_id.into());
        mission.state = MissionState::Accepted;
        mission.accepted_at_ms = Some(Self::now_ms());
        mission.escrow_id = Some(escrow_id.into());

        self.expert_missions.write()
            .entry(expert_id.into())
            .or_default()
            .push(mission_id.into());

        Ok(())
    }

    /// Expert starts working on the mission
    pub fn start_mission(&self, mission_id: &str) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::Accepted {
            return Err("Mission is not in Accepted state".into());
        }

        mission.state = MissionState::InProgress;
        mission.started_at_ms = Some(Self::now_ms());
        Ok(())
    }

    /// Expert sends a live update to the client
    pub fn add_update(
        &self,
        mission_id: &str,
        update_type: UpdateType,
        message: &str,
        media: Vec<String>,
        lat: Option<f64>,
        lon: Option<f64>,
    ) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::InProgress && mission.state != MissionState::AwaitingDecision {
            return Err("Mission is not active".into());
        }

        // If expert asks for decision → change state
        if update_type == UpdateType::DecisionNeeded {
            mission.state = MissionState::AwaitingDecision;
        }

        mission.live_updates.push(MissionUpdate {
            timestamp_ms: Self::now_ms(),
            update_type,
            message: message.into(),
            media,
            lat,
            lon,
        });

        Ok(())
    }

    /// Client responds to a decision request
    pub fn client_decision(&self, mission_id: &str, approved: bool, note: &str) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::AwaitingDecision {
            return Err("No decision pending".into());
        }

        mission.state = MissionState::InProgress;
        mission.live_updates.push(MissionUpdate {
            timestamp_ms: Self::now_ms(),
            update_type: UpdateType::TextUpdate,
            message: format!(
                "Client {}: {}{}",
                if approved { "APPROVED" } else { "DECLINED" },
                note,
                if approved { "" } else { " — Expert should proceed accordingly." }
            ),
            media: vec![],
            lat: None,
            lon: None,
        });

        Ok(())
    }

    /// Complete a subtask
    pub fn complete_subtask(
        &self,
        mission_id: &str,
        subtask_id: &str,
        evidence: Vec<String>,
        notes: &str,
    ) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        let subtask = mission.subtasks.iter_mut()
            .find(|s| s.id == subtask_id)
            .ok_or("Subtask not found")?;

        subtask.completed = true;
        subtask.completed_at_ms = Some(Self::now_ms());
        subtask.evidence = evidence;
        subtask.notes = notes.into();

        Ok(())
    }

    /// Expert submits final report
    pub fn submit_report(&self, mission_id: &str) -> Result<(), String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::InProgress {
            return Err("Mission is not in progress".into());
        }

        mission.state = MissionState::Reporting;
        Ok(())
    }

    /// Client confirms mission completion → funds released
    pub fn confirm_mission(
        &self,
        mission_id: &str,
        client_rating: f32,
    ) -> Result<MissionSettlement, String> {
        let mut missions = self.missions.write();
        let mission = missions.get_mut(mission_id)
            .ok_or("Mission not found")?;

        if mission.state != MissionState::Reporting {
            return Err("Mission is not in Reporting state".into());
        }

        mission.state = MissionState::Confirmed;
        mission.completed_at_ms = Some(Self::now_ms());
        mission.client_rating = Some(client_rating.clamp(1.0, 5.0));

        // Update expert stats
        if let Some(ref expert_id) = mission.expert_id {
            if let Some(expert) = self.experts.write().get_mut(expert_id) {
                expert.total_missions += 1;
                let prev_total = expert.total_missions - 1;
                expert.avg_rating = (expert.avg_rating * prev_total as f32 + client_rating)
                    / expert.total_missions as f32;
            }
        }

        // Calculate settlement
        let expert_receives = mission.expert_fee + mission.travel_budget;
        let purchase_refund = mission.purchase_escrow; // return unused purchase funds

        Ok(MissionSettlement {
            mission_id: mission_id.into(),
            expert_receives,
            purchase_spent: 0, // TODO: track actual purchase amount
            purchase_refund,
            total_released: expert_receives + purchase_refund,
        })
    }

    /// Get mission by ID
    pub fn get_mission(&self, mission_id: &str) -> Option<Mission> {
        self.missions.read().get(mission_id).cloned()
    }

    /// Get client's missions
    pub fn client_missions(&self, client_id: &str) -> Vec<Mission> {
        let index = self.client_missions.read();
        let ids = match index.get(client_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };
        let missions = self.missions.read();
        ids.iter().filter_map(|id| missions.get(id).cloned()).collect()
    }

    /// Stats
    pub fn stats(&self) -> ProxyStats {
        let missions = self.missions.read();
        let experts = self.experts.read();
        ProxyStats {
            total_missions: missions.len() as u32,
            active_missions: missions.values()
                .filter(|m| matches!(m.state, MissionState::InProgress | MissionState::AwaitingDecision))
                .count() as u32,
            completed_missions: missions.values()
                .filter(|m| m.state == MissionState::Confirmed)
                .count() as u32,
            total_experts: experts.len() as u32,
            online_experts: experts.values().filter(|e| e.is_online).count() as u32,
        }
    }
}

// ═══════════════════════════════════════════════════════
// SETTLEMENT & STATS
// ═══════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MissionSettlement {
    pub mission_id: String,
    pub expert_receives: u64,
    pub purchase_spent: u64,
    pub purchase_refund: u64,
    pub total_released: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProxyStats {
    pub total_missions: u32,
    pub active_missions: u32,
    pub completed_missions: u32,
    pub total_experts: u32,
    pub online_experts: u32,
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

    fn make_expert(id: &str, skill: &str, purchase_capable: bool) -> ExpertProfile {
        ExpertProfile {
            user_id: id.into(),
            skills: vec![skill.into()],
            accepted_missions: vec![
                MissionType::Inspect,
                MissionType::InspectAndBuy,
                MissionType::FullService,
                MissionType::TechnicalCheck,
            ],
            max_travel_km: 500.0,
            purchase_capable,
            has_vehicle: true,
            languages: vec!["ru".into(), "en".into()],
            total_missions: 0,
            avg_rating: 0.0,
            identity_verified: purchase_capable,
            is_online: true,
            hourly_rate: bolh(50),
        }
    }

    #[test]
    fn test_full_mission_lifecycle() {
        let engine = ProxyExpertEngine::new();

        // Register expert
        engine.register_expert(make_expert("expert1", "auto_expert", true));

        // Client creates mission: inspect & buy a car
        let mission_id = engine.create_mission(
            "client_abroad",
            MissionType::InspectAndBuy,
            "Купить BMW X5 2020",
            "Машина на Авито, нужно осмотреть и если ок — купить и доставить",
            None,
            "auto",
            "auto_expert",
            55.75, 37.62, "Москва, ул. Ленина 15",
            40.71, -74.00, "New York, USA",
            bolh(200),   // expert fee
            bolh(50),    // travel
            Some(PurchaseAuthority {
                max_budget: bolh(30_000),
                target_description: "BMW X5 2020, белый, до 100к км".into(),
                min_condition: 4,
                requires_approval: true,
                insurance_budget: bolh(500),
                delivery_method: "drive".into(),
            }),
            vec![
                "Приехать на адрес".into(),
                "Осмотреть кузов, салон".into(),
                "Проверить документы".into(),
                "Тест-драйв".into(),
                "Фото/видео отчёт".into(),
                "Ждать решения клиента".into(),
            ],
        );
        assert!(mission_id.starts_with("MISSION-"));

        let m = engine.get_mission(&mission_id).unwrap();
        assert_eq!(m.state, MissionState::Created);
        assert_eq!(m.subtasks.len(), 6);
        assert_eq!(m.total_locked, bolh(200) + bolh(50) + bolh(30_000) + bolh(500));

        // Expert accepts
        engine.accept_mission(&mission_id, "expert1", "ESC-M-001").unwrap();
        let m = engine.get_mission(&mission_id).unwrap();
        assert_eq!(m.state, MissionState::Accepted);
        assert_eq!(m.expert_id, Some("expert1".to_string()));

        // Expert starts
        engine.start_mission(&mission_id).unwrap();

        // Expert arrives and sends update
        engine.add_update(
            &mission_id, UpdateType::Arrived,
            "Приехал на место, машина здесь", vec!["photo1.jpg".into()],
            Some(55.75), Some(37.62),
        ).unwrap();

        // Complete subtasks
        engine.complete_subtask(&mission_id, &format!("{}-ST-1", mission_id), vec![], "Приехал").unwrap();
        engine.complete_subtask(&mission_id, &format!("{}-ST-2", mission_id), vec!["body.jpg".into()], "Кузов чистый, без царапин").unwrap();

        // Expert asks: should I buy?
        engine.add_update(
            &mission_id, UpdateType::DecisionNeeded,
            "Машина в отличном состоянии. Цена 28000 BOLH. Покупать?",
            vec!["full_report.mp4".into()],
            None, None,
        ).unwrap();

        let m = engine.get_mission(&mission_id).unwrap();
        assert_eq!(m.state, MissionState::AwaitingDecision);

        // Client approves
        engine.client_decision(&mission_id, true, "Да, покупай! Спасибо!").unwrap();
        let m = engine.get_mission(&mission_id).unwrap();
        assert_eq!(m.state, MissionState::InProgress);

        // Expert completes remaining subtasks and submits report
        engine.submit_report(&mission_id).unwrap();

        // Client confirms
        let settlement = engine.confirm_mission(&mission_id, 5.0).unwrap();
        assert_eq!(settlement.expert_receives, bolh(250)); // 200 fee + 50 travel

        let m = engine.get_mission(&mission_id).unwrap();
        assert_eq!(m.state, MissionState::Confirmed);
    }

    #[test]
    fn test_custom_mission() {
        let engine = ProxyExpertEngine::new();
        engine.register_expert(make_expert("helper1", "handy_general", false));

        let mid = engine.create_mission(
            "user123",
            MissionType::Custom,
            "Повесить полки и карнизы",
            "Нужен мастер, сам не могу — нужно 3 полки и карниз",
            Some("Позвоните заранее"),
            "handyman",
            "handy_general",
            55.75, 37.62, "Москва, мой адрес",
            55.75, 37.62, "Москва",
            bolh(100), bolh(0), None,
            vec!["Повесить 3 полки".into(), "Установить карниз".into()],
        );

        let m = engine.get_mission(&mid).unwrap();
        assert_eq!(m.subtasks.len(), 2);
        assert_eq!(m.client_note, Some("Позвоните заранее".to_string()));
    }

    #[test]
    fn test_find_experts() {
        let engine = ProxyExpertEngine::new();

        engine.register_expert(make_expert("exp1", "auto_expert", true));
        engine.register_expert(make_expert("exp2", "auto_expert", false));
        engine.register_expert(make_expert("exp3", "plumb_expert", true));

        // Find auto experts who can purchase
        let results = engine.find_experts(
            "auto_expert", &MissionType::InspectAndBuy,
            55.75, 37.62, true,
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].user_id, "exp1");

        // Find auto experts, no purchase needed
        let results = engine.find_experts(
            "auto_expert", &MissionType::Inspect,
            55.75, 37.62, false,
        );
        assert_eq!(results.len(), 2); // both exp1 and exp2
    }

    #[test]
    fn test_expert_rating_accumulation() {
        let engine = ProxyExpertEngine::new();
        engine.register_expert(make_expert("exp1", "auto_expert", false));

        // Mission 1: rated 5.0
        let m1 = engine.create_mission(
            "c1", MissionType::Inspect,
            "Test 1", "", None, "auto", "auto_expert",
            0.0, 0.0, "", 0.0, 0.0, "",
            bolh(100), 0, None, vec![],
        );
        engine.accept_mission(&m1, "exp1", "E1").unwrap();
        engine.start_mission(&m1).unwrap();
        engine.submit_report(&m1).unwrap();
        engine.confirm_mission(&m1, 5.0).unwrap();

        // Mission 2: rated 3.0
        let m2 = engine.create_mission(
            "c2", MissionType::Inspect,
            "Test 2", "", None, "auto", "auto_expert",
            0.0, 0.0, "", 0.0, 0.0, "",
            bolh(100), 0, None, vec![],
        );
        engine.accept_mission(&m2, "exp1", "E2").unwrap();
        engine.start_mission(&m2).unwrap();
        engine.submit_report(&m2).unwrap();
        engine.confirm_mission(&m2, 3.0).unwrap();

        // Average should be 4.0
        let expert = engine.experts.read().get("exp1").cloned().unwrap();
        assert_eq!(expert.total_missions, 2);
        assert!((expert.avg_rating - 4.0).abs() < 0.01);
    }
}
