//! BOLH Internship System
//!
//! Two-sided matching for every profession on the platform:
//! - "Ищу стажёра" — professionals/companies post internship openings
//! - "Ищу стаж"    — people looking to learn & gain experience
//!
//! Applies to ALL departments. Drives massive registration from both sides:
//! young people seeking experience, and businesses seeking fresh talent.
//!
//! Features:
//! - Post / search internships across any department & skill
//! - Duration-based (days, weeks, months)
//! - Paid or unpaid (with optional BOLH stipend)
//! - Rating & review after completion
//! - Mentor matching (experienced worker ↔ intern)
//! - Portfolio building (completed internships show on profile)

use std::collections::HashMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

/// Which side of the internship
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum InternshipSide {
    /// Professional/company looking for an intern
    SeekingIntern,
    /// Person looking for an internship
    SeekingInternship,
}

impl InternshipSide {
    pub fn name_ru(&self) -> &'static str {
        match self {
            InternshipSide::SeekingIntern => "Ищу стажёра",
            InternshipSide::SeekingInternship => "Ищу стаж",
        }
    }
    pub fn name_en(&self) -> &'static str {
        match self {
            InternshipSide::SeekingIntern => "Looking for intern",
            InternshipSide::SeekingInternship => "Looking for internship",
        }
    }
}

/// Compensation type
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum Compensation {
    /// No pay — experience only
    Unpaid,
    /// Fixed stipend in BOLH for the whole period
    FixedStipend(u64),
    /// Hourly rate in BOLH
    HourlyRate(u64),
    /// Negotiable — agree during matching
    Negotiable,
}

/// Duration of the internship
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum Duration {
    /// Single day trial
    OneDay,
    /// Specific number of days
    Days(u32),
    /// Weeks
    Weeks(u32),
    /// Months
    Months(u32),
    /// Ongoing / flexible
    Flexible,
}

impl Duration {
    pub fn label_ru(&self) -> String {
        match self {
            Duration::OneDay => "1 день (пробный)".into(),
            Duration::Days(d) => format!("{} дн.", d),
            Duration::Weeks(w) => format!("{} нед.", w),
            Duration::Months(m) => format!("{} мес.", m),
            Duration::Flexible => "Гибкий срок".into(),
        }
    }
    pub fn label_en(&self) -> String {
        match self {
            Duration::OneDay => "1 day (trial)".into(),
            Duration::Days(d) => format!("{} days", d),
            Duration::Weeks(w) => format!("{} weeks", w),
            Duration::Months(m) => format!("{} months", m),
            Duration::Flexible => "Flexible".into(),
        }
    }
}

/// Schedule preference
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum Schedule {
    FullTime,
    PartTime,
    Weekends,
    Evenings,
    Flexible,
}

impl Schedule {
    pub fn label_ru(&self) -> &'static str {
        match self {
            Schedule::FullTime => "Полный день",
            Schedule::PartTime => "Частичная занятость",
            Schedule::Weekends => "Выходные",
            Schedule::Evenings => "Вечернее время",
            Schedule::Flexible => "Гибкий график",
        }
    }
    pub fn label_en(&self) -> &'static str {
        match self {
            Schedule::FullTime => "Full time",
            Schedule::PartTime => "Part time",
            Schedule::Weekends => "Weekends",
            Schedule::Evenings => "Evenings",
            Schedule::Flexible => "Flexible",
        }
    }
}

// ═══════════════════════════════════════════════════════
// POSTING
// ═══════════════════════════════════════════════════════

/// A posting — either "seeking intern" or "seeking internship"
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InternshipPost {
    pub id: String,
    pub user_id: String,
    pub side: InternshipSide,
    /// Department (e.g. "auto", "plumbing", "tech")
    pub department_id: String,
    /// Specific skill (e.g. "auto_expert", "plumb_general")
    pub skill_id: String,
    /// Title
    pub title: String,
    pub description: String,
    /// Location
    pub city: String,
    pub lat: f64,
    pub lon: f64,
    /// Can be done remotely?
    pub remote_ok: bool,
    /// Terms
    pub compensation: Compensation,
    pub duration: Duration,
    pub schedule: Schedule,
    /// What the intern will learn (for SeekingIntern posts)
    /// What the person wants to learn (for SeekingInternship posts)
    pub learning_goals: Vec<String>,
    /// Requirements (for SeekingIntern: what they expect)
    /// Skills already known (for SeekingInternship: what they offer)
    pub requirements: Vec<String>,
    /// Active?
    pub is_active: bool,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
    /// How many applications received / sent
    pub application_count: u32,
}

// ═══════════════════════════════════════════════════════
// APPLICATION
// ═══════════════════════════════════════════════════════

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum ApplicationState {
    Pending,
    Accepted,
    Declined,
    Withdrawn,
}

/// Application to a posting
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Application {
    pub id: String,
    pub post_id: String,
    /// Who applied
    pub applicant_id: String,
    /// Who posted
    pub poster_id: String,
    pub message: String,
    pub state: ApplicationState,
    pub created_at_ms: u64,
    pub responded_at_ms: Option<u64>,
}

// ═══════════════════════════════════════════════════════
// ACTIVE INTERNSHIP
// ═══════════════════════════════════════════════════════

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum InternshipState {
    Active,
    Completed,
    CancelledByMentor,
    CancelledByIntern,
}

/// An ongoing internship (after application accepted)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActiveInternship {
    pub id: String,
    pub post_id: String,
    pub mentor_id: String,
    pub intern_id: String,
    pub department_id: String,
    pub skill_id: String,
    pub state: InternshipState,
    /// Progress log
    pub log_entries: Vec<LogEntry>,
    /// Agreed terms
    pub compensation: Compensation,
    pub duration: Duration,
    pub schedule: Schedule,
    /// Timestamps
    pub started_at_ms: u64,
    pub completed_at_ms: Option<u64>,
    /// Reviews (filled after completion)
    pub mentor_review: Option<Review>,
    pub intern_review: Option<Review>,
}

/// Progress log entry
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp_ms: u64,
    pub author_id: String,
    pub text: String,
    /// Skill milestones reached
    pub milestones: Vec<String>,
}

/// Post-internship review
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Review {
    pub rating: f32,       // 1.0 — 5.0
    pub text: String,
    pub skills_confirmed: Vec<String>,
    pub would_recommend: bool,
    pub created_at_ms: u64,
}

// ═══════════════════════════════════════════════════════
// PORTFOLIO ENTRY (shows on profile)
// ═══════════════════════════════════════════════════════

/// Completed internship → portfolio item
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PortfolioEntry {
    pub internship_id: String,
    pub department_id: String,
    pub skill_id: String,
    pub mentor_name: String,
    pub duration_label: String,
    pub rating_received: Option<f32>,
    pub skills_confirmed: Vec<String>,
    pub completed_at_ms: u64,
}

// ═══════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════

pub struct InternshipEngine {
    posts: RwLock<HashMap<String, InternshipPost>>,
    applications: RwLock<HashMap<String, Application>>,
    internships: RwLock<HashMap<String, ActiveInternship>>,
    /// user_id → portfolio
    portfolios: RwLock<HashMap<String, Vec<PortfolioEntry>>>,
    post_counter: RwLock<u64>,
    app_counter: RwLock<u64>,
    internship_counter: RwLock<u64>,
}

impl InternshipEngine {
    pub fn new() -> Self {
        InternshipEngine {
            posts: RwLock::new(HashMap::new()),
            applications: RwLock::new(HashMap::new()),
            internships: RwLock::new(HashMap::new()),
            portfolios: RwLock::new(HashMap::new()),
            post_counter: RwLock::new(0),
            app_counter: RwLock::new(0),
            internship_counter: RwLock::new(0),
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    // ─── POSTING ────────────────────────────────────────

    /// Create a new posting (either side)
    pub fn create_post(
        &self,
        user_id: &str,
        side: InternshipSide,
        department_id: &str,
        skill_id: &str,
        title: &str,
        description: &str,
        city: &str,
        lat: f64,
        lon: f64,
        remote_ok: bool,
        compensation: Compensation,
        duration: Duration,
        schedule: Schedule,
        learning_goals: Vec<String>,
        requirements: Vec<String>,
    ) -> String {
        let mut counter = self.post_counter.write();
        *counter += 1;
        let id = format!("INTERN-{:06}", *counter);
        let now = Self::now_ms();

        let post = InternshipPost {
            id: id.clone(),
            user_id: user_id.into(),
            side,
            department_id: department_id.into(),
            skill_id: skill_id.into(),
            title: title.into(),
            description: description.into(),
            city: city.into(),
            lat, lon,
            remote_ok,
            compensation,
            duration,
            schedule,
            learning_goals,
            requirements,
            is_active: true,
            created_at_ms: now,
            updated_at_ms: now,
            application_count: 0,
        };

        self.posts.write().insert(id.clone(), post);
        id
    }

    /// Deactivate a posting
    pub fn deactivate_post(&self, post_id: &str, user_id: &str) -> Result<(), String> {
        let mut posts = self.posts.write();
        let post = posts.get_mut(post_id).ok_or("Post not found")?;
        if post.user_id != user_id {
            return Err("Not your post".into());
        }
        post.is_active = false;
        Ok(())
    }

    // ─── SEARCH ─────────────────────────────────────────

    /// Search posts by side + department + optional skill
    pub fn search_posts(
        &self,
        side: InternshipSide,
        department_id: Option<&str>,
        skill_id: Option<&str>,
        city: Option<&str>,
        remote_only: bool,
    ) -> Vec<InternshipPost> {
        let posts = self.posts.read();
        posts.values()
            .filter(|p| p.is_active)
            .filter(|p| p.side == side)
            .filter(|p| department_id.map_or(true, |d| p.department_id == d))
            .filter(|p| skill_id.map_or(true, |s| p.skill_id == s))
            .filter(|p| city.map_or(true, |c| p.city.to_lowercase().contains(&c.to_lowercase())))
            .filter(|p| !remote_only || p.remote_ok)
            .cloned()
            .collect()
    }

    /// Get a user's own posts
    pub fn user_posts(&self, user_id: &str) -> Vec<InternshipPost> {
        self.posts.read().values()
            .filter(|p| p.user_id == user_id)
            .cloned()
            .collect()
    }

    // ─── APPLICATION ────────────────────────────────────

    /// Apply to a posting
    pub fn apply(
        &self,
        post_id: &str,
        applicant_id: &str,
        message: &str,
    ) -> Result<String, String> {
        let posts = self.posts.read();
        let post = posts.get(post_id).ok_or("Post not found")?;

        if !post.is_active {
            return Err("Post is no longer active".into());
        }
        if post.user_id == applicant_id {
            return Err("Cannot apply to your own post".into());
        }

        // Check for duplicate application
        let apps = self.applications.read();
        let already = apps.values().any(|a|
            a.post_id == post_id &&
            a.applicant_id == applicant_id &&
            a.state == ApplicationState::Pending
        );
        if already {
            return Err("Already applied to this post".into());
        }
        drop(apps);

        let poster_id = post.user_id.clone();
        drop(posts);

        let mut counter = self.app_counter.write();
        *counter += 1;
        let id = format!("APP-{:06}", *counter);

        let app = Application {
            id: id.clone(),
            post_id: post_id.into(),
            applicant_id: applicant_id.into(),
            poster_id,
            message: message.into(),
            state: ApplicationState::Pending,
            created_at_ms: Self::now_ms(),
            responded_at_ms: None,
        };

        self.applications.write().insert(id.clone(), app);

        // Increment application count
        if let Some(post) = self.posts.write().get_mut(post_id) {
            post.application_count += 1;
        }

        Ok(id)
    }

    /// Accept an application → creates an active internship
    pub fn accept_application(&self, app_id: &str, poster_id: &str) -> Result<String, String> {
        let mut apps = self.applications.write();
        let app = apps.get_mut(app_id).ok_or("Application not found")?;

        if app.poster_id != poster_id {
            return Err("Not your application to accept".into());
        }
        if app.state != ApplicationState::Pending {
            return Err("Application not pending".into());
        }

        app.state = ApplicationState::Accepted;
        app.responded_at_ms = Some(Self::now_ms());

        let post_id = app.post_id.clone();
        let applicant_id = app.applicant_id.clone();
        drop(apps);

        // Get post details
        let posts = self.posts.read();
        let post = posts.get(&post_id).ok_or("Post not found")?;

        // Determine mentor and intern
        let (mentor_id, intern_id) = match post.side {
            InternshipSide::SeekingIntern => {
                // Poster is the mentor, applicant is the intern
                (post.user_id.clone(), applicant_id)
            }
            InternshipSide::SeekingInternship => {
                // Poster is the intern, applicant is the mentor
                (applicant_id, post.user_id.clone())
            }
        };

        let dept = post.department_id.clone();
        let skill = post.skill_id.clone();
        let comp = post.compensation.clone();
        let dur = post.duration.clone();
        let sched = post.schedule.clone();
        drop(posts);

        // Create active internship
        let mut counter = self.internship_counter.write();
        *counter += 1;
        let id = format!("STAGE-{:06}", *counter);

        let internship = ActiveInternship {
            id: id.clone(),
            post_id,
            mentor_id,
            intern_id,
            department_id: dept,
            skill_id: skill,
            state: InternshipState::Active,
            log_entries: vec![],
            compensation: comp,
            duration: dur,
            schedule: sched,
            started_at_ms: Self::now_ms(),
            completed_at_ms: None,
            mentor_review: None,
            intern_review: None,
        };

        self.internships.write().insert(id.clone(), internship);
        Ok(id)
    }

    /// Decline an application
    pub fn decline_application(&self, app_id: &str, poster_id: &str) -> Result<(), String> {
        let mut apps = self.applications.write();
        let app = apps.get_mut(app_id).ok_or("Application not found")?;
        if app.poster_id != poster_id {
            return Err("Not your application to decline".into());
        }
        if app.state != ApplicationState::Pending {
            return Err("Application not pending".into());
        }
        app.state = ApplicationState::Declined;
        app.responded_at_ms = Some(Self::now_ms());
        Ok(())
    }

    /// Get applications for a post
    pub fn post_applications(&self, post_id: &str) -> Vec<Application> {
        self.applications.read().values()
            .filter(|a| a.post_id == post_id)
            .cloned()
            .collect()
    }

    // ─── INTERNSHIP LIFECYCLE ───────────────────────────

    /// Add a log entry to an active internship
    pub fn add_log(
        &self,
        internship_id: &str,
        author_id: &str,
        text: &str,
        milestones: Vec<String>,
    ) -> Result<(), String> {
        let mut internships = self.internships.write();
        let internship = internships.get_mut(internship_id)
            .ok_or("Internship not found")?;

        if internship.state != InternshipState::Active {
            return Err("Internship is not active".into());
        }
        if author_id != internship.mentor_id && author_id != internship.intern_id {
            return Err("Not a participant".into());
        }

        internship.log_entries.push(LogEntry {
            timestamp_ms: Self::now_ms(),
            author_id: author_id.into(),
            text: text.into(),
            milestones,
        });

        Ok(())
    }

    /// Complete an internship (either side can initiate, both must agree in real flow,
    /// simplified here: mentor completes)
    pub fn complete_internship(&self, internship_id: &str, by_user: &str) -> Result<(), String> {
        let mut internships = self.internships.write();
        let internship = internships.get_mut(internship_id)
            .ok_or("Internship not found")?;

        if internship.state != InternshipState::Active {
            return Err("Internship not active".into());
        }
        if by_user != internship.mentor_id && by_user != internship.intern_id {
            return Err("Not a participant".into());
        }

        internship.state = InternshipState::Completed;
        internship.completed_at_ms = Some(Self::now_ms());
        Ok(())
    }

    /// Leave a review after completion
    pub fn leave_review(
        &self,
        internship_id: &str,
        reviewer_id: &str,
        rating: f32,
        text: &str,
        skills_confirmed: Vec<String>,
        would_recommend: bool,
    ) -> Result<(), String> {
        let mut internships = self.internships.write();
        let internship = internships.get_mut(internship_id)
            .ok_or("Internship not found")?;

        if internship.state != InternshipState::Completed {
            return Err("Internship not completed yet".into());
        }

        let rating = rating.clamp(1.0, 5.0);
        let review = Review {
            rating,
            text: text.into(),
            skills_confirmed: skills_confirmed.clone(),
            would_recommend,
            created_at_ms: Self::now_ms(),
        };

        if reviewer_id == internship.mentor_id {
            if internship.mentor_review.is_some() {
                return Err("Mentor already reviewed".into());
            }
            internship.mentor_review = Some(review);

            // Add to intern's portfolio
            let entry = PortfolioEntry {
                internship_id: internship_id.into(),
                department_id: internship.department_id.clone(),
                skill_id: internship.skill_id.clone(),
                mentor_name: internship.mentor_id.clone(), // in real app: resolve name
                duration_label: internship.duration.label_en(),
                rating_received: Some(rating),
                skills_confirmed,
                completed_at_ms: internship.completed_at_ms.unwrap_or(0),
            };
            self.portfolios.write()
                .entry(internship.intern_id.clone())
                .or_default()
                .push(entry);

        } else if reviewer_id == internship.intern_id {
            if internship.intern_review.is_some() {
                return Err("Intern already reviewed".into());
            }
            internship.intern_review = Some(review);
        } else {
            return Err("Not a participant".into());
        }

        Ok(())
    }

    /// Get a user's portfolio (completed internships)
    pub fn portfolio(&self, user_id: &str) -> Vec<PortfolioEntry> {
        self.portfolios.read()
            .get(user_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Get active internships for a user (as mentor or intern)
    pub fn user_internships(&self, user_id: &str) -> Vec<ActiveInternship> {
        self.internships.read().values()
            .filter(|i| i.mentor_id == user_id || i.intern_id == user_id)
            .cloned()
            .collect()
    }

    /// Stats
    pub fn stats(&self) -> InternshipStats {
        let posts = self.posts.read();
        let internships = self.internships.read();
        InternshipStats {
            total_posts: posts.len() as u32,
            active_seeking_intern: posts.values()
                .filter(|p| p.is_active && p.side == InternshipSide::SeekingIntern)
                .count() as u32,
            active_seeking_internship: posts.values()
                .filter(|p| p.is_active && p.side == InternshipSide::SeekingInternship)
                .count() as u32,
            active_internships: internships.values()
                .filter(|i| i.state == InternshipState::Active)
                .count() as u32,
            completed_internships: internships.values()
                .filter(|i| i.state == InternshipState::Completed)
                .count() as u32,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InternshipStats {
    pub total_posts: u32,
    pub active_seeking_intern: u32,
    pub active_seeking_internship: u32,
    pub active_internships: u32,
    pub completed_internships: u32,
}

// ═══════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_internship_flow() {
        let engine = InternshipEngine::new();

        // Company posts: seeking auto mechanic intern
        let post_id = engine.create_post(
            "company_autoservice",
            InternshipSide::SeekingIntern,
            "auto", "auto_repair",
            "Стажёр автомеханик",
            "Научим ремонту двигателей и ходовой. Опыт не нужен.",
            "Москва", 55.75, 37.62,
            false,
            Compensation::FixedStipend(50_000),
            Duration::Months(3),
            Schedule::FullTime,
            vec!["Ремонт двигателя".into(), "Диагностика".into(), "Ходовая часть".into()],
            vec!["Желание учиться".into()],
        );

        // Young person searches and finds it
        let results = engine.search_posts(
            InternshipSide::SeekingIntern, Some("auto"), None, None, false,
        );
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "Стажёр автомеханик");

        // They apply
        let app_id = engine.apply(&post_id, "student_ivan", "Хочу учиться! Мне 20 лет.").unwrap();

        // Can't apply twice
        assert!(engine.apply(&post_id, "student_ivan", "Ещё раз").is_err());

        // Can't apply to own post
        assert!(engine.apply(&post_id, "company_autoservice", "test").is_err());

        // Check applications
        let apps = engine.post_applications(&post_id);
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].state, ApplicationState::Pending);

        // Company accepts
        let internship_id = engine.accept_application(&app_id, "company_autoservice").unwrap();
        assert!(internship_id.starts_with("STAGE-"));

        // Verify internship
        let internships = engine.user_internships("student_ivan");
        assert_eq!(internships.len(), 1);
        assert_eq!(internships[0].mentor_id, "company_autoservice");
        assert_eq!(internships[0].intern_id, "student_ivan");

        // Add progress logs
        engine.add_log(&internship_id, "student_ivan", "Первый день. Изучил устройство мотора.", vec![]).unwrap();
        engine.add_log(&internship_id, "company_autoservice", "Иван хорошо усвоил основы.", vec!["Основы двигателя".into()]).unwrap();

        // Complete
        engine.complete_internship(&internship_id, "company_autoservice").unwrap();

        // Mentor leaves review → goes to intern's portfolio
        engine.leave_review(
            &internship_id, "company_autoservice",
            4.5, "Отличный стажёр, быстро учится",
            vec!["Ремонт двигателя".into(), "Диагностика".into()],
            true,
        ).unwrap();

        // Can't review twice
        assert!(engine.leave_review(&internship_id, "company_autoservice", 5.0, "", vec![], true).is_err());

        // Intern reviews mentor
        engine.leave_review(
            &internship_id, "student_ivan",
            5.0, "Лучший наставник!",
            vec![], true,
        ).unwrap();

        // Check portfolio
        let portfolio = engine.portfolio("student_ivan");
        assert_eq!(portfolio.len(), 1);
        assert_eq!(portfolio[0].skill_id, "auto_repair");
        assert_eq!(portfolio[0].rating_received, Some(4.5));
        assert_eq!(portfolio[0].skills_confirmed.len(), 2);

        // Stats
        let stats = engine.stats();
        assert_eq!(stats.completed_internships, 1);
    }

    #[test]
    fn test_seeking_internship_flow() {
        let engine = InternshipEngine::new();

        // Student posts: looking for plumbing internship
        let post_id = engine.create_post(
            "young_misha",
            InternshipSide::SeekingInternship,
            "plumbing", "plumb_general",
            "Ищу стаж сантехника",
            "Хочу научиться. Есть базовые знания.",
            "СПб", 59.93, 30.31,
            false,
            Compensation::Unpaid,
            Duration::Weeks(4),
            Schedule::Flexible,
            vec!["Монтаж труб".into(), "Ремонт кранов".into()],
            vec!["Базовые знания сантехники".into()],
        );

        // Master finds it
        let results = engine.search_posts(
            InternshipSide::SeekingInternship, Some("plumbing"), None, None, false,
        );
        assert_eq!(results.len(), 1);

        // Master applies (offers internship)
        let app_id = engine.apply(&post_id, "master_petrov", "Возьму на стажировку, у меня 15 лет опыта.").unwrap();

        // Student (poster) accepts → master becomes mentor
        let _internship_id = engine.accept_application(&app_id, "young_misha").unwrap();

        let internships = engine.user_internships("master_petrov");
        assert_eq!(internships.len(), 1);
        assert_eq!(internships[0].mentor_id, "master_petrov");
        assert_eq!(internships[0].intern_id, "young_misha");
    }

    #[test]
    fn test_search_filters() {
        let engine = InternshipEngine::new();

        // Create varied posts
        engine.create_post("u1", InternshipSide::SeekingIntern, "auto", "auto_repair",
            "Auto intern", "", "Москва", 0.0, 0.0, false,
            Compensation::Unpaid, Duration::Months(1), Schedule::FullTime, vec![], vec![]);

        engine.create_post("u2", InternshipSide::SeekingIntern, "tech", "tech_pc",
            "Tech intern", "", "Москва", 0.0, 0.0, true,
            Compensation::Negotiable, Duration::Weeks(2), Schedule::PartTime, vec![], vec![]);

        engine.create_post("u3", InternshipSide::SeekingInternship, "auto", "auto_repair",
            "Want auto stage", "", "СПб", 0.0, 0.0, false,
            Compensation::Unpaid, Duration::Flexible, Schedule::Flexible, vec![], vec![]);

        // Filter: seeking interns in auto
        let r = engine.search_posts(InternshipSide::SeekingIntern, Some("auto"), None, None, false);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].title, "Auto intern");

        // Filter: remote only
        let r = engine.search_posts(InternshipSide::SeekingIntern, None, None, None, true);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0].department_id, "tech");

        // Filter: seeking internship
        let r = engine.search_posts(InternshipSide::SeekingInternship, None, None, None, false);
        assert_eq!(r.len(), 1);

        // Filter: by city
        let r = engine.search_posts(InternshipSide::SeekingInternship, None, None, Some("спб"), false);
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn test_decline_and_deactivate() {
        let engine = InternshipEngine::new();

        let post_id = engine.create_post("boss", InternshipSide::SeekingIntern,
            "plumbing", "plumb_general", "Intern needed", "", "Москва", 0.0, 0.0,
            false, Compensation::Unpaid, Duration::Days(5), Schedule::FullTime, vec![], vec![]);

        let app_id = engine.apply(&post_id, "candidate1", "Привет!").unwrap();

        // Decline
        engine.decline_application(&app_id, "boss").unwrap();
        let apps = engine.post_applications(&post_id);
        assert_eq!(apps[0].state, ApplicationState::Declined);

        // Deactivate post
        engine.deactivate_post(&post_id, "boss").unwrap();

        // Can't apply to deactivated
        assert!(engine.apply(&post_id, "candidate2", "Хочу!").is_err());

        // Can't deactivate someone else's post
        assert!(engine.deactivate_post(&post_id, "hacker").is_err());
    }
}
