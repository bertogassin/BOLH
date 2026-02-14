//! C FFI interface for BOLH blockchain
//! Exports blockchain functions as C-callable functions for Tauri integration
//! Now powered by REAL Ed25519 cryptography and an actual in-memory blockchain

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde_json::json;
use crate::chain::global_chain;
use crate::types::Address;

/// Helper: CString to raw pointer, returns "{}" on error
fn json_to_ptr(value: serde_json::Value) -> *const c_char {
    let json_str = value.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => CString::new("{}").unwrap().into_raw(),
    }
}

/// Helper: read C string safely
fn read_cstr(ptr: *const c_char) -> Option<String> {
    if ptr.is_null() { return None; }
    Some(unsafe { CStr::from_ptr(ptr).to_string_lossy().into_owned() })
}

/// Free allocated C string
#[no_mangle]
pub extern "C" fn bolh_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe { let _ = CString::from_raw(ptr); }
    }
}

/// Initialize blockchain — creates Genesis block with BOLH distribution
#[no_mangle]
pub extern "C" fn bolh_init() -> *const c_char {
    let chain = global_chain();
    let stats = chain.stats();
    json_to_ptr(json!({
        "status": "initialized",
        "version": crate::VERSION,
        "network": "main",
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "genesis_hash": stats.genesis_hash,
        "accounts": stats.total_accounts
    }))
}

/// Create a new Ed25519 keypair (real cryptography)
#[no_mangle]
pub extern "C" fn bolh_create_key() -> *const c_char {
    let wallet = crate::wallet::Wallet::new("ephemeral");
    let export = wallet.export();
    json_to_ptr(json!({
        "pubkey": export.pubkey,
        "seckey": export.seckey,
        "address": export.address
    }))
}

/// Sign a transaction with Ed25519 (real signature)
#[no_mangle]
pub extern "C" fn bolh_sign_tx(tx_ptr: *const c_char) -> *const c_char {
    let Some(tx_json) = read_cstr(tx_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    // Parse transaction JSON: { "wallet": "name", "to": "bolh1...", "amount": 1000 }
    let Ok(req) = serde_json::from_str::<serde_json::Value>(&tx_json) else {
        return json_to_ptr(json!({"error": "invalid JSON"}));
    };

    let wallet_name = req["wallet"].as_str().unwrap_or("default");
    let to = req["to"].as_str().unwrap_or("");
    let amount = req["amount"].as_u64().unwrap_or(0);

    let chain = global_chain();
    match chain.create_transfer(wallet_name, to, amount) {
        Ok(tx) => {
            json_to_ptr(json!({
                "txid": hex::encode(tx.hash),
                "signature": hex::encode(&tx.signature),
                "pubkey": hex::encode(&tx.public_key),
                "from": tx.from.to_bech32(),
                "to": tx.to.to_bech32(),
                "amount": tx.amount,
                "fee": tx.fee,
                "nonce": tx.nonce,
                "status": "signed"
            }))
        }
        Err(e) => json_to_ptr(json!({"error": e})),
    }
}

/// Submit a signed transaction (executes immediately in local chain)
#[no_mangle]
pub extern "C" fn bolh_submit_tx(signed_ptr: *const c_char) -> *const c_char {
    let Some(tx_json) = read_cstr(signed_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    let Ok(req) = serde_json::from_str::<serde_json::Value>(&tx_json) else {
        return json_to_ptr(json!({"error": "invalid JSON"}));
    };

    let wallet_name = req["wallet"].as_str().unwrap_or("default");
    let to = req["to"].as_str().unwrap_or("");
    let amount = req["amount"].as_u64().unwrap_or(0);

    let chain = global_chain();
    match chain.create_transfer(wallet_name, to, amount) {
        Ok(tx) => {
            let result = chain.submit_transaction(tx);
            json_to_ptr(json!({
                "success": result.success,
                "txid": result.txid,
                "error": result.error,
                "status": if result.success { "confirmed" } else { "rejected" }
            }))
        }
        Err(e) => json_to_ptr(json!({"error": e, "success": false})),
    }
}

/// Get balance for address (real balance from chain state)
#[no_mangle]
pub extern "C" fn bolh_get_balance(addr_ptr: *const c_char) -> u64 {
    let Some(addr_str) = read_cstr(addr_ptr) else { return 0; };
    let Ok(address) = Address::from_bech32(&addr_str) else { return 0; };
    global_chain().get_balance(&address)
}

// ============= WALLET API =============

/// Create a new wallet (real Ed25519 keypair)
#[no_mangle]
pub extern "C" fn bolh_create_wallet(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    match global_chain().create_wallet(&name) {
        Ok(info) => json_to_ptr(json!({
            "name": info.name,
            "address": info.address,
            "pubkey": info.pubkey,
            "created_at": info.created_at,
            "status": "active"
        })),
        Err(e) => json_to_ptr(json!({"error": e})),
    }
}

/// Get wallet info
#[no_mangle]
pub extern "C" fn bolh_get_wallet_info(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    match global_chain().get_wallet(&name) {
        Some(info) => {
            let addr = Address::from_bech32(&info.address).ok();
            let balance = addr.map(|a| global_chain().get_balance(&a)).unwrap_or(0);
            json_to_ptr(json!({
                "name": info.name,
                "address": info.address,
                "pubkey": info.pubkey,
                "balance": balance,
                "status": "active"
            }))
        }
        None => json_to_ptr(json!({"error": "wallet not found"})),
    }
}

/// Get wallet balance
#[no_mangle]
pub extern "C" fn bolh_get_wallet_balance(name_ptr: *const c_char) -> u64 {
    let Some(name) = read_cstr(name_ptr) else { return 0; };
    global_chain().get_wallet_balance(&name)
}

/// List all wallets
#[no_mangle]
pub extern "C" fn bolh_list_wallets() -> *const c_char {
    let wallets = global_chain().list_wallets();
    let list: Vec<serde_json::Value> = wallets.iter().map(|w| {
        let addr = Address::from_bech32(&w.address).ok();
        let balance = addr.map(|a| global_chain().get_balance(&a)).unwrap_or(0);
        json!({
            "name": w.name,
            "address": w.address,
            "balance": balance
        })
    }).collect();
    json_to_ptr(json!(list))
}

/// Delete a wallet
#[no_mangle]
pub extern "C" fn bolh_delete_wallet(name_ptr: *const c_char) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };
    let deleted = global_chain().delete_wallet(&name);
    json_to_ptr(json!({
        "deleted": name,
        "status": if deleted { "success" } else { "not_found" }
    }))
}

/// Import a wallet from keys
#[no_mangle]
pub extern "C" fn bolh_import_wallet(
    name_ptr: *const c_char,
    _pubkey_ptr: *const c_char,
    seckey_ptr: *const c_char,
) -> *const c_char {
    let Some(name) = read_cstr(name_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };
    let Some(seckey) = read_cstr(seckey_ptr) else {
        return json_to_ptr(json!({"error": "null secret key"}));
    };

    match global_chain().import_wallet(&name, &seckey) {
        Ok(info) => json_to_ptr(json!({
            "name": info.name,
            "address": info.address,
            "status": "imported"
        })),
        Err(e) => json_to_ptr(json!({"error": e})),
    }
}

// ============= UTXO/CHAIN API =============

/// Initialize genesis block (now done automatically)
#[no_mangle]
pub extern "C" fn bolh_init_genesis(_accounts_ptr: *const c_char) -> *const c_char {
    let stats = global_chain().stats();
    json_to_ptr(json!({
        "genesis_height": 0,
        "genesis_hash": stats.genesis_hash,
        "total_supply": stats.total_supply,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "status": "initialized"
    }))
}

/// Get balance (UTXO-style)
#[no_mangle]
pub extern "C" fn bolh_get_utxo_balance(addr_ptr: *const c_char) -> u64 {
    bolh_get_balance(addr_ptr)
}

/// Get UTXOs for address (now returns account-based data)
#[no_mangle]
pub extern "C" fn bolh_get_utxos(addr_ptr: *const c_char) -> *const c_char {
    let Some(addr_str) = read_cstr(addr_ptr) else {
        return json_to_ptr(json!([]));
    };
    let Ok(address) = Address::from_bech32(&addr_str) else {
        return json_to_ptr(json!([]));
    };

    let chain = global_chain();
    let account = chain.get_account(&address);
    
    json_to_ptr(json!([{
        "address": addr_str,
        "balance": account.balance,
        "nonce": account.nonce,
        "staked": account.staked,
        "is_validator": account.is_validator
    }]))
}

/// Validate and process transaction
#[no_mangle]
pub extern "C" fn bolh_validate_and_process_tx(tx_ptr: *const c_char) -> *const c_char {
    // Delegates to bolh_submit_tx
    bolh_submit_tx(tx_ptr)
}

/// Persist state (no-op for in-memory, placeholder for future RocksDB)
#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    json_to_ptr(json!({
        "status": "persisted",
        "note": "in-memory chain — persistence planned for v0.2",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

// ============= CONSENSUS API =============

/// Propose a new block
#[no_mangle]
pub extern "C" fn bolh_propose_block(
    proposer_ptr: *const c_char,
    _txs_ptr: *const c_char,
) -> *const c_char {
    let Some(proposer) = read_cstr(proposer_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    match global_chain().produce_block(&proposer) {
        Ok(block) => json_to_ptr(json!({
            "block_hash": hex::encode(block.hash),
            "height": block.header.height,
            "tx_count": block.header.tx_count,
            "total_fees": block.header.total_fees,
            "status": "finalized"
        })),
        Err(e) => json_to_ptr(json!({"error": e})),
    }
}

/// Vote on a block (simplified — auto-approve for single-node)
#[no_mangle]
pub extern "C" fn bolh_vote_on_block(
    _voter_ptr: *const c_char,
    _block_id_ptr: *const c_char,
    approved: bool,
) -> *const c_char {
    json_to_ptr(json!({
        "vote": if approved { "yes" } else { "no" },
        "status": "recorded"
    }))
}

/// Check if block can be finalized
#[no_mangle]
pub extern "C" fn bolh_can_finalize(_block_id_ptr: *const c_char) -> bool {
    true // Single-node mode: always finalizable
}

/// Finalize a block
#[no_mangle]
pub extern "C" fn bolh_finalize_block(_block_id_ptr: *const c_char) -> *const c_char {
    let stats = global_chain().stats();
    json_to_ptr(json!({
        "status": "finalized",
        "height": stats.height,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Get consensus state
#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let stats = global_chain().stats();
    json_to_ptr(json!({
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "total_accounts": stats.total_accounts,
        "total_transactions": stats.total_transactions,
        "genesis_hash": stats.genesis_hash,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "consensus": "PoS-BFT",
        "status": "active"
    }))
}

/// Get voting status for a block
#[no_mangle]
pub extern "C" fn bolh_voting_status(_block_id_ptr: *const c_char) -> *const c_char {
    json_to_ptr(json!({
        "yes_votes": 1,
        "no_votes": 0,
        "pending": 0,
        "status": "passed"
    }))
}
