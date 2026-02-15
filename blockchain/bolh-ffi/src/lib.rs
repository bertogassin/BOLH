//! C FFI interface for BOLH blockchain — connected to real chain engine
//!
//! All functions use the global BolhChain instance with:
//! - Real Ed25519 key generation
//! - Real balances (new wallet = 0 BOLH)
//! - Real transaction signing & validation
//! - Persistence to device storage

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde_json::json;

use bolh_core::chain::{global_chain, save_global_chain};
use bolh_core::types::Address;

/// Helper: create a C string from JSON value, returning "{}" on error
fn json_to_cstr(val: serde_json::Value) -> *const c_char {
    let s = val.to_string();
    match CString::new(s) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Helper: create a C string from a JSON error
fn error_cstr(msg: &str) -> *const c_char {
    json_to_cstr(json!({ "error": msg }))
}

/// Helper: read a C string pointer, return None if null
fn read_cstr(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() {
        return None;
    }
    unsafe { Some(CStr::from_ptr(ptr).to_string_lossy().into_owned()) }
}

// ============= LIFECYCLE =============

/// Free allocated C string
#[no_mangle]
pub extern "C" fn bolh_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

/// Initialize blockchain (loads from disk or creates genesis)
#[no_mangle]
pub extern "C" fn bolh_init() -> *const c_char {
    let chain = global_chain();
    let stats = chain.stats();
    json_to_cstr(json!({
        "status": "initialized",
        "version": bolh_core::VERSION,
        "network": "main",
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "total_accounts": stats.total_accounts,
        "genesis_hash": stats.genesis_hash
    }))
}

/// Save chain state to disk
#[no_mangle]
pub extern "C" fn bolh_save() -> *const c_char {
    match save_global_chain() {
        Ok(()) => json_to_cstr(json!({ "status": "saved" })),
        Err(e) => error_cstr(&e),
    }
}

// ============= WALLET API =============

/// Create a new wallet (real Ed25519 keypair, balance starts at 0)
#[no_mangle]
pub extern "C" fn bolh_create_wallet(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return error_cstr("null pointer");
    };

    let chain = global_chain();
    match chain.create_wallet(&name) {
        Ok(info) => {
            // Auto-save after wallet creation
            let _ = save_global_chain();
            json_to_cstr(json!({
                "name": info.name,
                "address": info.address,
                "pubkey": info.pubkey,
                "balance": 0,
                "created_at": info.created_at,
                "status": "created"
            }))
        }
        Err(e) => error_cstr(&e),
    }
}

/// Get wallet info
#[no_mangle]
pub extern "C" fn bolh_get_wallet_info(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return error_cstr("null pointer");
    };

    let chain = global_chain();
    match chain.get_wallet(&name) {
        Some(info) => {
            let balance = chain.get_wallet_balance(&name);
            json_to_cstr(json!({
                "name": info.name,
                "address": info.address,
                "pubkey": info.pubkey,
                "balance": balance,
                "status": "active"
            }))
        }
        None => error_cstr(&format!("Wallet '{}' not found", name)),
    }
}

/// Get wallet balance (returns real balance, 0 for new wallets)
#[no_mangle]
pub extern "C" fn bolh_get_wallet_balance(name_ptr: *const c_char) -> u64 {
    let Some(name) = read_cstr(name_ptr) else {
        return 0;
    };
    global_chain().get_wallet_balance(&name)
}

/// List all wallets
#[no_mangle]
pub extern "C" fn bolh_list_wallets() -> *const c_char {
    let chain = global_chain();
    let wallets = chain.list_wallets();
    let list: Vec<serde_json::Value> = wallets
        .iter()
        .map(|w| {
            let balance = chain.get_wallet_balance(&w.name);
            json!({
                "name": w.name,
                "address": w.address,
                "pubkey": w.pubkey,
                "balance": balance,
                "created_at": w.created_at
            })
        })
        .collect();

    let s = serde_json::to_string(&list).unwrap_or_else(|_| "[]".to_string());
    match CString::new(s) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("[]").unwrap();
            err.into_raw()
        }
    }
}

/// Delete a wallet
#[no_mangle]
pub extern "C" fn bolh_delete_wallet(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return error_cstr("null pointer");
    };

    let chain = global_chain();
    if chain.delete_wallet(&name) {
        let _ = save_global_chain();
        json_to_cstr(json!({ "deleted": name, "status": "success" }))
    } else {
        error_cstr(&format!("Wallet '{}' not found", name))
    }
}

/// Import a wallet from secret key
#[no_mangle]
pub extern "C" fn bolh_import_wallet(
    name_ptr: *const c_char,
    _pubkey_ptr: *const c_char,
    seckey_ptr: *const c_char,
) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return error_cstr("null pointer");
    };
    let Some(seckey) = read_cstr(seckey_ptr) else {
        return error_cstr("null secret key pointer");
    };

    let chain = global_chain();
    match chain.import_wallet(&name, &seckey) {
        Ok(info) => {
            let _ = save_global_chain();
            json_to_cstr(json!({
                "name": info.name,
                "address": info.address,
                "pubkey": info.pubkey,
                "status": "imported"
            }))
        }
        Err(e) => error_cstr(&e),
    }
}

// ============= KEY MANAGEMENT =============

/// Create a new key pair (standalone, not saved as wallet)
#[no_mangle]
pub extern "C" fn bolh_create_key() -> *const c_char {
    let wallet = bolh_core::wallet::Wallet::new("temp");
    let export = wallet.export();
    json_to_cstr(json!({
        "pubkey": export.pubkey,
        "seckey": export.seckey,
        "address": export.address
    }))
}

// ============= BALANCE API =============

/// Get balance for address (returns real on-chain balance)
#[no_mangle]
pub extern "C" fn bolh_get_balance(addr_ptr: *const c_char) -> u64 {
    let Some(addr_str) = read_cstr(addr_ptr) else {
        return 0;
    };

    let Ok(addr) = Address::from_bech32(&addr_str) else {
        return 0;
    };

    global_chain().get_balance(&addr)
}

// ============= TRANSACTION API =============

/// Sign a transaction (create transfer from wallet)
#[no_mangle]
pub extern "C" fn bolh_sign_tx(tx_ptr: *const c_char) -> *const c_char {
    let Some(tx_json) = read_cstr(tx_ptr) else {
        return error_cstr("null pointer");
    };

    // Parse: { "from_wallet": "name", "to": "bolh1...", "amount": 12345 }
    let Ok(params) = serde_json::from_str::<serde_json::Value>(&tx_json) else {
        return error_cstr("Invalid JSON");
    };

    let from_wallet = params["from_wallet"].as_str().unwrap_or("");
    let to_address = params["to"].as_str().unwrap_or("");
    let amount = params["amount"].as_u64().unwrap_or(0);

    if from_wallet.is_empty() || to_address.is_empty() || amount == 0 {
        return error_cstr("Missing from_wallet, to, or amount");
    }

    let chain = global_chain();
    match chain.create_transfer(from_wallet, to_address, amount) {
        Ok(tx) => {
            json_to_cstr(json!({
                "txid": hex::encode(tx.hash),
                "from": tx.from.to_bech32(),
                "to": tx.to.to_bech32(),
                "amount": tx.amount,
                "fee": tx.fee,
                "nonce": tx.nonce,
                "signature": hex::encode(&tx.signature),
                "status": "signed"
            }))
        }
        Err(e) => error_cstr(&e),
    }
}

/// Submit a signed transaction to the mempool
#[no_mangle]
pub extern "C" fn bolh_submit_tx(signed_ptr: *const c_char) -> *const c_char {
    let Some(tx_json) = read_cstr(signed_ptr) else {
        return error_cstr("null pointer");
    };

    // For now, sign+submit in one step using wallet name
    let Ok(params) = serde_json::from_str::<serde_json::Value>(&tx_json) else {
        return error_cstr("Invalid JSON");
    };

    let from_wallet = params["from_wallet"].as_str().unwrap_or("");
    let to_address = params["to"].as_str().unwrap_or("");
    let amount = params["amount"].as_u64().unwrap_or(0);

    if from_wallet.is_empty() || to_address.is_empty() || amount == 0 {
        return error_cstr("Missing from_wallet, to, or amount");
    }

    let chain = global_chain();
    let tx = match chain.create_transfer(from_wallet, to_address, amount) {
        Ok(tx) => tx,
        Err(e) => return error_cstr(&e),
    };

    let result = chain.submit_transaction(tx);
    json_to_cstr(json!({
        "txid": result.txid,
        "success": result.success,
        "error": result.error,
        "status": if result.success { "pending" } else { "rejected" },
        "mempool": result.success
    }))
}

// ============= UTXO / GENESIS API =============

/// Initialize genesis block (already done at chain init, this is a no-op)
#[no_mangle]
pub extern "C" fn bolh_init_genesis(_accounts_ptr: *const c_char) -> *const c_char {
    let chain = global_chain();
    let stats = chain.stats();
    json_to_cstr(json!({
        "genesis_height": 0,
        "genesis_hash": stats.genesis_hash,
        "total_supply": stats.total_supply,
        "status": "initialized"
    }))
}

/// Get UTXO balance (alias for get_balance)
#[no_mangle]
pub extern "C" fn bolh_get_utxo_balance(addr_ptr: *const c_char) -> u64 {
    bolh_get_balance(addr_ptr)
}

/// Get UTXOs for address (returns tx history as UTXO-like entries)
#[no_mangle]
pub extern "C" fn bolh_get_utxos(addr_ptr: *const c_char) -> *const c_char {
    let Some(addr_str) = read_cstr(addr_ptr) else {
        return json_to_cstr(json!([]));
    };

    let Ok(addr) = Address::from_bech32(&addr_str) else {
        return json_to_cstr(json!([]));
    };

    let chain = global_chain();
    let history = chain.get_tx_history(&addr);
    let utxos: Vec<serde_json::Value> = history
        .iter()
        .map(|tx| {
            json!({
                "txid": tx.txid,
                "address": tx.to,
                "amount": tx.amount,
                "block_height": tx.block_height,
                "spent": false
            })
        })
        .collect();

    let s = serde_json::to_string(&utxos).unwrap_or_else(|_| "[]".to_string());
    match CString::new(s) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("[]").unwrap();
            err.into_raw()
        }
    }
}

/// Validate and process transaction
#[no_mangle]
pub extern "C" fn bolh_validate_and_process_tx(tx_ptr: *const c_char) -> *const c_char {
    // Delegate to submit_tx
    bolh_submit_tx(tx_ptr)
}

/// Persist chain state
#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    bolh_save()
}

// ============= CONSENSUS API =============

/// Propose a new block
#[no_mangle]
pub extern "C" fn bolh_propose_block(
    proposer_ptr: *const c_char,
    _txs_ptr: *const c_char,
) -> *const c_char {
    let Some(proposer) = read_cstr(proposer_ptr) else {
        return error_cstr("null pointer");
    };

    let chain = global_chain();
    match chain.propose_block(&proposer) {
        Ok(block_id) => {
            json_to_cstr(json!({
                "block_id": block_id,
                "height": chain.height() + 1,
                "status": "proposed"
            }))
        }
        Err(e) => error_cstr(&e),
    }
}

/// Vote on a block
#[no_mangle]
pub extern "C" fn bolh_vote_on_block(
    voter_ptr: *const c_char,
    block_id_ptr: *const c_char,
    approved: bool,
) -> *const c_char {
    let Some(voter) = read_cstr(voter_ptr) else {
        return error_cstr("null pointer");
    };
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return error_cstr("null block_id pointer");
    };

    let chain = global_chain();
    match chain.vote_on_block(&voter, &block_id, approved) {
        Ok(()) => json_to_cstr(json!({
            "vote": if approved { "yes" } else { "no" },
            "status": "recorded"
        })),
        Err(e) => error_cstr(&e),
    }
}

/// Check if block can be finalized
#[no_mangle]
pub extern "C" fn bolh_can_finalize(block_id_ptr: *const c_char) -> bool {
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return false;
    };
    global_chain().can_finalize(&block_id).unwrap_or(false)
}

/// Finalize a block
#[no_mangle]
pub extern "C" fn bolh_finalize_block(block_id_ptr: *const c_char) -> *const c_char {
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return error_cstr("null pointer");
    };

    let chain = global_chain();
    match chain.finalize_block(&block_id) {
        Ok(height) => {
            let _ = save_global_chain();
            json_to_cstr(json!({
                "status": "finalized",
                "height": height,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))
        }
        Err(e) => error_cstr(&e),
    }
}

/// Get consensus state
#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let chain = global_chain();
    let stats = chain.stats();
    let validators = chain.active_validators();

    let vals: Vec<serde_json::Value> = validators
        .iter()
        .map(|v| {
            json!({
                "address": v.address.to_bech32(),
                "stake": v.stake,
                "is_active": v.is_active
            })
        })
        .collect();

    json_to_cstr(json!({
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "validators": vals,
        "status": "active"
    }))
}

/// Get voting status for a block (stub — real voting tracked in consensus runtime)
#[no_mangle]
pub extern "C" fn bolh_voting_status(block_id_ptr: *const c_char) -> *const c_char {
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return error_cstr("null pointer");
    };

    let can = global_chain().can_finalize(&block_id).unwrap_or(false);
    json_to_cstr(json!({
        "block_id": block_id,
        "can_finalize": can,
        "status": if can { "passed" } else { "pending" }
    }))
}

// ============= CHAIN STATS =============

/// Get chain statistics
#[no_mangle]
pub extern "C" fn bolh_chain_stats() -> *const c_char {
    let stats = global_chain().stats();
    json_to_cstr(json!({
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "total_accounts": stats.total_accounts,
        "total_transactions": stats.total_transactions,
        "genesis_hash": stats.genesis_hash
    }))
}
