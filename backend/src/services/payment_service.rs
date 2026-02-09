//! Payment service

use sqlx::postgres::PgPool;
use uuid::Uuid;
use rust_decimal::Decimal;

pub struct PaymentService {
    pool: PgPool,
}

impl PaymentService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_payment(
        &self,
        user_id: i64,
        order_id: Option<Uuid>,
        amount: i64,
        method: &str,
    ) -> Result<Payment, PaymentServiceError> {
        let id = Uuid::new_v4();

        let payment = sqlx::query_as::<_, Payment>(
            r#"
            INSERT INTO payments (id, user_id, order_id, amount, method, status)
            VALUES ($1, $2, $3, $4, $5, 'pending')
            RETURNING id, user_id, order_id, amount, currency, method, status, 
                      transaction_id, card_last_four, error_message, created_at
            "#,
        )
        .bind(id)
        .bind(user_id)
        .bind(order_id)
        .bind(amount)
        .bind(method)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        Ok(payment)
    }

    pub async fn process_payment(&self, payment_id: Uuid) -> Result<Payment, PaymentServiceError> {
        // TODO: Integrate with payment provider (Stripe, CloudPayments, etc.)
        
        // Mark as processing
        let payment = sqlx::query_as::<_, Payment>(
            r#"
            UPDATE payments
            SET status = 'processing', transaction_id = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id, user_id, order_id, amount, currency, method, status,
                      transaction_id, card_last_four, error_message, created_at
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(payment_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        Ok(payment)
    }

    pub async fn complete_payment(&self, payment_id: Uuid) -> Result<Payment, PaymentServiceError> {
        let payment = sqlx::query_as::<_, Payment>(
            r#"
            UPDATE payments
            SET status = 'completed', updated_at = NOW()
            WHERE id = $1
            RETURNING id, user_id, order_id, amount, currency, method, status,
                      transaction_id, card_last_four, error_message, created_at
            "#,
        )
        .bind(payment_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        let percent: Option<(Option<i32>,)> = sqlx::query_as(
            "SELECT revenue_percent FROM loyalty_economy WHERE id = 1"
        )
        .fetch_one(&self.pool)
        .await
        .ok();
        let percent_val = percent.and_then(|p| p.0).unwrap_or(10);
        let inject = (payment.amount as i128) * (percent_val as i128) / 100;
        let dec = Decimal::from_i128_with_scale(inject, 2);
        let loyalty = crate::services::LoyaltyService::new(self.pool.clone());
        let _ = loyalty.inject_revenue(dec).await;

        Ok(payment)
    }

    pub async fn fail_payment(&self, payment_id: Uuid, error: &str) -> Result<Payment, PaymentServiceError> {
        let payment = sqlx::query_as::<_, Payment>(
            r#"
            UPDATE payments
            SET status = 'failed', error_message = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id, user_id, order_id, amount, currency, method, status,
                      transaction_id, card_last_four, error_message, created_at
            "#,
        )
        .bind(error)
        .bind(payment_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        Ok(payment)
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Payment>, PaymentServiceError> {
        let payment = sqlx::query_as::<_, Payment>(
            r#"
            SELECT id, user_id, order_id, amount, currency, method, status,
                   transaction_id, card_last_four, error_message, created_at
            FROM payments
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        Ok(payment)
    }

    pub async fn list_by_user(&self, user_id: i64, limit: i32) -> Result<Vec<Payment>, PaymentServiceError> {
        let payments = sqlx::query_as::<_, Payment>(
            r#"
            SELECT id, user_id, order_id, amount, currency, method, status,
                   transaction_id, card_last_four, error_message, created_at
            FROM payments
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| PaymentServiceError::DatabaseError(e.to_string()))?;

        Ok(payments)
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct Payment {
    pub id: Uuid,
    pub user_id: i64,
    pub order_id: Option<Uuid>,
    pub amount: i64,
    pub currency: String,
    pub method: String,
    pub status: String,
    pub transaction_id: Option<String>,
    pub card_last_four: Option<String>,
    pub error_message: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum PaymentServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Payment not found")]
    NotFound,
    #[error("Processing failed: {0}")]
    ProcessingFailed(String),
}
