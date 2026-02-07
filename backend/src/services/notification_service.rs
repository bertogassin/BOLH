//! Notification service

use sqlx::PgPool;
use uuid::Uuid;

pub struct NotificationService {
    pool: PgPool,
}

impl NotificationService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        user_id: i64,
        notification_type: &str,
        title: &str,
        body: &str,
        data: Option<serde_json::Value>,
    ) -> Result<Notification, NotificationServiceError> {
        let id = Uuid::new_v4();

        let notification = sqlx::query_as!(
            Notification,
            r#"
            INSERT INTO notifications (id, user_id, type, title, body, data)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, user_id, type as notification_type, title, body, data, is_read, created_at
            "#,
            id,
            user_id,
            notification_type,
            title,
            body,
            data,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| NotificationServiceError::DatabaseError(e.to_string()))?;

        // TODO: Send push notification via FCM/APNs

        Ok(notification)
    }

    pub async fn list_by_user(
        &self,
        user_id: i64,
        limit: i32,
        unread_only: bool,
    ) -> Result<Vec<Notification>, NotificationServiceError> {
        let notifications = if unread_only {
            sqlx::query_as!(
                Notification,
                r#"
                SELECT id, user_id, type as notification_type, title, body, data, is_read, created_at
                FROM notifications
                WHERE user_id = $1 AND is_read = false
                ORDER BY created_at DESC
                LIMIT $2
                "#,
                user_id,
                limit as i64,
            )
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query_as!(
                Notification,
                r#"
                SELECT id, user_id, type as notification_type, title, body, data, is_read, created_at
                FROM notifications
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
                "#,
                user_id,
                limit as i64,
            )
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|e| NotificationServiceError::DatabaseError(e.to_string()))?;

        Ok(notifications)
    }

    pub async fn mark_read(&self, notification_ids: &[Uuid]) -> Result<i64, NotificationServiceError> {
        let result = sqlx::query!(
            r#"
            UPDATE notifications
            SET is_read = true
            WHERE id = ANY($1)
            "#,
            notification_ids,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| NotificationServiceError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() as i64)
    }

    pub async fn mark_all_read(&self, user_id: i64) -> Result<i64, NotificationServiceError> {
        let result = sqlx::query!(
            r#"
            UPDATE notifications
            SET is_read = true
            WHERE user_id = $1 AND is_read = false
            "#,
            user_id,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| NotificationServiceError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() as i64)
    }

    pub async fn get_unread_count(&self, user_id: i64) -> Result<i64, NotificationServiceError> {
        let result = sqlx::query!(
            r#"
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1 AND is_read = false
            "#,
            user_id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e: sqlx::Error| NotificationServiceError::DatabaseError(e.to_string()))?;

        let count: i64 = result.count.unwrap_or(0);

        Ok(count)
    }
}

#[derive(Debug, Clone)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: i64,
    pub notification_type: String,
    pub title: String,
    pub body: String,
    pub data: Option<serde_json::Value>,
    pub is_read: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum NotificationServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
}
