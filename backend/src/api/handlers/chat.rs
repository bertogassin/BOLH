//! Chat handlers

use axum::{
    extract::{Path, Query, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;

pub async fn list_conversations() -> impl IntoResponse {
    // TODO: Fetch conversations
    (StatusCode::OK, Json(serde_json::json!({
        "conversations": []
    })))
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub before: Option<String>,
    pub limit: Option<i32>,
}

pub async fn get_messages(
    Path(id): Path<String>,
    Query(q): Query<GetMessagesQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(50);

    // TODO: Fetch messages
    (StatusCode::OK, Json(serde_json::json!({
        "conversation_id": id,
        "messages": [],
        "has_more": false
    })))
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub text: String,
    pub attachment_url: Option<String>,
}

pub async fn send_message(
    Path(id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    // TODO: Save message and notify via WebSocket

    (StatusCode::CREATED, Json(serde_json::json!({
        "id": "msg_123",
        "conversation_id": id,
        "text": req.text,
        "attachment_url": req.attachment_url,
        "created_at": chrono::Utc::now().to_rfc3339()
    })))
}
