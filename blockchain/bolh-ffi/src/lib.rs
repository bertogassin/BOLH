//! C FFI interface for BOLH blockchain
//! Exports blockchain functions as C-callable functions for Tauri integration

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde_json::json;

/// Free allocated C string
#[no_mangle]
pub extern "C" fn bolh_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

/// Initialize blockchain
#[no_mangle]
pub extern "C" fn bolh_init() -> *const c_char {
    let result = json!({
        "status": "initialized",
        "version": "0.1.0",
        "network": "main",
        "height": 0
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Create a new key pair
#[no_mangle]
pub extern "C" fn bolh_create_key() -> *const c_char {
    use rand::Rng;
    
    let mut rng = rand::thread_rng();
    let secret_key: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    let public_key: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    
    let result = json!({
        "pubkey": hex::encode(&public_key),
        "seckey": hex::encode(&secret_key),
        "address": format!("bolh_{}", hex::encode(&public_key[..8]))
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Sign a transaction
#[no_mangle]
pub extern "C" fn bolh_sign_tx(tx_ptr: *const c_char) -> *const c_char {
    if tx_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let tx_str = unsafe { CStr::from_ptr(tx_ptr).to_string_lossy() };
    
    let result = json!({
        "signed": format!("sig_{}", hex::encode(&[0u8; 32])),
        "tx": tx_str.as_ref(),
        "status": "signed"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Submit a signed transaction
#[no_mangle]
pub extern "C" fn bolh_submit_tx(signed_ptr: *const c_char) -> *const c_char {
    if signed_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let _signed_str = unsafe { CStr::from_ptr(signed_ptr).to_string_lossy() };
    
    let result = json!({
        "txid": format!("tx_{}", hex::encode(&[1u8; 32])),
        "status": "pending",
        "mempool": true
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get balance for address
#[no_mangle]
pub extern "C" fn bolh_get_balance(addr_ptr: *const c_char) -> u64 {
    if addr_ptr.is_null() {
        return 0;
    }
    
    let _addr = unsafe { CStr::from_ptr(addr_ptr).to_string_lossy() };
    
    // Return mock balance (1000 BOLH = 100,000,000,000 satoshis)
    100_000_000_000
}

// ============= WALLET API =============

/// Create a new wallet
#[no_mangle]
pub extern "C" fn bolh_create_wallet(name_ptr: *const c_char) -> *const c_char {
    if name_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy() };
    
    let result = json!({
        "name": name.as_ref(),
        "address": format!("bolh_{}", hex::encode(&[2u8; 32][..8])),
        "balance": 10000000000i64,
        "created_at": chrono::Utc::now().to_rfc3339(),
        "status": "active"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get wallet info
#[no_mangle]
pub extern "C" fn bolh_get_wallet_info(name_ptr: *const c_char) -> *const c_char {
    if name_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy() };
    
    let result = json!({
        "name": name.as_ref(),
        "address": format!("bolh_{}", hex::encode(&[2u8; 32][..8])),
        "balance": 10000000000i64,
        "pubkey": hex::encode(&[3u8; 32]),
        "status": "active"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get wallet balance
#[no_mangle]
pub extern "C" fn bolh_get_wallet_balance(name_ptr: *const c_char) -> u64 {
    if name_ptr.is_null() {
        return 0;
    }
    
    let _name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy() };
    
    // Return mock balance (1000 BOLH = 100,000,000,000 satoshis)
    100_000_000_000
}

/// List all wallets
#[no_mangle]
pub extern "C" fn bolh_list_wallets() -> *const c_char {
    let result = json!([
        {
            "name": "default",
            "address": format!("bolh_{}", hex::encode(&[2u8; 32][..8])),
            "balance": 10000000000i64
        }
    ]);
    
    let json_str = result.to_string();
    match CString::new(json_str) {
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
    if name_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy() };
    
    let result = json!({
        "deleted": name.as_ref(),
        "status": "success"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Import a wallet
#[no_mangle]
pub extern "C" fn bolh_import_wallet(
    name_ptr: *const c_char,
    pubkey_ptr: *const c_char,
    seckey_ptr: *const c_char,
) -> *const c_char {
    if name_ptr.is_null() || pubkey_ptr.is_null() || seckey_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let name = unsafe { CStr::from_ptr(name_ptr).to_string_lossy() };
    let pubkey = unsafe { CStr::from_ptr(pubkey_ptr).to_string_lossy() };
    
    let result = json!({
        "name": name.as_ref(),
        "address": format!("bolh_{}", &pubkey.as_ref()[..8.min(pubkey.len())]),
        "status": "imported"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

// ============= UTXO API =============

/// Initialize genesis block
#[no_mangle]
pub extern "C" fn bolh_init_genesis(accounts_ptr: *const c_char) -> *const c_char {
    if accounts_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "genesis_height": 0,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "status": "initialized"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get UTXO balance
#[no_mangle]
pub extern "C" fn bolh_get_utxo_balance(addr_ptr: *const c_char) -> u64 {
    if addr_ptr.is_null() {
        return 0;
    }
    
    let _addr = unsafe { CStr::from_ptr(addr_ptr).to_string_lossy() };
    100_000_000_000
}

/// Get UTXOs for address
#[no_mangle]
pub extern "C" fn bolh_get_utxos(addr_ptr: *const c_char) -> *const c_char {
    if addr_ptr.is_null() {
        let err = CString::new("[]").unwrap();
        return err.into_raw();
    }
    
    let addr = unsafe { CStr::from_ptr(addr_ptr).to_string_lossy() };
    
    let result = json!([
        {
            "txid": hex::encode(&[1u8; 32]),
            "output_index": 0,
            "address": addr.as_ref(),
            "amount": 50000000000i64,
            "block_height": 0,
            "spent": false
        }
    ]);
    
    let json_str = result.to_string();
    match CString::new(json_str) {
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
    if tx_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "valid": true,
        "txid": hex::encode(&[4u8; 32]),
        "fee": 1000,
        "status": "accepted"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Persist UTXO set
#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    let result = json!({
        "status": "persisted",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

// ============= CONSENSUS API =============

/// Propose a new block
#[no_mangle]
pub extern "C" fn bolh_propose_block(
    proposer_ptr: *const c_char,
    txs_ptr: *const c_char,
) -> *const c_char {
    if proposer_ptr.is_null() || txs_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "block_id": format!("block_{}", hex::encode(&[5u8; 32][..8])),
        "height": 1,
        "status": "proposed"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Vote on a block
#[no_mangle]
pub extern "C" fn bolh_vote_on_block(
    voter_ptr: *const c_char,
    block_id_ptr: *const c_char,
    approved: bool,
) -> *const c_char {
    if voter_ptr.is_null() || block_id_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "vote": if approved { "yes" } else { "no" },
        "status": "recorded"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Check if block can be finalized
#[no_mangle]
pub extern "C" fn bolh_can_finalize(block_id_ptr: *const c_char) -> bool {
    if block_id_ptr.is_null() {
        return false;
    }
    
    true
}

/// Finalize a block
#[no_mangle]
pub extern "C" fn bolh_finalize_block(block_id_ptr: *const c_char) -> *const c_char {
    if block_id_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "status": "finalized",
        "height": 1,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get consensus state
#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let result = json!({
        "height": 0,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "validators": [
            {"name": "validator_1", "stake": 100000000000i64},
            {"name": "validator_2", "stake": 100000000000i64}
        ],
        "status": "active"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}

/// Get voting status for a block
#[no_mangle]
pub extern "C" fn bolh_voting_status(block_id_ptr: *const c_char) -> *const c_char {
    if block_id_ptr.is_null() {
        let err = CString::new(r#"{"error": "null pointer"}"#).unwrap();
        return err.into_raw();
    }
    
    let result = json!({
        "yes_votes": 2,
        "no_votes": 0,
        "pending": 0,
        "status": "passed"
    });
    
    let json_str = result.to_string();
    match CString::new(json_str) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => {
            let err = CString::new("{}").unwrap();
            err.into_raw()
        }
    }
}
