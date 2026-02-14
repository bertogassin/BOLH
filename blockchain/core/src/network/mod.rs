//! BOLH P2P Networking layer
//!
//! Pure TCP-based peer-to-peer protocol (no external P2P libraries).
//! Handles peer discovery, block sync, and transaction gossip.
//!
//! Architecture:
//! - protocol.rs — wire protocol (message framing and types)
//! - node.rs — P2P node (connection management, sync, broadcast)
//! - peer.rs — peer information
//! - gossip.rs — gossip topics

pub mod protocol;
pub mod peer;
pub mod gossip;
pub mod node;

use crate::types::{Block, Transaction};
pub use node::{BolhNode, NodeConfig, NetworkStats};
pub use protocol::{Message, HandshakeData, PeerAddress};

/// Network events
#[derive(Debug)]
pub enum NetworkEvent {
    /// New block received from peer
    NewBlock(Block),
    /// New transaction received from peer
    NewTransaction(Transaction),
    /// Peer connected
    PeerConnected(String),
    /// Peer disconnected
    PeerDisconnected(String),
    /// Chain sync completed
    SyncCompleted { peer_id: String, blocks_synced: u64 },
}

/// Network configuration
pub struct NetworkConfig {
    /// Listen address
    pub listen_addr: String,
    /// Bootstrap peers
    pub bootstrap_peers: Vec<String>,
    /// Maximum peers
    pub max_peers: usize,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        NetworkConfig {
            listen_addr: "/ip4/0.0.0.0/tcp/30333".to_string(),
            bootstrap_peers: Vec::new(),
            max_peers: 50,
        }
    }
}
