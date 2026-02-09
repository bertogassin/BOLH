//! P2P Networking layer using libp2p
//! Handles peer discovery, gossip protocol, block/tx propagation

pub mod peer;
pub mod gossip;

use crate::types::{Block, Transaction};

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
