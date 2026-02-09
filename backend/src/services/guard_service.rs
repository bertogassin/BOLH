//! Guard service

use sqlx::postgres::PgPool;
use guardio_core::geo::GeoService;

pub struct GuardService {
    pool: PgPool,
}

impl GuardService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn find_nearby(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
        limit: i32,
    ) -> Result<Vec<NearbyGuard>, GuardServiceError> {
        // Get bounding box for efficient query
        let bbox = GeoService::get_bounding_box(latitude, longitude, radius_km);

        let guards = sqlx::query_as::<_, GuardRow>(
            r#"
            SELECT 
                g.id, g.user_id, u.name, u.phone, g.avatar_url,
                g.verification_level, g.rating, g.total_reviews,
                g.latitude, g.longitude, g.is_available, g.is_online,
                g.hourly_rate, g.experience_years
            FROM guards g
            JOIN users u ON g.user_id = u.id
            WHERE g.latitude BETWEEN $1 AND $2
              AND g.longitude BETWEEN $3 AND $4
              AND g.is_active = true
            LIMIT $5
            "#,
        )
        .bind(bbox.min_lat)
        .bind(bbox.max_lat)
        .bind(bbox.min_lng)
        .bind(bbox.max_lng)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| GuardServiceError::DatabaseError(e.to_string()))?;

        // Calculate exact distances and filter
        let mut nearby: Vec<NearbyGuard> = guards
            .into_iter()
            .map(|g| {
                let distance = GeoService::calculate_distance(
                    latitude, longitude,
                    g.latitude.unwrap_or(0.0), g.longitude.unwrap_or(0.0),
                );
                NearbyGuard {
                    id: g.id,
                    user_id: g.user_id,
                    name: g.name,
                    phone: g.phone,
                    avatar_url: g.avatar_url,
                    verification_level: g.verification_level.unwrap_or(0),
                    rating: g.rating.unwrap_or(0.0),
                    total_reviews: g.total_reviews.unwrap_or(0),
                    latitude: g.latitude.unwrap_or(0.0),
                    longitude: g.longitude.unwrap_or(0.0),
                    is_available: g.is_available.unwrap_or(false),
                    is_online: g.is_online.unwrap_or(false),
                    hourly_rate: g.hourly_rate.unwrap_or(0),
                    experience_years: g.experience_years.unwrap_or(0),
                    distance_km: distance,
                }
            })
            .filter(|g| g.distance_km <= radius_km)
            .collect();

        // Sort by distance
        nearby.sort_by(|a, b| a.distance_km.partial_cmp(&b.distance_km).unwrap());

        Ok(nearby)
    }

    pub async fn get_by_id(&self, id: i64) -> Result<Option<Guard>, GuardServiceError> {
        let guard = sqlx::query_as::<_, GuardRow>(
            r#"
            SELECT 
                g.id, g.user_id, u.name, u.phone, g.avatar_url,
                g.verification_level, g.rating, g.total_reviews,
                g.latitude, g.longitude, g.is_available, g.is_online,
                g.hourly_rate, g.experience_years
            FROM guards g
            JOIN users u ON g.user_id = u.id
            WHERE g.id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| GuardServiceError::DatabaseError(e.to_string()))?;

        Ok(guard.map(|g| Guard {
            id: g.id,
            user_id: g.user_id,
            name: g.name,
            phone: g.phone,
            avatar_url: g.avatar_url,
            verification_level: g.verification_level.unwrap_or(0),
            rating: g.rating.unwrap_or(0.0),
            total_reviews: g.total_reviews.unwrap_or(0),
            latitude: g.latitude.unwrap_or(0.0),
            longitude: g.longitude.unwrap_or(0.0),
            is_available: g.is_available.unwrap_or(false),
            is_online: g.is_online.unwrap_or(false),
            hourly_rate: g.hourly_rate.unwrap_or(0),
            experience_years: g.experience_years.unwrap_or(0),
        }))
    }

    pub async fn update_availability(
        &self,
        guard_id: i64,
        is_available: bool,
    ) -> Result<(), GuardServiceError> {
        sqlx::query(
            "UPDATE guards SET is_available = $1 WHERE id = $2",
        )
        .bind(is_available)
        .bind(guard_id)
        .execute(&self.pool)
        .await
        .map_err(|e| GuardServiceError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}

#[derive(Debug, sqlx::FromRow)]
struct GuardRow {
    id: i64,
    user_id: i64,
    name: String,
    phone: String,
    avatar_url: Option<String>,
    verification_level: Option<i32>,
    rating: Option<f64>,
    total_reviews: Option<i32>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    is_available: Option<bool>,
    is_online: Option<bool>,
    hourly_rate: Option<i64>,
    experience_years: Option<i32>,
}

#[derive(Debug, Clone)]
pub struct Guard {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub phone: String,
    pub avatar_url: Option<String>,
    pub verification_level: i32,
    pub rating: f64,
    pub total_reviews: i32,
    pub latitude: f64,
    pub longitude: f64,
    pub is_available: bool,
    pub is_online: bool,
    pub hourly_rate: i64,
    pub experience_years: i32,
}

#[derive(Debug, Clone)]
pub struct NearbyGuard {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub phone: String,
    pub avatar_url: Option<String>,
    pub verification_level: i32,
    pub rating: f64,
    pub total_reviews: i32,
    pub latitude: f64,
    pub longitude: f64,
    pub is_available: bool,
    pub is_online: bool,
    pub hourly_rate: i64,
    pub experience_years: i32,
    pub distance_km: f64,
}

#[derive(Debug, thiserror::Error)]
pub enum GuardServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Guard not found")]
    NotFound,
}
