//! Authentication handlers

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use bolh_core::{auth::UserRole, CryptoService, ValidationService};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub phone: String,
    pub password: String,
    pub name: String,
    pub role: UserRole,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: i64,
    pub phone: String,
    pub name: String,
    pub role: UserRole,
}

pub async fn register(Json(req): Json<RegisterRequest>) -> impl IntoResponse {
    // Validate phone
    if !ValidationService::validate_phone_kz(&req.phone) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Invalid phone number"
        })));
    }

    // Check password strength
    let strength = ValidationService::check_password_strength(&req.password);
    if strength.score < 3 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Password too weak"
        })));
    }

    // Hash password
    let password_hash = match CryptoService::hash_password(&req.password) {
        Ok(hash) => hash,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": "Failed to hash password"
        }))),
    };

    // TODO: Save to database
    // For now, return mock response
    let user_id = 1i64;
    
    (StatusCode::CREATED, Json(serde_json::json!({
        "access_token": "mock_access_token",
        "refresh_token": "mock_refresh_token",
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": {
            "id": user_id,
            "phone": req.phone,
            "name": req.name,
            "role": req.role
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub phone: String,
    pub password: String,
}

pub async fn login(Json(req): Json<LoginRequest>) -> impl IntoResponse {
    // Validate phone
    if !ValidationService::validate_phone_kz(&req.phone) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Invalid phone number"
        })));
    }

    // TODO: Verify credentials from database
    // For now, return mock response
    (StatusCode::OK, Json(serde_json::json!({
        "access_token": "mock_access_token",
        "refresh_token": "mock_refresh_token",
        "token_type": "Bearer",
        "expires_in": 3600,
        "user": {
            "id": 1,
            "phone": req.phone,
            "name": "Test User",
            "role": "client"
        }
    })))
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

pub async fn refresh_token(Json(_req): Json<RefreshRequest>) -> impl IntoResponse {
    // TODO: Validate and refresh token
    (StatusCode::OK, Json(serde_json::json!({
        "access_token": "new_access_token",
        "refresh_token": "new_refresh_token",
        "token_type": "Bearer",
        "expires_in": 3600
    })))
}

pub async fn logout() -> impl IntoResponse {
    // TODO: Invalidate tokens
    StatusCode::NO_CONTENT
}

#[derive(Debug, Deserialize)]
pub struct VerifyPhoneRequest {
    pub phone: String,
    pub code: String,
}

pub async fn verify_phone(Json(req): Json<VerifyPhoneRequest>) -> impl IntoResponse {
    if !ValidationService::validate_phone_kz(&req.phone) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Invalid phone number"
        })));
    }

    // TODO: Verify SMS code
    (StatusCode::OK, Json(serde_json::json!({
        "verified": true
    })))
}
