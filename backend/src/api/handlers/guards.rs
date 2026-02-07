//! Guard handlers

use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use guardio_core::geo::GeoService;

#[derive(Debug, Deserialize)]
pub struct ListGuardsQuery {
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

pub async fn list_guards(Query(q): Query<ListGuardsQuery>) -> impl IntoResponse {
    let page = q.page.unwrap_or(1);
    let limit = q.limit.unwrap_or(20);

    // TODO: Fetch from database
    (StatusCode::OK, Json(serde_json::json!({
        "guards": [],
        "total": 0,
        "page": page,
        "limit": limit
    })))
}

#[derive(Debug, Deserialize)]
pub struct NearbyGuardsQuery {
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: Option<f64>,
    pub limit: Option<i32>,
}

pub async fn nearby_guards(Query(q): Query<NearbyGuardsQuery>) -> impl IntoResponse {
    let radius = q.radius_km.unwrap_or(10.0);
    let limit = q.limit.unwrap_or(20);

    // Get bounding box for efficient DB query
    let bbox = GeoService::get_bounding_box(q.latitude, q.longitude, radius);

    // TODO: Fetch guards within bounding box from database
    // Then filter by exact distance and rank them

    (StatusCode::OK, Json(serde_json::json!({
        "guards": [],
        "center": {
            "latitude": q.latitude,
            "longitude": q.longitude
        },
        "radius_km": radius,
        "bounding_box": {
            "min_lat": bbox.min_lat,
            "max_lat": bbox.max_lat,
            "min_lng": bbox.min_lng,
            "max_lng": bbox.max_lng
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct SearchGuardsQuery {
    pub query: Option<String>,
    pub min_rating: Option<f64>,
    pub specialization: Option<String>,
    pub available_only: Option<bool>,
}

pub async fn search_guards(Query(_q): Query<SearchGuardsQuery>) -> impl IntoResponse {
    // TODO: Search guards
    (StatusCode::OK, Json(serde_json::json!({
        "guards": [],
        "total": 0
    })))
}

pub async fn get_guard(Path(id): Path<i64>) -> impl IntoResponse {
    // TODO: Fetch guard from database
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "name": "Guard Name",
        "phone": "+77071234567",
        "rating": 4.8,
        "total_reviews": 50,
        "verification_level": "premium",
        "specializations": ["bodyguard", "event_security"],
        "hourly_rate": 5000,
        "is_available": true
    })))
}

pub async fn get_availability(Path(id): Path<i64>) -> impl IntoResponse {
    // TODO: Fetch availability schedule
    (StatusCode::OK, Json(serde_json::json!({
        "guard_id": id,
        "schedule": [
            {"day": 0, "start": 9, "end": 18, "available": true},
            {"day": 1, "start": 9, "end": 18, "available": true},
            {"day": 2, "start": 9, "end": 18, "available": true},
            {"day": 3, "start": 9, "end": 18, "available": true},
            {"day": 4, "start": 9, "end": 18, "available": true}
        ]
    })))
}

pub async fn get_reviews(Path(id): Path<i64>) -> impl IntoResponse {
    // TODO: Fetch reviews
    (StatusCode::OK, Json(serde_json::json!({
        "guard_id": id,
        "reviews": [],
        "average_rating": 4.8,
        "total": 0
    })))
}
