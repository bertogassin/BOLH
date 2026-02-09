//! API Routes

use axum::{
    routing::{get, post, put, delete},
    Router,
};

use super::handlers;
use crate::api::handlers::loyalty::LoyaltyState;
use crate::api::handlers::blockchain::BlockchainState;
use crate::api::handlers::notifications::NotificationState;
use crate::ws::blockchain::BlockchainWsManager;
use crate::ws::notifications::NotificationWsManager;
use sqlx::postgres::PgPool;
use std::sync::Arc;

pub fn api_routes(pool: PgPool, blockchain_ws: Arc<BlockchainWsManager>, notification_ws: Arc<NotificationWsManager>) -> Router {
    Router::new()
        .nest("/auth", auth_routes())
        .nest("/users", user_routes())
        .nest("/guards", guard_routes())
        .nest("/orders", order_routes())
        .nest("/payments", payment_routes())
        .nest("/chat", chat_routes())
        .nest("/notifications", notification_routes(pool.clone(), notification_ws.clone()))
        .nest("/blockchain", blockchain_routes(pool.clone(), blockchain_ws))
}

fn auth_routes() -> Router {
    Router::new()
        .route("/register", post(handlers::auth::register))
        .route("/login", post(handlers::auth::login))
        .route("/refresh", post(handlers::auth::refresh_token))
        .route("/logout", post(handlers::auth::logout))
        .route("/verify-phone", post(handlers::auth::verify_phone))
}

fn user_routes() -> Router {
    Router::new()
        .route("/me", get(handlers::users::get_current_user))
        .route("/me", put(handlers::users::update_profile))
        .route("/me/location", put(handlers::users::update_location))
        .route("/me/avatar", post(handlers::users::upload_avatar))
        .route("/:id", get(handlers::users::get_user_by_id))
}

fn guard_routes() -> Router {
    Router::new()
        .route("/", get(handlers::guards::list_guards))
        .route("/nearby", get(handlers::guards::nearby_guards))
        .route("/search", get(handlers::guards::search_guards))
        .route("/:id", get(handlers::guards::get_guard))
        .route("/:id/availability", get(handlers::guards::get_availability))
        .route("/:id/reviews", get(handlers::guards::get_reviews))
}


fn order_routes() -> Router {
    Router::new()
        .route("/", get(handlers::orders::list_orders))
        .route("/", post(handlers::orders::create_order))
        .route("/:id", get(handlers::orders::get_order))
        .route("/:id", put(handlers::orders::update_order))
        .route("/:id/accept", post(handlers::orders::accept_order))
        .route("/:id/start", post(handlers::orders::start_order))
        .route("/:id/complete", post(handlers::orders::complete_order))
        .route("/:id/cancel", post(handlers::orders::cancel_order))
}

fn payment_routes() -> Router {
    Router::new()
        .route("/", get(handlers::payments::list_payments))
        .route("/", post(handlers::payments::create_payment))
        .route("/cards", get(handlers::payments::list_cards))
        .route("/cards", post(handlers::payments::add_card))
        .route("/cards/:id", delete(handlers::payments::remove_card))
        .route("/subscription", get(handlers::payments::get_subscription))
        .route("/subscription", post(handlers::payments::subscribe))
}

fn chat_routes() -> Router {
    Router::new()
        .route("/conversations", get(handlers::chat::list_conversations))
        .route("/conversations/:id/messages", get(handlers::chat::get_messages))
        .route("/conversations/:id/messages", post(handlers::chat::send_message))
}

fn notification_routes(pool: PgPool, ws: Arc<NotificationWsManager>) -> Router {
    let state = NotificationState { pool, ws };
    
    Router::new()
        .route("/", get(handlers::notifications::list_notifications))
        .route("/read", post(handlers::notifications::mark_read))
        .route("/settings", get(handlers::notifications::get_settings))
        .route("/settings", put(handlers::notifications::update_settings))
        .route("/ws", get(handlers::notifications::notification_ws))
        .with_state(state)
}

fn blockchain_routes(pool: PgPool, ws: Arc<BlockchainWsManager>) -> Router {
    let state = BlockchainState { pool, ws };
    
    Router::new()
        .route("/init", post(handlers::blockchain::init_blockchain))
        .route("/ws", get(handlers::blockchain::blockchain_ws))
        .route("/wallets", get(handlers::blockchain::list_wallets))
        .route("/wallets", post(handlers::blockchain::create_wallet))
        .route("/wallets/:name", get(handlers::blockchain::get_wallet))
        .route("/wallets/:name/balance", get(handlers::blockchain::get_wallet_balance))
        .route("/wallets/:name", delete(handlers::blockchain::delete_wallet))
        .route("/wallets/import", post(handlers::blockchain::import_wallet))
        .route("/balance/:address", get(handlers::blockchain::get_balance))
        .route("/transactions", post(handlers::blockchain::submit_transaction))
        .route("/transactions/validate", post(handlers::blockchain::validate_transaction))
        .route("/consensus", get(handlers::blockchain::get_consensus_state))
        .route("/utxos/:address", get(handlers::blockchain::get_utxos))
        .route("/genesis", post(handlers::blockchain::init_genesis))
        .route("/fees/estimate", post(handlers::blockchain::estimate_fees))
        .with_state(state)
}
