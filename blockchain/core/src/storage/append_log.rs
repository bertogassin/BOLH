//! Append-only block storage (V1)
//!
//! Writes each block as a single JSON line to `blocks.log`.
//! This is intended as an audit trail and crash-recovery primitive.

use std::fs::OpenOptions;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::io::{self, Write};
use std::path::Path;
use std::path::PathBuf;

use crate::types::Block;

pub fn blocks_log_path(data_dir: &Path) -> PathBuf {
    data_dir.join("blocks.log")
}

pub fn append_block(data_dir: &Path, block: &Block) -> io::Result<()> {
    std::fs::create_dir_all(data_dir)?;
    let path = blocks_log_path(data_dir);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;

    let json = serde_json::to_string(block)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;

    file.write_all(json.as_bytes())?;
    file.write_all(b"\n")?;
    file.flush()?;
    file.sync_all()?;
    Ok(())
}

/// Replay an append-only `blocks.log` file into a list of blocks.
///
/// Each line is expected to be a JSON-serialized `Block`.
/// Note: `Block.hash` is `#[serde(skip)]` and may be zero on deserialize; callers
/// should recompute hashes before validation/apply.
pub fn replay_block_log(path: &Path) -> Result<Vec<Block>, String> {
    if !path.exists() {
        return Ok(vec![]);
    }

    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    // Read all lines first so we can tolerate a partially written trailing line (crash).
    let mut lines: Vec<String> = Vec::new();
    for line in reader.lines() {
        let line = line.map_err(|e| e.to_string())?;
        if !line.trim().is_empty() {
            lines.push(line);
        }
    }

    let mut blocks = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        match serde_json::from_str::<Block>(line) {
            Ok(mut block) => {
                // Recompute skipped hashes.
                block.hash = block.header.compute_hash();
                for tx in &mut block.transactions {
                    tx.hash = tx.compute_hash();
                }
                blocks.push(block);
            }
            Err(e) => {
                // If the LAST line is corrupted, ignore it (common with partial write).
                if idx == lines.len() - 1 {
                    break;
                }
                return Err(e.to_string());
            }
        }
    }

    // Ensure deterministic ordering even if file got weird (should already be append-ordered).
    blocks.sort_by_key(|b| b.header.height);

    // Detect log forks / corruption: heights must be contiguous and prev_hash must chain.
    if blocks.len() >= 2 {
        for i in 1..blocks.len() {
            let prev = &blocks[i - 1];
            let curr = &blocks[i];

            if curr.header.height != prev.header.height + 1 {
                return Err("Log height gap detected".into());
            }
            if curr.header.prev_hash != prev.hash {
                return Err("Log fork detected".into());
            }
        }
    }
    Ok(blocks)
}

