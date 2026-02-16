//! Blockchain API Handlers for Web/Desktop
//! Exposes blockchain operations as HTTP endpoints backed by the REAL bolh-chain

use axum::{
    extract::{ws::WebSocketUpgrade, State, Json, Path},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::postgres::PgPool;
use std::sync::Arc;

use bolh_core::chain::{global_chain, save_global_chain};
use bolh_core::types::Address;

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

// ============= Handlers (REAL blockchain) =============

/// Initialize blockchain
pub async fn init_blockchain(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let chain = global_chain();
    let stats = chain.stats();
    let response = InitResponse {
        status: "initialized".to_string(),
        version: bolh_core::VERSION.to_string(),
        network: "main".to_string(),
        height: stats.height,
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

/// Create a new wallet (real Ed25519 keypair)
pub async fn create_wallet(
    State(state): State<BlockchainState>,
    Json(req): Json<CreateWalletRequest>,
) -> impl IntoResponse {
    let chain = global_chain();
    match chain.create_wallet(&req.name) {
        Ok(info) => {
            let _ = save_global_chain();
            let wallet = WalletResponse {
                name: info.name.clone(),
                address: info.address.clone(),
                balance: 0,
                pubkey: Some(info.pubkey.clone()),
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
            
            (StatusCode::CREATED, Json(json!(wallet))).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": e})),
        ).into_response(),
    }
}

/// List all wallets (real data from chain)
pub async fn list_wallets(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let chain = global_chain();
    let wallets = chain.list_wallets();
    let list: Vec<WalletResponse> = wallets.iter().map(|w| {
        let balance = Address::from_bech32(&w.address)
            .map(|a| chain.get_balance(&a))
            .unwrap_or(0);
        WalletResponse {
            name: w.name.clone(),
            address: w.address.clone(),
            balance,
            pubkey: Some(w.pubkey.clone()),
            created_at: None,
            status: "active".to_string(),
        }
    }).collect();
    
    (StatusCode::OK, Json(list))
}

/// Get wallet info (real data)
pub async fn get_wallet(
    State(_state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let chain = global_chain();
    match chain.get_wallet(&name) {
        Some(info) => {
            let balance = Address::from_bech32(&info.address)
                .map(|a| chain.get_balance(&a))
                .unwrap_or(0);
            let wallet = WalletResponse {
                name: info.name.clone(),
                address: info.address.clone(),
                balance,
                pubkey: Some(info.pubkey.clone()),
                created_at: Some(chrono::Utc::now().to_rfc3339()),
                status: "active".to_string(),
            };
            (StatusCode::OK, Json(json!(wallet))).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "wallet not found"})),
        ).into_response(),
    }
}

/// Get wallet balance (real balance from chain)
pub async fn get_wallet_balance(
    State(_state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let chain = global_chain();
    let balance = chain.get_wallet_balance(&name);
    let address = chain.get_wallet(&name)
        .map(|w| w.address.clone())
        .unwrap_or_default();
    let response = BalanceResponse { address, balance };
    (StatusCode::OK, Json(response))
}

/// Delete wallet
pub async fn delete_wallet(
    State(state): State<BlockchainState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let chain = global_chain();
    let deleted = chain.delete_wallet(&name);
    if deleted {
        let _ = save_global_chain();
    }

    state
        .ws
        .broadcast(BlockchainWsMessage::Wallet {
            name: name.clone(),
            address: String::new(),
            balance: 0,
            status: "deleted".to_string(),
        })
        .await;

    (
        StatusCode::OK,
        Json(json!({
            "deleted": name,
            "status": if deleted { "success" } else { "not_found" }
        })),
    )
}

/// Import wallet (real import from secret key)
pub async fn import_wallet(
    State(state): State<BlockchainState>,
    Json(req): Json<ImportWalletRequest>,
) -> impl IntoResponse {
    let chain = global_chain();
    match chain.import_wallet(&req.name, &req.seckey) {
        Ok(info) => {
            let _ = save_global_chain();
            let wallet = WalletResponse {
                name: info.name.clone(),
                address: info.address.clone(),
                balance: 0,
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
            
            (StatusCode::CREATED, Json(json!(wallet))).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": e})),
        ).into_response(),
    }
}

/// Get balance for address (real balance)
pub async fn get_balance(
    State(_state): State<BlockchainState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let balance = Address::from_bech32(&addr)
        .map(|a| global_chain().get_balance(&a))
        .unwrap_or(0);
    let response = BalanceResponse { address: addr, balance };
    (StatusCode::OK, Json(response))
}

/// Submit transaction (real transfer on chain)
pub async fn submit_transaction(
    State(state): State<BlockchainState>,
    Json(req): Json<SubmitTransactionRequest>,
) -> impl IntoResponse {
    let chain = global_chain();
    match chain.create_transfer(&req.from, &req.to, req.amount) {
        Ok(tx) => {
            let result = chain.submit_transaction(tx);
            if result.success {
                let _ = chain.produce_block(&req.from);
                let _ = save_global_chain();
            }

            let txid = result.txid.clone();
            let success = result.success;

            state
                .ws
                .broadcast(BlockchainWsMessage::Transaction {
                    txid: txid.clone(),
                    status: if success { "accepted" } else { "rejected" }.to_string(),
                    mempool: false,
                })
                .await;

            if success {
                let new_balance = Address::from_bech32(&req.from)
                    .map(|a| chain.get_balance(&a))
                    .unwrap_or(0);
                state
                    .ws
                    .broadcast(BlockchainWsMessage::Balance {
                        address: req.from,
                        balance: new_balance,
                    })
                    .await;
            }

            let response = TransactionResponse {
                txid,
                status: if success { "accepted" } else { "rejected" }.to_string(),
                mempool: false,
            };
            (StatusCode::ACCEPTED, Json(json!(response))).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": e, "success": false})),
        ).into_response(),
    }
}

/// Get consensus state (real validators and chain state)
pub async fn get_consensus_state(
    State(_state): State<BlockchainState>,
) -> impl IntoResponse {
    let chain = global_chain();
    let stats = chain.stats();
    let vals = chain.active_validators();
    let response = ConsensusStateResponse {
        height: stats.height,
        timestamp: chrono::Utc::now().to_rfc3339(),
        validators: vals.iter().map(|v| ValidatorInfo {
            name: v.address.to_bech32(),
            stake: v.stake,
        }).collect(),
        status: "active".to_string(),
    };
    (StatusCode::OK, Json(response))
}

/// Get UTXOs for address (account-based compat)
pub async fn get_utxos(
    State(_state): State<BlockchainState>,
    Path(addr): Path<String>,
) -> impl IntoResponse {
    let chain = global_chain();
    let balance = Address::from_bech32(&addr)
        .map(|a| chain.get_balance(&a))
        .unwrap_or(0);
    let utxos = vec![
        UTXOResponse {
            txid: format!("account_{}", &addr[..8.min(addr.len())]),
            output_index: 0,
            address: addr,
            amount: balance,
            block_height: chain.height(),
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
    let chain = global_chain();
    match chain.create_transfer(&req.from, &req.to, req.amount) {
        Ok(tx) => {
            let result = chain.submit_transaction(tx);
            if result.success {
                let _ = chain.produce_block(&req.from);
                let _ = save_global_chain();
            }
            (
                StatusCode::OK,
                Json(json!({
                    "valid": result.success,
                    "txid": result.txid,
                    "fee": req.fee,
                    "status": if result.success { "accepted" } else { "rejected" },
                    "error": result.error
                })),
            )
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "valid": false,
                "error": e,
                "status": "rejected"
            })),
        ),
    }
}

/// Initialize genesis block
pub async fn init_genesis(
    State(_state): State<BlockchainState>,
    Json(_req): Json<InitGenesisRequest>,
) -> impl IntoResponse {
    let stats = global_chain().stats();
    (
        StatusCode::CREATED,
        Json(json!({
            "genesis_height": 0,
            "genesis_hash": stats.genesis_hash,
            "total_supply": stats.total_supply,
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
    let base_fee: u64 = 1000;
    let amount_fee = std::cmp::max((req.amount as f64 * 0.001) as u64, 100);
    let priority_fee = std::cmp::min((amount_fee as f64 * 0.2) as u64 + 1000, 5000);
    let input_count = req.input_count.unwrap_or(1);
    let complexity_fee = (input_count as u64) * 500;
    let total_fee = base_fee + amount_fee + priority_fee + complexity_fee;
    let network_congestion = 0.3;
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
