use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_ulong};
use libloading::{Library, Symbol};

type CStrPtr = *const c_char;
type CBool = bool;

lazy_static::lazy_static! {
    static ref BOLH_LIB: Result<Box<LoadedLib>, String> = LoadedLib::load();
}

struct LoadedLib {
    // Core functions
    init: Symbol<'static, unsafe extern "C" fn() -> CStrPtr>,
    create_key: Symbol<'static, unsafe extern "C" fn() -> CStrPtr>,
    sign_tx: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    submit_tx: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    get_balance: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> c_ulong>,
    free_str: Symbol<'static, unsafe extern "C" fn(*mut c_char)>,
    
    // Wallet functions
    create_wallet: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    get_wallet_info: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    get_wallet_balance: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> c_ulong>,
    list_wallets: Symbol<'static, unsafe extern "C" fn() -> CStrPtr>,
    delete_wallet: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    import_wallet: Symbol<'static, unsafe extern "C" fn(CStrPtr, CStrPtr, CStrPtr) -> CStrPtr>,
    
    // UTXO functions
    init_genesis: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    get_utxo_balance: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> c_ulong>,
    get_utxos: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    validate_and_process_tx: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    utxo_persist: Symbol<'static, unsafe extern "C" fn() -> CStrPtr>,
    
    // Consensus functions
    propose_block: Symbol<'static, unsafe extern "C" fn(CStrPtr, CStrPtr) -> CStrPtr>,
    vote_on_block: Symbol<'static, unsafe extern "C" fn(CStrPtr, CStrPtr, CBool) -> CStrPtr>,
    can_finalize: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CBool>,
    finalize_block: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
    consensus_state: Symbol<'static, unsafe extern "C" fn() -> CStrPtr>,
    voting_status: Symbol<'static, unsafe extern "C" fn(CStrPtr) -> CStrPtr>,
}

impl LoadedLib {
    fn load() -> Result<Box<Self>, String> {
        #[cfg(target_os = "windows")]
        let names = vec!["bolh_core.dll", "target/release/bolh_core.dll"];
        #[cfg(not(target_os = "windows"))]
        #[cfg(target_os = "linux")]
        let names = vec!["libbolh_core.so", "target/release/libbolh_core.so"];
        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        let names = vec!["libbolh_core.dylib", "target/release/libbolh_core.dylib"];

        let mut last_error = String::new();
        
        for name in names {
            match unsafe { Library::new(name) } {
                Ok(lib) => {
                    let lib_ref: &'static Library = Box::leak(Box::new(lib));
                    if let Ok(loaded) = Self::load_symbols(lib_ref) {
                        return Ok(Box::new(loaded));
                    }
                }
                Err(e) => last_error = e.to_string(),
            }
        }
        
        Err(format!("bolh_core library not found. Last error: {}", last_error))
    }
    
    fn load_symbols(lib: &'static Library) -> Result<Self, String> {
        unsafe {
            Ok(LoadedLib {
                init: lib.get(b"bolh_init\0").map_err(|e| format!("bolh_init: {}", e))?,
                create_key: lib.get(b"bolh_create_key\0").map_err(|e| format!("bolh_create_key: {}", e))?,
                sign_tx: lib.get(b"bolh_sign_tx\0").map_err(|e| format!("bolh_sign_tx: {}", e))?,
                submit_tx: lib.get(b"bolh_submit_tx\0").map_err(|e| format!("bolh_submit_tx: {}", e))?,
                get_balance: lib.get(b"bolh_get_balance\0").map_err(|e| format!("bolh_get_balance: {}", e))?,
                free_str: lib.get(b"bolh_free\0").map_err(|e| format!("bolh_free: {}", e))?,
                
                create_wallet: lib.get(b"bolh_create_wallet\0").map_err(|e| format!("bolh_create_wallet: {}", e))?,
                get_wallet_info: lib.get(b"bolh_get_wallet_info\0").map_err(|e| format!("bolh_get_wallet_info: {}", e))?,
                get_wallet_balance: lib.get(b"bolh_get_wallet_balance\0").map_err(|e| format!("bolh_get_wallet_balance: {}", e))?,
                list_wallets: lib.get(b"bolh_list_wallets\0").map_err(|e| format!("bolh_list_wallets: {}", e))?,
                delete_wallet: lib.get(b"bolh_delete_wallet\0").map_err(|e| format!("bolh_delete_wallet: {}", e))?,
                import_wallet: lib.get(b"bolh_import_wallet\0").map_err(|e| format!("bolh_import_wallet: {}", e))?,
                
                init_genesis: lib.get(b"bolh_init_genesis\0").map_err(|e| format!("bolh_init_genesis: {}", e))?,
                get_utxo_balance: lib.get(b"bolh_get_utxo_balance\0").map_err(|e| format!("bolh_get_utxo_balance: {}", e))?,
                get_utxos: lib.get(b"bolh_get_utxos\0").map_err(|e| format!("bolh_get_utxos: {}", e))?,
                validate_and_process_tx: lib.get(b"bolh_validate_and_process_tx\0").map_err(|e| format!("bolh_validate_and_process_tx: {}", e))?,
                utxo_persist: lib.get(b"bolh_utxo_persist\0").map_err(|e| format!("bolh_utxo_persist: {}", e))?,
                
                propose_block: lib.get(b"bolh_propose_block\0").map_err(|e| format!("bolh_propose_block: {}", e))?,
                vote_on_block: lib.get(b"bolh_vote_on_block\0").map_err(|e| format!("bolh_vote_on_block: {}", e))?,
                can_finalize: lib.get(b"bolh_can_finalize\0").map_err(|e| format!("bolh_can_finalize: {}", e))?,
                finalize_block: lib.get(b"bolh_finalize_block\0").map_err(|e| format!("bolh_finalize_block: {}", e))?,
                consensus_state: lib.get(b"bolh_consensus_state\0").map_err(|e| format!("bolh_consensus_state: {}", e))?,
                voting_status: lib.get(b"bolh_voting_status\0").map_err(|e| format!("bolh_voting_status: {}", e))?,
            })
        }
    }
}

fn cstr_to_string(ptr: CStrPtr) -> String {
    if ptr.is_null() { return String::new(); }
    unsafe {
        CStr::from_ptr(ptr).to_string_lossy().into_owned()
    }
}

fn free_cstr(ptr: CStrPtr) {
    if ptr.is_null() { return; }
    if let Ok(lib) = BOLH_LIB.as_ref() {
        unsafe { (lib.free_str)(ptr as *mut c_char); }
    }
}

// Core API functions
#[tauri::command]
pub fn bolh_init() -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let r = unsafe { (lib.init)() };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_create_key() -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let r = unsafe { (lib.create_key)() };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_sign_tx(tx: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_tx = CString::new(tx).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.sign_tx)(c_tx.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_submit_tx(signed: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_s = CString::new(signed).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.submit_tx)(c_s.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_get_balance(addr: String) -> Result<u64, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_a = CString::new(addr).map_err(|e| e.to_string())?;
    let b = unsafe { (lib.get_balance)(c_a.as_ptr()) };
    Ok(b as u64)
}

// Wallet API functions
#[tauri::command]
pub fn bolh_create_wallet(name: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.create_wallet)(c_name.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_get_wallet_info(name: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.get_wallet_info)(c_name.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_get_wallet_balance(name: String) -> Result<u64, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let b = unsafe { (lib.get_wallet_balance)(c_name.as_ptr()) };
    Ok(b as u64)
}

#[tauri::command]
pub fn bolh_list_wallets() -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let r = unsafe { (lib.list_wallets)() };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_delete_wallet(name: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.delete_wallet)(c_name.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_import_wallet(name: String, pubkey: String, seckey: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_name = CString::new(name).map_err(|e| e.to_string())?;
    let c_pubkey = CString::new(pubkey).map_err(|e| e.to_string())?;
    let c_seckey = CString::new(seckey).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.import_wallet)(c_name.as_ptr(), c_pubkey.as_ptr(), c_seckey.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

// UTXO API functions
#[tauri::command]
pub fn bolh_init_genesis(accounts: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_accounts = CString::new(accounts).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.init_genesis)(c_accounts.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_get_utxo_balance(addr: String) -> Result<u64, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_addr = CString::new(addr).map_err(|e| e.to_string())?;
    let b = unsafe { (lib.get_utxo_balance)(c_addr.as_ptr()) };
    Ok(b as u64)
}

#[tauri::command]
pub fn bolh_get_utxos(addr: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_addr = CString::new(addr).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.get_utxos)(c_addr.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_validate_and_process_tx(tx_json: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_tx = CString::new(tx_json).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.validate_and_process_tx)(c_tx.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_utxo_persist() -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let r = unsafe { (lib.utxo_persist)() };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

// Consensus API functions
#[tauri::command]
pub fn bolh_propose_block(proposer: String, txs_json: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_proposer = CString::new(proposer).map_err(|e| e.to_string())?;
    let c_txs = CString::new(txs_json).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.propose_block)(c_proposer.as_ptr(), c_txs.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_vote_on_block(voter: String, block_id: String, approved: bool) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_voter = CString::new(voter).map_err(|e| e.to_string())?;
    let c_block = CString::new(block_id).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.vote_on_block)(c_voter.as_ptr(), c_block.as_ptr(), approved) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_can_finalize(block_id: String) -> Result<bool, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_block = CString::new(block_id).map_err(|e| e.to_string())?;
    let result = unsafe { (lib.can_finalize)(c_block.as_ptr()) };
    Ok(result)
}

#[tauri::command]
pub fn bolh_finalize_block(block_id: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_block = CString::new(block_id).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.finalize_block)(c_block.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_consensus_state() -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let r = unsafe { (lib.consensus_state)() };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

#[tauri::command]
pub fn bolh_voting_status(block_id: String) -> Result<String, String> {
    let lib = BOLH_LIB.as_ref().map_err(|e| e.clone())?;
    let c_block = CString::new(block_id).map_err(|e| e.to_string())?;
    let r = unsafe { (lib.voting_status)(c_block.as_ptr()) };
    let s = cstr_to_string(r);
    free_cstr(r);
    Ok(s)
}

