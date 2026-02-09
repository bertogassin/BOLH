//! Blockchain API Handlers for Web/Desktop
//! Exposes blockchain operations as HTTP endpoints

use axum::{
    extract::{ws::WebSocketUpgrade, State, Json, Path},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgPool;
use std::sync::Arc;

use crate::ws::blockchain::{BlockchainWsManager, BlockchainWsMessage};

#[derive(Clone)]
pub struct BlockchainState {
    pub pool: PgPool,
    pub ws: Arc<BlockchainWsManager>,
}

// ============= Response Types =============

#[derive(Debug, Serialize)]
pub struct WalletResponse {
    pub name: String,
    pub address: String,
    pub balance: u64,
    pub pubkey: Option<String>,
    pub created_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct InitResponse {
    pub status: String,
    pub version: String,
    pub network: String,
    pub height: u64,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub txid: String,
    pub status: String,
    pub mempool: bool,
}

#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub address: String,
    pub balance: u64,
}

#[derive(Debug, Serialize)]
pub struct ConsensusStateResponse {
    pub height: u64,
    pub timestamp: String,
    pub validators: Vec<ValidatorInfo>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ValidatorInfo {
    pub name: String,
    pub stake: u64,
}

#[derive(Debug, Serialize)]
pub struct UTXOResponse {
    pub txid: String,
    pub output_index: u32,
    pub address: String,
    pub amount: u64,
    pub block_height: u64,
    pub spent: bool,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize)]
pub struct FeeEstimateResponse {
    pub base_fee: u64,
    pub amount_fee: u64,
    pub priority_fee: u64,
    pub total_fee: u64,
    pub network_congestion: f64,
    pub estimated_block_time: u32,
}

// ============= Request Types =============

#[derive(Debug, Deserialize)]
pub struct CreateWalletRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportWalletRequest {
    pub name: String,
    pub pubkey: String,
    pub seckey: String,
}

#[derive(Debug, Deserialize)]
pub struct SubmitTransactionRequest {
    pub from: String,
    pub to: String,
    pub amount: u64,
    pub fee: u64,
}

#[derive(Debug, Deserialize)]
pub struct FeeEstimateRequest {
    pub amount: u64,
    pub input_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct InitGenesisRequest {
    pub accounts: Vec<String>,
}

// ============= Handlers =============

/// Initialize blockchain
pub async fn init_blockchain(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let response = InitResponse {
        status: "initialized".to_string(),
        version: "0.1.0".to_string(),
        network: "main".to_string(),
        height: 0,
    };
    
    (StatusCode::OK, Json(response))
}

/// Blockchain WebSocket endpoint
pub async fn blockchain_ws(
    ws: WebSocketUpgrade,
    State(state): State<BlockchainState>,
) -> Response {
    crate::ws::blockchain::ws_handler(ws, state.ws.clone()).await
}

/// Create a new wallet
pub async fn create_wallet(
    State(state): State<BlockchainState>,
    Json(req): Json<CreateWalletRequest>,
) -> impl IntoResponse {
    let wallet = WalletResponse {
        name: req.name,
        address: format!("bolh_mock_{}", uuid::Uuid::new_v4().to_string()[0..8].to_string()),
        balance: 10_000_000_000,
        pubkey: Some("0123456789abcdef0123456789abcdef".to_string()),
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        status: "active".to_string(),
    };

    state
        .ws
        .broadcast(BlockchainWsMessage::Wallet {
            name: wallet.name.clone(),
            address: wallet.address.clone(),
            balance: wallet.balance,
            status: wallet.status.clone(),
        })
        .await;
    
    (StatusCode::CREATED, Json(wallet))
}

/// List all wallets
pub async fn list_wallets(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let wallets = vec![
        WalletResponse {
            name: "default".to_string(),
            address: "bolh_default123".to_string(),
            balance: 10_000_000_000,
            pubkey: Some("pubkey_default".to_string()),
            created_at: Some(chrono::Utc::now().to_rfc3339()),
            status: "active".to_string(),
        },
    ];
    
    (StatusCode::OK, Json(wallets))
}

/// Get wallet info
pub async fn get_wallet(
    State(_state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let wallet = WalletResponse {
        name: name.clone(),
        address: format!("bolh_{}", name),
        balance: 10_000_000_000,
        pubkey: Some("pubkey_mock".to_string()),
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        status: "active".to_string(),
    };
    
    (StatusCode::OK, Json(wallet))
}

/// Get wallet balance
pub async fn get_wallet_balance(
    State(_state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let response = BalanceResponse {
        address: format!("bolh_{}", name),
        balance: 10_000_000_000,
    };
    
    (StatusCode::OK, Json(response))
}

/// Delete wallet
pub async fn delete_wallet(
    State(state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    state
        .ws
        .broadcast(BlockchainWsMessage::Wallet {
            name: name.clone(),
            address: format!("bolh_{}", name),
            balance: 0,
            status: "deleted".to_string(),
        })
        .await;

    (
        StatusCode::OK,
        Json(json!({
            "deleted": name,
            "status": "success"
        })),
    )
}

/// Import wallet
pub async fn import_wallet(
    State(state): State<BlockchainState>,
    Json(req): Json<ImportWalletRequest>,
) -> impl IntoResponse {
    let wallet = WalletResponse {
        name: req.name,
        address: format!("bolh_{}", &req.pubkey[..8.min(req.pubkey.len())]),
        balance: 10_000_000_000,
        pubkey: Some(req.pubkey),
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        status: "imported".to_string(),
    };

    state
        .ws
        .broadcast(BlockchainWsMessage::Wallet {
            name: wallet.name.clone(),
            address: wallet.address.clone(),
            balance: wallet.balance,
            status: wallet.status.clone(),
        })
        .await;
    
    (StatusCode::CREATED, Json(wallet))
}

/// Get balance for address
pub async fn get_balance(
    State(_state): State<BlockchainState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let response = BalanceResponse {
        address: addr,
        balance: 100_000_000_000,
    };
    
    (StatusCode::OK, Json(response))
}

/// Submit transaction
pub async fn submit_transaction(
    State(state): State<BlockchainState>,
    Json(req): Json<SubmitTransactionRequest>,
) -> impl IntoResponse {
    let response = TransactionResponse {
        txid: format!("tx_{}", uuid::Uuid::new_v4().to_string()[0..16].to_string()),
        status: "pending".to_string(),
        mempool: true,
    };

    state
        .ws
        .broadcast(BlockchainWsMessage::Transaction {
            txid: response.txid.clone(),
            status: response.status.clone(),
            mempool: response.mempool,
        })
        .await;

    state
        .ws
        .broadcast(BlockchainWsMessage::Balance {
            address: req.from,
            balance: 0,
        })
        .await;
    
    (StatusCode::ACCEPTED, Json(response))
}

/// Get consensus state
pub async fn get_consensus_state(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let response = ConsensusStateResponse {
        height: 0,
        timestamp: chrono::Utc::now().to_rfc3339(),
        validators: vec![
            ValidatorInfo {
                name: "validator_1".to_string(),
                stake: 100_000_000_000,
            },
            ValidatorInfo {
                name: "validator_2".to_string(),
                stake: 100_000_000_000,
            },
        ],
        status: "active".to_string(),
    };
    
    (StatusCode::OK, Json(response))
}

/// Get UTXOs for address
pub async fn get_utxos(
    State(_state): State<BlockchainState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let utxos = vec![
        UTXOResponse {
            txid: "tx_123abc".to_string(),
            output_index: 0,
            address: addr,
            amount: 50_000_000_000,
            block_height: 0,
            spent: false,
        },
    ];
    
    (StatusCode::OK, Json(utxos))
}

/// Validate and process transaction
pub async fn validate_transaction(
    State(_state): State<BlockchainState>,
    Json(req): Json<SubmitTransactionRequest>,
) -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(json!({
            "valid": true,
            "txid": format!("tx_{}", uuid::Uuid::new_v4().to_string()[0..16].to_string()),
            "fee": req.fee,
            "status": "accepted"
        })),
    )
}

/// Initialize genesis block
pub async fn init_genesis(
    State(_state): State<BlockchainState>,
    Json(_req): Json<InitGenesisRequest>,
) -> impl IntoResponse {
    (
        StatusCode::CREATED,
        Json(json!({
            "genesis_height": 0,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "status": "initialized"
        })),
    )
}
/// Estimate transaction fees
pub async fn estimate_fees(
    State(_state): State<BlockchainState>,
    Json(req): Json<FeeEstimateRequest>,
) -> impl IntoResponse {
    // Fee calculation algorithm:
    // - Base fee: 1000 (fixed minimum)
    // - Amount fee: amount * 0.001 (0.1% of transaction amount)
    // - Priority fee: based on network congestion (1000-5000)
    // - Input complexity fee: 500 * input_count
    
    let base_fee: u64 = 1000; // Base fee in satoshis
    
    // Amount-based fee: 0.1% of transaction amount, minimum 100
    let amount_fee = std::cmp::max((req.amount as f64 * 0.001) as u64, 100);
    
    // Network congestion fee (simulated: 20% of amount fee)
    let priority_fee = std::cmp::min((amount_fee as f64 * 0.2) as u64 + 1000, 5000);
    
    // Input complexity fee: higher fee for more inputs
    let input_count = req.input_count.unwrap_or(1);
    let complexity_fee = (input_count as u64) * 500;
    
    let total_fee = base_fee + amount_fee + priority_fee + complexity_fee;
    
    // Network congestion percentage (simulated: 20-60% based on random value)
    let network_congestion = 0.3; // 30% congestion
    
    // Estimated block time: 10-30 seconds based on congestion
    let estimated_block_time = (10 + (network_congestion * 20.0) as u32).min(30);
    
    let response = FeeEstimateResponse {
        base_fee,
        amount_fee,
        priority_fee,
        total_fee,
        network_congestion,
        estimated_block_time,
    };
    
    (StatusCode::OK, Json(response))
}