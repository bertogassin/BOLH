use axum::{
    extract::{State, Json, Query},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use crate::services::LoyaltyService;
use sqlx::PgPool;

#[derive(Clone)]
pub struct LoyaltyState {
    pub pool: PgPool,
}

#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub balance: i64,
    pub locked: i64,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
pub struct LedgerResponse {
    pub items: Vec<crate::services::loyalty_service::LedgerEntry>,
}

#[derive(Debug, Deserialize)]
pub struct EarnRequest {
    pub amount: i64,
    pub source: String, // referral|ad|admin
    pub reference: Option<String>,
    pub user_id: Option<i64>, // temporary until auth is wired
}

#[derive(Debug, Deserialize)]
pub struct RedeemRequest {
    pub amount: i64,
    pub kind: String, // service|voucher|cashout
    pub user_id: Option<i64>, // temporary until auth is wired
}

#[derive(Debug, Deserialize)]
pub struct LedgerQuery {
    pub limit: Option<i64>,
    pub user_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub supply_total: i64,
    pub supply_circulating: i64,
    pub reserve_usd: String,
    pub rate_usd: String,
    pub revenue_percent: i32,
}

pub async fn get_balance(State(state): State<LoyaltyState>, Query(q): Query<LedgerQuery>) -> impl IntoResponse {
    let user_id = q.user_id.unwrap_or(1);
    let service = LoyaltyService::new(state.pool);
    match service.get_balance(user_id).await {
        Ok(bal) => (StatusCode::OK, Json(BalanceResponse { balance: bal.balance, locked: bal.locked, updated_at: bal.updated_at })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

pub async fn get_ledger(State(state): State<LoyaltyState>, Query(q): Query<LedgerQuery>) -> impl IntoResponse {
    let user_id = q.user_id.unwrap_or(1);
    let limit = q.limit.unwrap_or(50);
    let service = LoyaltyService::new(state.pool);
    match service.list_ledger(user_id, limit).await {
        Ok(items) => (StatusCode::OK, Json(LedgerResponse { items })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

pub async fn post_earn(State(state): State<LoyaltyState>, Json(req): Json<EarnRequest>) -> impl IntoResponse {
    let user_id = req.user_id.unwrap_or(1);
    let service = LoyaltyService::new(state.pool);
    match service.earn(user_id, req.amount, &req.source, req.reference.as_deref()).await {
        Ok(bal) => (StatusCode::OK, Json(BalanceResponse { balance: bal.balance, locked: bal.locked, updated_at: bal.updated_at })),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

pub async fn post_redeem(State(state): State<LoyaltyState>, Json(req): Json<RedeemRequest>) -> impl IntoResponse {
    let user_id = req.user_id.unwrap_or(1);
    let service = LoyaltyService::new(state.pool);
    match service.redeem(user_id, req.amount, &req.kind).await {
        Ok(bal) => (StatusCode::OK, Json(BalanceResponse { balance: bal.balance, locked: bal.locked, updated_at: bal.updated_at })),
        Err(e) => {
            let code = if matches!(e, crate::services::loyalty_service::LoyaltyError::InsufficientBalance) {
                StatusCode::UNPROCESSABLE_ENTITY
            } else {
                StatusCode::BAD_REQUEST
            };
            (code, Json(serde_json::json!({ "error": e.to_string() })))
        },
    }
}

pub async fn get_stats(State(state): State<LoyaltyState>) -> impl IntoResponse {
    let service = LoyaltyService::new(state.pool);
    match service.get_stats().await {
        Ok((total, circ, reserve, rate, percent)) => (
            StatusCode::OK,
            Json(StatsResponse {
                supply_total: total,
                supply_circulating: circ,
                reserve_usd: reserve.to_string(),
                rate_usd: rate.to_string(),
                revenue_percent: percent,
            })
        ),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}

#[derive(Debug, Deserialize)]
pub struct ReferralRequest {
    pub referrer_id: i64,
    pub referee_id: i64,
}

#[derive(Debug, Serialize)]
pub struct ReferralResponse {
    pub reward_each: i64,
}

pub async fn post_referral(State(state): State<LoyaltyState>, Json(req): Json<ReferralRequest>) -> impl IntoResponse {
    let service = LoyaltyService::new(state.pool);
    match service.process_referral(req.referrer_id, req.referee_id).await {
        Ok(reward) => (StatusCode::OK, Json(ReferralResponse { reward_each: reward })),
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))),
    }
}
