//! Gossip protocol for block and transaction propagation
//! Uses libp2p gossipsub

/// Gossip topics
pub const BLOCK_TOPIC: &str = "bolh/blocks/1";
pub const TX_TOPIC: &str = "bolh/txs/1";
pub const CONSENSUS_TOPIC: &str = "bolh/consensus/1";
