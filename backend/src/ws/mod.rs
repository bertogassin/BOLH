//! WebSocket module

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

/// WebSocket connection manager
pub struct WsManager {
    /// Map of user_id to sender
    connections: Arc<RwLock<HashMap<i64, broadcast::Sender<WsMessage>>>>,
}

impl WsManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new connection
    pub async fn register(&self, user_id: i64) -> broadcast::Receiver<WsMessage> {
        let (tx, rx) = broadcast::channel(100);
        self.connections.write().await.insert(user_id, tx);
        rx
    }

    /// Unregister a connection
    pub async fn unregister(&self, user_id: i64) {
        self.connections.write().await.remove(&user_id);
    }

    /// Send message to a specific user
    pub async fn send_to_user(&self, user_id: i64, message: WsMessage) -> Result<(), WsError> {
        let connections = self.connections.read().await;
        if let Some(tx) = connections.get(&user_id) {
            tx.send(message).map_err(|_| WsError::SendFailed)?;
        }
        Ok(())
    }

    /// Broadcast message to all connected users
    pub async fn broadcast(&self, message: WsMessage) {
        let connections = self.connections.read().await;
        for tx in connections.values() {
            let _ = tx.send(message.clone());
        }
    }
}

impl Default for WsManager {
    fn default() -> Self {
        Self::new()
    }
}

/// WebSocket message types
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    /// Guard location update
    #[serde(rename = "guard:location")]
    GuardLocation {
        guard_id: i64,
        latitude: f64,
        longitude: f64,
        timestamp: i64,
    },
    
    /// Order status change
    #[serde(rename = "order:status")]
    OrderStatus {
        order_id: String,
        status: String,
        guard_id: Option<i64>,
    },
    
    /// New chat message
    #[serde(rename = "chat:message")]
    ChatMessage {
        conversation_id: String,
        message_id: String,
        sender_id: i64,
        text: String,
        timestamp: i64,
    },
    
    /// SOS alert
    #[serde(rename = "sos:alert")]
    SosAlert {
        user_id: i64,
        latitude: f64,
        longitude: f64,
        timestamp: i64,
    },
    
    /// Notification
    #[serde(rename = "notification")]
    Notification {
        id: String,
        title: String,
        body: String,
    },
    
    /// Ping/Pong for connection health
    #[serde(rename = "ping")]
    Ping,
    
    #[serde(rename = "pong")]
    Pong,
}

/// WebSocket handler
pub async fn ws_handler(ws: WebSocketUpgrade, user_id: i64, manager: Arc<WsManager>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, manager))
}

async fn handle_socket(mut socket: WebSocket, user_id: i64, manager: Arc<WsManager>) {
    let mut rx = manager.register(user_id).await;

    loop {
        tokio::select! {
            // Incoming message from client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                            handle_client_message(ws_msg, user_id, &manager).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    _ => {}
                }
            }
            
            // Outgoing message to client
            msg = rx.recv() => {
                if let Ok(ws_msg) = msg {
                    if let Ok(text) = serde_json::to_string(&ws_msg) {
                        if socket.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                }
            }
        }
    }

    manager.unregister(user_id).await;
}

async fn handle_client_message(message: WsMessage, user_id: i64, manager: &WsManager) {
    match message {
        WsMessage::Ping => {
            let _ = manager.send_to_user(user_id, WsMessage::Pong).await;
        }
        WsMessage::GuardLocation { guard_id, latitude, longitude, timestamp } => {
            // TODO: Update guard location in database
            // TODO: Broadcast to relevant clients
            tracing::info!("Guard {} location update: ({}, {})", guard_id, latitude, longitude);
        }
        _ => {}
    }
}

#[derive(Debug, thiserror::Error)]
pub enum WsError {
    #[error("Failed to send message")]
    SendFailed,
}
