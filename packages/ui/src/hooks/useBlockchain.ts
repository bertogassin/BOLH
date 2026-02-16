/**
 * BlockchainStore type — shared interface for blockchain components
 * Implementation lives in apps/, this is type-only for packages/ui
 */
import type { Accessor } from 'solid-js';
import type { WalletInfo, UTXO, ConsensusState, Transaction } from '../api/blockchain';

export interface BlockchainStore {
  initialized: Accessor<boolean>;
  initError: Accessor<string | null>;
  currentWallet: Accessor<WalletInfo | null>;
  allWallets: Accessor<WalletInfo[]>;
  walletError: Accessor<string | null>;
  balance: Accessor<number>;
  utxos: Accessor<UTXO[]>;
  balanceLoading: Accessor<boolean>;
  lastRefreshTime: Accessor<number | null>;
  isAutoRefreshing: Accessor<boolean>;
  wsConnected: Accessor<boolean>;
  consensusState: Accessor<ConsensusState | null>;
  consensusError: Accessor<string | null>;
  init: () => Promise<void>;
  createWallet: (name: string) => Promise<void>;
  selectWallet: (name: string) => Promise<void>;
  deleteWallet: (name: string) => Promise<void>;
  importWallet: (name: string, pubkey: string, seckey: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
  submitTransaction: (tx: Transaction) => Promise<string>;
  refreshConsensus: () => Promise<void>;
}
