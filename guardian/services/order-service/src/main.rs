// Order Service: HTTP API. With DATABASE_URL uses PostgreSQL (gateway_orders); otherwise in-memory.
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrderRow {
    id: Uuid,
    client_id: Uuid,
    title: String,
    description: String,
    required_licenses: Vec<String>,
    guard_count: i32,
    budget_min: f64,
    budget_max: f64,
    latitude: f64,
    longitude: f64,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateOrderRequest {
    client_id: Uuid,
    title: String,
    description: Option<String>,
    required_licenses: Option<Vec<String>>,
    guard_count: Option<i32>,
    budget_min: f64,
    budget_max: f64,
    latitude: f64,
    longitude: f64,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
}

#[derive(Clone)]
enum AppState {
    Memory(Arc<RwLock<HashMap<Uuid, OrderRow>>>),
    Pool(sqlx::PgPool),
}

async fn create_order(
    State(state): State<AppState>,
    Json(req): Json<CreateOrderRequest>,
) -> impl IntoResponse {
    if req.end_time <= req.start_time {
        return (
            StatusCode::BAD_REQUEST,
            "end time must be after start time".to_string(),
        )
            .into_response();
    }
    if req.budget_min < 0.0 {
        return (
            StatusCode::BAD_REQUEST,
            "budget_min must be >= 0".to_string(),
        )
            .into_response();
    }
    let order_id = Uuid::new_v4();
    let guard_count = req.guard_count.unwrap_or(1).max(1);
    let now = Utc::now();
    let row = OrderRow {
        id: order_id,
        client_id: req.client_id,
        title: req.title.clone(),
        description: req.description.unwrap_or_default(),
        required_licenses: req.required_licenses.unwrap_or_default(),
        guard_count,
        budget_min: req.budget_min,
        budget_max: req.budget_max,
        latitude: req.latitude,
        longitude: req.longitude,
        start_time: req.start_time,
        end_time: req.end_time,
        status: "open".to_string(),
        created_at: now,
        updated_at: now,
    };

    match &state {
        AppState::Memory(map) => {
            map.write().await.insert(order_id, row.clone());
            (StatusCode::CREATED, Json(row)).into_response()
        }
        AppState::Pool(pool) => {
            let desc = row.description.clone();
            let licenses = row.required_licenses.clone();
            if let Err(e) = sqlx::query(
                r#"
                INSERT INTO gateway_orders (id, client_id, title, description, required_licenses, guard_count, budget_min, budget_max, latitude, longitude, start_time, end_time, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                "#,
            )
            .bind(order_id)
            .bind(row.client_id)
            .bind(&row.title)
            .bind(&desc)
            .bind(&licenses)
            .bind(row.guard_count)
            .bind(row.budget_min)
            .bind(row.budget_max)
            .bind(row.latitude)
            .bind(row.longitude)
            .bind(row.start_time)
            .bind(row.end_time)
            .bind(&row.status)
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(pool)
            .await
            {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("db error: {}", e),
                )
                    .into_response();
            }
            (StatusCode::CREATED, Json(row)).into_response()
        }
    }
}

async fn create_order_auth(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(req): Json<CreateOrderRequest>,
) -> impl IntoResponse {
    if !internal_auth_allowed(&headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"service auth required"})),
        )
            .into_response();
    }
    create_order(State(state), Json(req)).await.into_response()
}

async fn list_orders_auth(
    headers: HeaderMap,
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    if !internal_auth_allowed(&headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"service auth required"})),
        )
            .into_response();
    }
    list_orders(State(state), Query(q)).await.into_response()
}

async fn get_order_auth(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !internal_auth_allowed(&headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"service auth required"})),
        )
            .into_response();
    }
    get_order(State(state), Path(id)).await.into_response()
}

fn internal_auth_allowed(headers: &HeaderMap) -> bool {
    let allow_insecure = std::env::var("ALLOW_INSECURE_INTERNAL_AUTH")
        .ok()
        .map(|v| {
            let x = v.to_lowercase();
            x == "1" || x == "true" || x == "yes"
        })
        .unwrap_or(false);
    let token = std::env::var("INTERNAL_SERVICE_TOKEN")
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    match token {
        Some(expected) => headers
            .get("X-Internal-Token")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == expected)
            .unwrap_or(false),
        None => allow_insecure,
    }
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    client_id: Option<Uuid>,
}

async fn list_orders(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    match &state {
        AppState::Memory(map) => {
            let orders: Vec<OrderRow> = map
                .read()
                .await
                .values()
                .filter(|o| q.client_id.is_none_or(|id| o.client_id == id))
                .cloned()
                .collect();
            Json(orders).into_response()
        }
        AppState::Pool(pool) => {
            let rows = if let Some(cid) = q.client_id {
                sqlx::query_as::<_, OrderRow>(
                    "SELECT id, client_id, title, description, required_licenses, guard_count, budget_min::double precision AS budget_min, budget_max::double precision AS budget_max, latitude::double precision AS latitude, longitude::double precision AS longitude, start_time, end_time, status, created_at, updated_at FROM gateway_orders WHERE client_id = $1 ORDER BY created_at DESC",
                )
                .bind(cid)
                .fetch_all(pool)
                .await
            } else {
                sqlx::query_as::<_, OrderRow>(
                    "SELECT id, client_id, title, description, required_licenses, guard_count, budget_min::double precision AS budget_min, budget_max::double precision AS budget_max, latitude::double precision AS latitude, longitude::double precision AS longitude, start_time, end_time, status, created_at, updated_at FROM gateway_orders ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await
            };
            match rows {
                Ok(list) => Json(list).into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("db error: {}", e),
                )
                    .into_response(),
            }
        }
    }
}

async fn get_order(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match &state {
        AppState::Memory(map) => {
            let orders = map.read().await;
            match orders.get(&id) {
                Some(o) => (StatusCode::OK, Json(o.clone())).into_response(),
                None => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error":"not found"})),
                )
                    .into_response(),
            }
        }
        AppState::Pool(pool) => {
            let row = sqlx::query_as::<_, OrderRow>(
                "SELECT id, client_id, title, description, required_licenses, guard_count, budget_min::double precision AS budget_min, budget_max::double precision AS budget_max, latitude::double precision AS latitude, longitude::double precision AS longitude, start_time, end_time, status, created_at, updated_at FROM gateway_orders WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(pool)
            .await;
            match row {
                Ok(Some(o)) => (StatusCode::OK, Json(o)).into_response(),
                Ok(None) => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error":"not found"})),
                )
                    .into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("db error: {}", e),
                )
                    .into_response(),
            }
        }
    }
}

impl sqlx::FromRow<'_, sqlx::postgres::PgRow> for OrderRow {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(OrderRow {
            id: row.try_get("id")?,
            client_id: row.try_get("client_id")?,
            title: row.try_get("title")?,
            description: row
                .try_get::<Option<String>, _>("description")?
                .unwrap_or_default(),
            required_licenses: row.try_get("required_licenses")?,
            guard_count: row.try_get("guard_count")?,
            budget_min: row.try_get::<f64, _>("budget_min")?,
            budget_max: row.try_get::<f64, _>("budget_max")?,
            latitude: row.try_get::<f64, _>("latitude")?,
            longitude: row.try_get::<f64, _>("longitude")?,
            start_time: row.try_get("start_time")?,
            end_time: row.try_get("end_time")?,
            status: row.try_get("status")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[tokio::main]
async fn main() {
    let production = std::env::var("APP_ENV")
        .map(|value| value.eq_ignore_ascii_case("production"))
        .unwrap_or(false);
    let state = match std::env::var("DATABASE_URL") {
        Ok(url) => {
            let pool = sqlx::postgres::PgPoolOptions::new()
                .connect(&url)
                .await
                .expect("connect to postgres");
            println!("order-service: using PostgreSQL");
            AppState::Pool(pool)
        }
        Err(_) if production => {
            panic!("DATABASE_URL is required in production");
        }
        Err(_) => {
            println!("order-service: using in-memory store (set DATABASE_URL for persistence)");
            AppState::Memory(Arc::new(RwLock::new(HashMap::new())))
        }
    };

    let app = Router::new()
        .route("/orders", post(create_order_auth).get(list_orders_auth))
        .route("/orders/:id", get(get_order_auth))
        .with_state(state);
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8082);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
