/**
 * Blockchain API Bindings
 * TypeScript wrappers for all BOLH blockchain Tauri commands
 * These call directly into the Rust blockchain core via Tauri invoke
 */

// ── Tauri invoke helper (Tauri v2 compatible) ──
let _cachedInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;
const tauriInvoke = async (cmd: string, args?: any): Promise<any> => {
  if (!_cachedInvoke) {
    try {
      const mod = await import('@tauri-apps/api/core');
      _cachedInvoke = mod.invoke;
    } catch {
      const w = window as any;
      if (w.__TAURI_INTERNALS__?.invoke) { _cachedInvoke = (c, a) => w.__TAURI_INTERNALS__.invoke(c, a || {}); }
      else { throw new Error('tauri-not-available'); }
    }
  }
  return _cachedInvoke!(cmd, args || {});
};

// ── Types ──
export interface WalletInfo {
  name: string;
  address: string;
  pubkey?: string;
  balance: number;
  created_at?: number;
  status: string;
}

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

export interface TxRecord {
  txid: string;
  from: string;
  to: string;
  amount: number;
  fee: number;
  type: string;
  timestamp: string;
  block_height: number;
}

export interface TxResult {
  success: boolean;
  txid?: string;
  error?: string;
}

export interface NetworkInfo {
  node_id: string;
  total_peers: number;
  status: string;
  height: number;
  protocol_version: number;
}

// ── Core ──
export async function blockchainInit(): Promise<any> {
  return tauriInvoke('bolh_init');
}

export async function getChainStats(): Promise<ChainStats> {
  return tauriInvoke('bolh_chain_stats');
}

// ── Wallet ──
export async function createWallet(name: string): Promise<WalletInfo> {
  return tauriInvoke('bolh_create_wallet', { name });
}

export async function getWallet(name: string): Promise<WalletInfo> {
  return tauriInvoke('bolh_get_wallet', { name });
}

export async function listWallets(): Promise<WalletInfo[]> {
  return tauriInvoke('bolh_list_wallets');
}

export async function getBalance(address: string): Promise<number> {
  return tauriInvoke('bolh_get_balance', { address });
}

// ── Transactions ──
export async function sendTransaction(walletName: string, to: string, amount: number): Promise<TxResult> {
  return tauriInvoke('bolh_send_tx', { walletName, to, amount });
}

export async function getTxHistory(address: string): Promise<{ transactions: TxRecord[]; count: number }> {
  return tauriInvoke('bolh_tx_history', { address });
}

// ── Network ──
export async function getNetworkInfo(): Promise<NetworkInfo> {
  return tauriInvoke('bolh_network_info');
}

// ── Persistence ──
export async function saveChain(): Promise<{ status: string }> {
  return tauriInvoke('bolh_save');
}

// ── Legacy compatibility types (used by BlockchainScreen, useBlockchain) ──
export interface UTXO {
  txid: string;
  output_index: number;
  address: string;
  amount: number;
  block_height: number;
  spent: boolean;
}

export interface Transaction {
  txid: string;
  inputs: Array<{ prev_txid: string; output_index: number; signature: string }>;
  outputs: Array<{ address: string; amount: number }>;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface ConsensusState {
  height: number;
  round: number;
  validators: Array<{ address: string; voting_power: number }>;
  current_proposer: string;
}

// ── Smoke Test (compatibility) ──
export interface SmokeTestStep {
  name: string;
  ok: boolean;
  message?: string;
}

export interface SmokeTestResult {
  ok: boolean;
  steps: SmokeTestStep[];
}

export async function runBlockchainSmokeTest(): Promise<SmokeTestResult> {
  const steps: SmokeTestStep[] = [];
  const fail = (name: string, err: unknown): SmokeTestResult => {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({ name, ok: false, message: msg });
    return { ok: false, steps };
  };

  try {
    await blockchainInit();
    steps.push({ name: 'init', ok: true });
  } catch (err) {
    return fail('init', err);
  }

  const walletName = `smoke_${Date.now()}`;
  try {
    const w = await createWallet(walletName);
    steps.push({ name: 'create_wallet', ok: !w.error });
  } catch (err) {
    return fail('create_wallet', err);
  }

  try {
    const w = await getWallet(walletName);
    steps.push({ name: 'get_wallet', ok: !!(w && !w.error) });
  } catch (err) {
    return fail('get_wallet', err);
  }

  try {
    const stats = await getChainStats();
    steps.push({ name: 'chain_stats', ok: !!stats });
  } catch (err) {
    return fail('chain_stats', err);
  }

  return { ok: steps.every((s) => s.ok), steps };
}

// ── Convenience API object (includes legacy compat for useBlockchain hook) ──
export function createBlockchainApi() {
  return {
    init: blockchainInit,
    stats: getChainStats,
    // Legacy signTransaction/submitTransaction
    signTransaction: async (_tx: string) => '{}',
    submitTransaction: async (_signed: string) => '{}',
    wallet: {
      create: createWallet,
      get: getWallet,
      getInfo: async (name: string) => getWallet(name),
      getBalance: async (name: string) => {
        const w = await getWallet(name);
        return w?.balance ?? 0;
      },
      list: listWallets,
      delete: async (_name: string) => {},
      import: async (_name: string, _pub: string, _sec: string) => ({ name: _name, address: '', balance: 0, status: 'imported' } as WalletInfo),
    },
    balance: getBalance,
    tx: {
      send: sendTransaction,
      history: getTxHistory,
    },
    utxo: {
      initGenesis: async () => {},
      getBalance: getBalance,
      getAll: async (_addr: string): Promise<UTXO[]> => [],
      validateAndProcess: async () => {},
      persist: async () => {},
    },
    consensus: {
      proposeBlock: async () => ({}),
      voteOnBlock: async () => ({}),
      canFinalize: async () => true,
      finalizeBlock: async () => ({}),
      getState: async (): Promise<ConsensusState> => ({ height: 0, round: 0, validators: [], current_proposer: '' }),
      getVotingStatus: async () => ({}),
    },
    network: getNetworkInfo,
    save: saveChain,
  };
}
