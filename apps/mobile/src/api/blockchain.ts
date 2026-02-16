/**
 * Blockchain API Bindings
 * TypeScript wrappers for all blockchain functions exposed via Tauri commands
 */

import { invoke } from "@tauri-apps/api/core";

function parseOrThrow<T>(raw: string, op: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${op}: invalid JSON response (${msg})`);
  }

  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const errVal = (parsed as Record<string, unknown>).error;
    throw new Error(`${op}: ${String(errVal)}`);
  }
  return parsed as T;
}

function assertNoErrorEnvelope(raw: string, op: string): void {
  parseOrThrow<Record<string, unknown>>(raw, op);
}

// Core initialization and crypto
export async function blockchainInit(): Promise<string> {
  const response = await invoke<string>("bolh_init");
  assertNoErrorEnvelope(response, "blockchainInit");
  return response;
}

export async function createKey(): Promise<string> {
  const response = await invoke<string>("bolh_create_key");
  assertNoErrorEnvelope(response, "createKey");
  return response;
}

export async function signTransaction(tx: string): Promise<string> {
  const response = await invoke<string>("bolh_sign_tx", { tx });
  assertNoErrorEnvelope(response, "signTransaction");
  return response;
}

export async function submitTransaction(signed: string): Promise<string> {
  const response = await invoke<string>("bolh_submit_tx", { signed });
  assertNoErrorEnvelope(response, "submitTransaction");
  return response;
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
  return parseOrThrow<WalletInfo>(info, "createWallet");
}

export async function getWalletInfo(name: string): Promise<WalletInfo> {
  const info = await invoke<string>("bolh_get_wallet_info", { name });
  return parseOrThrow<WalletInfo>(info, "getWalletInfo");
}

export async function getWalletBalance(name: string): Promise<number> {
  return invoke("bolh_get_wallet_balance", { name });
}

export async function listWallets(): Promise<WalletInfo[]> {
  const list = await invoke<string>("bolh_list_wallets");
  return parseOrThrow<WalletInfo[]>(list, "listWallets");
}

export async function deleteWallet(name: string): Promise<void> {
  const response = await invoke<string>("bolh_delete_wallet", { name });
  assertNoErrorEnvelope(response, "deleteWallet");
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
  return parseOrThrow<WalletInfo>(info, "importWallet");
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
  const response = await invoke<string>("bolh_init_genesis", {
    accounts: accountsJson,
  });
  assertNoErrorEnvelope(response, "initGenesis");
}

export async function getUTXOBalance(addr: string): Promise<number> {
  return invoke("bolh_get_utxo_balance", { addr });
}

export async function getUTXOs(addr: string): Promise<UTXO[]> {
  const utxos = await invoke<string>("bolh_get_utxos", { addr });
  return parseOrThrow<UTXO[]>(utxos, "getUTXOs");
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

export type PrivacyMode = "transparent" | "shielded" | "viewable";
export type SignatureScheme = "hybrid_qr_v1" | "legacy_compat";

export interface PrivacyOptions {
  mode?: PrivacyMode;
  revealKey?: string;
  ringSize?: number;
  priority?: 0 | 1 | 2 | 3;
  fast?: boolean;
  signatureScheme?: SignatureScheme;
}

export interface FeePreview {
  estimated_fee: number;
  tier: "ultra_cheap" | "cheap" | "normal";
  details: {
    base: number;
    io: number;
    amount_component: number;
    ring_component: number;
    congestion_multiplier: number;
  };
}

export interface RevealResult {
  txid: string;
  revealed: boolean;
  mode: PrivacyMode;
  commitment: string;
  outputs: Array<{ address: string; amount: number }>;
  fee: number;
  status: string;
  timestamp: number;
  total_output: number;
}

export interface RevealAuditRecord {
  txid: string;
  requester_hash: string;
  result: "success" | "denied" | string;
  reason?: string | null;
  timestamp: number;
}

export interface PolicySnapshot {
  version: string;
  network: string;
  chain_id: number;
  height: number;
  mempool_size: number;
  fee_policy: Record<string, unknown>;
  ring_policy: Record<string, unknown>;
  reveal_policy: Record<string, unknown>;
  signature_policy: Record<string, unknown>;
}

export interface SignedAuditEnvelope {
  algorithm: string;
  payload_hash: string;
  pubkey: string;
  signature: string;
  verified_locally: boolean;
  canonical?: boolean;
  audit_key_generation?: number;
  payload: Record<string, unknown>;
}

export interface AuditEnvelopeVerification {
  valid: boolean;
  hash_ok: boolean;
  signature_ok: boolean;
  expected_payload_hash: string;
  computed_payload_hash: string;
  algorithm: string;
}

export interface AuditKeyRotationRecord {
  generation: number;
  rotated_at: number;
  reason: string;
  old_pubkey: string;
  new_pubkey: string;
  rotation_payload_hash: string;
  rotation_signature: string;
  verified_locally: boolean;
}

export function buildQuantumPrivateTransaction(
  tx: Transaction,
  options: PrivacyOptions = {}
): Transaction {
  const mode = options.mode ?? "transparent";
  const metadata: Record<string, unknown> = {
    ...(tx.metadata ?? {}),
    sig_scheme: options.signatureScheme ?? "hybrid_qr_v1",
    privacy_mode: mode,
    ring_size: options.ringSize ?? 8,
    priority: options.priority ?? 1,
    fast: options.fast ?? true,
  };

  if (mode === "viewable") {
    if (!options.revealKey) {
      throw new Error(
        "buildQuantumPrivateTransaction: revealKey is required for viewable mode"
      );
    }
    metadata.reveal_key = options.revealKey;
  }

  return {
    ...tx,
    metadata,
  };
}

/**
 * Client-side adaptive fee preview.
 * The authoritative fee check is performed by Rust core.
 */
export function estimateAdaptiveFee(
  tx: Transaction,
  mempoolSizeHint: number = 0
): FeePreview {
  const outputTotal = tx.outputs.reduce((sum, out) => sum + Number(out.amount || 0), 0);
  const mode = String((tx.metadata ?? {}).privacy_mode ?? "transparent");
  const ringSizeRaw = Number((tx.metadata ?? {}).ring_size ?? 8);
  const ringSize = Number.isFinite(ringSizeRaw) ? Math.max(3, Math.min(32, ringSizeRaw)) : 8;
  const base = 400;
  const io = tx.inputs.length * 120 + tx.outputs.length * 80;
  const amountComponent = Math.floor(outputTotal * 0.00015);
  const ringComponent =
    mode === "transparent" ? 0 : Math.max(0, Math.floor((ringSize - 4) * 25));
  const congestionMultiplier =
    mempoolSizeHint < 7000 ? 0.85 : mempoolSizeHint < 14000 ? 1.0 : 1.2;
  const estimated = Math.max(
    1,
    Math.floor((base + io + amountComponent + ringComponent) * congestionMultiplier)
  );
  const tier: FeePreview["tier"] =
    estimated < 1000 ? "ultra_cheap" : estimated < 3000 ? "cheap" : "normal";

  return {
    estimated_fee: estimated,
    tier,
    details: {
      base,
      io,
      amount_component: amountComponent,
      ring_component: ringComponent,
      congestion_multiplier: congestionMultiplier,
    },
  };
}

export async function signAndSubmitQuantumTx(
  tx: Transaction,
  options: PrivacyOptions = {}
): Promise<Record<string, unknown>> {
  const prepared = buildQuantumPrivateTransaction(tx, options);
  const signed = await signTransaction(JSON.stringify(prepared));
  const submitResult = await submitTransaction(signed);
  return parseOrThrow<Record<string, unknown>>(submitResult, "signAndSubmitQuantumTx");
}

/** Reveal a viewable private transaction. */
export async function revealPrivateTransaction(
  txid: string,
  revealKey: string
): Promise<RevealResult> {
  const payload = await invoke<string>("bolh_reveal_private_tx", {
    txid,
    reveal_key: revealKey,
  });
  return parseOrThrow<RevealResult>(payload, "revealPrivateTransaction");
}

export async function getRevealAudit(
  limit: number = 20
): Promise<RevealAuditRecord[]> {
  const payload = await invoke<string>("bolh_get_reveal_audit", { limit });
  return parseOrThrow<RevealAuditRecord[]>(payload, "getRevealAudit");
}

export async function getPolicySnapshot(): Promise<PolicySnapshot> {
  const payload = await invoke<string>("bolh_policy_snapshot");
  return parseOrThrow<PolicySnapshot>(payload, "getPolicySnapshot");
}

export async function exportSignedAudit(
  limit: number = 100
): Promise<SignedAuditEnvelope> {
  const payload = await invoke<string>("bolh_export_audit_signed", { limit });
  return parseOrThrow<SignedAuditEnvelope>(payload, "exportSignedAudit");
}

export async function verifySignedAuditEnvelope(
  envelope: SignedAuditEnvelope | Record<string, unknown>
): Promise<AuditEnvelopeVerification> {
  const envelopeJson = JSON.stringify(envelope);
  const payload = await invoke<string>("bolh_verify_audit_export", {
    envelope_json: envelopeJson,
  });
  return parseOrThrow<AuditEnvelopeVerification>(
    payload,
    "verifySignedAuditEnvelope"
  );
}

export async function rotateAuditKey(
  reason: string = "manual"
): Promise<Record<string, unknown>> {
  const payload = await invoke<string>("bolh_rotate_audit_key", { reason });
  return parseOrThrow<Record<string, unknown>>(payload, "rotateAuditKey");
}

export async function getAuditKeyHistory(
  limit: number = 20
): Promise<AuditKeyRotationRecord[]> {
  const payload = await invoke<string>("bolh_get_audit_key_history", { limit });
  return parseOrThrow<AuditKeyRotationRecord[]>(payload, "getAuditKeyHistory");
}

export async function validateAndProcessTx(tx: Transaction): Promise<void> {
  const txJson = JSON.stringify(tx);
  const response = await invoke<string>("bolh_validate_and_process_tx", {
    tx_json: txJson,
  });
  assertNoErrorEnvelope(response, "validateAndProcessTx");
}

export async function persistUTXOSet(): Promise<void> {
  const response = await invoke<string>("bolh_utxo_persist");
  assertNoErrorEnvelope(response, "persistUTXOSet");
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
  return parseOrThrow<BlockProposal>(block, "proposeBlock");
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
  return parseOrThrow<VoteResult>(result, "voteOnBlock");
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
  return parseOrThrow<FinalizedBlock>(block, "finalizeBlock");
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
  return parseOrThrow<ConsensusState>(state, "getConsensusState");
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
  return parseOrThrow<VotingStatus>(status, "getVotingStatus");
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
      revealPrivate: revealPrivateTransaction,
      getRevealAudit,
    },
    audit: {
      getPolicySnapshot,
      exportSigned: exportSignedAudit,
      verifySigned: verifySignedAuditEnvelope,
      rotateKey: rotateAuditKey,
      getKeyHistory: getAuditKeyHistory,
    },
    tx: {
      buildQuantumPrivate: buildQuantumPrivateTransaction,
      estimateAdaptiveFee,
      signAndSubmitQuantumTx,
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

