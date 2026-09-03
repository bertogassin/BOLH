// Bid Service: HTTP API. With DATABASE_URL uses PostgreSQL (gateway_bids); otherwise in-memory.
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
struct BidRow {
    id: Uuid,
    guard_id: Uuid,
    title: String,
    licenses: Vec<String>,
    price_per_hour: f64,
    latitude: f64,
    longitude: f64,
    radius_km: f64,
    active: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct CreateBidRequest {
    guard_id: Uuid,
    title: String,
    licenses: Option<Vec<String>>,
    price_per_hour: f64,
    latitude: f64,
    longitude: f64,
    radius_km: Option<f64>,
}

#[derive(Clone)]
enum AppState {
    Memory(Arc<RwLock<HashMap<Uuid, BidRow>>>),
    Pool(sqlx::PgPool),
}

async fn create_bid(
    State(state): State<AppState>,
    Json(req): Json<CreateBidRequest>,
) -> impl IntoResponse {
    if req.price_per_hour < 0.0 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":"price_per_hour must be >= 0"})),
        )
            .into_response();
    }
    let bid_id = Uuid::new_v4();
    let radius_km = req.radius_km.unwrap_or(10.0).max(0.0);
    let now = Utc::now();
    let row = BidRow {
        id: bid_id,
        guard_id: req.guard_id,
        title: req.title.clone(),
        licenses: req.licenses.unwrap_or_default(),
        price_per_hour: req.price_per_hour,
        latitude: req.latitude,
        longitude: req.longitude,
        radius_km,
        active: true,
        created_at: now,
        updated_at: now,
    };

    match &state {
        AppState::Memory(map) => {
            map.write().await.insert(bid_id, row.clone());
            (StatusCode::CREATED, Json(row)).into_response()
        }
        AppState::Pool(pool) => {
            let licenses = row.licenses.clone();
            if let Err(e) = sqlx::query(
                r#"
                INSERT INTO gateway_bids (id, guard_id, title, licenses, price_per_hour, latitude, longitude, radius_km, active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                "#,
            )
            .bind(bid_id)
            .bind(row.guard_id)
            .bind(&row.title)
            .bind(&licenses)
            .bind(row.price_per_hour)
            .bind(row.latitude)
            .bind(row.longitude)
            .bind(row.radius_km)
            .bind(row.active)
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(pool)
            .await
            {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": format!("db: {}", e)})),
                )
                    .into_response();
            }
            (StatusCode::CREATED, Json(row)).into_response()
        }
    }
}

async fn create_bid_auth(
    headers: HeaderMap,
    State(state): State<AppState>,
    Json(req): Json<CreateBidRequest>,
) -> impl IntoResponse {
    if !internal_auth_allowed(&headers) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error":"service auth required"})),
        )
            .into_response();
    }
    create_bid(State(state), Json(req)).await.into_response()
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    guard_id: Option<Uuid>,
}

async fn list_bids(State(state): State<AppState>, Query(q): Query<ListQuery>) -> impl IntoResponse {
    match &state {
        AppState::Memory(map) => {
            let bids: Vec<BidRow> = map
                .read()
                .await
                .values()
                .filter(|b| q.guard_id.is_none_or(|g| g == b.guard_id))
                .cloned()
                .collect();
            Json(bids).into_response()
        }
        AppState::Pool(pool) => {
            let rows = if let Some(guard_id) = q.guard_id {
                sqlx::query_as::<_, BidRow>(
                    "SELECT id, guard_id, title, licenses, price_per_hour::double precision AS price_per_hour, latitude::double precision AS latitude, longitude::double precision AS longitude, radius_km::double precision AS radius_km, active, created_at, updated_at FROM gateway_bids WHERE guard_id = $1 ORDER BY created_at DESC",
                )
                .bind(guard_id)
                .fetch_all(pool)
                .await
            } else {
                sqlx::query_as::<_, BidRow>(
                    "SELECT id, guard_id, title, licenses, price_per_hour::double precision AS price_per_hour, latitude::double precision AS latitude, longitude::double precision AS longitude, radius_km::double precision AS radius_km, active, created_at, updated_at FROM gateway_bids ORDER BY created_at DESC",
                )
                .fetch_all(pool)
                .await
            };
            match rows {
                Ok(list) => Json(list).into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": format!("db: {}", e)})),
                )
                    .into_response(),
            }
        }
    }
}

async fn list_bids_auth(
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
    list_bids(State(state), Query(q)).await.into_response()
}

async fn get_bid(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    match &state {
        AppState::Memory(map) => {
            let bids = map.read().await;
            match bids.get(&id) {
                Some(b) => (StatusCode::OK, Json(b.clone())).into_response(),
                None => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error":"not found"})),
                )
                    .into_response(),
            }
        }
        AppState::Pool(pool) => {
            let row = sqlx::query_as::<_, BidRow>(
                "SELECT id, guard_id, title, licenses, price_per_hour::double precision AS price_per_hour, latitude::double precision AS latitude, longitude::double precision AS longitude, radius_km::double precision AS radius_km, active, created_at, updated_at FROM gateway_bids WHERE id = $1",
            )
            .bind(id)
            .fetch_optional(pool)
            .await;
            match row {
                Ok(Some(b)) => (StatusCode::OK, Json(b)).into_response(),
                Ok(None) => (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({"error":"not found"})),
                )
                    .into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": format!("db: {}", e)})),
                )
                    .into_response(),
            }
        }
    }
}

async fn get_bid_auth(
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
    get_bid(State(state), Path(id)).await.into_response()
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

impl sqlx::FromRow<'_, sqlx::postgres::PgRow> for BidRow {
    fn from_row(row: &sqlx::postgres::PgRow) -> Result<Self, sqlx::Error> {
        use sqlx::Row;
        Ok(BidRow {
            id: row.try_get("id")?,
            guard_id: row.try_get("guard_id")?,
            title: row.try_get("title")?,
            licenses: row.try_get("licenses")?,
            price_per_hour: row.try_get::<f64, _>("price_per_hour")?,
            latitude: row.try_get::<Option<f64>, _>("latitude")?.unwrap_or(0.0),
            longitude: row.try_get::<Option<f64>, _>("longitude")?.unwrap_or(0.0),
            radius_km: row.try_get::<Option<f64>, _>("radius_km")?.unwrap_or(0.0),
            active: row.try_get("active")?,
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
            println!("bid-service: using PostgreSQL");
            AppState::Pool(pool)
        }
        Err(_) if production => {
            panic!("DATABASE_URL is required in production");
        }
        Err(_) => {
            println!("bid-service: using in-memory store (set DATABASE_URL for persistence)");
            AppState::Memory(Arc::new(RwLock::new(HashMap::new())))
        }
    };
    let app = Router::new()
        .route("/bids", post(create_bid_auth).get(list_bids_auth))
        .route("/bids/:id", get(get_bid_auth))
        .with_state(state);
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8083);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    axum::serve(tokio::net::TcpListener::bind(addr).await.unwrap(), app)
        .await
        .unwrap();
}
