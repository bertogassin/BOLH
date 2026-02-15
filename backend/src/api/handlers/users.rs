//! User handlers

use axum::{
    extract::{Path, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct UserProfile {
    pub id: i64,
    pub phone: String,
    pub name: String,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub rating: f64,
    pub verified_level: i32,
}

pub async fn get_current_user() -> impl IntoResponse {
    // TODO: Get from auth context
    (StatusCode::OK, Json(serde_json::json!({
        "id": 1,
        "phone": "+77071234567",
        "name": "Test User",
        "email": null,
        "avatar_url": null,
        "role": "client",
        "rating": 4.8,
        "verified_level": 2
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub email: Option<String>,
}

pub async fn update_profile(Json(req): Json<UpdateProfileRequest>) -> impl IntoResponse {
    // TODO: Update user in database
    (StatusCode::OK, Json(serde_json::json!({
        "id": 1,
        "phone": "+77071234567",
        "name": req.name.unwrap_or("Test User".into()),
        "email": req.email,
        "role": "client"
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateLocationRequest {
    pub latitude: f64,
    pub longitude: f64,
}

pub async fn update_location(Json(req): Json<UpdateLocationRequest>) -> impl IntoResponse {
    // TODO: Update user location
    (StatusCode::OK, Json(serde_json::json!({
        "latitude": req.latitude,
        "longitude": req.longitude,
        "updated_at": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn upload_avatar() -> impl IntoResponse {
    // TODO: Handle file upload
    (StatusCode::OK, Json(serde_json::json!({
        "avatar_url": "https://example.com/avatar.jpg"
    })))
}

pub async fn get_user_by_id(Path(id): Path<i64>) -> impl IntoResponse {
    // TODO: Get user from database
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "name": "User Name",
        "rating": 4.5,
        "verified_level": 2
    })))
}
