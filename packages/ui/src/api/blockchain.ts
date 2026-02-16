/**
 * Blockchain types — shared type definitions
 * Implementation lives in apps, these are type-only exports for shared components
 */

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

export interface SmokeTestStep {
  name: string;
  ok: boolean;
  message?: string;
}

export interface SmokeTestResult {
  ok: boolean;
  steps: SmokeTestStep[];
}
