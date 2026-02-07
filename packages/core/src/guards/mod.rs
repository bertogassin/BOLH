//! Guards module
//! 
//! Guard management, discovery, ranking

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::geo::GeoService;

/// Guard verification level
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationLevel {
    None = 0,
    Basic = 1,      // Phone verified
    Standard = 2,   // ID verified
    Premium = 3,    // Background check
    Elite = 4,      // Full verification + training
}

/// Guard entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guard {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub phone: String,
    pub avatar_url: Option<String>,
    pub verification_level: VerificationLevel,
    pub rating: f64,
    pub total_reviews: i32,
    pub total_orders: i32,
    pub completed_orders: i32,
    pub latitude: f64,
    pub longitude: f64,
    pub is_available: bool,
    pub is_online: bool,
    pub specializations: Vec<Specialization>,
    pub hourly_rate: i64,
    pub experience_years: i32,
    pub created_at: DateTime<Utc>,
    pub last_active: DateTime<Utc>,
}

impl Guard {
    /// Calculate completion rate
    pub fn completion_rate(&self) -> f64 {
        if self.total_orders == 0 {
            return 0.0;
        }
        (self.completed_orders as f64 / self.total_orders as f64) * 100.0
    }

    /// Calculate guard score for ranking
    pub fn calculate_score(&self, user_lat: f64, user_lng: f64) -> f64 {
        let distance = GeoService::calculate_distance(user_lat, user_lng, self.latitude, self.longitude);
        
        // Distance score (closer is better, max 40 points)
        let distance_score = 40.0 / (1.0 + distance * 0.5);
        
        // Rating score (max 30 points)
        let rating_score = self.rating * 6.0;
        
        // Verification score (max 15 points)
        let verification_score = match self.verification_level {
            VerificationLevel::None => 0.0,
            VerificationLevel::Basic => 5.0,
            VerificationLevel::Standard => 8.0,
            VerificationLevel::Premium => 12.0,
            VerificationLevel::Elite => 15.0,
        };
        
        // Experience score (max 10 points)
        let experience_score = (self.experience_years as f64).min(10.0);
        
        // Availability bonus (5 points)
        let availability_bonus = if self.is_available && self.is_online { 5.0 } else { 0.0 };
        
        distance_score + rating_score + verification_score + experience_score + availability_bonus
    }
}

/// Guard specialization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Specialization {
    Bodyguard,
    PropertyPatrol,
    EventSecurity,
    VehicleEscort,
    VipProtection,
    CctvOperator,
    K9Handler,
    FirearmsCertified,
    FirstAid,
    MartialArts,
}

/// Guard availability schedule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailabilitySchedule {
    pub guard_id: i64,
    pub day_of_week: u8,    // 0 = Monday
    pub start_hour: u8,
    pub end_hour: u8,
    pub is_available: bool,
}

/// Guard zone assignment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardZone {
    pub id: Uuid,
    pub guard_id: i64,
    pub name: String,
    pub center_lat: f64,
    pub center_lng: f64,
    pub radius_km: f64,
    pub is_active: bool,
}

impl GuardZone {
    /// Check if a point is within this zone
    pub fn contains(&self, lat: f64, lng: f64) -> bool {
        GeoService::point_in_geofence(lat, lng, self.center_lat, self.center_lng, self.radius_km)
    }
}

/// Guard discovery service
pub struct GuardDiscovery;

impl GuardDiscovery {
    /// Find guards near a location
    pub fn find_nearby(
        guards: Vec<Guard>,
        lat: f64,
        lng: f64,
        max_distance_km: f64,
        filters: Option<GuardFilters>,
    ) -> Vec<RankedGuard> {
        let mut results: Vec<RankedGuard> = guards
            .into_iter()
            .filter(|g| {
                let distance = GeoService::calculate_distance(lat, lng, g.latitude, g.longitude);
                if distance > max_distance_km {
                    return false;
                }

                if let Some(ref f) = filters {
                    if let Some(min_rating) = f.min_rating {
                        if g.rating < min_rating {
                            return false;
                        }
                    }
                    if let Some(min_level) = f.min_verification_level {
                        if g.verification_level < min_level {
                            return false;
                        }
                    }
                    if let Some(ref specs) = f.specializations {
                        if !specs.iter().any(|s| g.specializations.contains(s)) {
                            return false;
                        }
                    }
                    if f.available_only && !g.is_available {
                        return false;
                    }
                }

                true
            })
            .map(|g| {
                let distance = GeoService::calculate_distance(lat, lng, g.latitude, g.longitude);
                let score = g.calculate_score(lat, lng);
                RankedGuard {
                    guard: g,
                    distance_km: distance,
                    score,
                }
            })
            .collect();

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
        results
    }
}

/// Guard with ranking information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RankedGuard {
    pub guard: Guard,
    pub distance_km: f64,
    pub score: f64,
}

/// Filters for guard discovery
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GuardFilters {
    pub min_rating: Option<f64>,
    pub min_verification_level: Option<VerificationLevel>,
    pub specializations: Option<Vec<Specialization>>,
    pub max_hourly_rate: Option<i64>,
    pub available_only: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_guard(id: i64, lat: f64, lng: f64, rating: f64) -> Guard {
        Guard {
            id,
            user_id: id,
            name: format!("Guard {}", id),
            phone: "+77071234567".into(),
            avatar_url: None,
            verification_level: VerificationLevel::Standard,
            rating,
            total_reviews: 10,
            total_orders: 20,
            completed_orders: 18,
            latitude: lat,
            longitude: lng,
            is_available: true,
            is_online: true,
            specializations: vec![Specialization::Bodyguard],
            hourly_rate: 5000,
            experience_years: 3,
            created_at: Utc::now(),
            last_active: Utc::now(),
        }
    }

    #[test]
    fn test_guard_discovery() {
        let guards = vec![
            create_test_guard(1, 43.24, 76.95, 4.8),
            create_test_guard(2, 43.25, 76.96, 4.5),
            create_test_guard(3, 43.30, 77.00, 4.9),
        ];

        let results = GuardDiscovery::find_nearby(guards, 43.238, 76.945, 10.0, None);
        
        assert_eq!(results.len(), 3);
        // Closest guard with good rating should be first
        assert!(results[0].distance_km < results[2].distance_km);
    }
}
