//! Peer management

/// Peer information
#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub addr: String,
    pub version: String,
    pub best_height: u64,
}
