//! User service

use sqlx::PgPool;
use guardio_core::{auth::UserRole, CryptoService};

pub struct UserService {
    pool: PgPool,
}

impl UserService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_user(
        &self,
        phone: &str,
        password: &str,
        name: &str,
        role: UserRole,
    ) -> Result<User, UserServiceError> {
        let password_hash = CryptoService::hash_password(password)
            .map_err(|_| UserServiceError::HashingFailed)?;

        let user = sqlx::query_as!(
            User,
            r#"
            INSERT INTO users (phone, password_hash, name, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, phone, name, role as "role: _", rating, verified_level, created_at
            "#,
            phone,
            password_hash,
            name,
            role.to_string(),
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| UserServiceError::DatabaseError(e.to_string()))?;

        Ok(user)
    }

    pub async fn find_by_phone(&self, phone: &str) -> Result<Option<User>, UserServiceError> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, phone, name, role as "role: _", rating, verified_level, created_at
            FROM users
            WHERE phone = $1
            "#,
            phone,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| UserServiceError::DatabaseError(e.to_string()))?;

        Ok(user)
    }

    pub async fn find_by_id(&self, id: i64) -> Result<Option<User>, UserServiceError> {
        let user = sqlx::query_as!(
            User,
            r#"
            SELECT id, phone, name, role as "role: _", rating, verified_level, created_at
            FROM users
            WHERE id = $1
            "#,
            id,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| UserServiceError::DatabaseError(e.to_string()))?;

        Ok(user)
    }

    pub async fn verify_password(&self, phone: &str, password: &str) -> Result<bool, UserServiceError> {
        let result = sqlx::query!(
            "SELECT password_hash FROM users WHERE phone = $1",
            phone,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| UserServiceError::DatabaseError(e.to_string()))?;

        match result {
            Some(row) => Ok(CryptoService::verify_password(password, &row.password_hash)),
            None => Ok(false),
        }
    }

    pub async fn update_location(
        &self,
        user_id: i64,
        latitude: f64,
        longitude: f64,
    ) -> Result<(), UserServiceError> {
        sqlx::query!(
            r#"
            UPDATE users
            SET latitude = $1, longitude = $2, last_active = NOW()
            WHERE id = $3
            "#,
            latitude,
            longitude,
            user_id,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| UserServiceError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: i64,
    pub phone: String,
    pub name: String,
    pub role: String,
    pub rating: Option<f64>,
    pub verified_level: Option<i32>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum UserServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Password hashing failed")]
    HashingFailed,
    #[error("User not found")]
    NotFound,
}
