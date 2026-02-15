// Guardio Mobile App - Tauri Backend Library
// Provides native APIs, Rust core integration, and BOLH blockchain bridge

use guardio_core::{
    crypto::CryptoService,
    geo::GeoService,
    validation::ValidationService,
};

// ============= BOLH Blockchain Bridge =============
// All commands are async + spawn_blocking to prevent blocking the Android WebView IPC bridge
use bolh_core::chain::{global_chain, save_global_chain};
use bolh_core::types::Address;
use bolh_core::referral::ReferralEngine;
use bolh_core::network::{BolhNode, NodeConfig};
use bolh_core::delivery::DeliveryEngine;
use bolh_core::rental::RentalEngine;
use bolh_core::internship::InternshipEngine;
use bolh_core::proxy_expert::ProxyExpertEngine;
use bolh_core::contract::ContractEngine;
use std::sync::OnceLock;

/// Global referral engine (singleton, like global_chain)
fn global_referral() -> &'static ReferralEngine {
    static INSTANCE: OnceLock<ReferralEngine> = OnceLock::new();
    INSTANCE.get_or_init(ReferralEngine::new)
}

/// Global P2P node (singleton)
fn global_node() -> &'static BolhNode {
    static NODE: OnceLock<BolhNode> = OnceLock::new();
    NODE.get_or_init(|| {
        let chain = global_chain();
        let node_id = chain.stats().genesis_hash[..16].to_string();
        BolhNode::new(node_id, NodeConfig::default())
    })
}

/// Global business module engines (singletons)
fn global_delivery() -> &'static DeliveryEngine {
    static INSTANCE: OnceLock<DeliveryEngine> = OnceLock::new();
    INSTANCE.get_or_init(DeliveryEngine::new)
}
fn global_rental() -> &'static RentalEngine {
    static INSTANCE: OnceLock<RentalEngine> = OnceLock::new();
    INSTANCE.get_or_init(RentalEngine::new)
}
fn global_internship() -> &'static InternshipEngine {
    static INSTANCE: OnceLock<InternshipEngine> = OnceLock::new();
    INSTANCE.get_or_init(InternshipEngine::new)
}
fn global_expert() -> &'static ProxyExpertEngine {
    static INSTANCE: OnceLock<ProxyExpertEngine> = OnceLock::new();
    INSTANCE.get_or_init(ProxyExpertEngine::new)
}
fn global_contracts() -> &'static ContractEngine {
    static INSTANCE: OnceLock<ContractEngine> = OnceLock::new();
    INSTANCE.get_or_init(ContractEngine::new)
}

#[tauri::command]
async fn bolh_init() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let chain = global_chain();
        let stats = chain.stats();
        serde_json::json!({
            "status": "initialized",
            "version": bolh_core::VERSION,
            "network": "main",
            "height": stats.height,
            "total_supply": stats.total_supply,
            "circulating_supply": stats.circulating_supply,
            "genesis_hash": stats.genesis_hash,
            "accounts": stats.total_accounts,
            "total_transactions": stats.total_transactions
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_chain_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let chain = global_chain();
        let stats = chain.stats();
        serde_json::json!({
            "height": stats.height,
            "total_supply": stats.total_supply,
            "circulating_supply": stats.circulating_supply,
            "total_accounts": stats.total_accounts,
            "total_transactions": stats.total_transactions,
            "genesis_hash": stats.genesis_hash,
            "consensus": "PoS-BFT",
            "status": "active"
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_create_wallet(name: String) -> Result<serde_json::Value, String> {

    tauri::async_runtime::spawn_blocking(move || -> Result<serde_json::Value, String> {

        println!("Создание кошелька: {}", name);

        let info = global_chain()
            .create_wallet(&name)
            .map_err(|e| {
                eprintln!("Ошибка создания кошелька: {}", e);
                e.to_string()
            })?;

        save_global_chain()
            .map_err(|e| {
                eprintln!("Ошибка сохранения chain: {}", e);
                e.to_string()
            })?;

        println!("Кошелек успешно создан: {}", info.address);

        Ok(serde_json::json!({
            "name": info.name,
            "address": info.address,
            "pubkey": info.pubkey,
            "created_at": info.created_at,
            "status": "active"
        }))

    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn bolh_get_wallet(name: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        match global_chain().get_wallet(&name) {
            Some(info) => {
                let balance = Address::from_bech32(&info.address)
                    .map(|a| global_chain().get_balance(&a))
                    .unwrap_or(0);
                serde_json::json!({
                    "name": info.name,
                    "address": info.address,
                    "pubkey": info.pubkey,
                    "balance": balance,
                    "created_at": info.created_at,
                    "status": "active"
                })
            }
            None => serde_json::json!({"error": "wallet not found"}),
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_list_wallets() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let wallets = global_chain().list_wallets();
        let list: Vec<serde_json::Value> = wallets.iter().map(|w| {
            let balance = Address::from_bech32(&w.address)
                .map(|a| global_chain().get_balance(&a))
                .unwrap_or(0);
            serde_json::json!({
                "name": w.name,
                "address": w.address,
                "balance": balance
            })
        }).collect();
        serde_json::json!(list)
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_send_tx(wallet_name: String, to: String, amount: u64) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        match chain.create_transfer(&wallet_name, &to, amount) {
            Ok(tx) => {
                let result = chain.submit_transaction(tx);
                if result.success {
                    // Single-node convenience: finalize immediately
                    let _ = chain.produce_block(&wallet_name);
                    let _ = save_global_chain();
                }
                serde_json::json!({
                    "success": result.success,
                    "txid": result.txid,
                    "error": result.error
                })
            }
            Err(e) => serde_json::json!({"success": false, "error": e}),
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_get_balance(address: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Address::from_bech32(&address)
            .map(|a| global_chain().get_balance(&a))
            .unwrap_or(0)
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_tx_history(address: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(addr) = Address::from_bech32(&address) else {
            return serde_json::json!({"transactions": [], "count": 0});
        };
        let history = global_chain().get_tx_history(&addr);
        let txs: Vec<serde_json::Value> = history.iter().map(|r| {
            serde_json::json!({
                "txid": r.txid,
                "from": r.from,
                "to": r.to,
                "amount": r.amount,
                "fee": r.fee,
                "type": r.tx_type,
                "timestamp": r.timestamp,
                "block_height": r.block_height
            })
        }).collect();
        serde_json::json!({
            "transactions": txs,
            "count": txs.len()
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_network_info() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let node = global_node();
        let ns = node.network_stats();
        serde_json::json!({
            "node_id": ns.node_id,
            "total_peers": ns.total_peers,
            "inbound_peers": ns.inbound_peers,
            "outbound_peers": ns.outbound_peers,
            "known_peers": ns.known_peers,
            "is_running": ns.is_running,
            "listen_addr": ns.listen_addr,
            "protocol_version": 1,
            "status": if ns.is_running { "running" } else { "stopped" }
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_p2p_start() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let node = global_node();
        let chain = global_chain();
        match node.start(chain) {
            Ok(()) => serde_json::json!({"success": true, "listen_addr": node.config.listen_addr}),
            Err(e) => serde_json::json!({"success": false, "error": e}),
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_p2p_stop() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        global_node().stop();
        serde_json::json!({"success": true})
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_p2p_connect(addr: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let node = global_node();
        let chain = global_chain();
        match node.connect_to_peer(&addr, chain) {
            Ok(peer_id) => serde_json::json!({"success": true, "peer_id": peer_id}),
            Err(e) => serde_json::json!({"success": false, "error": e}),
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_p2p_peers() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let node = global_node();
        let peers: Vec<serde_json::Value> = node.connected_peers().iter().map(|p| {
            serde_json::json!({
                "id": p.id,
                "addr": p.addr,
                "version": p.version,
                "best_height": p.best_height
            })
        }).collect();
        serde_json::json!({"peers": peers, "count": peers.len()})
    }).await.map_err(|e| e.to_string())
}

// ============= Block Explorer =============

/// Hex-encode a byte slice (avoids adding hex crate to Tauri)
fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
async fn bolh_get_block(height: u64) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        match chain.get_block(height) {
            Some(block) => {
                let hash = block.header.compute_hash();
                let txs: Vec<serde_json::Value> = block.transactions.iter().map(|tx| {
                    serde_json::json!({
                        "from": tx.from.to_bech32(),
                        "to": tx.to.to_bech32(),
                        "amount": tx.amount,
                        "fee": tx.fee,
                        "nonce": tx.nonce,
                        "tx_type": format!("{:?}", tx.tx_type),
                    })
                }).collect();
                serde_json::json!({
                    "height": block.header.height,
                    "hash": to_hex(&hash),
                    "prev_hash": to_hex(&block.header.prev_hash),
                    "validator": block.header.validator.to_bech32(),
                    "timestamp": block.header.timestamp,
                    "tx_count": block.header.tx_count,
                    "total_fees": block.header.total_fees,
                    "state_root": to_hex(&block.header.state_root),
                    "transactions": txs,
                })
            }
            None => serde_json::json!({"error": "Block not found"})
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_get_blocks(from_height: u64, count: u64) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        let h = chain.height();
        let start = from_height.min(h);
        let end = (start + count).min(h + 1);
        let mut blocks: Vec<serde_json::Value> = Vec::new();
        // Iterate in reverse (newest first)
        for i in (start..end).rev() {
            if let Some(block) = chain.get_block(i) {
                let hash = block.header.compute_hash();
                blocks.push(serde_json::json!({
                    "height": block.header.height,
                    "hash": to_hex(&hash)[..12].to_string(),
                    "validator": block.header.validator.to_bech32(),
                    "timestamp": block.header.timestamp,
                    "tx_count": block.header.tx_count,
                    "total_fees": block.header.total_fees,
                }));
            }
        }
        serde_json::json!({"blocks": blocks, "chain_height": h})
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_explorer_summary() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let chain = global_chain();
        let stats = chain.stats();
        let cstats = global_contracts().stats();
        let h = chain.height();

        // Get last 5 blocks
        let mut recent_blocks: Vec<serde_json::Value> = Vec::new();
        let start = if h >= 5 { h - 4 } else { 0 };
        for i in (start..=h).rev() {
            if let Some(block) = chain.get_block(i) {
                let hash = block.header.compute_hash();
                recent_blocks.push(serde_json::json!({
                    "height": block.header.height,
                    "hash": to_hex(&hash)[..12].to_string(),
                    "tx_count": block.header.tx_count,
                    "timestamp": block.header.timestamp,
                    "validator": block.header.validator.to_bech32(),
                }));
            }
        }

        serde_json::json!({
            "chain": {
                "height": stats.height,
                "total_supply": stats.total_supply,
                "circulating_supply": stats.circulating_supply,
                "total_accounts": stats.total_accounts,
                "total_transactions": stats.total_transactions,
                "genesis_hash": stats.genesis_hash,
            },
            "contracts": {
                "total_created": cstats.total_created,
                "active_count": cstats.active_count,
                "total_locked": cstats.total_locked,
                "total_settled": cstats.total_settled,
            },
            "recent_blocks": recent_blocks,
        })
    }).await.map_err(|e| e.to_string())
}

// ============= Smart Contracts =============

#[tauri::command]
async fn bolh_create_escrow(client_addr: String, provider_addr: String, amount: u64, description: String, deadline: u64) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client = Address::from_bech32(&client_addr).map_err(|e| format!("Bad client addr: {}", e))?;
        let provider = Address::from_bech32(&provider_addr).map_err(|e| format!("Bad provider addr: {}", e))?;
        let result = global_contracts().create_escrow(&client, &provider, amount, &description, deadline);
        Ok(serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn bolh_fund_contract(contract_id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let result = global_contracts().fund(&contract_id);
        serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_complete_service(contract_id: String, provider_addr: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let provider = Address::from_bech32(&provider_addr).map_err(|e| format!("Bad addr: {}", e))?;
        let result = global_contracts().complete_service(&contract_id, &provider);
        Ok(serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn bolh_confirm_contract(contract_id: String, client_addr: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let client = Address::from_bech32(&client_addr).map_err(|e| format!("Bad addr: {}", e))?;
        let result = global_contracts().confirm_completion(&contract_id, &client);
        Ok(serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn bolh_cancel_contract(contract_id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let result = global_contracts().cancel(&contract_id);
        serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_dispute_contract(contract_id: String, reason: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let result = global_contracts().dispute(&contract_id, &reason);
        serde_json::json!({
            "success": result.success,
            "contract_id": result.contract_id,
            "message": result.message
        })
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_get_contract(contract_id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        match global_contracts().get_contract(&contract_id) {
            Some(c) => serde_json::to_value(c).unwrap_or_default(),
            None => serde_json::json!({"error": "Not found"})
        }
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_my_contracts(address: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(addr) = Address::from_bech32(&address) else {
            return serde_json::json!({"contracts": [], "count": 0});
        };
        let contracts = global_contracts().get_contracts_for(&addr);
        let list: Vec<serde_json::Value> = contracts.iter().map(|c| {
            serde_json::json!({
                "id": c.id,
                "type": format!("{:?}", c.contract_type),
                "state": format!("{:?}", c.state),
                "client": c.client,
                "provider": c.provider,
                "amount": c.amount,
                "description": c.description,
                "created_at": c.created_at,
                "deadline": c.deadline,
                "client_approved": c.client_approved,
                "provider_approved": c.provider_approved,
                "dispute_reason": c.dispute_reason,
            })
        }).collect();
        serde_json::json!({"contracts": list, "count": list.len()})
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_contract_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let stats = global_contracts().stats();
        serde_json::to_value(stats).unwrap_or_default()
    }).await.map_err(|e| e.to_string())
}

// ============= Business Module Stats =============

#[tauri::command]
async fn bolh_delivery_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let stats = global_delivery().stats();
        serde_json::to_value(stats).unwrap_or_default()
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_rental_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let stats = global_rental().stats();
        serde_json::to_value(stats).unwrap_or_default()
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_internship_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let stats = global_internship().stats();
        serde_json::to_value(stats).unwrap_or_default()
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_expert_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let stats = global_expert().stats();
        serde_json::to_value(stats).unwrap_or_default()
    }).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn bolh_save() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        match save_global_chain() {
            Ok(()) => serde_json::json!({"status": "saved"}),
            Err(e) => serde_json::json!({"status": "error", "error": e}),
        }
    }).await.map_err(|e| e.to_string())
}

// ============= Referral System =============

/// Generate or get referral code for current wallet
#[tauri::command]
async fn bolh_get_referral_code(wallet_name: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        let info = chain.get_wallet(&wallet_name).ok_or("Wallet not found")?;
        let addr = Address::from_bech32(&info.address).map_err(|e| e.to_string())?;
        let engine = global_referral();
        let code = engine.generate_code(&addr)?;
        let count = engine.get_referral_count(&addr);
        let earned = engine.get_total_earned(&addr);
        Ok(serde_json::json!({
            "code": code,
            "referral_count": count,
            "total_earned": earned,
            "address": info.address
        }))
    }).await.map_err(|e| e.to_string())?
}

/// Apply a referral code (new user enters someone else's code)
#[tauri::command]
async fn bolh_apply_referral(wallet_name: String, referral_code: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        let info = chain.get_wallet(&wallet_name).ok_or("Wallet not found")?;
        let invitee_addr = Address::from_bech32(&info.address).map_err(|e| e.to_string())?;
        let user_count = chain.user_count();
        let engine = global_referral();

        // Process referral in engine (validation, anti-fraud, history)
        let result = engine.process_referral(&invitee_addr, &referral_code, user_count);

        if result.success {
            // Get inviter address from code
            if let Some(code_info) = engine.get_code_info(&referral_code) {
                let inviter_addr = Address::from_bech32(&code_info.owner).map_err(|e| e.to_string())?;
                // Actually distribute rewards on-chain from referral pool
                match chain.process_referral(&inviter_addr, &invitee_addr) {
                    Ok(reward) => {
                        let _ = save_global_chain();
                        return Ok(serde_json::json!({
                            "success": true,
                            "inviter_reward": reward,
                            "invitee_reward": reward,
                            "tier": result.tier,
                            "message": result.message,
                            "new_balance": chain.get_balance(&invitee_addr)
                        }));
                    }
                    Err(e) => {
                        return Ok(serde_json::json!({
                            "success": false,
                            "message": format!("Chain reward failed: {}", e)
                        }));
                    }
                }
            }
        }

        Ok(serde_json::json!({
            "success": result.success,
            "inviter_reward": result.inviter_reward,
            "invitee_reward": result.invitee_reward,
            "tier": result.tier,
            "message": result.message
        }))
    }).await.map_err(|e| e.to_string())?
}

/// Get referral program stats
#[tauri::command]
async fn bolh_referral_stats() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let chain = global_chain();
        let user_count = chain.user_count();
        let engine = global_referral();
        let stats = engine.stats(user_count);

        let top: Vec<serde_json::Value> = stats.top_referrers.iter().map(|r| {
            serde_json::json!({
                "address": r.address,
                "code": r.code,
                "referral_count": r.referral_count,
                "total_earned": r.total_earned
            })
        }).collect();

        serde_json::json!({
            "total_referrals": stats.total_referrals,
            "total_rewards_distributed": stats.total_rewards_distributed,
            "pool_remaining": stats.pool_remaining,
            "pool_total": stats.pool_total,
            "pool_used_percent": stats.pool_used_percent,
            "current_tier": stats.current_tier,
            "current_reward_per_person": stats.current_reward_per_person,
            "total_codes_created": stats.total_codes_created,
            "user_count": user_count,
            "top_referrers": top
        })
    }).await.map_err(|e| e.to_string())
}

/// Get referral history for a wallet
#[tauri::command]
async fn bolh_referral_history(wallet_name: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        let info = chain.get_wallet(&wallet_name).ok_or("Wallet not found")?;
        let addr = Address::from_bech32(&info.address).map_err(|e| e.to_string())?;
        let engine = global_referral();

        let referrals = engine.get_referrals_by(&addr);
        let list: Vec<serde_json::Value> = referrals.iter().map(|r| {
            serde_json::json!({
                "invitee": r.invitee,
                "reward": r.reward,
                "tier": r.tier,
                "timestamp": r.timestamp,
                "user_count_at_time": r.user_count_at_time
            })
        }).collect();

        let inviter = engine.get_inviter(&addr);

        Ok(serde_json::json!({
            "referrals": list,
            "count": list.len(),
            "invited_by": inviter
        }))
    }).await.map_err(|e| e.to_string())?
}

/// Delete wallet
#[tauri::command]
async fn bolh_delete_wallet(name: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chain = global_chain();
        if chain.delete_wallet(&name) {
            let _ = save_global_chain();
            serde_json::json!({"deleted": name, "status": "success"})
        } else {
            serde_json::json!({"error": format!("Wallet '{}' not found", name)})
        }
    }).await.map_err(|e| e.to_string())
}

// Crypto commands
#[tauri::command]
fn encrypt_data(plaintext: String, key: String) -> Result<String, String> {
    CryptoService::encrypt_aes256(&plaintext, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn decrypt_data(ciphertext: String, key: String) -> Result<String, String> {
    CryptoService::decrypt_aes256(&ciphertext, &key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    CryptoService::hash_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> bool {
    CryptoService::verify_password(&password, &hash)
}

#[tauri::command]
fn generate_key() -> String {
    CryptoService::generate_key()
}

// Geo commands
#[tauri::command]
fn calculate_distance(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    GeoService::calculate_distance(lat1, lng1, lat2, lng2)
}

#[tauri::command]
fn point_in_geofence(
    point_lat: f64,
    point_lng: f64,
    center_lat: f64,
    center_lng: f64,
    radius_km: f64,
) -> bool {
    GeoService::point_in_geofence(point_lat, point_lng, center_lat, center_lng, radius_km)
}

// Validation commands
#[tauri::command]
fn validate_phone(phone: String) -> bool {
    ValidationService::validate_phone_kz(&phone)
}

#[tauri::command]
fn validate_email(email: String) -> bool {
    ValidationService::validate_email(&email)
}

#[tauri::command]
fn validate_iin(iin: String) -> bool {
    ValidationService::validate_iin(&iin)
}

#[tauri::command]
fn validate_card(card: String) -> bool {
    ValidationService::validate_card(&card)
}

#[tauri::command]
fn check_password_strength(password: String) -> serde_json::Value {
    let strength = ValidationService::check_password_strength(&password);
    serde_json::json!({
        "level": format!("{:?}", strength.level),
        "score": strength.score,
        "has_lowercase": strength.has_lowercase,
        "has_uppercase": strength.has_uppercase,
        "has_digit": strength.has_digit,
        "has_special": strength.has_special,
        "length": strength.length
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Crypto
            encrypt_data,
            decrypt_data,
            hash_password,
            verify_password,
            generate_key,
            // Geo
            calculate_distance,
            point_in_geofence,
            // Validation
            validate_phone,
            validate_email,
            validate_iin,
            validate_card,
            check_password_strength,
            // BOLH Blockchain
            bolh_init,
            bolh_chain_stats,
            bolh_create_wallet,
            bolh_get_wallet,
            bolh_list_wallets,
            bolh_delete_wallet,
            bolh_send_tx,
            bolh_get_balance,
            bolh_tx_history,
            bolh_network_info,
            bolh_p2p_start,
            bolh_p2p_stop,
            bolh_p2p_connect,
            bolh_p2p_peers,
            bolh_save,
            // Block Explorer
            bolh_get_block,
            bolh_get_blocks,
            bolh_explorer_summary,
            // Smart Contracts
            bolh_create_escrow,
            bolh_fund_contract,
            bolh_complete_service,
            bolh_confirm_contract,
            bolh_cancel_contract,
            bolh_dispute_contract,
            bolh_get_contract,
            bolh_my_contracts,
            bolh_contract_stats,
            // Business modules
            bolh_delivery_stats,
            bolh_rental_stats,
            bolh_internship_stats,
            bolh_expert_stats,
            // Referral
            bolh_get_referral_code,
            bolh_apply_referral,
            bolh_referral_stats,
            bolh_referral_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
