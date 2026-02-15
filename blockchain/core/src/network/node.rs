//! BOLH P2P Node — TCP-based peer-to-peer networking
//!
//! Manages connections, peer discovery, block sync, and transaction gossip.
//! Pure Rust TCP (no external P2P libraries), lightweight for mobile.
//!
//! Improvements v2:
//! - Persistent connections with message loops per peer
//! - Background maintenance (ping/pong, reconnect, discovery)
//! - Transaction deduplication in gossip
//! - Peer reputation scoring

use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::{TcpStream, TcpListener, SocketAddr};
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;

use super::protocol::*;
use super::peer::{PeerInfo, PeerReputation};
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
    /// Reconnect interval in seconds
    pub reconnect_interval_secs: u64,
    /// Discovery interval in seconds
    pub discovery_interval_secs: u64,
    /// Max seen transactions to cache (dedup)
    pub max_seen_txs: usize,
    /// Maintenance loop interval in seconds
    pub maintenance_interval_secs: u64,
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
            reconnect_interval_secs: 60,
            discovery_interval_secs: 120,
            max_seen_txs: 10_000,
            maintenance_interval_secs: 15,
        }
    }
}

/// Connected peer state (persistent)
#[derive(Debug)]
pub struct ConnectedPeer {
    pub info: PeerInfo,
    pub addr: SocketAddr,
    pub connected_at: Instant,
    pub last_ping: Instant,
    pub last_pong: Option<Instant>,
    pub latency_ms: u64,
    pub inbound: bool,
    /// Peer reputation
    pub reputation: PeerReputation,
}

/// P2P Node state
pub struct BolhNode {
    /// Our node identity (public key hex)
    pub node_id: String,
    /// Configuration
    pub config: NodeConfig,
    /// Connected peers with their info
    pub peers: Arc<RwLock<HashMap<String, ConnectedPeer>>>,
    /// Active TCP streams for each peer (for sending messages)
    streams: Arc<RwLock<HashMap<String, Arc<RwLock<TcpStream>>>>>,
    /// Known peer addresses (for discovery)
    pub known_peers: Arc<RwLock<Vec<PeerAddress>>>,
    /// Banned peer IDs
    banned_peers: Arc<RwLock<HashSet<String>>>,
    /// Recently seen transaction hashes (for dedup)
    seen_txs: Arc<RwLock<HashSet<String>>>,
    /// Recently seen block hashes (for dedup)
    seen_blocks: Arc<RwLock<HashSet<String>>>,
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
            streams: Arc::new(RwLock::new(HashMap::new())),
            known_peers: Arc::new(RwLock::new(Vec::new())),
            banned_peers: Arc::new(RwLock::new(HashSet::new())),
            seen_txs: Arc::new(RwLock::new(HashSet::new())),
            seen_blocks: Arc::new(RwLock::new(HashSet::new())),
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

    // ─── Connection Management ────────────────────────────────────────

    /// Connect to a peer by address (outbound)
    pub fn connect_to_peer(
        &self,
        addr: &str,
        chain: &BolhChain,
    ) -> Result<String, String> {
        // Check max peers
        if self.peers.read().len() >= self.config.max_peers {
            return Err("Max peers reached".into());
        }

        // Parse address
        let socket_addr: SocketAddr = addr.parse()
            .map_err(|e| format!("Invalid address '{}': {}", addr, e))?;

        // Check if already connected
        {
            let peers = self.peers.read();
            for p in peers.values() {
                if p.addr == socket_addr {
                    return Err(format!("Already connected to {}", addr));
                }
            }
        }

        // Connect with timeout
        let stream = TcpStream::connect_timeout(
            &socket_addr,
            Duration::from_secs(self.config.connect_timeout_secs),
        ).map_err(|e| format!("Connection failed to {}: {}", addr, e))?;

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

                // Check if banned
                if self.banned_peers.read().contains(&peer_hs.node_id) {
                    return Err("Peer is banned".into());
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
                    reputation: PeerReputation::default(),
                };

                self.peers.write().insert(peer_id.clone(), peer);

                // Store the stream for persistent communication
                let stream_clone = stream.try_clone()
                    .map_err(|e| format!("Failed to clone stream: {}", e))?;
                self.streams.write().insert(
                    peer_id.clone(),
                    Arc::new(RwLock::new(stream_clone)),
                );

                // Register in known peers (dedup)
                let mut known = self.known_peers.write();
                if !known.iter().any(|k| k.node_id == peer_id) {
                    known.push(PeerAddress {
                        host: socket_addr.ip().to_string(),
                        port: peer_hs.listen_port,
                        node_id: peer_id.clone(),
                        height: peer_hs.height,
                    });
                }

                eprintln!("[P2P] Connected to peer {} at {}", peer_id, addr);
                Ok(peer_id)
            }
            _ => Err("Expected HandshakeAck, got unexpected message".into()),
        }
    }

    /// Handle an incoming connection (inbound)
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
                // Check if banned
                if self.banned_peers.read().contains(&peer_hs.node_id) {
                    return Err("Peer is banned".into());
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
                    reputation: PeerReputation::default(),
                };

                self.peers.write().insert(peer_id.clone(), peer);

                // Store the stream
                if let Ok(cloned) = stream.try_clone() {
                    self.streams.write().insert(
                        peer_id.clone(),
                        Arc::new(RwLock::new(cloned)),
                    );
                }

                // Register in known peers
                let mut known = self.known_peers.write();
                if !known.iter().any(|k| k.node_id == peer_id) {
                    known.push(PeerAddress {
                        host: peer_addr.ip().to_string(),
                        port: peer_hs.listen_port,
                        node_id: peer_id.clone(),
                        height: peer_hs.height,
                    });
                }

                Ok(peer_id)
            }
            _ => Err("Expected Handshake, got unexpected message".into()),
        }
    }

    // ─── Message Broadcasting ─────────────────────────────────────────

    /// Send a message to a specific peer using the persistent stream
    fn send_to_peer(&self, peer_id: &str, msg: &Message) -> Result<(), String> {
        let streams = self.streams.read();
        if let Some(stream_arc) = streams.get(peer_id) {
            let stream = stream_arc.read();
            send_message(&stream, msg)?;
            // Record good interaction
            if let Some(peer) = self.peers.write().get_mut(peer_id) {
                peer.reputation.record_good();
            }
            Ok(())
        } else {
            // Fallback: try direct connect
            let peers = self.peers.read();
            if let Some(peer) = peers.get(peer_id) {
                let stream = TcpStream::connect_timeout(
                    &peer.addr,
                    Duration::from_secs(5),
                ).map_err(|e| format!("Reconnect to {} failed: {}", peer_id, e))?;
                send_message(&stream, msg)?;
                Ok(())
            } else {
                Err(format!("Peer '{}' not found", peer_id))
            }
        }
    }

    /// Broadcast a new block to all connected peers (with dedup)
    pub fn broadcast_block(&self, block: &crate::types::Block) {
        let block_hash = hex::encode(&block.hash);

        // Check if we've already broadcast this block
        {
            let mut seen = self.seen_blocks.write();
            if seen.contains(&block_hash) {
                return;
            }
            seen.insert(block_hash.clone());
            // Limit cache size
            if seen.len() > 1000 {
                let to_remove: Vec<String> = seen.iter().take(500).cloned().collect();
                for h in to_remove {
                    seen.remove(&h);
                }
            }
        }

        let msg = Message::NewBlock(block.clone());
        let peer_ids: Vec<String> = self.peers.read().keys().cloned().collect();

        for peer_id in &peer_ids {
            if let Err(e) = self.send_to_peer(peer_id, &msg) {
                eprintln!("[P2P] Failed to send block to {}: {}", peer_id, e);
                if let Some(peer) = self.peers.write().get_mut(peer_id) {
                    peer.reputation.record_bad();
                }
            }
        }

        eprintln!("[P2P] Block {} broadcast to {} peers", &block_hash[..8], peer_ids.len());
    }

    /// Broadcast a new transaction to all connected peers (with dedup)
    pub fn broadcast_transaction(&self, tx: &crate::types::Transaction) {
        let tx_hash = hex::encode(&tx.hash);

        // Check dedup
        {
            let mut seen = self.seen_txs.write();
            if seen.contains(&tx_hash) {
                return;
            }
            seen.insert(tx_hash.clone());
            // Limit cache size
            if seen.len() > self.config.max_seen_txs {
                let to_remove: Vec<String> = seen.iter()
                    .take(self.config.max_seen_txs / 2)
                    .cloned().collect();
                for h in to_remove {
                    seen.remove(&h);
                }
            }
        }

        let msg = Message::NewTransaction(tx.clone());
        let peer_ids: Vec<String> = self.peers.read().keys().cloned().collect();

        for peer_id in &peer_ids {
            if let Err(e) = self.send_to_peer(peer_id, &msg) {
                eprintln!("[P2P] Failed to send tx to {}: {}", peer_id, e);
            }
        }
    }

    /// Send ping to a specific peer (public for external use)
    pub fn ping_peer(&self, peer_id: &str) -> Result<(), String> {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        self.send_to_peer(peer_id, &Message::Ping { nonce })?;

        // Update last_ping timestamp
        if let Some(peer) = self.peers.write().get_mut(peer_id) {
            peer.last_ping = Instant::now();
        }

        Ok(())
    }

    // ─── Block Sync ───────────────────────────────────────────────────

    /// Request blocks from a peer for chain sync
    pub fn request_blocks(
        &self,
        peer_id: &str,
        from_height: u64,
        to_height: u64,
    ) -> Result<Vec<crate::types::Block>, String> {
        let req = Message::RequestBlocks(BlockRequest {
            from_height,
            to_height,
        });

        self.send_to_peer(peer_id, &req)?;

        // Read response from persistent stream
        let streams = self.streams.read();
        if let Some(stream_arc) = streams.get(peer_id) {
            let stream = stream_arc.read();
            let response = read_message(&stream)?;
            match response {
                Message::ResponseBlocks(resp) => {
                    // Record good reputation for blocks provided
                    if let Some(peer) = self.peers.write().get_mut(peer_id) {
                        peer.reputation.blocks_provided += resp.blocks.len() as u64;
                        peer.reputation.record_good();
                    }
                    Ok(resp.blocks)
                }
                _ => Err("Expected ResponseBlocks".into()),
            }
        } else {
            // Fallback to direct connection
            let peers = self.peers.read();
            let peer = peers.get(peer_id)
                .ok_or_else(|| format!("Peer '{}' not found", peer_id))?;

            let stream = TcpStream::connect_timeout(
                &peer.addr,
                Duration::from_secs(self.config.connect_timeout_secs),
            ).map_err(|e| format!("Connect to peer failed: {}", e))?;

            send_message(&stream, &req)?;
            let response = read_message(&stream)?;
            match response {
                Message::ResponseBlocks(resp) => Ok(resp.blocks),
                _ => Err("Expected ResponseBlocks".into()),
            }
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

        eprintln!("[P2P] Syncing with {} — our height: {}, peer height: {}", peer_id, our_height, peer_height);

        let mut synced = 0u64;
        let mut current = our_height + 1;

        while current <= peer_height {
            let end = std::cmp::min(current + self.config.sync_batch_size - 1, peer_height);
            let blocks = self.request_blocks(peer_id, current, end)?;

            if blocks.is_empty() {
                eprintln!("[P2P] No more blocks from peer, stopping sync at height {}", current);
                break;
            }

            for block in blocks {
                // Validate and apply block
                if block.is_valid_structure() {
                    match chain.apply_synced_block(block) {
                        Ok(()) => synced += 1,
                        Err(e) => {
                            eprintln!("[P2P] Block apply error at height {}: {}", current, e);
                            // Record bad reputation
                            if let Some(peer) = self.peers.write().get_mut(peer_id) {
                                peer.reputation.record_bad();
                            }
                            break;
                        }
                    }
                } else {
                    eprintln!("[P2P] Invalid block structure from peer {} at height {}", peer_id, current);
                    if let Some(peer) = self.peers.write().get_mut(peer_id) {
                        peer.reputation.record_bad();
                    }
                    break;
                }
            }

            current = end + 1;
        }

        // Save after sync
        if synced > 0 {
            let _ = crate::chain::save_global_chain();
            eprintln!("[P2P] Synced {} blocks from peer {}", synced, peer_id);
        }

        Ok(synced)
    }

    /// Auto-sync: find the best peer and sync from them
    pub fn auto_sync(&self, chain: &BolhChain) -> Result<u64, String> {
        let our_height = chain.height();
        let best_peer = {
            let peers = self.peers.read();
            peers.iter()
                .filter(|(_, p)| p.info.best_height > our_height && p.reputation.is_trusted())
                .max_by_key(|(_, p)| p.info.best_height)
                .map(|(id, _)| id.clone())
        };

        match best_peer {
            Some(peer_id) => self.sync_with_peer(&peer_id, chain),
            None => Ok(0),
        }
    }

    // ─── Peer Discovery ───────────────────────────────────────────────

    /// Request peer list from a connected peer
    pub fn discover_peers(&self, peer_id: &str) -> Result<Vec<PeerAddress>, String> {
        self.send_to_peer(peer_id, &Message::RequestPeers)?;

        // Read response
        let streams = self.streams.read();
        if let Some(stream_arc) = streams.get(peer_id) {
            let stream = stream_arc.read();
            match read_message(&stream)? {
                Message::ResponsePeers(peer_list) => {
                    // Add to known peers (dedup by node_id, skip self, skip banned)
                    let mut known = self.known_peers.write();
                    let banned = self.banned_peers.read();
                    let mut added = 0;
                    for p in &peer_list.peers {
                        if p.node_id != self.node_id
                            && !banned.contains(&p.node_id)
                            && !known.iter().any(|k| k.node_id == p.node_id)
                        {
                            known.push(p.clone());
                            added += 1;
                        }
                    }
                    if added > 0 {
                        eprintln!("[P2P] Discovered {} new peers from {}", added, peer_id);
                    }
                    Ok(peer_list.peers)
                }
                _ => Err("Expected ResponsePeers".into()),
            }
        } else {
            Err("No stream for peer".into())
        }
    }

    // ─── Connection Lifecycle ─────────────────────────────────────────

    /// Disconnect a peer
    pub fn disconnect_peer(&self, peer_id: &str) {
        self.peers.write().remove(peer_id);
        self.streams.write().remove(peer_id);
        eprintln!("[P2P] Disconnected peer {}", peer_id);
    }

    /// Ban a peer (disconnect + prevent reconnect)
    pub fn ban_peer(&self, peer_id: &str) {
        self.disconnect_peer(peer_id);
        self.banned_peers.write().insert(peer_id.to_string());
        // Remove from known peers
        self.known_peers.write().retain(|p| p.node_id != peer_id);
        eprintln!("[P2P] Banned peer {}", peer_id);
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
        let avg_reputation = if peers.is_empty() {
            0
        } else {
            peers.values().map(|p| p.reputation.score as u64).sum::<u64>() / peers.len() as u64
        };

        NetworkStats {
            total_peers: peers.len(),
            inbound_peers: inbound,
            outbound_peers: outbound,
            known_peers: self.known_peers.read().len(),
            banned_peers: self.banned_peers.read().len(),
            seen_txs: self.seen_txs.read().len(),
            seen_blocks: self.seen_blocks.read().len(),
            avg_peer_reputation: avg_reputation as u32,
            is_running: *self.running.read(),
            listen_addr: self.config.listen_addr.clone(),
            node_id: self.node_id.clone(),
        }
    }

    // ─── Node Lifecycle ───────────────────────────────────────────────

    /// Start the P2P node: TCP listener + connect to seed nodes + background maintenance
    pub fn start(&self, chain: &'static BolhChain) -> Result<(), String> {
        if *self.running.read() {
            return Err("Node already running".into());
        }
        *self.running.write() = true;

        // 1. Start TCP listener with full message loop
        let listener_addr = self.config.listen_addr.clone();
        let peers = Arc::clone(&self.peers);
        let streams = Arc::clone(&self.streams);
        let known = Arc::clone(&self.known_peers);
        let banned = Arc::clone(&self.banned_peers);
        let seen_txs = Arc::clone(&self.seen_txs);
        let seen_blocks = Arc::clone(&self.seen_blocks);
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

                eprintln!("[P2P] Listening on {}", listener_addr);

                for incoming in listener.incoming() {
                    if !*running.read() {
                        break;
                    }
                    match incoming {
                        Ok(stream) => {
                            if peers.read().len() >= max_peers {
                                continue;
                            }
                            stream.set_nodelay(true).ok();
                            stream.set_read_timeout(Some(Duration::from_secs(30))).ok();
                            stream.set_write_timeout(Some(Duration::from_secs(10))).ok();

                            let peer_addr = match stream.peer_addr() {
                                Ok(a) => a,
                                Err(_) => continue,
                            };

                            // Handle handshake
                            match read_message(&stream) {
                                Ok(Message::Handshake(peer_hs)) => {
                                    let our_stats = chain.stats();
                                    if peer_hs.network != network
                                        || peer_hs.genesis_hash != our_stats.genesis_hash
                                    {
                                        continue;
                                    }
                                    if banned.read().contains(&peer_hs.node_id) {
                                        continue;
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
                                    if send_message(&stream, &Message::HandshakeAck(ack)).is_err() {
                                        continue;
                                    }

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
                                        reputation: PeerReputation::default(),
                                    });

                                    // Store stream
                                    if let Ok(cloned) = stream.try_clone() {
                                        streams.write().insert(
                                            pid.clone(),
                                            Arc::new(RwLock::new(cloned)),
                                        );
                                    }

                                    if !known.read().iter().any(|k| k.node_id == pid) {
                                        known.write().push(PeerAddress {
                                            host: peer_addr.ip().to_string(),
                                            port: peer_hs.listen_port,
                                            node_id: pid.clone(),
                                            height: peer_hs.height,
                                        });
                                    }

                                    eprintln!("[P2P] Inbound peer {} connected from {}", pid, peer_addr);

                                    // Spawn message loop for this inbound peer
                                    let peers2 = Arc::clone(&peers);
                                    let streams2 = Arc::clone(&streams);
                                    let seen_txs2 = Arc::clone(&seen_txs);
                                    let seen_blocks2 = Arc::clone(&seen_blocks);
                                    let running2 = Arc::clone(&running);
                                    let known2 = Arc::clone(&known);
                                    let pid2 = pid.clone();
                                    let node_id2 = node_id.clone();
                                    let listen_port2 = listen_port;

                                    std::thread::Builder::new()
                                        .name(format!("bolh-peer-{}", &pid[..8.min(pid.len())]))
                                        .spawn(move || {
                                            handle_peer_messages(
                                                &stream, chain,
                                                &pid2, &node_id2, listen_port2,
                                                &peers2, &streams2,
                                                &seen_txs2, &seen_blocks2,
                                                &known2, &running2,
                                            );
                                            // Peer disconnected
                                            peers2.write().remove(&pid2);
                                            streams2.write().remove(&pid2);
                                            eprintln!("[P2P] Peer {} disconnected", pid2);
                                        })
                                        .ok();
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

        // 2. Connect to seed nodes
        let seeds = self.config.seed_nodes.clone();
        if !seeds.is_empty() {
            let peers2 = Arc::clone(&self.peers);
            let streams2 = Arc::clone(&self.streams);
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
                        let stream = match TcpStream::connect_timeout(
                            &socket_addr,
                            Duration::from_secs(timeout),
                        ) {
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
                                if peer_hs.network == network2
                                    && peer_hs.genesis_hash == our_stats.genesis_hash
                                {
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
                                        reputation: PeerReputation::default(),
                                    });

                                    // Store stream
                                    if let Ok(cloned) = stream.try_clone() {
                                        streams2.write().insert(
                                            pid.clone(),
                                            Arc::new(RwLock::new(cloned)),
                                        );
                                    }

                                    if !known2.read().iter().any(|k| k.node_id == pid) {
                                        known2.write().push(PeerAddress {
                                            host: socket_addr.ip().to_string(),
                                            port: peer_hs.listen_port,
                                            node_id: pid.clone(),
                                            height: peer_hs.height,
                                        });
                                    }
                                    eprintln!("[P2P] Connected to seed {}", seed);
                                }
                            }
                            _ => {}
                        }
                    }
                })
                .ok();
        }

        // 3. Background maintenance thread
        let running3 = Arc::clone(&self.running);
        let peers3 = Arc::clone(&self.peers);
        let streams3 = Arc::clone(&self.streams);
        let known3 = Arc::clone(&self.known_peers);
        let banned3 = Arc::clone(&self.banned_peers);
        let node_id3 = self.node_id.clone();
        let network3 = self.network.clone();
        let listen_port3 = self.listen_port;
        let ping_interval = Duration::from_secs(self.config.ping_interval_secs);
        let maintenance_interval = Duration::from_secs(self.config.maintenance_interval_secs);
        let connect_timeout = self.config.connect_timeout_secs;

        std::thread::Builder::new()
            .name("bolh-p2p-maintenance".into())
            .spawn(move || {
                let mut last_ping = Instant::now();

                while *running3.read() {
                    std::thread::sleep(maintenance_interval);
                    if !*running3.read() {
                        break;
                    }

                    // Ping all peers periodically
                    if last_ping.elapsed() >= ping_interval {
                        let peer_ids: Vec<String> = peers3.read().keys().cloned().collect();
                        for pid in &peer_ids {
                            let nonce = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_millis() as u64;
                            let msg = Message::Ping { nonce };

                            let sent_ok = {
                                let streams_r = streams3.read();
                                if let Some(stream_arc) = streams_r.get(pid) {
                                    let stream = stream_arc.read();
                                    send_message(&stream, &msg).is_ok()
                                } else {
                                    false
                                }
                            };

                            if sent_ok {
                                if let Some(peer) = peers3.write().get_mut(pid) {
                                    peer.last_ping = Instant::now();
                                }
                            } else {
                                // Peer unreachable, record timeout
                                let should_remove = {
                                    let mut peers_w = peers3.write();
                                    if let Some(peer) = peers_w.get_mut(pid) {
                                        peer.reputation.record_timeout();
                                        peer.reputation.should_ban()
                                    } else {
                                        false
                                    }
                                };
                                if should_remove {
                                    peers3.write().remove(pid);
                                    streams3.write().remove(pid);
                                    banned3.write().insert(pid.clone());
                                    eprintln!("[P2P] Peer {} removed (too many timeouts)", pid);
                                }
                            }
                        }
                        last_ping = Instant::now();
                    }

                    // Try connecting to known peers if below max
                    let current_count = peers3.read().len();
                    if current_count < 3 {
                        // Try to connect to some known peers
                        let known_addrs: Vec<PeerAddress> = known3.read().clone();
                        let connected_ids: HashSet<String> = peers3.read().keys().cloned().collect();

                        for kp in &known_addrs {
                            if connected_ids.contains(&kp.node_id) || kp.node_id == node_id3 {
                                continue;
                            }
                            if banned3.read().contains(&kp.node_id) {
                                continue;
                            }
                            let addr_str = format!("{}:{}", kp.host, kp.port);
                            let socket_addr: SocketAddr = match addr_str.parse() {
                                Ok(a) => a,
                                Err(_) => continue,
                            };

                            let stream = match TcpStream::connect_timeout(
                                &socket_addr,
                                Duration::from_secs(connect_timeout),
                            ) {
                                Ok(s) => s,
                                Err(_) => continue,
                            };
                            stream.set_nodelay(true).ok();
                            stream.set_read_timeout(Some(Duration::from_secs(30))).ok();

                            let our_stats = chain.stats();
                            let hs = HandshakeData {
                                version: PROTOCOL_VERSION,
                                node_id: node_id3.clone(),
                                network: network3.clone(),
                                height: our_stats.height,
                                genesis_hash: our_stats.genesis_hash.clone(),
                                listen_port: listen_port3,
                                user_agent: format!("BOLH-Core/{}", crate::VERSION),
                            };
                            if send_message(&stream, &Message::Handshake(hs)).is_err() {
                                continue;
                            }
                            match read_message(&stream) {
                                Ok(Message::HandshakeAck(peer_hs)) => {
                                    if peer_hs.network == network3
                                        && peer_hs.genesis_hash == our_stats.genesis_hash
                                    {
                                        let pid = peer_hs.node_id.clone();
                                        peers3.write().insert(pid.clone(), ConnectedPeer {
                                            info: PeerInfo {
                                                id: peer_hs.node_id.clone(),
                                                addr: addr_str.clone(),
                                                version: peer_hs.user_agent,
                                                best_height: peer_hs.height,
                                            },
                                            addr: socket_addr,
                                            connected_at: Instant::now(),
                                            last_ping: Instant::now(),
                                            last_pong: None,
                                            latency_ms: 0,
                                            inbound: false,
                                            reputation: PeerReputation::default(),
                                        });
                                        if let Ok(cloned) = stream.try_clone() {
                                            streams3.write().insert(
                                                pid.clone(),
                                                Arc::new(RwLock::new(cloned)),
                                            );
                                        }
                                        eprintln!("[P2P] Reconnected to peer {}", pid);
                                    }
                                }
                                _ => {}
                            }

                            // Don't try too many at once
                            if peers3.read().len() >= 3 {
                                break;
                            }
                        }
                    }
                }
                eprintln!("[P2P] Maintenance thread stopped");
            })
            .ok();

        Ok(())
    }

    /// Stop the P2P node
    pub fn stop(&self) {
        *self.running.write() = false;
        // Disconnect all peers gracefully
        self.peers.write().clear();
        self.streams.write().clear();
        eprintln!("[P2P] Node stopped");
    }
}

// ─── Message Handling Loop ────────────────────────────────────────

/// Handle messages from a connected peer in a loop
/// This runs in its own thread per inbound peer
fn handle_peer_messages(
    stream: &TcpStream,
    chain: &BolhChain,
    peer_id: &str,
    our_node_id: &str,
    _our_listen_port: u16,
    peers: &Arc<RwLock<HashMap<String, ConnectedPeer>>>,
    _streams: &Arc<RwLock<HashMap<String, Arc<RwLock<TcpStream>>>>>,
    seen_txs: &Arc<RwLock<HashSet<String>>>,
    seen_blocks: &Arc<RwLock<HashSet<String>>>,
    known: &Arc<RwLock<Vec<PeerAddress>>>,
    running: &Arc<RwLock<bool>>,
) {
    loop {
        if !*running.read() {
            break;
        }

        match read_message(stream) {
            Ok(msg) => {
                match msg {
                    // ── Ping / Pong ──
                    Message::Ping { nonce } => {
                        let _ = send_message(stream, &Message::Pong { nonce });
                    }
                    Message::Pong { nonce: _ } => {
                        if let Some(peer) = peers.write().get_mut(peer_id) {
                            let now = Instant::now();
                            peer.latency_ms = now.duration_since(peer.last_ping).as_millis() as u64;
                            peer.last_pong = Some(now);
                            peer.reputation.record_good();
                        }
                    }

                    // ── New Block from peer ──
                    Message::NewBlock(block) => {
                        let block_hash = hex::encode(&block.hash);
                        let is_new = {
                            let mut seen = seen_blocks.write();
                            if seen.contains(&block_hash) {
                                false
                            } else {
                                seen.insert(block_hash.clone());
                                true
                            }
                        };

                        if is_new && block.is_valid_structure() {
                            match chain.apply_synced_block(block) {
                                Ok(()) => {
                                    if let Some(peer) = peers.write().get_mut(peer_id) {
                                        peer.reputation.record_good();
                                        peer.info.best_height = chain.height();
                                    }
                                    let _ = crate::chain::save_global_chain();
                                    eprintln!("[P2P] Applied new block {} from {}", &block_hash[..8], peer_id);
                                }
                                Err(e) => {
                                    eprintln!("[P2P] Block {} from {} invalid: {}", &block_hash[..8], peer_id, e);
                                    if let Some(peer) = peers.write().get_mut(peer_id) {
                                        peer.reputation.record_bad();
                                    }
                                }
                            }
                        }
                    }

                    // ── New Transaction from peer ──
                    Message::NewTransaction(tx) => {
                        let tx_hash = hex::encode(&tx.hash);
                        let is_new = {
                            let mut seen = seen_txs.write();
                            if seen.contains(&tx_hash) {
                                false
                            } else {
                                seen.insert(tx_hash);
                                true
                            }
                        };

                        if is_new {
                            let result = chain.submit_transaction(tx);
                            if result.success {
                                if let Some(peer) = peers.write().get_mut(peer_id) {
                                    peer.reputation.record_good();
                                }
                            }
                        }
                    }

                    // ── Block Request (peer wants blocks from us) ──
                    Message::RequestBlocks(req) => {
                        let blocks = chain.get_blocks_range(req.from_height, req.to_height);
                        let resp = Message::ResponseBlocks(BlockResponse { blocks });
                        let _ = send_message(stream, &resp);
                    }

                    // ── Peer Discovery Request ──
                    Message::RequestPeers => {
                        let peer_list: Vec<PeerAddress> = known.read().clone();
                        let _ = send_message(stream, &Message::ResponsePeers(PeerList {
                            peers: peer_list,
                        }));
                    }

                    // ── Peer Discovery Response ──
                    Message::ResponsePeers(list) => {
                        let mut known_w = known.write();
                        for p in &list.peers {
                            if p.node_id != our_node_id
                                && !known_w.iter().any(|k| k.node_id == p.node_id)
                            {
                                known_w.push(p.clone());
                            }
                        }
                    }

                    // Ignore handshake messages in the loop
                    Message::Handshake(_) | Message::HandshakeAck(_) => {}

                    // Ignore block responses in the loop (handled by request_blocks)
                    Message::ResponseBlocks(_) => {}
                }
            }
            Err(e) => {
                // Connection closed or error
                if *running.read() {
                    eprintln!("[P2P] Peer {} message error: {}", peer_id, e);
                }
                break;
            }
        }
    }
}

// ─── Network Stats ────────────────────────────────────────────────

/// Network statistics (extended)
#[derive(Debug, Clone, serde::Serialize)]
pub struct NetworkStats {
    pub total_peers: usize,
    pub inbound_peers: usize,
    pub outbound_peers: usize,
    pub known_peers: usize,
    pub banned_peers: usize,
    pub seen_txs: usize,
    pub seen_blocks: usize,
    pub avg_peer_reputation: u32,
    pub is_running: bool,
    pub listen_addr: String,
    pub node_id: String,
}

// ─── Wire Format Helpers ──────────────────────────────────────────

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
