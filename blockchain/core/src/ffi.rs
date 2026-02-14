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
        "seckey": export.seckey.unwrap_or_default(),
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
            if result.success {
                // Single-node convenience: finalize immediately by producing a block
                let _ = chain.produce_block(wallet_name);
                // Auto-save after successful transaction
                let _ = crate::chain::save_global_chain();
            }
            json_to_ptr(json!({
                "success": result.success,
                "txid": result.txid,
                "error": result.error,
                "status": if result.success { "accepted" } else { "rejected" }
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
        Ok(info) => {
            // Auto-save after wallet creation
            let _ = crate::chain::save_global_chain();
            json_to_ptr(json!({
                "name": info.name,
                "address": info.address,
                "pubkey": info.pubkey,
                "created_at": info.created_at,
                "status": "active"
            }))
        }
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

/// Persist chain state to disk (real file persistence)
#[no_mangle]
pub extern "C" fn bolh_utxo_persist() -> *const c_char {
    match crate::chain::save_global_chain() {
        Ok(()) => {
            let stats = global_chain().stats();
            json_to_ptr(json!({
                "status": "persisted",
                "height": stats.height,
                "accounts": stats.total_accounts,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))
        }
        Err(e) => json_to_ptr(json!({
            "status": "error",
            "error": e,
            "timestamp": chrono::Utc::now().to_rfc3339()
        })),
    }
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

    match global_chain().propose_block(&proposer) {
        Ok(block_id) => {
            json_to_ptr(json!({
                "block_id": block_id,
                "height": global_chain().height() + 1,
                "status": "proposed"
            }))
        }
        Err(e) => json_to_ptr(json!({"error": e, "status": "failed"})),
    }
}

/// Vote on a block (simplified — auto-approve for single-node)
#[no_mangle]
pub extern "C" fn bolh_vote_on_block(
    voter_ptr: *const c_char,
    block_id_ptr: *const c_char,
    approved: bool,
) -> *const c_char {
    let Some(voter) = read_cstr(voter_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    match global_chain().vote_on_block(&voter, &block_id, approved) {
        Ok(()) => json_to_ptr(json!({
            "vote": if approved { "yes" } else { "no" },
            "status": "recorded"
        })),
        Err(e) => json_to_ptr(json!({"error": e, "status": "failed"})),
    }
}

/// Check if block can be finalized
#[no_mangle]
pub extern "C" fn bolh_can_finalize(block_id_ptr: *const c_char) -> bool {
    let Some(block_id) = read_cstr(block_id_ptr) else { return false; };
    global_chain().can_finalize(&block_id).unwrap_or(false)
}

/// Finalize a block
#[no_mangle]
pub extern "C" fn bolh_finalize_block(block_id_ptr: *const c_char) -> *const c_char {
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };
    match global_chain().finalize_block(&block_id) {
        Ok(height) => {
            let _ = crate::chain::save_global_chain();
            json_to_ptr(json!({
                "status": "finalized",
                "height": height,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))
        }
        Err(e) => json_to_ptr(json!({"error": e, "status": "failed"})),
    }
}

/// Get consensus state
#[no_mangle]
pub extern "C" fn bolh_consensus_state() -> *const c_char {
    let chain = global_chain();
    let stats = chain.stats();
    let vals = chain.active_validators();
    let proposer = chain.current_proposer().map(|a| a.to_bech32()).unwrap_or_default();
    json_to_ptr(json!({
        "height": stats.height,
        "total_supply": stats.total_supply,
        "circulating_supply": stats.circulating_supply,
        "total_accounts": stats.total_accounts,
        "total_transactions": stats.total_transactions,
        "genesis_hash": stats.genesis_hash,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "consensus": "PoS-BFT",
        "epoch": chain.epoch(),
        "current_proposer": proposer,
        "validators": vals.iter().map(|v| json!({
            "address": v.address.to_bech32(),
            "voting_power": v.stake,
            "active": v.is_active,
            "jailed_until": v.jailed_until
        })).collect::<Vec<_>>(),
        "status": "active"
    }))
}

/// Get voting status for a block
#[no_mangle]
pub extern "C" fn bolh_voting_status(block_id_ptr: *const c_char) -> *const c_char {
    let Some(block_id) = read_cstr(block_id_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    let chain = global_chain();
    let rt = chain.consensus.read();
    let Some(prop) = rt.proposals.get(&block_id) else {
        return json_to_ptr(json!({"error": "proposal not found"}));
    };
    let yes_count = prop.yes.len() as i64;
    let no_count = prop.no.len() as i64;
    drop(rt);

    let vals = chain.active_validators();
    let total_active = vals.iter().filter(|v| v.is_active).count() as i64;
    let pending = (total_active - yes_count - no_count).max(0);
    let passed = chain.can_finalize(&block_id).unwrap_or(false);

    json_to_ptr(json!({
        "yes_votes": yes_count,
        "no_votes": no_count,
        "pending": pending,
        "status": if passed { "passed" } else { "pending" }
    }))
}

// ============= P2P NETWORK API =============

use std::sync::OnceLock as FfiOnceLock;
static GLOBAL_NODE: FfiOnceLock<crate::network::BolhNode> = FfiOnceLock::new();

/// Get or initialize the global P2P node
fn global_node() -> &'static crate::network::BolhNode {
    GLOBAL_NODE.get_or_init(|| {
        let chain = global_chain();
        let stats = chain.stats();
        // Use genesis hash as a simple node ID seed
        let node_id = stats.genesis_hash[..16].to_string();
        crate::network::BolhNode::new(
            node_id,
            crate::network::NodeConfig::default(),
        )
    })
}

/// Get P2P network status
#[no_mangle]
pub extern "C" fn bolh_network_status() -> *const c_char {
    let node = global_node();
    let stats = node.network_stats();
    json_to_ptr(json!({
        "node_id": stats.node_id,
        "total_peers": stats.total_peers,
        "inbound_peers": stats.inbound_peers,
        "outbound_peers": stats.outbound_peers,
        "known_peers": stats.known_peers,
        "is_running": stats.is_running,
        "listen_addr": stats.listen_addr,
        "protocol_version": crate::network::protocol::PROTOCOL_VERSION,
        "status": if stats.total_peers > 0 { "connected" } else { "waiting_for_peers" }
    }))
}

/// Connect to a P2P peer
#[no_mangle]
pub extern "C" fn bolh_connect_peer(addr_ptr: *const c_char) -> *const c_char {
    let Some(addr) = read_cstr(addr_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    let node = global_node();
    let chain = global_chain();

    match node.connect_to_peer(&addr, chain) {
        Ok(peer_id) => json_to_ptr(json!({
            "peer_id": peer_id,
            "status": "connected",
            "total_peers": node.peer_count()
        })),
        Err(e) => json_to_ptr(json!({
            "error": e,
            "status": "failed"
        })),
    }
}

/// Get connected peers list
#[no_mangle]
pub extern "C" fn bolh_get_peers() -> *const c_char {
    let node = global_node();
    let peers: Vec<serde_json::Value> = node.connected_peers().iter().map(|p| {
        json!({
            "id": p.id,
            "addr": p.addr,
            "version": p.version,
            "best_height": p.best_height
        })
    }).collect();

    json_to_ptr(json!({
        "peers": peers,
        "count": peers.len()
    }))
}

/// Sync blockchain with a specific peer
#[no_mangle]
pub extern "C" fn bolh_sync_with_peer(peer_id_ptr: *const c_char) -> *const c_char {
    let Some(peer_id) = read_cstr(peer_id_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    let node = global_node();
    let chain = global_chain();

    match node.sync_with_peer(&peer_id, chain) {
        Ok(synced) => json_to_ptr(json!({
            "blocks_synced": synced,
            "new_height": chain.height(),
            "status": if synced > 0 { "synced" } else { "up_to_date" }
        })),
        Err(e) => json_to_ptr(json!({
            "error": e,
            "status": "failed"
        })),
    }
}

/// Disconnect a peer
#[no_mangle]
pub extern "C" fn bolh_disconnect_peer(peer_id_ptr: *const c_char) -> *const c_char {
    let Some(peer_id) = read_cstr(peer_id_ptr) else {
        return json_to_ptr(json!({"error": "null pointer"}));
    };

    let node = global_node();
    node.disconnect_peer(&peer_id);

    json_to_ptr(json!({
        "peer_id": peer_id,
        "status": "disconnected",
        "total_peers": node.peer_count()
    }))
}

/// Get transaction history for a wallet
#[no_mangle]
pub extern "C" fn bolh_get_tx_history(addr_ptr: *const c_char) -> *const c_char {
    let Some(addr_str) = read_cstr(addr_ptr) else {
        return json_to_ptr(json!({"error": "null pointer", "transactions": []}));
    };
    let Ok(address) = Address::from_bech32(&addr_str) else {
        return json_to_ptr(json!({"error": "invalid address", "transactions": []}));
    };

    let chain = global_chain();
    let history = chain.get_tx_history(&address);
    let txs: Vec<serde_json::Value> = history.iter().map(|r| {
        json!({
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

    json_to_ptr(json!({
        "transactions": txs,
        "count": txs.len()
    }))
}
