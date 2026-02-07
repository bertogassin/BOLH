//! Payment handlers

use axum::{
    extract::{Path, Json},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;
use guardio_core::payments::{Payment, PaymentMethod};

pub async fn list_payments() -> impl IntoResponse {
    // TODO: Fetch from database
    (StatusCode::OK, Json(serde_json::json!({
        "payments": [],
        "total": 0
    })))
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub order_id: Option<String>,
    pub amount: i64,
    pub method: String,
    pub card_id: Option<String>,
}

pub async fn create_payment(Json(req): Json<CreatePaymentRequest>) -> impl IntoResponse {
    let method = match req.method.as_str() {
        "card" => PaymentMethod::Card,
        "apple_pay" => PaymentMethod::ApplePay,
        "google_pay" => PaymentMethod::GooglePay,
        "wallet" => PaymentMethod::Wallet,
        _ => PaymentMethod::Card,
    };

    let payment = Payment::new(1, req.amount, method); // TODO: Get user from auth

    // TODO: Process payment with payment provider

    (StatusCode::CREATED, Json(serde_json::json!({
        "id": payment.id.to_string(),
        "status": "pending",
        "amount": payment.amount,
        "currency": payment.currency
    })))
}

pub async fn list_cards() -> impl IntoResponse {
    // TODO: Fetch saved cards
    (StatusCode::OK, Json(serde_json::json!({
        "cards": []
    })))
}

#[derive(Debug, Deserialize)]
pub struct AddCardRequest {
    pub number: String,
    pub expiry_month: u8,
    pub expiry_year: u16,
    pub cvv: String,
    pub holder_name: String,
}

pub async fn add_card(Json(req): Json<AddCardRequest>) -> impl IntoResponse {
    // Validate card number
    if !guardio_core::ValidationService::validate_card(&req.number) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Invalid card number"
        })));
    }

    // TODO: Tokenize card with payment provider
    let last_four = &req.number[req.number.len()-4..];

    (StatusCode::CREATED, Json(serde_json::json!({
        "id": "card_123",
        "last_four": last_four,
        "expiry_month": req.expiry_month,
        "expiry_year": req.expiry_year,
        "holder_name": req.holder_name,
        "card_type": "visa"
    })))
}

pub async fn remove_card(Path(id): Path<String>) -> impl IntoResponse {
    // TODO: Remove card
    (StatusCode::OK, Json(serde_json::json!({
        "id": id,
        "removed": true
    })))
}

pub async fn get_subscription() -> impl IntoResponse {
    // TODO: Fetch subscription
    (StatusCode::OK, Json(serde_json::json!({
        "plan": "free",
        "status": "active",
        "features": ["Basic guard discovery", "5 orders per month"]
    })))
}

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    pub plan: String,
    pub payment_method_id: Option<String>,
}

pub async fn subscribe(Json(req): Json<SubscribeRequest>) -> impl IntoResponse {
    // TODO: Create subscription
    (StatusCode::CREATED, Json(serde_json::json!({
        "plan": req.plan,
        "status": "active",
        "current_period_end": chrono::Utc::now().to_rfc3339()
    })))
}
