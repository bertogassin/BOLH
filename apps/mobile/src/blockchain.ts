/**
 * BOLH Blockchain Bridge
 * 
 * Provides typed access to the real BOLH blockchain.
 * - In Tauri mobile: uses invoke() to call Rust FFI functions
 * - In browser/dev: provides realistic data based on actual genesis state
 */

// ========== Types ==========

export interface ChainStats {
  height: number;
  total_supply: number;
  circulating_supply: number;
  total_accounts: number;
  total_transactions: number;
  genesis_hash: string;
  consensus: string;
  status: string;
}

export interface WalletInfo {
  name: string;
  address: string;
  pubkey: string;
  balance: number;
  created_at?: number;
  status: string;
}

export interface TxRecord {
  txid: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  type: string;
  timestamp: number;
  block_height: number;
}

export interface NetworkStatus {
  node_id: string;
  total_peers: number;
  inbound_peers: number;
  outbound_peers: number;
  known_peers: number;
  is_running: boolean;
  listen_addr: string;
  status: string;
}

export interface PersistResult {
  status: string;
  height?: number;
  accounts?: number;
  error?: string;
}

// ========== Constants ==========

/** Total BOLH supply: 10 billion (with 8 decimals) */
export const TOTAL_SUPPLY_RAW = 10_000_000_000_00_000_000;
export const DECIMALS = 8;
export const TOTAL_SUPPLY = 10_000_000_000;

/** Distribution */
export const MINING_POOL_PERCENT = 60;
export const REFERRAL_POOL_PERCENT = 20;
export const ADVERTISING_POOL_PERCENT = 10;
export const RESERVE_POOL_PERCENT = 10;

// ========== Helpers ==========

/** Format raw amount (with 8 decimals) to human-readable */
export function formatBOLH(raw: number): string {
  const amount = raw / 10 ** DECIMALS;
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + ' B';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + ' M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(2) + ' K';
  return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Format raw amount to full number */
export function rawToBOLH(raw: number): number {
  return raw / 10 ** DECIMALS;
}

/** Convert BOLH to raw amount */
export function bolhToRaw(amount: number): number {
  return Math.round(amount * 10 ** DECIMALS);
}

/** Shorten address: bolh1abc...xyz */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 20) return addr;
  return addr.slice(0, 10) + '...' + addr.slice(-6);
}

// ========== Tauri Bridge ==========

/** Check if running in Tauri */
function isTauri(): boolean {
  return typeof (window as any).__TAURI__ !== 'undefined';
}

/** Call Tauri invoke if available */
async function tauriInvoke<T>(cmd: string, args?: any): Promise<T | null> {
  if (isTauri()) {
    try {
      return await (window as any).__TAURI__.invoke(cmd, args);
    } catch (e) {
      console.warn(`[BOLH] Tauri invoke '${cmd}' failed:`, e);
      return null;
    }
  }
  return null;
}

// ========== In-memory state for dev/browser mode ==========

let _devWallet: WalletInfo | null = null;
let _devTxHistory: TxRecord[] = [];
let _devChainStats: ChainStats = {
  height: 0,
  total_supply: TOTAL_SUPPLY_RAW,
  circulating_supply: TOTAL_SUPPLY_RAW,
  total_accounts: 4,
  total_transactions: 0,
  genesis_hash: 'e3b0c44298fc1c149afbf4c8996fb924...',
  consensus: 'PoS-BFT',
  status: 'active',
};

// ========== API ==========

/** Initialize blockchain and get chain stats */
export async function initChain(): Promise<ChainStats> {
  const result = await tauriInvoke<any>('bolh_init');
  if (result) {
    _devChainStats = {
      height: result.height ?? 0,
      total_supply: result.total_supply ?? TOTAL_SUPPLY_RAW,
      circulating_supply: result.circulating_supply ?? TOTAL_SUPPLY_RAW,
      total_accounts: result.accounts ?? 4,
      total_transactions: 0,
      genesis_hash: result.genesis_hash ?? '',
      consensus: 'PoS-BFT',
      status: result.status ?? 'active',
    };
  }
  return _devChainStats;
}

/** Get chain statistics */
export async function getChainStats(): Promise<ChainStats> {
  const result = await tauriInvoke<any>('bolh_consensus_state');
  if (result) {
    return {
      height: result.height ?? 0,
      total_supply: result.total_supply ?? TOTAL_SUPPLY_RAW,
      circulating_supply: result.circulating_supply ?? TOTAL_SUPPLY_RAW,
      total_accounts: result.total_accounts ?? 0,
      total_transactions: result.total_transactions ?? 0,
      genesis_hash: result.genesis_hash ?? '',
      consensus: result.consensus ?? 'PoS-BFT',
      status: result.status ?? 'active',
    };
  }
  return _devChainStats;
}

/** Create a new wallet */
export async function createWallet(name: string): Promise<WalletInfo | null> {
  const result = await tauriInvoke<any>('bolh_create_wallet', { name });
  if (result && !result.error) {
    const w: WalletInfo = {
      name: result.name,
      address: result.address,
      pubkey: result.pubkey,
      balance: 0,
      created_at: result.created_at,
      status: result.status ?? 'active',
    };
    _devWallet = w;
    return w;
  }

  // Dev mode: create mock wallet
  if (!isTauri()) {
    _devWallet = {
      name,
      address: 'bolh1' + Array.from({length: 40}, () => '0123456789abcdef'[Math.random()*16|0]).join(''),
      pubkey: Array.from({length: 64}, () => '0123456789abcdef'[Math.random()*16|0]).join(''),
      balance: 0,
      created_at: Date.now(),
      status: 'active',
    };
    return _devWallet;
  }

  return null;
}

/** Get wallet info and balance */
export async function getWallet(name: string): Promise<WalletInfo | null> {
  const result = await tauriInvoke<any>('bolh_get_wallet_info', { name });
  if (result && !result.error) {
    return {
      name: result.name,
      address: result.address,
      pubkey: result.pubkey,
      balance: result.balance ?? 0,
      status: result.status ?? 'active',
    };
  }

  // Dev mode
  if (_devWallet && _devWallet.name === name) return _devWallet;
  return null;
}

/** List all wallets */
export async function listWallets(): Promise<WalletInfo[]> {
  const result = await tauriInvoke<any[]>('bolh_list_wallets');
  if (result && Array.isArray(result)) {
    return result.map((w: any) => ({
      name: w.name,
      address: w.address,
      pubkey: w.pubkey ?? '',
      balance: w.balance ?? 0,
      status: 'active',
    }));
  }

  // Dev mode
  return _devWallet ? [_devWallet] : [];
}

/** Get transaction history */
export async function getTxHistory(address: string): Promise<TxRecord[]> {
  const result = await tauriInvoke<any>('bolh_get_tx_history', { address });
  if (result?.transactions) {
    return result.transactions;
  }
  return _devTxHistory;
}

/** Get network status */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  const result = await tauriInvoke<any>('bolh_network_status');
  if (result) {
    return result;
  }
  return {
    node_id: 'dev-node',
    total_peers: 0,
    inbound_peers: 0,
    outbound_peers: 0,
    known_peers: 0,
    is_running: true,
    listen_addr: '0.0.0.0:30333',
    status: 'waiting_for_peers',
  };
}

/** Save chain to disk */
export async function persistChain(): Promise<PersistResult> {
  const result = await tauriInvoke<any>('bolh_utxo_persist');
  if (result) return result;
  return { status: 'dev_mode' };
}
