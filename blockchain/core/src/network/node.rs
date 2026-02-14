//! BOLH P2P Node — TCP-based peer-to-peer networking
//!
//! Manages connections, peer discovery, block sync, and transaction gossip.
//! Pure Rust TCP (no external P2P libraries), lightweight for mobile.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;

use super::protocol::*;
use super::peer::PeerInfo;
use crate::chain::BolhChain;

/// Node configuration
#[derive(Clone)]
pub struct NodeConfig {
    /// Listen address (e.g. "0.0.0.0:30333")
    pub listen_addr: String,
    /// Seed/bootstrap nodes to connect to initially
    pub seed_nodes: Vec<String>,
    /// Maximum number of connected peers
    pub max_peers: usize,
    /// Ping interval in seconds
    pub ping_interval_secs: u64,
    /// Connection timeout in seconds
    pub connect_timeout_secs: u64,
    /// Sync batch size (blocks per request)
    pub sync_batch_size: u64,
}

impl Default for NodeConfig {
    fn default() -> Self {
        NodeConfig {
            listen_addr: "0.0.0.0:30333".to_string(),
            seed_nodes: Vec::new(),
            max_peers: 50,
            ping_interval_secs: 30,
            connect_timeout_secs: 10,
            sync_batch_size: 100,
        }
    }
}

/// Connected peer state
#[derive(Debug)]
pub struct ConnectedPeer {
    pub info: PeerInfo,
    pub addr: SocketAddr,
    pub connected_at: Instant,
    pub last_ping: Instant,
    pub last_pong: Option<Instant>,
    pub latency_ms: u64,
    pub inbound: bool,
}

/// P2P Node state
pub struct BolhNode {
    /// Our node identity (public key hex)
    pub node_id: String,
    /// Configuration
    pub config: NodeConfig,
    /// Connected peers
    pub peers: Arc<RwLock<HashMap<String, ConnectedPeer>>>,
    /// Known peer addresses (for discovery)
    pub known_peers: Arc<RwLock<Vec<PeerAddress>>>,
    /// Is node running?
    pub running: Arc<RwLock<bool>>,
    /// Network name
    pub network: String,
    /// Our listen port
    pub listen_port: u16,
}

impl BolhNode {
    /// Create a new P2P node
    pub fn new(node_id: String, config: NodeConfig) -> Self {
        let listen_port = config.listen_addr
            .split(':')
            .last()
            .and_then(|p| p.parse().ok())
            .unwrap_or(30333);

        BolhNode {
            node_id,
            config,
            peers: Arc::new(RwLock::new(HashMap::new())),
            known_peers: Arc::new(RwLock::new(Vec::new())),
            running: Arc::new(RwLock::new(false)),
            network: "main".to_string(),
            listen_port,
        }
    }

    /// Build handshake data from current chain state
    pub fn build_handshake(&self, chain: &BolhChain) -> HandshakeData {
        let stats = chain.stats();
        HandshakeData {
            version: PROTOCOL_VERSION,
            node_id: self.node_id.clone(),
            network: self.network.clone(),
            height: stats.height,
            genesis_hash: stats.genesis_hash,
            listen_port: self.listen_port,
            user_agent: format!("BOLH-Core/{}", crate::VERSION),
        }
    }

    /// Connect to a peer by address
    pub fn connect_to_peer(
        &self,
        addr: &str,
        chain: &BolhChain,
    ) -> Result<String, String> {
        // Check max peers
        if self.peers.read().len() >= self.config.max_peers {
            return Err("Max peers reached".into());
        }

        // Connect with timeout
        let socket_addr: SocketAddr = addr.parse()
            .map_err(|e| format!("Invalid address '{}': {}", addr, e))?;

        let stream = TcpStream::connect_timeout(
            &socket_addr,
            Duration::from_secs(self.config.connect_timeout_secs),
        ).map_err(|e| format!("Connection failed: {}", e))?;

        stream.set_nodelay(true).ok();
        stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
        stream.set_write_timeout(Some(Duration::from_secs(10))).ok();

        // Send handshake
        let handshake = self.build_handshake(chain);
        let msg = Message::Handshake(handshake);
        send_message(&stream, &msg)?;

        // Wait for handshake ack
        let response = read_message(&stream)?;
        match response {
            Message::HandshakeAck(peer_hs) => {
                // Verify same network and genesis
                let our_stats = chain.stats();
                if peer_hs.network != self.network {
                    return Err(format!("Network mismatch: {} vs {}", peer_hs.network, self.network));
                }
                if peer_hs.genesis_hash != our_stats.genesis_hash {
                    return Err("Genesis hash mismatch — different chain".into());
                }

                let peer_id = peer_hs.node_id.clone();

                // Register peer
                let peer = ConnectedPeer {
                    info: PeerInfo {
                        id: peer_hs.node_id.clone(),
                        addr: addr.to_string(),
                        version: peer_hs.user_agent.clone(),
                        best_height: peer_hs.height,
                    },
                    addr: socket_addr,
                    connected_at: Instant::now(),
                    last_ping: Instant::now(),
                    last_pong: None,
                    latency_ms: 0,
                    inbound: false,
                };

                self.peers.write().insert(peer_id.clone(), peer);

                // Register in known peers
                self.known_peers.write().push(PeerAddress {
                    host: socket_addr.ip().to_string(),
                    port: peer_hs.listen_port,
                    node_id: peer_id.clone(),
                    height: peer_hs.height,
                });

                Ok(peer_id)
            }
            _ => Err("Expected HandshakeAck, got unexpected message".into()),
        }
    }

    /// Handle an incoming connection
    pub fn handle_incoming(
        &self,
        stream: &TcpStream,
        chain: &BolhChain,
    ) -> Result<String, String> {
        let peer_addr = stream.peer_addr()
            .map_err(|e| format!("No peer addr: {}", e))?;

        // Read handshake
        let msg = read_message(stream)?;
        match msg {
            Message::Handshake(peer_hs) => {
                // Verify network
                let our_stats = chain.stats();
                if peer_hs.network != self.network {
                    return Err(format!("Network mismatch: {}", peer_hs.network));
                }
                if peer_hs.genesis_hash != our_stats.genesis_hash {
                    return Err("Genesis hash mismatch".into());
                }

                // Send handshake ack
                let ack = self.build_handshake(chain);
                send_message(stream, &Message::HandshakeAck(ack))?;

                let peer_id = peer_hs.node_id.clone();

                let peer = ConnectedPeer {
                    info: PeerInfo {
                        id: peer_hs.node_id.clone(),
                        addr: peer_addr.to_string(),
                        version: peer_hs.user_agent,
                        best_height: peer_hs.height,
                    },
                    addr: peer_addr,
                    connected_at: Instant::now(),
                    last_ping: Instant::now(),
                    last_pong: None,
                    latency_ms: 0,
                    inbound: true,
                };

                self.peers.write().insert(peer_id.clone(), peer);
                Ok(peer_id)
            }
            _ => Err("Expected Handshake, got unexpected message".into()),
        }
    }

    /// Broadcast a new block to all connected peers
    pub fn broadcast_block(&self, block: &crate::types::Block) {
        let msg = Message::NewBlock(block.clone());
        let peers = self.peers.read();
        for (peer_id, peer) in peers.iter() {
            if let Ok(stream) = TcpStream::connect_timeout(
                &peer.addr,
                Duration::from_secs(5),
            ) {
                if let Err(e) = send_message(&stream, &msg) {
                    eprintln!("[P2P] Failed to send block to {}: {}", peer_id, e);
                }
            }
        }
    }

    /// Broadcast a new transaction to all connected peers
    pub fn broadcast_transaction(&self, tx: &crate::types::Transaction) {
        let msg = Message::NewTransaction(tx.clone());
        let peers = self.peers.read();
        for (peer_id, peer) in peers.iter() {
            if let Ok(stream) = TcpStream::connect_timeout(
                &peer.addr,
                Duration::from_secs(5),
            ) {
                if let Err(e) = send_message(&stream, &msg) {
                    eprintln!("[P2P] Failed to send tx to {}: {}", peer_id, e);
                }
            }
        }
    }

    /// Request blocks from a peer for chain sync
    pub fn request_blocks(
        &self,
        peer_id: &str,
        from_height: u64,
        to_height: u64,
    ) -> Result<Vec<crate::types::Block>, String> {
        let peers = self.peers.read();
        let peer = peers.get(peer_id)
            .ok_or_else(|| format!("Peer '{}' not found", peer_id))?;

        let stream = TcpStream::connect_timeout(
            &peer.addr,
            Duration::from_secs(self.config.connect_timeout_secs),
        ).map_err(|e| format!("Connect to peer failed: {}", e))?;

        let req = Message::RequestBlocks(BlockRequest {
            from_height,
            to_height,
        });
        send_message(&stream, &req)?;

        let response = read_message(&stream)?;
        match response {
            Message::ResponseBlocks(resp) => Ok(resp.blocks),
            _ => Err("Expected ResponseBlocks".into()),
        }
    }

    /// Sync chain with a peer that has more blocks
    pub fn sync_with_peer(
        &self,
        peer_id: &str,
        chain: &BolhChain,
    ) -> Result<u64, String> {
        let our_height = chain.height();
        let peer_height = {
            let peers = self.peers.read();
            peers.get(peer_id)
                .map(|p| p.info.best_height)
                .unwrap_or(0)
        };

        if peer_height <= our_height {
            return Ok(0); // Nothing to sync
        }

        let mut synced = 0u64;
        let mut current = our_height + 1;

        while current <= peer_height {
            let end = std::cmp::min(current + self.config.sync_batch_size - 1, peer_height);
            let blocks = self.request_blocks(peer_id, current, end)?;

            for block in blocks {
                // Validate and apply block
                if block.is_valid_structure() {
                    chain.apply_synced_block(block)?;
                    synced += 1;
                }
            }

            current = end + 1;
        }

        // Save after sync
        let _ = crate::chain::save_global_chain();

        Ok(synced)
    }

    /// Disconnect a peer
    pub fn disconnect_peer(&self, peer_id: &str) {
        self.peers.write().remove(peer_id);
    }

    /// Get number of connected peers
    pub fn peer_count(&self) -> usize {
        self.peers.read().len()
    }

    /// Get list of connected peers
    pub fn connected_peers(&self) -> Vec<PeerInfo> {
        self.peers.read().values().map(|p| p.info.clone()).collect()
    }

    /// Get network stats
    pub fn network_stats(&self) -> NetworkStats {
        let peers = self.peers.read();
        let inbound = peers.values().filter(|p| p.inbound).count();
        let outbound = peers.values().filter(|p| !p.inbound).count();

        NetworkStats {
            total_peers: peers.len(),
            inbound_peers: inbound,
            outbound_peers: outbound,
            known_peers: self.known_peers.read().len(),
            is_running: *self.running.read(),
            listen_addr: self.config.listen_addr.clone(),
            node_id: self.node_id.clone(),
        }
    }
}

/// Network statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct NetworkStats {
    pub total_peers: usize,
    pub inbound_peers: usize,
    pub outbound_peers: usize,
    pub known_peers: usize,
    pub is_running: bool,
    pub listen_addr: String,
    pub node_id: String,
}

// === Wire format helpers ===

/// Send a framed message over TCP
pub fn send_message(stream: &TcpStream, msg: &Message) -> Result<(), String> {
    let bytes = msg.to_bytes()?;
    let mut stream = stream;
    stream.write_all(&bytes)
        .map_err(|e| format!("Write error: {}", e))?;
    stream.flush()
        .map_err(|e| format!("Flush error: {}", e))?;
    Ok(())
}

/// Read a framed message from TCP
pub fn read_message(stream: &TcpStream) -> Result<Message, String> {
    let mut stream = stream;

    // Read magic bytes
    let mut magic = [0u8; 4];
    stream.read_exact(&mut magic)
        .map_err(|e| format!("Read magic error: {}", e))?;

    if magic != MAGIC {
        return Err(format!("Invalid magic bytes: {:?}", magic));
    }

    // Read length
    let mut len_bytes = [0u8; 4];
    stream.read_exact(&mut len_bytes)
        .map_err(|e| format!("Read length error: {}", e))?;
    let msg_len = u32::from_le_bytes(len_bytes);

    if msg_len > MAX_MESSAGE_SIZE || msg_len == 0 {
        return Err(format!("Invalid message size: {}", msg_len));
    }

    // Read type byte
    let mut type_byte = [0u8; 1];
    stream.read_exact(&mut type_byte)
        .map_err(|e| format!("Read type error: {}", e))?;

    // Read payload
    let payload_len = msg_len as usize - 1;
    let mut payload = vec![0u8; payload_len];
    if payload_len > 0 {
        stream.read_exact(&mut payload)
            .map_err(|e| format!("Read payload error: {}", e))?;
    }

    Message::from_raw(type_byte[0], &payload)
}

// Add apply_synced_block to BolhChain
impl BolhChain {
    /// Apply a block received from a peer during sync
    pub fn apply_synced_block(&self, block: crate::types::Block) -> Result<(), String> {
        // Delegate to unified execution path.
        self.apply_block(block)
    }
}
