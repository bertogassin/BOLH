use rocksdb::{DB, Options};
use std::path::Path;
use crate::types::{Block, BlockHeight, Hash};
use super::StorageError;

/// Persistent block storage using RocksDB
pub struct BlockStore {
    db: DB,
}

impl BlockStore {
    /// Open or create block store at path
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, StorageError> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.set_compression_type(rocksdb::DBCompressionType::Lz4);
        let db = DB::open(&opts, path)?;
        Ok(BlockStore { db })
    }

    /// Store a block (keyed by height)
    pub fn put_block(&self, block: &Block) -> Result<(), StorageError> {
        let key = block.header.height.to_be_bytes();
        let value = bincode::serialize(block).map_err(|e| StorageError::Serialize(e.to_string()))?;
        self.db.put(key, value)?;

        // Also index by hash
        let hash_key = [b"hash:".as_slice(), &block.hash].concat();
        self.db.put(hash_key, block.header.height.to_be_bytes())?;

        // Update latest height
        self.db.put(b"latest_height", block.header.height.to_be_bytes())?;

        Ok(())
    }

    /// Get block by height
    pub fn get_block(&self, height: BlockHeight) -> Result<Block, StorageError> {
        let key = height.to_be_bytes();
        match self.db.get(key)? {
            Some(value) => {
                bincode::deserialize(&value).map_err(|e| StorageError::Serialize(e.to_string()))
            }
            None => Err(StorageError::BlockNotFound(height)),
        }
    }

    /// Get block by hash
    pub fn get_block_by_hash(&self, hash: &Hash) -> Result<Block, StorageError> {
        let hash_key = [b"hash:".as_slice(), hash.as_slice()].concat();
        match self.db.get(hash_key)? {
            Some(height_bytes) => {
                let height = u64::from_be_bytes(height_bytes.try_into().unwrap_or([0u8; 8]));
                self.get_block(height)
            }
            None => Err(StorageError::BlockNotFound(0)),
        }
    }

    /// Get the latest block height
    pub fn latest_height(&self) -> Result<BlockHeight, StorageError> {
        match self.db.get(b"latest_height")? {
            Some(bytes) => Ok(u64::from_be_bytes(bytes.try_into().unwrap_or([0u8; 8]))),
            None => Ok(0),
        }
    }

    /// Get the latest block
    pub fn latest_block(&self) -> Result<Block, StorageError> {
        let height = self.latest_height()?;
        self.get_block(height)
    }
}
