//! Performance metrics and monitoring
//! Tracks TPS, block production, validator performance

use std::collections::VecDeque;
use std::time::{Duration, Instant};
use crate::types::{Address, BlockHeight};

/// Performance metrics tracker
pub struct Metrics {
    /// Transaction throughput samples (timestamp, tx_count)
    tps_samples: VecDeque<(Instant, usize)>,
    /// Sample window duration
    sample_window: Duration,
    /// Total transactions processed
    total_txs: u64,
    /// Total blocks produced
    total_blocks: u64,
    /// Block production times (height, duration)
    block_times: VecDeque<(BlockHeight, Duration)>,
    /// Validator performance (address, blocks_produced, avg_time)
    validator_stats: std::collections::HashMap<Address, ValidatorStats>,
    /// Start time
    start_time: Instant,
}

/// Validator performance statistics
#[derive(Debug, Clone)]
pub struct ValidatorStats {
    pub blocks_produced: u64,
    pub total_block_time_ms: u64,
    pub avg_block_time_ms: u64,
    pub last_block_height: BlockHeight,
}

impl Metrics {
    /// Create new metrics tracker
    pub fn new() -> Self {
        Metrics {
            tps_samples: VecDeque::with_capacity(1000),
            sample_window: Duration::from_secs(60), // 1 minute window
            total_txs: 0,
            total_blocks: 0,
            block_times: VecDeque::with_capacity(1000),
            validator_stats: std::collections::HashMap::new(),
            start_time: Instant::now(),
        }
    }

    /// Record transactions processed
    pub fn record_txs(&mut self, count: usize) {
        let now = Instant::now();
        self.total_txs += count as u64;
        self.tps_samples.push_back((now, count));

        // Clean old samples
        let cutoff = now - self.sample_window;
        while let Some((timestamp, _)) = self.tps_samples.front() {
            if *timestamp < cutoff {
                self.tps_samples.pop_front();
            } else {
                break;
            }
        }
    }

    /// Record block production
    pub fn record_block(
        &mut self,
        height: BlockHeight,
        validator: &Address,
        production_time: Duration,
        tx_count: usize,
    ) {
        self.total_blocks += 1;
        self.block_times.push_back((height, production_time));

        // Keep last 1000 blocks
        if self.block_times.len() > 1000 {
            self.block_times.pop_front();
        }

        // Update validator stats
        let stats = self.validator_stats
            .entry(validator.clone())
            .or_insert(ValidatorStats {
                blocks_produced: 0,
                total_block_time_ms: 0,
                avg_block_time_ms: 0,
                last_block_height: height,
            });

        stats.blocks_produced += 1;
        stats.total_block_time_ms += production_time.as_millis() as u64;
        stats.avg_block_time_ms = stats.total_block_time_ms / stats.blocks_produced;
        stats.last_block_height = height;

        // Record transactions in this block
        self.record_txs(tx_count);
    }

    /// Get current TPS (transactions per second)
    pub fn current_tps(&self) -> f64 {
        if self.tps_samples.is_empty() {
            return 0.0;
        }

        let total_txs: usize = self.tps_samples.iter().map(|(_, count)| count).sum();
        let window_secs = self.sample_window.as_secs_f64();
        
        total_txs as f64 / window_secs
    }

    /// Get average block time in milliseconds
    pub fn avg_block_time_ms(&self) -> u64 {
        if self.block_times.is_empty() {
            return 0;
        }

        let total: u128 = self.block_times
            .iter()
            .map(|(_, duration)| duration.as_millis())
            .sum();
        
        (total / self.block_times.len() as u128) as u64
    }

    /// Get total runtime in seconds
    pub fn runtime_secs(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }

    /// Get overall TPS since start
    pub fn overall_tps(&self) -> f64 {
        let runtime = self.runtime_secs();
        if runtime == 0 {
            return 0.0;
        }
        self.total_txs as f64 / runtime as f64
    }

    /// Get validator statistics
    pub fn validator_stats(&self, addr: &Address) -> Option<&ValidatorStats> {
        self.validator_stats.get(addr)
    }

    /// Get top validators by block count
    pub fn top_validators(&self, n: usize) -> Vec<(&Address, &ValidatorStats)> {
        let mut validators: Vec<_> = self.validator_stats.iter().collect();
        validators.sort_by(|a, b| b.1.blocks_produced.cmp(&a.1.blocks_produced));
        validators.into_iter().take(n).collect()
    }

    /// Get performance summary
    pub fn summary(&self) -> MetricsSummary {
        MetricsSummary {
            total_txs: self.total_txs,
            total_blocks: self.total_blocks,
            current_tps: self.current_tps(),
            overall_tps: self.overall_tps(),
            avg_block_time_ms: self.avg_block_time_ms(),
            runtime_secs: self.runtime_secs(),
            validator_count: self.validator_stats.len(),
        }
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Metrics summary snapshot
#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub total_txs: u64,
    pub total_blocks: u64,
    pub current_tps: f64,
    pub overall_tps: f64,
    pub avg_block_time_ms: u64,
    pub runtime_secs: u64,
    pub validator_count: usize,
}

impl MetricsSummary {
    /// Format as human-readable string
    pub fn format(&self) -> String {
        format!(
            "Metrics Summary:\n\
             - Total Transactions: {}\n\
             - Total Blocks: {}\n\
             - Current TPS: {:.2}\n\
             - Overall TPS: {:.2}\n\
             - Avg Block Time: {}ms\n\
             - Runtime: {}s\n\
             - Active Validators: {}",
            self.total_txs,
            self.total_blocks,
            self.current_tps,
            self.overall_tps,
            self.avg_block_time_ms,
            self.runtime_secs,
            self.validator_count
        )
    }
}
