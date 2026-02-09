use axum::{
    extract::{State, Json, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Router,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod blockchain;
use blockchain::BlockchainState;

type AppState = Arc<BlockchainState>;

#[derive(Deserialize)]
struct CreateWalletReq {
    name: String,
}

#[derive(Deserialize)]
struct SubmitTxReq {
    from: String,
    to: String,
    amount: u64,
    fee: u64,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state: AppState = Arc::new(BlockchainState::new());
    state.initialize().await;

    let app = Router::new()
        .route("/health", get(health))
        .route("/blockchain/init", post(init_blockchain))
        .route("/blockchain/wallets", get(list_wallets))
        .route("/blockchain/wallets", post(create_wallet))
        .route("/blockchain/wallets/:name", get(get_wallet))
        .route("/blockchain/wallets/:name", delete(delete_wallet))
        .route("/blockchain/wallets/:name/balance", get(get_wallet_balance))
        .route("/blockchain/balance/:address", get(get_balance))
        .route("/blockchain/transactions", post(submit_transaction))
        .route("/blockchain/consensus", get(get_consensus_state))
        .route("/blockchain/utxos/:address", get(get_utxos))
        .with_state(state)
        .layer(CorsLayer::permissive());

    let port = 8080;
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    tracing::info!("🚀 Blockchain Service (REAL) listening on http://{}", addr);

    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "OK"
}

async fn init_blockchain() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "status": "initialized",
            "version": "0.1.0",
            "network": "main",
            "height": 0,
            "engine": "SHA3-256 + UTXO"
        })),
    )
}

async fn list_wallets(State(state): State<AppState>) -> impl IntoResponse {
    let wallets = state.list_wallets().await;
    (StatusCode::OK, Json(wallets))
}

async fn create_wallet(
    State(state): State<AppState>,
    Json(req): Json<CreateWalletReq>,
) -> impl IntoResponse {
    let wallet = state.create_wallet(req.name).await;
    (StatusCode::CREATED, Json(wallet))
}

async fn get_wallet(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match state.get_wallet(&name).await {
        Some(mut wallet) => {
            // Don't expose private key
            wallet.seckey = None;
            (StatusCode::OK, Json(wallet)).into_response()
        }
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Wallet not found"}))).into_response(),
    }
}

async fn get_wallet_balance(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    match state.get_wallet(&name).await {
        Some(wallet) => {
            let balance = state.get_balance(&wallet.address).await;
            (
                StatusCode::OK,
                Json(json!({
                    "address": wallet.address,
                    "balance": balance
                })),
            )
                .into_response()
        }
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "Wallet not found"}))).into_response(),
    }
}

async fn delete_wallet(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let deleted = state.delete_wallet(&name).await;
    if deleted {
        (
            StatusCode::OK,
            Json(json!({
                "deleted": name,
                "status": "success"
            })),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({
                "error": "Wallet not found"
            })),
        )
    }
}

async fn get_balance(
    State(state): State<AppState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let balance = state.get_balance(&addr).await;
    (
        StatusCode::OK,
        Json(json!({
            "address": addr,
            "balance": balance
        })),
    )
}

async fn submit_transaction(
    State(state): State<AppState>,
    Json(req): Json<SubmitTxReq>,
) -> impl IntoResponse {
    let tx = state.submit_transaction(req.from, req.to, req.amount, req.fee).await;
    state.mine_block().await; // Auto-mine for testing
    (StatusCode::ACCEPTED, Json(tx))
}

async fn get_consensus_state(State(state): State<AppState>) -> impl IntoResponse {
    let (height, validators) = state.get_consensus_state().await;
    (
        StatusCode::OK,
        Json(json!({
            "height": height,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "validators": validators,
            "status": "active"
        })),
    )
}

async fn get_utxos(
    State(state): State<AppState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let utxos = state.get_utxos(&addr).await;
    (StatusCode::OK, Json(utxos))
}
