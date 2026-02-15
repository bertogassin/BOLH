//! In-memory block store
//! Will be replaced with RocksDB in production (v0.2)

use std::collections::HashMap;
use std::sync::RwLock;
use crate::types::Block;
use super::StorageError;

pub struct BlockStore {
    blocks: RwLock<HashMap<u64, Vec<u8>>>,
    height: RwLock<u64>,
}

impl BlockStore {
    pub fn new(_path: &str) -> Result<Self, StorageError> {
        Ok(BlockStore {
            blocks: RwLock::new(HashMap::new()),
            height: RwLock::new(0),
        })
    }

    pub fn put_block(&self, block: &Block) -> Result<(), StorageError> {
        let mut db = self.blocks.write().unwrap();
        let value = bincode::serialize(block)
            .map_err(|e| StorageError::Serialize(e.to_string()))?;
        let height = block.header.height;
        db.insert(height, value);
        *self.height.write().unwrap() = height;
        Ok(())
    }

    pub fn get_block(&self, height: u64) -> Result<Block, StorageError> {
        let db = self.blocks.read().unwrap();
        match db.get(&height) {
            Some(bytes) => {
                bincode::deserialize(bytes)
                    .map_err(|e| StorageError::Serialize(e.to_string()))
            }
            None => Err(StorageError::BlockNotFound(height)),
        }
    }

    pub fn get_height(&self) -> u64 {
        *self.height.read().unwrap()
    }
}
