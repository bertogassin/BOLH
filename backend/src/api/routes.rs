//! API Routes

use axum::{
    routing::{get, post, put, delete},
    Router,
};

use super::handlers;
use crate::api::handlers::loyalty::LoyaltyState;
use sqlx::PgPool;

pub fn api_routes() -> Router {
    Router::new()
        .nest("/auth", auth_routes())
        .nest("/users", user_routes())
        .nest("/guards", guard_routes())
        .nest("/orders", order_routes())
        .nest("/payments", payment_routes())
        .nest("/chat", chat_routes())
        .nest("/notifications", notification_routes())
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

fn notification_routes() -> Router {
    Router::new()
        .route("/", get(handlers::notifications::list_notifications))
        .route("/read", post(handlers::notifications::mark_read))
        .route("/settings", get(handlers::notifications::get_settings))
        .route("/settings", put(handlers::notifications::update_settings))
}
