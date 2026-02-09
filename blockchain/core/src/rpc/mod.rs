//! JSON-RPC server for UI communication
//! Exposes blockchain operations to the BOLH App frontend

/// RPC methods:
/// - bolh_getBalance(address) -> balance
/// - bolh_getBlock(height) -> block
/// - bolh_getTransaction(hash) -> transaction
/// - bolh_sendTransaction(signed_tx) -> tx_hash
/// - bolh_getBlockHeight() -> height
/// - bolh_getAccountInfo(address) -> account
/// - bolh_getMiningReward() -> pending_reward
/// - bolh_getReferralInfo(address) -> referral_info
/// - bolh_getValidators() -> validator_list
/// - bolh_getNetworkInfo() -> network_stats

/// RPC server configuration
pub struct RpcConfig {
    pub bind_addr: String,
    pub port: u16,
}

impl Default for RpcConfig {
    fn default() -> Self {
        RpcConfig {
            bind_addr: "127.0.0.1".to_string(),
            port: 9944,
        }
    }
}
