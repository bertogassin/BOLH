//! Notification handlers

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::services::notification_service::NotificationService;
use crate::ws::notifications::NotificationWsManager;
use axum::extract::ws::WebSocketUpgrade;

#[derive(Clone)]
#[derive(Debug)]
pub struct NotificationState {
    pub pool: PgPool,
    pub ws: Arc<NotificationWsManager>,
}

#[derive(Debug, Serialize)]
pub struct NotificationResponse {
    pub id: String,
    pub user_id: i64,
    pub title: String,
    pub body: String,
    pub notification_type: String,
    pub data: Option<serde_json::Value>,
    pub is_read: bool,
    pub created_at: String,
}

/// List notifications for the authenticated user
pub async fn list_notifications(
    State(state): State<NotificationState>,
    // TODO: Extract user_id from auth header
) -> impl IntoResponse {
    let user_id = 1i64; // Placeholder - should come from auth

    let service = NotificationService::new(state.pool.clone());

    match service.list_by_user(user_id, 50, false).await {
        Ok(notifications) => {
            let responses: Vec<NotificationResponse> = notifications
                .into_iter()
                .map(|n| NotificationResponse {
                    id: n.id.to_string(),
                    user_id: n.user_id,
                    title: n.title,
                    body: n.body,
                    notification_type: n.notification_type,
                    data: n.data,
                    is_read: n.is_read,
                    created_at: n.created_at.to_rfc3339(),
                })
                .collect();

            let unread_count = service.get_unread_count(user_id).await.unwrap_or(0);

            (
                StatusCode::OK,
                Json(json!({
                    "notifications": responses,
                    "unread_count": unread_count
                })),
            )
                .into_response()
        }
        Err(e) => {
            eprintln!("Error listing notifications: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to fetch notifications"})),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MarkReadRequest {
    pub notification_ids: Vec<String>,
}

/// Mark notifications as read
pub async fn mark_read(
    State(state): State<NotificationState>,
    Json(req): Json<MarkReadRequest>,
) -> impl IntoResponse {
    let user_id = 1i64; // Placeholder - should come from auth

    // Parse UUID strings
    let ids: Vec<Uuid> = req
        .notification_ids
        .iter()
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect();

    let service = NotificationService::new(state.pool.clone());

    match service.mark_read(&ids).await {
        Ok(marked_count) => {
            // Broadcast notification read events via WebSocket
            for id in &ids {
                state
                    .ws
                    .broadcast_to_user(
                        user_id,
                        crate::ws::notifications::NotificationWsMessage::NotificationRead {
                            notification_id: id.to_string(),
                        },
                    )
                    .await;
            }

            // Broadcast updated unread count
            let unread_count = service.get_unread_count(user_id).await.unwrap_or(0);
            state
                .ws
                .broadcast_to_user(
                    user_id,
                    crate::ws::notifications::NotificationWsMessage::UnreadCount {
                        user_id,
                        count: unread_count,
                    },
                )
                .await;

            (
                StatusCode::OK,
                Json(json!({
                    "marked_count": marked_count,
                    "unread_count": unread_count
                })),
            )
                .into_response()
        }
        Err(e) => {
            eprintln!("Error marking notifications as read: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to mark notifications as read"})),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Serialize)]
pub struct NotificationSettings {
    pub push_enabled: bool,
    pub email_enabled: bool,
    pub sms_enabled: bool,
    pub order_updates: bool,
    pub promotions: bool,
    pub security_alerts: bool,
}

/// Get notification settings for the user
pub async fn get_settings(State(state): State<NotificationState>) -> impl IntoResponse {
    let user_id = 1i64; // Placeholder - should come from auth

    match sqlx::query_as::<_, (bool, bool, bool, bool, bool, bool)>(
        r#"
        SELECT
            COALESCE(push_enabled, true) as push_enabled,
            COALESCE(email_enabled, false) as email_enabled,
            COALESCE(sms_enabled, true) as sms_enabled,
            COALESCE(order_updates, true) as order_updates,
            COALESCE(promotions, false) as promotions,
            COALESCE(security_alerts, true) as security_alerts
        FROM notification_settings
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    {
        Ok(Some((push, email, sms, orders, promo, security))) => {
            (
                StatusCode::OK,
                Json(NotificationSettings {
                    push_enabled: push,
                    email_enabled: email,
                    sms_enabled: sms,
                    order_updates: orders,
                    promotions: promo,
                    security_alerts: security,
                }),
            )
                .into_response()
        }
        Ok(None) => {
            // Return defaults if no settings exist
            (
                StatusCode::OK,
                Json(NotificationSettings {
                    push_enabled: true,
                    email_enabled: false,
                    sms_enabled: true,
                    order_updates: true,
                    promotions: false,
                    security_alerts: true,
                }),
            )
                .into_response()
        }
        Err(e) => {
            eprintln!("Error fetching notification settings: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to fetch notification settings"})),
            )
                .into_response()
        }
    }
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

/// Update notification settings for the user
pub async fn update_settings(
    State(state): State<NotificationState>,
    Json(req): Json<UpdateSettingsRequest>,
) -> impl IntoResponse {
    let user_id = 1i64; // Placeholder - should come from auth

    // First, try to update existing settings
    let result = sqlx::query(
        r#"
        INSERT INTO notification_settings (user_id, push_enabled, email_enabled, sms_enabled, order_updates, promotions, security_alerts)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
            push_enabled = COALESCE($2, notification_settings.push_enabled),
            email_enabled = COALESCE($3, notification_settings.email_enabled),
            sms_enabled = COALESCE($4, notification_settings.sms_enabled),
            order_updates = COALESCE($5, notification_settings.order_updates),
            promotions = COALESCE($6, notification_settings.promotions),
            security_alerts = COALESCE($7, notification_settings.security_alerts)
        "#,
    )
    .bind(user_id)
    .bind(req.push_enabled)
    .bind(req.email_enabled)
    .bind(req.sms_enabled)
    .bind(req.order_updates)
    .bind(req.promotions)
    .bind(req.security_alerts)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => {
            // Return the updated settings
            (
                StatusCode::OK,
                Json(NotificationSettings {
                    push_enabled: req.push_enabled.unwrap_or(true),
                    email_enabled: req.email_enabled.unwrap_or(false),
                    sms_enabled: req.sms_enabled.unwrap_or(true),
                    order_updates: req.order_updates.unwrap_or(true),
                    promotions: req.promotions.unwrap_or(false),
                    security_alerts: req.security_alerts.unwrap_or(true),
                }),
            )
                .into_response()
        }
        Err(e) => {
            eprintln!("Error updating notification settings: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to update notification settings"})),
            )
                .into_response()
        }
    }
}

/// Notification WebSocket endpoint
pub async fn notification_ws(
    ws: WebSocketUpgrade,
    State(state): State<NotificationState>,
) -> impl IntoResponse {
    let user_id = 1i64; // Placeholder - should come from auth
    crate::ws::notifications::ws_handler(ws, state.ws.clone(), user_id).await
}

