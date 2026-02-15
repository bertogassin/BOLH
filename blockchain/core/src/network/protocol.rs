//! BOLH P2P Wire Protocol
//!
//! Binary message format (length-prefixed):
//! [4 bytes: msg_len] [1 byte: msg_type] [msg_len - 1 bytes: payload]
//!
//! Message types:
//! 0x01 — Handshake: node identity, version, chain height
//! 0x02 — HandshakeAck: accept connection
//! 0x03 — Ping
//! 0x04 — Pong
//! 0x10 — NewBlock: broadcast a new block
//! 0x11 — NewTransaction: broadcast a new transaction
//! 0x20 — RequestBlocks: request blocks by height range
//! 0x21 — ResponseBlocks: respond with blocks
//! 0x30 — RequestPeers: ask for known peers
//! 0x31 — ResponsePeers: respond with peer list

use serde::{Deserialize, Serialize};
use crate::types::{Block, Transaction};

/// Protocol version
pub const PROTOCOL_VERSION: u32 = 1;

/// Magic bytes to identify BOLH protocol
pub const MAGIC: [u8; 4] = [0x42, 0x4F, 0x4C, 0x48]; // "BOLH"

/// Maximum message size (10 MB)
pub const MAX_MESSAGE_SIZE: u32 = 10 * 1024 * 1024;

/// Message type IDs
#[derive(Debug, Clone, Copy, PartialEq)]
#[repr(u8)]
pub enum MessageType {
    Handshake       = 0x01,
    HandshakeAck    = 0x02,
    Ping            = 0x03,
    Pong            = 0x04,
    NewBlock        = 0x10,
    NewTransaction  = 0x11,
    RequestBlocks   = 0x20,
    ResponseBlocks  = 0x21,
    RequestPeers    = 0x30,
    ResponsePeers   = 0x31,
}

impl MessageType {
    pub fn from_byte(b: u8) -> Option<Self> {
        match b {
            0x01 => Some(Self::Handshake),
            0x02 => Some(Self::HandshakeAck),
            0x03 => Some(Self::Ping),
            0x04 => Some(Self::Pong),
            0x10 => Some(Self::NewBlock),
            0x11 => Some(Self::NewTransaction),
            0x20 => Some(Self::RequestBlocks),
            0x21 => Some(Self::ResponseBlocks),
            0x30 => Some(Self::RequestPeers),
            0x31 => Some(Self::ResponsePeers),
            _ => None,
        }
    }
}

/// Handshake data sent when connecting to a peer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandshakeData {
    /// Protocol version
    pub version: u32,
    /// Node ID (public key hex)
    pub node_id: String,
    /// Network name ("main", "test", etc.)
    pub network: String,
    /// Current chain height
    pub height: u64,
    /// Genesis block hash (to ensure same chain)
    pub genesis_hash: String,
    /// Our listen port (so the peer can connect back)
    pub listen_port: u16,
    /// User agent
    pub user_agent: String,
}

/// Block range request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockRequest {
    /// Start height (inclusive)
    pub from_height: u64,
    /// End height (inclusive)
    pub to_height: u64,
}

/// Block range response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockResponse {
    /// Blocks in order
    pub blocks: Vec<Block>,
}

/// Peer address information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerAddress {
    /// IP address or hostname
    pub host: String,
    /// Port
    pub port: u16,
    /// Node ID (public key hex)
    pub node_id: String,
    /// Last known chain height
    pub height: u64,
}

/// Peer list response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerList {
    pub peers: Vec<PeerAddress>,
}

/// High-level message enum for easy handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    Handshake(HandshakeData),
    HandshakeAck(HandshakeData),
    Ping { nonce: u64 },
    Pong { nonce: u64 },
    NewBlock(Block),
    NewTransaction(Transaction),
    RequestBlocks(BlockRequest),
    ResponseBlocks(BlockResponse),
    RequestPeers,
    ResponsePeers(PeerList),
}

impl Message {
    /// Serialize message to bytes (type byte + JSON payload)
    pub fn to_bytes(&self) -> Result<Vec<u8>, String> {
        let (msg_type, payload) = match self {
            Message::Handshake(data) => (MessageType::Handshake, serde_json::to_vec(data)),
            Message::HandshakeAck(data) => (MessageType::HandshakeAck, serde_json::to_vec(data)),
            Message::Ping { nonce } => (MessageType::Ping, serde_json::to_vec(nonce)),
            Message::Pong { nonce } => (MessageType::Pong, serde_json::to_vec(nonce)),
            Message::NewBlock(block) => (MessageType::NewBlock, serde_json::to_vec(block)),
            Message::NewTransaction(tx) => (MessageType::NewTransaction, serde_json::to_vec(tx)),
            Message::RequestBlocks(req) => (MessageType::RequestBlocks, serde_json::to_vec(req)),
            Message::ResponseBlocks(resp) => (MessageType::ResponseBlocks, serde_json::to_vec(resp)),
            Message::RequestPeers => (MessageType::RequestPeers, Ok(vec![])),
            Message::ResponsePeers(list) => (MessageType::ResponsePeers, serde_json::to_vec(list)),
        };

        let payload = payload.map_err(|e| format!("Serialize error: {}", e))?;

        // Frame: [4 magic] [4 length] [1 type] [payload]
        let total_len = 1 + payload.len();
        if total_len as u32 > MAX_MESSAGE_SIZE {
            return Err("Message too large".into());
        }

        let mut bytes = Vec::with_capacity(4 + 4 + total_len);
        bytes.extend_from_slice(&MAGIC);
        bytes.extend_from_slice(&(total_len as u32).to_le_bytes());
        bytes.push(msg_type as u8);
        bytes.extend_from_slice(&payload);

        Ok(bytes)
    }

    /// Deserialize message from raw bytes (after reading frame header)
    pub fn from_raw(msg_type_byte: u8, payload: &[u8]) -> Result<Self, String> {
        let msg_type = MessageType::from_byte(msg_type_byte)
            .ok_or_else(|| format!("Unknown message type: 0x{:02x}", msg_type_byte))?;

        match msg_type {
            MessageType::Handshake => {
                let data: HandshakeData = serde_json::from_slice(payload)
                    .map_err(|e| format!("Handshake parse error: {}", e))?;
                Ok(Message::Handshake(data))
            }
            MessageType::HandshakeAck => {
                let data: HandshakeData = serde_json::from_slice(payload)
                    .map_err(|e| format!("HandshakeAck parse error: {}", e))?;
                Ok(Message::HandshakeAck(data))
            }
            MessageType::Ping => {
                let nonce: u64 = serde_json::from_slice(payload).unwrap_or(0);
                Ok(Message::Ping { nonce })
            }
            MessageType::Pong => {
                let nonce: u64 = serde_json::from_slice(payload).unwrap_or(0);
                Ok(Message::Pong { nonce })
            }
            MessageType::NewBlock => {
                let block: Block = serde_json::from_slice(payload)
                    .map_err(|e| format!("Block parse error: {}", e))?;
                Ok(Message::NewBlock(block))
            }
            MessageType::NewTransaction => {
                let tx: Transaction = serde_json::from_slice(payload)
                    .map_err(|e| format!("Transaction parse error: {}", e))?;
                Ok(Message::NewTransaction(tx))
            }
            MessageType::RequestBlocks => {
                let req: BlockRequest = serde_json::from_slice(payload)
                    .map_err(|e| format!("BlockRequest parse error: {}", e))?;
                Ok(Message::RequestBlocks(req))
            }
            MessageType::ResponseBlocks => {
                let resp: BlockResponse = serde_json::from_slice(payload)
                    .map_err(|e| format!("BlockResponse parse error: {}", e))?;
                Ok(Message::ResponseBlocks(resp))
            }
            MessageType::RequestPeers => Ok(Message::RequestPeers),
            MessageType::ResponsePeers => {
                let list: PeerList = serde_json::from_slice(payload)
                    .map_err(|e| format!("PeerList parse error: {}", e))?;
                Ok(Message::ResponsePeers(list))
            }
        }
    }
}
