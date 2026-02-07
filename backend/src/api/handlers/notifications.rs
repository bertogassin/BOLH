//! Notification handlers

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;

pub async fn list_notifications() -> impl IntoResponse {
    // TODO: Fetch notifications
    (StatusCode::OK, Json(serde_json::json!({
        "notifications": [],
        "unread_count": 0
    })))
}

#[derive(Debug, Deserialize)]
pub struct MarkReadRequest {
    pub notification_ids: Vec<String>,
}

pub async fn mark_read(Json(req): Json<MarkReadRequest>) -> impl IntoResponse {
    // TODO: Mark notifications as read
    (StatusCode::OK, Json(serde_json::json!({
        "marked_count": req.notification_ids.len()
    })))
}

pub async fn get_settings() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({
        "push_enabled": true,
        "email_enabled": false,
        "sms_enabled": true,
        "order_updates": true,
        "promotions": false,
        "security_alerts": true
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsRequest {
    pub push_enabled: Option<bool>,
    pub email_enabled: Option<bool>,
    pub sms_enabled: Option<bool>,
    pub order_updates: Option<bool>,
    pub promotions: Option<bool>,
    pub security_alerts: Option<bool>,
}

pub async fn update_settings(Json(req): Json<UpdateSettingsRequest>) -> impl IntoResponse {
    // TODO: Update settings
    (StatusCode::OK, Json(serde_json::json!({
        "push_enabled": req.push_enabled.unwrap_or(true),
        "email_enabled": req.email_enabled.unwrap_or(false),
        "sms_enabled": req.sms_enabled.unwrap_or(true),
        "order_updates": req.order_updates.unwrap_or(true),
        "promotions": req.promotions.unwrap_or(false),
        "security_alerts": req.security_alerts.unwrap_or(true)
    })))
}
