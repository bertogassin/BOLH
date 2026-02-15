//! Peer management with reputation scoring

/// Peer information
#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub addr: String,
    pub version: String,
    pub best_height: u64,
}

/// Peer reputation score
#[derive(Debug, Clone)]
pub struct PeerReputation {
    /// Current score (0-100, starts at 50)
    pub score: u32,
    /// Number of successful messages
    pub good_messages: u64,
    /// Number of failed/invalid messages
    pub bad_messages: u64,
    /// Number of blocks provided via sync
    pub blocks_provided: u64,
    /// Number of timeouts
    pub timeouts: u64,
}

impl Default for PeerReputation {
    fn default() -> Self {
        PeerReputation {
            score: 50,
            good_messages: 0,
            bad_messages: 0,
            blocks_provided: 0,
            timeouts: 0,
        }
    }
}

impl PeerReputation {
    /// Record a good event (received valid block/tx, responded to request)
    pub fn record_good(&mut self) {
        self.good_messages += 1;
        self.score = (self.score + 1).min(100);
    }

    /// Record a bad event (invalid block, timeout, protocol error)
    pub fn record_bad(&mut self) {
        self.bad_messages += 1;
        self.score = self.score.saturating_sub(5);
    }

    /// Record a timeout
    pub fn record_timeout(&mut self) {
        self.timeouts += 1;
        self.score = self.score.saturating_sub(2);
    }

    /// Should we ban this peer?
    pub fn should_ban(&self) -> bool {
        self.score < 10
    }

    /// Is this peer trustworthy?
    pub fn is_trusted(&self) -> bool {
        self.score >= 40
    }
}
