//! Order handlers

use axum::{
    extract::{Path, Query, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use bolh_core::orders::{Order, ServiceType, PricingConfig};

#[derive(Debug, Deserialize)]
pub struct ListOrdersQuery {
    pub status: Option<String>,
    pub page: Option<i32>,
    pub limit: Option<i32>,
}

pub async fn list_orders(Query(q): Query<ListOrdersQuery>) -> impl IntoResponse {
    let page = q.page.unwrap_or(1);
    let limit = q.limit.unwrap_or(20);

    // TODO: Fetch from database
    (StatusCode::OK, Json(serde_json::json!({
        "orders": [],
        "total": 0,
        "page": page,
        "limit": limit
    })))
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub service_type: String,
    pub address: String,
    pub latitude: f64,
    pub longitude: f64,
    pub description: Option<String>,
    pub scheduled_at: Option<String>,
    pub duration_hours: Option<f64>,
}

pub async fn create_order(Json(req): Json<CreateOrderRequest>) -> impl IntoResponse {
    let service_type = match req.service_type.as_str() {
        "bodyguard" => ServiceType::Bodyguard,
        "property_patrol" => ServiceType::PropertyPatrol,
        "event_security" => ServiceType::EventSecurity,
        "vehicle_escort" => ServiceType::VehicleEscort,
        _ => ServiceType::Custom,
    };

    let mut order = Order::new(
        1, // TODO: Get from auth context
        service_type,
        req.address,
        req.latitude,
        req.longitude,
    );

    order.description = req.description;
    order.duration_hours = req.duration_hours.unwrap_or(1.0);

    let pricing = PricingConfig::default();
    order.calculate_price(&pricing);

    // TODO: Save to database

    (StatusCode::CREATED, Json(serde_json::json!({
        "id": order.id.to_string(),
        "status": "new",
        "service_type": req.service_type,
        "price": order.price,
        "currency": order.currency,
        "created_at": order.created_at.to_rfc3339()
    })))
}

pub async fn get_order(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Fetch from database
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "new",
        "service_type": "bodyguard",
        "address": "Test Address",
        "price": 5000,
        "currency": "KZT"
    })))
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderRequest {
    pub description: Option<String>,
    pub scheduled_at: Option<String>,
}

pub async fn update_order(
    Path(id): Path<String>,
    Json(_req): Json<UpdateOrderRequest>,
) -> impl IntoResponse {
    // TODO: Update in database
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "updated": true
    })))
}

pub async fn accept_order(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Accept order and assign guard
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "accepted"
    })))
}

pub async fn start_order(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Start order
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "in_progress",
        "started_at": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn complete_order(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Complete order
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "completed",
        "completed_at": chrono::Utc::now().to_rfc3339()
    })))
}

pub async fn cancel_order(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Cancel order
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "status": "cancelled"
    })))
}
