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
use std::sync::OnceLock;

/// Global referral engine (singleton, like global_chain)
fn global_referral() -> &'static ReferralEngine {
    static INSTANCE: OnceLock<ReferralEngine> = OnceLock::new();
    INSTANCE.get_or_init(ReferralEngine::new)
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
        let chain = global_chain();
        let stats = chain.stats();
        serde_json::json!({
            "node_id": &stats.genesis_hash[..16],
            "total_peers": 0,
            "status": "single_node",
            "height": stats.height,
            "protocol_version": 1
        })
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
            bolh_save,
            // Referral
            bolh_get_referral_code,
            bolh_apply_referral,
            bolh_referral_stats,
            bolh_referral_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
