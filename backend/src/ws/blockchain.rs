//! Blockchain WebSocket support

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum BlockchainWsMessage {
    #[serde(rename = "blockchain:tx")]
    Transaction {
        txid: String,
        status: String,
        mempool: bool,
    },

    #[serde(rename = "blockchain:wallet")]
    Wallet {
        name: String,
        address: String,
        balance: u64,
        status: String,
    },

    #[serde(rename = "blockchain:balance")]
    Balance {
        address: String,
        balance: u64,
    },

    #[serde(rename = "blockchain:block")]
    Block {
        height: u64,
        hash: String,
        tx_count: u32,
    },

    #[serde(rename = "ping")]
    Ping,

    #[serde(rename = "pong")]
    Pong,
}

#[derive(Clone)]
pub struct BlockchainWsManager {
    sender: broadcast::Sender<BlockchainWsMessage>,
}

impl BlockchainWsManager {
    pub fn new() -> Self {
        let (sender, _rx) = broadcast::channel(200);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<BlockchainWsMessage> {
        self.sender.subscribe()
    }

    pub async fn broadcast(&self, message: BlockchainWsMessage) {
        let _ = self.sender.send(message);
    }
}

impl Default for BlockchainWsManager {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn ws_handler(ws: WebSocketUpgrade, manager: Arc<BlockchainWsManager>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, manager))
}

async fn handle_socket(mut socket: WebSocket, manager: Arc<BlockchainWsManager>) {
    let mut rx = manager.subscribe();

    loop {
        tokio::select! {
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(msg) = serde_json::from_str::<BlockchainWsMessage>(&text) {
                            if matches!(msg, BlockchainWsMessage::Ping) {
                                let _ = socket.send(Message::Text(
                                    serde_json::to_string(&BlockchainWsMessage::Pong).unwrap_or_default()
                                )).await;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }

            outgoing = rx.recv() => {
                if let Ok(msg) = outgoing {
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
