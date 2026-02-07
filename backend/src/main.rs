//! Guardio Backend Server
//! 
//! REST API + WebSocket server built with Axum

use axum::{
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod auth;
mod db;
mod services;
mod ws;

use api::routes;
use db::Database;
use sqlx::PgPool;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,guardio_backend=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    guardio_core::init();

    tracing::info!("Starting Guardio Backend v{}", env!("CARGO_PKG_VERSION"));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let db = Database::from_env().await.expect("DATABASE_URL not set or connection failed");
    db.migrate().await.expect("Database migrations failed");
    let pool: PgPool = db.pool.clone();

    let loyalty = Router::new()
        .route("/balance", get(handlers::loyalty::get_balance))
        .route("/ledger", get(handlers::loyalty::get_ledger))
        .route("/stats", get(handlers::loyalty::get_stats))
        .route("/earn", post(handlers::loyalty::post_earn))
        .route("/referral", post(handlers::loyalty::post_referral))
        .route("/redeem", post(handlers::loyalty::post_redeem))
        .with_state(handlers::loyalty::LoyaltyState { pool: pool.clone() });

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api/v1", routes::api_routes())
        .nest("/api/v1/loyalty", loyalty)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}
