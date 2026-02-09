//! Notifications WebSocket support

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum NotificationWsMessage {
    #[serde(rename = "notification:new")]
    NewNotification {
        id: String,
        user_id: i64,
        title: String,
        body: String,
        notification_type: String,
        data: Option<serde_json::Value>,
        created_at: String,
    },

    #[serde(rename = "notification:read")]
    NotificationRead {
        notification_id: String,
    },

    #[serde(rename = "notification:unread_count")]
    UnreadCount {
        user_id: i64,
        count: i64,
    },

    #[serde(rename = "notification:marked_read")]
    MarkedRead {
        notification_ids: Vec<String>,
        user_id: i64,
    },
}

#[derive(Clone, Debug)]
pub struct NotificationWsManager {
    sender: broadcast::Sender<(i64, NotificationWsMessage)>, // (user_id, message)
}

impl NotificationWsManager {
    pub fn new() -> Self {
        let (sender, _rx) = broadcast::channel(200);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<(i64, NotificationWsMessage)> {
        self.sender.subscribe()
    }

    pub async fn broadcast_to_user(&self, user_id: i64, message: NotificationWsMessage) {
        let _ = self.sender.send((user_id, message));
    }
}

impl Default for NotificationWsManager {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn ws_handler(ws: WebSocketUpgrade, manager: Arc<NotificationWsManager>, user_id: i64) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, manager, user_id))
}

async fn handle_socket(mut socket: WebSocket, manager: Arc<NotificationWsManager>, user_id: i64) {
    let mut rx = manager.subscribe();

    loop {
        tokio::select! {
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(_text))) => {
                        // Client sent a message (not expected for notifications)
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }

            outgoing = rx.recv() => {
                if let Ok((msg_user_id, msg)) = outgoing {
                    // Only send to the subscribed user
                    if msg_user_id == user_id {
                        if let Ok(text) = serde_json::to_string(&msg) {
                            if socket.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
}
