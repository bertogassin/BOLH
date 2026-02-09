/**
 * Blockchain API Bindings
 * TypeScript wrappers for all blockchain functions exposed via Tauri commands
 */

import { invoke } from "@tauri-apps/api/core";

// Core initialization and crypto
export async function blockchainInit(): Promise<string> {
  return invoke("bolh_init");
}

export async function createKey(): Promise<string> {
  return invoke("bolh_create_key");
}

export async function signTransaction(tx: string): Promise<string> {
  return invoke("bolh_sign_tx", { tx });
}

export async function submitTransaction(signed: string): Promise<string> {
  return invoke("bolh_submit_tx", { signed });
}

export async function getBalance(addr: string): Promise<number> {
  return invoke("bolh_get_balance", { addr });
}

// Wallet API
export interface WalletInfo {
  name: string;
  address: string;
  balance: number;
  pubkey?: string;
  seckey?: string;
}

export async function createWallet(name: string): Promise<WalletInfo> {
  const info = await invoke<string>("bolh_create_wallet", { name });
  return JSON.parse(info);
}

export async function getWalletInfo(name: string): Promise<WalletInfo> {
  const info = await invoke<string>("bolh_get_wallet_info", { name });
  return JSON.parse(info);
}

export async function getWalletBalance(name: string): Promise<number> {
  return invoke("bolh_get_wallet_balance", { name });
}

export async function listWallets(): Promise<WalletInfo[]> {
  const list = await invoke<string>("bolh_list_wallets");
  return JSON.parse(list);
}

export async function deleteWallet(name: string): Promise<void> {
  await invoke("bolh_delete_wallet", { name });
}

export async function importWallet(
  name: string,
  pubkey: string,
  seckey: string
): Promise<WalletInfo> {
  const info = await invoke<string>("bolh_import_wallet", {
    name,
    pubkey,
    seckey,
  });
  return JSON.parse(info);
}

// UTXO API
export interface UTXO {
  txid: string;
  output_index: number;
  address: string;
  amount: number;
  block_height: number;
  spent: boolean;
}

export async function initGenesis(accounts: string[]): Promise<void> {
  const accountsJson = JSON.stringify(accounts);
  await invoke("bolh_init_genesis", { accounts: accountsJson });
}

export async function getUTXOBalance(addr: string): Promise<number> {
  return invoke("bolh_get_utxo_balance", { addr });
}

export async function getUTXOs(addr: string): Promise<UTXO[]> {
  const utxos = await invoke<string>("bolh_get_utxos", { addr });
  return JSON.parse(utxos);
}

export interface Transaction {
  txid: string;
  inputs: Array<{
    prev_txid: string;
    output_index: number;
    signature: string;
  }>;
  outputs: Array<{
    address: string;
    amount: number;
  }>;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export async function validateAndProcessTx(tx: Transaction): Promise<void> {
  const txJson = JSON.stringify(tx);
  await invoke("bolh_validate_and_process_tx", { tx_json: txJson });
}

export async function persistUTXOSet(): Promise<void> {
  await invoke("bolh_utxo_persist");
}

// Consensus API
export interface BlockProposal {
  block_id: string;
  proposer: string;
  transactions: Transaction[];
  height: number;
}

export async function proposeBlock(
  proposer: string,
  txs: Transaction[]
): Promise<BlockProposal> {
  const txsJson = JSON.stringify(txs);
  const block = await invoke<string>("bolh_propose_block", {
    proposer,
    txs_json: txsJson,
  });
  return JSON.parse(block);
}

export interface VoteResult {
  block_id: string;
  voter: string;
  approved: boolean;
  status: string;
}

export async function voteOnBlock(
  voter: string,
  blockId: string,
  approved: boolean
): Promise<VoteResult> {
  const result = await invoke<string>("bolh_vote_on_block", {
    voter,
    block_id: blockId,
    approved,
  });
  return JSON.parse(result);
}

export async function canFinalize(blockId: string): Promise<boolean> {
  return invoke("bolh_can_finalize", { block_id: blockId });
}

export interface FinalizedBlock extends BlockProposal {
  finalized: boolean;
  finalized_at: number;
}

export async function finalizeBlock(
  blockId: string
): Promise<FinalizedBlock> {
  const block = await invoke<string>("bolh_finalize_block", {
    block_id: blockId,
  });
  return JSON.parse(block);
}

export interface ConsensusState {
  height: number;
  round: number;
  validators: Array<{
    address: string;
    voting_power: number;
  }>;
  current_proposer: string;
}

export async function getConsensusState(): Promise<ConsensusState> {
  const state = await invoke<string>("bolh_consensus_state");
  return JSON.parse(state);
}

export interface VotingStatus {
  block_id: string;
  total_power: number;
  votes_received: number;
  can_finalize: boolean;
}

export async function getVotingStatus(blockId: string): Promise<VotingStatus> {
  const status = await invoke<string>("bolh_voting_status", {
    block_id: blockId,
  });
  return JSON.parse(status);
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

export async function runBlockchainSmokeTest(): Promise<SmokeTestResult> {
  const steps: SmokeTestStep[] = [];
  const fail = (name: string, err: unknown): SmokeTestResult => {
    const msg = err instanceof Error ? err.message : String(err);
    steps.push({ name, ok: false, message: msg });
    return { ok: false, steps };
  };

  try {
    await blockchainInit();
    steps.push({ name: "init", ok: true });
  } catch (err) {
    return fail("init", err);
  }

  const walletName = `smoke_${Date.now()}`;
  let created = false;

  try {
    await createWallet(walletName);
    created = true;
    steps.push({ name: "create_wallet", ok: true });
  } catch (err) {
    return fail("create_wallet", err);
  }

  try {
    await getWalletInfo(walletName);
    steps.push({ name: "get_wallet_info", ok: true });
  } catch (err) {
    return fail("get_wallet_info", err);
  }

  try {
    await getWalletBalance(walletName);
    steps.push({ name: "get_wallet_balance", ok: true });
  } catch (err) {
    return fail("get_wallet_balance", err);
  }

  try {
    await getConsensusState();
    steps.push({ name: "get_consensus_state", ok: true });
  } catch (err) {
    return fail("get_consensus_state", err);
  }

  if (created) {
    try {
      await deleteWallet(walletName);
      steps.push({ name: "delete_wallet", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ name: "delete_wallet", ok: false, message: msg });
    }
  }

  const ok = steps.every((step) => step.ok);
  return { ok, steps };
}

// Helper hook for React/Solid.js integration
export interface BlockchainState {
  initialized: boolean;
  currentWallet: WalletInfo | null;
  balance: number;
  utxos: UTXO[];
  consensusState: ConsensusState | null;
}

export function createBlockchainApi() {
  return {
    init: blockchainInit,
    createKey,
    signTransaction,
    submitTransaction,
    getBalance,
    wallet: {
      create: createWallet,
      getInfo: getWalletInfo,
      getBalance: getWalletBalance,
      list: listWallets,
      delete: deleteWallet,
      import: importWallet,
    },
    utxo: {
      initGenesis,
      getBalance: getUTXOBalance,
      getAll: getUTXOs,
      validateAndProcess: validateAndProcessTx,
      persist: persistUTXOSet,
    },
    consensus: {
      proposeBlock,
      voteOnBlock,
      canFinalize,
      finalizeBlock,
      getState: getConsensusState,
      getVotingStatus,
    },
  };
}

