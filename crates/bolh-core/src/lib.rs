use libc::c_char;
use std::ffi::{CStr, CString};
use std::os::raw::c_ulong;

pub mod mempool;
pub mod consensus;
pub mod network;
pub mod crypto;
pub mod storage;
pub mod transaction;
pub mod utxo;
pub mod wallet;

fn into_raw(s: String) -> *const c_char {
    CString::new(s).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn bolh_free(ptr: *mut c_char) {
    if ptr.is_null() { return; }
    unsafe { let _ = CString::from_raw(ptr); }
}

#[no_mangle]
pub extern "C" fn bolh_init() -> *const c_char {
    // PoC init — in real code initialize state, DB, network threads
    into_raw("ok".to_string())
}

#[no_mangle]
pub extern "C" fn bolh_create_key() -> *const c_char {
    // PoC: return a demo keypair (replace with PQC keygen)
    let (pk, sk) = crypto::generate_keypair();
    let json = format!("{{\"pubkey\":\"{}\",\"seckey\":\"{}\"}}", pk, sk);
    into_raw(json)
}

#[no_mangle]
pub extern "C" fn bolh_sign_tx(tx_ptr: *const c_char) -> *const c_char {
    if tx_ptr.is_null() { return into_raw("{\"error\":\"null input\"}".to_string()); }
    let cstr = unsafe { CStr::from_ptr(tx_ptr) };
    let tx = match cstr.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid utf8\"}".to_string()),
    };
    // Use crypto scaffold to sign (demo secret used for PoC)
    let demo_sk = "BOLH_DEMO_SECKEY_9876543210";
    let sig = crypto::sign(tx, demo_sk);
    let json = format!("{{\"signed_tx\":\"{}\"}}", sig);
    into_raw(json)
}

#[no_mangle]
pub extern "C" fn bolh_submit_tx(signed_ptr: *const c_char) -> *const c_char {
    if signed_ptr.is_null() { return into_raw("{\"error\":\"null input\"}".to_string()); }
    let cstr = unsafe { CStr::from_ptr(signed_ptr) };
    let signed = match cstr.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid utf8\"}".to_string()),
    };
    // PoC: produce fake txid from hash of string
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    signed.hash(&mut hasher);
    let txid = hasher.finish();
    let json = format!("{{\"txid\":\"{}\"}}", txid);
    into_raw(json)
}

#[no_mangle]
pub extern "C" fn bolh_get_balance(addr_ptr: *const c_char) -> c_ulong {
    if addr_ptr.is_null() { return 0; }
    let cstr = unsafe { CStr::from_ptr(addr_ptr) };
    let addr = match cstr.to_str() {
        Ok(s) => s,
        Err(_) => return 0,
    };
    // Use storage to get balance
    storage::get_balance(addr).unwrap_or(0) as c_ulong
}

// --- PoC mempool / consensus bindings ---

#[no_mangle]
pub extern "C" fn bolh_mempool_size() -> c_ulong {
    mempool::size() as c_ulong
}

#[no_mangle]
pub extern "C" fn bolh_submit_tx_to_mempool(tx_ptr: *const c_char) -> *const c_char {
    if tx_ptr.is_null() { return into_raw("{\"error\":\"null input\"}".to_string()); }
    let cstr = unsafe { CStr::from_ptr(tx_ptr) };
    let tx_json = match cstr.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid utf8\"}".to_string()),
    };
    // Parse and submit transaction
    match mempool::submit_tx_json(tx_json) {
        Ok(new_size) => {
            let json = format!("{{\"status\":\"ok\",\"mempool_size\":{}}}", new_size);
            into_raw(json)
        },
        Err(e) => {
            let json = format!("{{\"error\":\"{}\"}}", e);
            into_raw(json)
        }
    }
}

#[no_mangle]
pub extern "C" fn bolh_create_block_from_mempool() -> *const c_char {
    let txs = mempool::drain_all();
    let block_id = consensus::create_block_id(&txs);
    let json = format!("{{\"block_id\":\"{}\",\"tx_count\":{}}}", block_id, txs.len());
    // Save block to storage with serialized transactions
    let tx_jsons: Vec<String> = txs.iter()
        .filter_map(|tx| tx.to_json().ok())
        .collect();
    let block_data = format!("{{\"txs\":[{}]}}", tx_jsons.join(","));
    let _ = storage::save_block(&block_id, &block_data);
    into_raw(json)
}

#[no_mangle]
pub extern "C" fn bolh_network_start(port: u16) -> *const c_char {
    match network::start(port) {
        Ok(()) => into_raw("{\"status\":\"network_started\"}".to_string()),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_network_stop() -> *const c_char {
    match network::stop() {
        Ok(()) => into_raw("{\"status\":\"network_stopped\"}".to_string()),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_network_peers() -> *const c_char {
    let peers = network::peers();
    let joined = peers.join(",");
    into_raw(format!("{{\"peers\":\"{}\"}}", joined))
}

// --- BFT Consensus bindings ---

#[no_mangle]
pub extern "C" fn bolh_propose_block(proposer_ptr: *const c_char, prev_block_ptr: *const c_char) -> *const c_char {
    if proposer_ptr.is_null() || prev_block_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let proposer = unsafe { CStr::from_ptr(proposer_ptr) }.to_str().unwrap_or("unknown");
    let prev_block = unsafe { CStr::from_ptr(prev_block_ptr) }.to_str().unwrap_or("genesis");
    
    // Get transactions from mempool
    let txs = mempool::drain_all();
    
    // Create proposal
    let proposal = consensus::propose_block(txs, proposer, prev_block);
    
    // Serialize proposal
    match serde_json::to_string(&proposal) {
        Ok(json) => into_raw(json),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_vote_on_block(block_id_ptr: *const c_char, validator_ptr: *const c_char, approve: bool) -> *const c_char {
    if block_id_ptr.is_null() || validator_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let block_id = match unsafe { CStr::from_ptr(block_id_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid block_id\"}".to_string()),
    };
    
    let validator = match unsafe { CStr::from_ptr(validator_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid validator\"}".to_string()),
    };
    
    match consensus::vote_on_block(block_id, validator, approve) {
        Ok(vote) => {
            match serde_json::to_string(&vote) {
                Ok(json) => into_raw(json),
                Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
            }
        },
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_can_finalize(block_id_ptr: *const c_char) -> bool {
    if block_id_ptr.is_null() {
        return false;
    }
    
    let block_id = match unsafe { CStr::from_ptr(block_id_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    consensus::can_finalize(block_id)
}

#[no_mangle]
pub extern "C" fn bolh_finalize_block(block_id_ptr: *const c_char) -> *const c_char {
    if block_id_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let block_id = match unsafe { CStr::from_ptr(block_id_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid block_id\"}".to_string()),
    };
    
    match consensus::finalize_block(block_id) {
        Ok(()) => into_raw(format!("{{\"status\":\"finalized\",\"block_id\":\"{}\"}}", block_id)),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let state = consensus::get_state_info();
    into_raw(state.to_string())
}

#[no_mangle]
pub extern "C" fn bolh_voting_status(block_id_ptr: *const c_char) -> *const c_char {
    if block_id_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let block_id = match unsafe { CStr::from_ptr(block_id_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid block_id\"}".to_string()),
    };
    
    let status = consensus::get_voting_status(block_id);
    into_raw(status.to_string())
}

// --- UTXO management bindings ---

#[no_mangle]
pub extern "C" fn bolh_init_genesis(accounts_json_ptr: *const c_char) -> *const c_char {
    if accounts_json_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let accounts_json = match unsafe { CStr::from_ptr(accounts_json_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid json\"}".to_string()),
    };
    
    // Parse JSON array of [address, amount] pairs
    let accounts: Vec<(String, u64)> = match serde_json::from_str(accounts_json) {
        Ok(v) => v,
        Err(e) => return into_raw(format!("{{\"error\":\"{}\"}}", e)),
    };
    
    match utxo::init_genesis(accounts) {
        Ok(()) => into_raw("{\"status\":\"genesis_initialized\"}".to_string()),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_get_utxo_balance(addr_ptr: *const c_char) -> c_ulong {
    if addr_ptr.is_null() {
        return 0;
    }
    
    let addr = match unsafe { CStr::from_ptr(addr_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return 0,
    };
    
    utxo::get_balance(addr) as c_ulong
}

#[no_mangle]
pub extern "C" fn bolh_get_utxos(addr_ptr: *const c_char) -> *const c_char {
    if addr_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let addr = match unsafe { CStr::from_ptr(addr_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid address\"}".to_string()),
    };
    
    let utxos = utxo::get_utxos(addr);
    match serde_json::to_string(&utxos) {
        Ok(json) => into_raw(json),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_validate_and_process_tx(tx_json_ptr: *const c_char) -> *const c_char {
    if tx_json_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let tx_json = match unsafe { CStr::from_ptr(tx_json_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid json\"}".to_string()),
    };
    
    // Parse transaction JSON
    let tx: transaction::Transaction = match serde_json::from_str(tx_json) {
        Ok(t) => t,
        Err(e) => return into_raw(format!("{{\"error\":\"parse error: {}\"}}", e)),
    };
    
    // Extract inputs and outputs
    let inputs: Vec<(String, u32)> = tx.inputs
        .iter()
        .map(|i| (i.prev_txid.clone(), i.output_index))
        .collect();
    
    let outputs: Vec<(String, u64)> = tx.outputs
        .iter()
        .map(|o| (o.address.clone(), o.amount))
        .collect();
    
    // Process transaction
    match utxo::process_tx(tx.txid.clone(), inputs, outputs) {
        Ok(()) => into_raw(format!("{{\"status\":\"ok\",\"txid\":\"{}\"}}", tx.txid)),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    match utxo::persist() {
        Ok(()) => into_raw("{\"status\":\"persisted\"}".to_string()),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

// --- Wallet management bindings ---

#[no_mangle]
pub extern "C" fn bolh_create_wallet(name_ptr: *const c_char) -> *const c_char {
    if name_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let name = match unsafe { CStr::from_ptr(name_ptr) }.to_str() {
        Ok(s) => s.to_string(),
        Err(_) => return into_raw("{\"error\":\"invalid name\"}".to_string()),
    };
    
    match wallet::create_wallet(name) {
        Ok(address) => into_raw(format!("{{\"address\":\"{}\"}}", address)),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_get_wallet_info(name_ptr: *const c_char) -> *const c_char {
    if name_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let name = match unsafe { CStr::from_ptr(name_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid name\"}".to_string()),
    };
    
    match wallet::get_wallet(name) {
        Some(w) => {
            match serde_json::json!({
                "name": w.name,
                "address": w.public_key,
                "created_at": w.created_at,
                "balance": w.balance(),
            }).to_string().parse::<String>() {
                Ok(json) => into_raw(json),
                Err(_) => into_raw("{\"error\":\"serialization error\"}".to_string()),
            }
        },
        None => into_raw(format!("{{\"error\":\"wallet {} not found\"}}", name)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_get_wallet_balance(name_ptr: *const c_char) -> c_ulong {
    if name_ptr.is_null() {
        return 0;
    }
    
    let name = match unsafe { CStr::from_ptr(name_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return 0,
    };
    
    wallet::get_wallet_balance(name).unwrap_or(0) as c_ulong
}

#[no_mangle]
pub extern "C" fn bolh_list_wallets() -> *const c_char {
    let wallets = wallet::list_wallets();
    match serde_json::to_string(&wallets) {
        Ok(json) => into_raw(json),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_delete_wallet(name_ptr: *const c_char) -> *const c_char {
    if name_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let name = match unsafe { CStr::from_ptr(name_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return into_raw("{\"error\":\"invalid name\"}".to_string()),
    };
    
    match wallet::delete_wallet(name) {
        Ok(()) => into_raw("{\"status\":\"deleted\"}".to_string()),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}

#[no_mangle]
pub extern "C" fn bolh_import_wallet(
    name_ptr: *const c_char,
    pubkey_ptr: *const c_char,
    seckey_ptr: *const c_char,
) -> *const c_char {
    if name_ptr.is_null() || pubkey_ptr.is_null() || seckey_ptr.is_null() {
        return into_raw("{\"error\":\"null input\"}".to_string());
    }
    
    let name = match unsafe { CStr::from_ptr(name_ptr) }.to_str() {
        Ok(s) => s.to_string(),
        Err(_) => return into_raw("{\"error\":\"invalid name\"}".to_string()),
    };
    
    let pubkey = match unsafe { CStr::from_ptr(pubkey_ptr) }.to_str() {
        Ok(s) => s.to_string(),
        Err(_) => return into_raw("{\"error\":\"invalid pubkey\"}".to_string()),
    };
    
    let seckey = match unsafe { CStr::from_ptr(seckey_ptr) }.to_str() {
        Ok(s) => s.to_string(),
        Err(_) => return into_raw("{\"error\":\"invalid seckey\"}".to_string()),
    };
    
    match wallet::import_wallet(name, pubkey, seckey) {
        Ok(address) => into_raw(format!("{{\"address\":\"{}\"}}", address)),
        Err(e) => into_raw(format!("{{\"error\":\"{}\"}}", e)),
    }
}
