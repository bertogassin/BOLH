//! Database module

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub struct Database {
    pub pool: PgPool,
}

impl Database {
    pub async fn connect(database_url: &str) -> Result<Self, DatabaseError> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .acquire_timeout(Duration::from_secs(5))
            .connect(database_url)
            .await
            .map_err(|e| DatabaseError::ConnectionFailed(e.to_string()))?;

        Ok(Self { pool })
    }

    pub async fn from_env() -> Result<Self, DatabaseError> {
        let url = std::env::var("DATABASE_URL")
            .map_err(|_| DatabaseError::MissingConfig("DATABASE_URL not set".into()))?;
        
        Self::connect(&url).await
    }

    /// Run migrations
    pub async fn migrate(&self) -> Result<(), DatabaseError> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .map_err(|e| DatabaseError::MigrationFailed(e.to_string()))
    }

    /// Health check
    pub async fn ping(&self) -> Result<(), DatabaseError> {
        sqlx::query("SELECT 1")
            .execute(&self.pool)
            .await
            .map_err(|e| DatabaseError::QueryFailed(e.to_string()))?;
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Missing config: {0}")]
    MissingConfig(String),
    #[error("Migration failed: {0}")]
    MigrationFailed(String),
    #[error("Query failed: {0}")]
    QueryFailed(String),
}

/// Redis connection for caching
pub struct RedisCache {
    client: redis::Client,
}

impl RedisCache {
    pub fn new(redis_url: &str) -> Result<Self, CacheError> {
        let client = redis::Client::open(redis_url)
            .map_err(|e| CacheError::ConnectionFailed(e.to_string()))?;
        Ok(Self { client })
    }

    pub fn from_env() -> Result<Self, CacheError> {
        let url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".into());
        Self::new(&url)
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>, CacheError> {
        let mut conn = self.client.get_multiplexed_async_connection().await
            .map_err(|e| CacheError::ConnectionFailed(e.to_string()))?;
        
        redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| CacheError::QueryFailed(e.to_string()))
    }

    pub async fn set(&self, key: &str, value: &str, ttl_seconds: u64) -> Result<(), CacheError> {
        let mut conn = self.client.get_multiplexed_async_connection().await
            .map_err(|e| CacheError::ConnectionFailed(e.to_string()))?;
        
        redis::cmd("SETEX")
            .arg(key)
            .arg(ttl_seconds)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| CacheError::QueryFailed(e.to_string()))
    }

    pub async fn delete(&self, key: &str) -> Result<(), CacheError> {
        let mut conn = self.client.get_multiplexed_async_connection().await
            .map_err(|e| CacheError::ConnectionFailed(e.to_string()))?;
        
        redis::cmd("DEL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| CacheError::QueryFailed(e.to_string()))
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Query failed: {0}")]
    QueryFailed(String),
}
