//! Order service

use sqlx::PgPool;
use uuid::Uuid;
use guardio_core::orders::{OrderStatus, ServiceType, PricingConfig};

pub struct OrderService {
    pool: PgPool,
}

impl OrderService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        client_id: i64,
        service_type: ServiceType,
        address: &str,
        latitude: f64,
        longitude: f64,
        duration_hours: f64,
        description: Option<&str>,
    ) -> Result<Order, OrderServiceError> {
        let id = Uuid::new_v4();
        let pricing = PricingConfig::default();
        
        // Calculate price
        let base_rate = service_type.base_rate();
        let price = (base_rate as f64 * duration_hours.max(1.0)) as i64;

        let order = sqlx::query_as!(
            Order,
            r#"
            INSERT INTO orders (id, client_id, service_type, status, address, latitude, longitude, duration_hours, price, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, client_id, guard_id, service_type, status, address, latitude, longitude, 
                      duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            "#,
            id,
            client_id,
            service_type_to_string(service_type),
            "new",
            address,
            latitude,
            longitude,
            duration_hours,
            price,
            description,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }

    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Order>, OrderServiceError> {
        let order = sqlx::query_as!(
            Order,
            r#"
            SELECT id, client_id, guard_id, service_type, status, address, latitude, longitude,
                   duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            FROM orders
            WHERE id = $1
            "#,
            id,
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }

    pub async fn list_by_client(&self, client_id: i64, limit: i32, offset: i32) -> Result<Vec<Order>, OrderServiceError> {
        let orders = sqlx::query_as!(
            Order,
            r#"
            SELECT id, client_id, guard_id, service_type, status, address, latitude, longitude,
                   duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            FROM orders
            WHERE client_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            client_id,
            limit as i64,
            offset as i64,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(orders)
    }

    pub async fn list_by_guard(&self, guard_id: i64, limit: i32, offset: i32) -> Result<Vec<Order>, OrderServiceError> {
        let orders = sqlx::query_as!(
            Order,
            r#"
            SELECT id, client_id, guard_id, service_type, status, address, latitude, longitude,
                   duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            FROM orders
            WHERE guard_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            guard_id,
            limit as i64,
            offset as i64,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(orders)
    }

    pub async fn accept(&self, order_id: Uuid, guard_id: i64) -> Result<Order, OrderServiceError> {
        let order = sqlx::query_as!(
            Order,
            r#"
            UPDATE orders
            SET guard_id = $1, status = 'accepted', updated_at = NOW()
            WHERE id = $2 AND status = 'new'
            RETURNING id, client_id, guard_id, service_type, status, address, latitude, longitude,
                      duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            "#,
            guard_id,
            order_id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }

    pub async fn start(&self, order_id: Uuid) -> Result<Order, OrderServiceError> {
        let order = sqlx::query_as!(
            Order,
            r#"
            UPDATE orders
            SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND status = 'accepted'
            RETURNING id, client_id, guard_id, service_type, status, address, latitude, longitude,
                      duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            "#,
            order_id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }

    pub async fn complete(&self, order_id: Uuid) -> Result<Order, OrderServiceError> {
        let order = sqlx::query_as!(
            Order,
            r#"
            UPDATE orders
            SET status = 'completed', completed_at = NOW(), updated_at = NOW()
            WHERE id = $1 AND status = 'in_progress'
            RETURNING id, client_id, guard_id, service_type, status, address, latitude, longitude,
                      duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            "#,
            order_id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }

    pub async fn cancel(&self, order_id: Uuid) -> Result<Order, OrderServiceError> {
        let order = sqlx::query_as!(
            Order,
            r#"
            UPDATE orders
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = $1 AND status IN ('new', 'accepted')
            RETURNING id, client_id, guard_id, service_type, status, address, latitude, longitude,
                      duration_hours, price, currency, description, scheduled_at, started_at, completed_at, created_at
            "#,
            order_id,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| OrderServiceError::DatabaseError(e.to_string()))?;

        Ok(order)
    }
}

fn service_type_to_string(st: ServiceType) -> String {
    match st {
        ServiceType::Bodyguard => "bodyguard".into(),
        ServiceType::PropertyPatrol => "property_patrol".into(),
        ServiceType::EventSecurity => "event_security".into(),
        ServiceType::VehicleEscort => "vehicle_escort".into(),
        ServiceType::PersonalProtection => "personal_protection".into(),
        ServiceType::CctvMonitoring => "cctv_monitoring".into(),
        ServiceType::AlarmResponse => "alarm_response".into(),
        ServiceType::Custom => "custom".into(),
    }
}

#[derive(Debug, Clone)]
pub struct Order {
    pub id: Uuid,
    pub client_id: i64,
    pub guard_id: Option<i64>,
    pub service_type: String,
    pub status: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub duration_hours: f64,
    pub price: i64,
    pub currency: String,
    pub description: Option<String>,
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, thiserror::Error)]
pub enum OrderServiceError {
    #[error("Database error: {0}")]
    DatabaseError(String),
    #[error("Order not found")]
    NotFound,
    #[error("Invalid transition")]
    InvalidTransition,
}
