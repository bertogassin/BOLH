//! BOLH P2P Node — TCP-based peer-to-peer networking
//!
//! Manages connections, peer discovery, block sync, and transaction gossip.
//! Pure Rust TCP (no external P2P libraries), lightweight for mobile.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, TcpListener, SocketAddr};
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

    /// Start the P2P node: TCP listener + connect to seed nodes
    /// Returns immediately; listener runs in a background thread.
    pub fn start(&self, chain: &'static BolhChain) -> Result<(), String> {
        if *self.running.read() {
            return Err("Node already running".into());
        }
        *self.running.write() = true;

        // 1. Start TCP listener in a background thread
        let listener_addr = self.config.listen_addr.clone();
        let peers = Arc::clone(&self.peers);
        let known = Arc::clone(&self.known_peers);
        let running = Arc::clone(&self.running);
        let node_id = self.node_id.clone();
        let network = self.network.clone();
        let listen_port = self.listen_port;
        let max_peers = self.config.max_peers;

        std::thread::Builder::new()
            .name("bolh-p2p-listener".into())
            .spawn(move || {
                let listener = match TcpListener::bind(&listener_addr) {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("[P2P] Listen failed on {}: {}", listener_addr, e);
                        *running.write() = false;
                        return;
                    }
                };
                // Non-blocking with timeout so we can check `running`
                listener.set_nonblocking(false).ok();
                let _ = listener
                    .set_nonblocking(false);

                eprintln!("[P2P] Listening on {}", listener_addr);

                for incoming in listener.incoming() {
                    if !*running.read() {
                        break;
                    }
                    match incoming {
                        Ok(stream) => {
                            if peers.read().len() >= max_peers {
                                continue; // drop excess connections
                            }
                            stream.set_nodelay(true).ok();
                            stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
                            stream.set_write_timeout(Some(Duration::from_secs(10))).ok();

                            // Handle handshake on the incoming stream
                            let peer_addr = match stream.peer_addr() {
                                Ok(a) => a,
                                Err(_) => continue,
                            };

                            match read_message(&stream) {
                                Ok(Message::Handshake(peer_hs)) => {
                                    let our_stats = chain.stats();
                                    if peer_hs.network != network || peer_hs.genesis_hash != our_stats.genesis_hash {
                                        continue; // wrong chain
                                    }
                                    // Send ack
                                    let ack = HandshakeData {
                                        version: PROTOCOL_VERSION,
                                        node_id: node_id.clone(),
                                        network: network.clone(),
                                        height: our_stats.height,
                                        genesis_hash: our_stats.genesis_hash,
                                        listen_port,
                                        user_agent: format!("BOLH-Core/{}", crate::VERSION),
                                    };
                                    if send_message(&stream, &Message::HandshakeAck(ack)).is_ok() {
                                        let pid = peer_hs.node_id.clone();
                                        peers.write().insert(pid.clone(), ConnectedPeer {
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
                                        });
                                        known.write().push(PeerAddress {
                                            host: peer_addr.ip().to_string(),
                                            port: peer_hs.listen_port,
                                            node_id: pid,
                                            height: peer_hs.height,
                                        });
                                        eprintln!("[P2P] Inbound peer {} connected", peer_addr);
                                    }
                                }
                                _ => {} // ignore non-handshake
                            }
                        }
                        Err(e) => {
                            if !*running.read() {
                                break;
                            }
                            eprintln!("[P2P] Accept error: {}", e);
                            std::thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
                eprintln!("[P2P] Listener stopped");
                *running.write() = false;
            })
            .map_err(|e| format!("Thread spawn error: {}", e))?;

        // 2. Connect to seed nodes in background
        let seeds = self.config.seed_nodes.clone();
        if !seeds.is_empty() {
            let peers2 = Arc::clone(&self.peers);
            let known2 = Arc::clone(&self.known_peers);
            let node_id2 = self.node_id.clone();
            let network2 = self.network.clone();
            let listen_port2 = self.listen_port;
            let timeout = self.config.connect_timeout_secs;

            std::thread::Builder::new()
                .name("bolh-p2p-seeds".into())
                .spawn(move || {
                    for seed in &seeds {
                        let socket_addr: SocketAddr = match seed.parse() {
                            Ok(a) => a,
                            Err(_) => continue,
                        };
                        let stream = match TcpStream::connect_timeout(&socket_addr, Duration::from_secs(timeout)) {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        stream.set_nodelay(true).ok();
                        stream.set_read_timeout(Some(Duration::from_secs(30))).ok();

                        let our_stats = chain.stats();
                        let hs = HandshakeData {
                            version: PROTOCOL_VERSION,
                            node_id: node_id2.clone(),
                            network: network2.clone(),
                            height: our_stats.height,
                            genesis_hash: our_stats.genesis_hash.clone(),
                            listen_port: listen_port2,
                            user_agent: format!("BOLH-Core/{}", crate::VERSION),
                        };
                        if send_message(&stream, &Message::Handshake(hs)).is_err() {
                            continue;
                        }
                        match read_message(&stream) {
                            Ok(Message::HandshakeAck(peer_hs)) => {
                                if peer_hs.network == network2 && peer_hs.genesis_hash == our_stats.genesis_hash {
                                    let pid = peer_hs.node_id.clone();
                                    peers2.write().insert(pid.clone(), ConnectedPeer {
                                        info: PeerInfo {
                                            id: peer_hs.node_id.clone(),
                                            addr: seed.clone(),
                                            version: peer_hs.user_agent,
                                            best_height: peer_hs.height,
                                        },
                                        addr: socket_addr,
                                        connected_at: Instant::now(),
                                        last_ping: Instant::now(),
                                        last_pong: None,
                                        latency_ms: 0,
                                        inbound: false,
                                    });
                                    known2.write().push(PeerAddress {
                                        host: socket_addr.ip().to_string(),
                                        port: peer_hs.listen_port,
                                        node_id: pid,
                                        height: peer_hs.height,
                                    });
                                    eprintln!("[P2P] Connected to seed {}", seed);
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .ok();
        }

        Ok(())
    }

    /// Stop the P2P node
    pub fn stop(&self) {
        *self.running.write() = false;
        // Disconnect all peers
        self.peers.write().clear();
        self.known_peers.write().clear();
        eprintln!("[P2P] Node stopped");
    }

    /// Request peer list from a connected peer (peer discovery)
    pub fn discover_peers(&self, peer_id: &str) -> Result<Vec<PeerAddress>, String> {
        let peers = self.peers.read();
        let peer = peers.get(peer_id)
            .ok_or_else(|| format!("Peer '{}' not found", peer_id))?;

        let stream = TcpStream::connect_timeout(
            &peer.addr,
            Duration::from_secs(self.config.connect_timeout_secs),
        ).map_err(|e| format!("Connect failed: {}", e))?;

        send_message(&stream, &Message::RequestPeers)?;

        match read_message(&stream)? {
            Message::ResponsePeers(peer_list) => {
                // Add to known peers (dedup by node_id)
                let mut known = self.known_peers.write();
                for p in &peer_list.peers {
                    if !known.iter().any(|k| k.node_id == p.node_id) && p.node_id != self.node_id {
                        known.push(p.clone());
                    }
                }
                Ok(peer_list.peers)
            }
            _ => Err("Expected ResponsePeers".into()),
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
