// Guardio Mobile App - Tauri Backend
// Exposes simple bolh commands by loading `bolh_core` native library at runtime.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bolh_bridge;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Core API
            bolh_bridge::bolh_init,
            bolh_bridge::bolh_create_key,
            bolh_bridge::bolh_sign_tx,
            bolh_bridge::bolh_submit_tx,
            bolh_bridge::bolh_get_balance,
            // Wallet API
            bolh_bridge::bolh_create_wallet,
            bolh_bridge::bolh_get_wallet_info,
            bolh_bridge::bolh_get_wallet_balance,
            bolh_bridge::bolh_list_wallets,
            bolh_bridge::bolh_delete_wallet,
            bolh_bridge::bolh_import_wallet,
            // UTXO API
            bolh_bridge::bolh_init_genesis,
            bolh_bridge::bolh_get_utxo_balance,
            bolh_bridge::bolh_get_utxos,
            bolh_bridge::bolh_validate_and_process_tx,
            bolh_bridge::bolh_utxo_persist,
            // Consensus API
            bolh_bridge::bolh_propose_block,
            bolh_bridge::bolh_vote_on_block,
            bolh_bridge::bolh_can_finalize,
            bolh_bridge::bolh_finalize_block,
            bolh_bridge::bolh_consensus_state,
            bolh_bridge::bolh_voting_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
