/**
 * Blockchain State Management Hook
 * Manages wallet, balance, transactions, and consensus state
 */

import { createSignal, createEffect, onMount, Accessor } from "solid-js";
import { createBlockchainApi } from "../api/blockchain";
import type {
  WalletInfo,
  UTXO,
  ConsensusState,
  Transaction,
} from "../api/blockchain";

export interface BlockchainStore {
  // Initialization (as signals/accessors)
  initialized: Accessor<boolean>;
  initError: Accessor<string | null>;

  // Wallet (as signals/accessors)
  currentWallet: Accessor<WalletInfo | null>;
  allWallets: Accessor<WalletInfo[]>;
  walletError: Accessor<string | null>;

  // Balance (as signals/accessors)
  balance: Accessor<number>;
  utxos: Accessor<UTXO[]>;
  balanceLoading: Accessor<boolean>;
  lastRefreshTime: Accessor<number | null>;
  isAutoRefreshing: Accessor<boolean>;

  // Consensus (as signals/accessors)
  consensusState: Accessor<ConsensusState | null>;
  consensusError: Accessor<string | null>;

  // WebSocket (as signals/accessors)
  wsConnected: Accessor<boolean>;

  // Actions
  init: () => Promise<void>;
  createWallet: (name: string) => Promise<void>;
  selectWallet: (name: string) => Promise<void>;
  deleteWallet: (name: string) => Promise<void>;
  importWallet: (name: string, pubkey: string, seckey: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
  submitTransaction: (tx: Transaction) => Promise<string>;
  refreshConsensus: () => Promise<void>;
}

export function useBlockchain(): BlockchainStore {
  const api = createBlockchainApi();

  // State signals
  const [initialized, setInitialized] = createSignal(false);
  const [initError, setInitError] = createSignal<string | null>(null);

  const [currentWallet, setCurrentWallet] = createSignal<WalletInfo | null>(
    null
  );
  const [allWallets, setAllWallets] = createSignal<WalletInfo[]>([]);
  const [walletError, setWalletError] = createSignal<string | null>(null);

  const [balance, setBalance] = createSignal(0);
  const [utxos, setUTXOs] = createSignal<UTXO[]>([]);
  const [balanceLoading, setBalanceLoading] = createSignal(false);
  const [lastRefreshTime, setLastRefreshTime] = createSignal<number | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = createSignal(false);

  const [consensusState, setConsensusState] = createSignal<ConsensusState | null>(
    null
  );
  const [consensusError, setConsensusError] = createSignal<string | null>(null);

  const [wsConnected, setWsConnected] = createSignal(false);

  // Initialize blockchain
  const init = async () => {
    try {
      setInitError(null);
      await api.init();
      setInitialized(true);

      // Load existing wallets
      const wallets = await api.wallet.list();
      setAllWallets(wallets);

      // Auto-select first wallet if exists
      if (wallets.length > 0) {
        await selectWallet(wallets[0].name);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setInitError(`Failed to initialize blockchain: ${msg}`);
      console.error(msg);
    }
  };

  // Create new wallet
  const createWallet = async (name: string) => {
    try {
      setWalletError(null);
      const wallet = await api.wallet.create(name);
      const updated = await api.wallet.list();
      setAllWallets(updated);
      await selectWallet(name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to create wallet: ${msg}`);
      console.error(msg);
    }
  };

  // Select active wallet and load its balance
  const selectWallet = async (name: string) => {
    try {
      setWalletError(null);
      setBalanceLoading(true);

      const wallet = await api.wallet.getInfo(name);
      setCurrentWallet(wallet);

      // Load balance from UTXO
      await refreshBalance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to select wallet: ${msg}`);
      console.error(msg);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Delete wallet
  const deleteWallet = async (name: string) => {
    try {
      setWalletError(null);
      await api.wallet.delete(name);
      const updated = await api.wallet.list();
      setAllWallets(updated);

      // If deleted wallet was selected, select another or clear
      if (currentWallet()?.name === name) {
        if (updated.length > 0) {
          await selectWallet(updated[0].name);
        } else {
          setCurrentWallet(null);
          setBalance(0);
          setUTXOs([]);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to delete wallet: ${msg}`);
      console.error(msg);
    }
  };

  // Import wallet from keys
  const importWallet = async (name: string, pubkey: string, seckey: string) => {
    try {
      setWalletError(null);
      await api.wallet.import(name, pubkey, seckey);
      const updated = await api.wallet.list();
      setAllWallets(updated);
      await selectWallet(name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to import wallet: ${msg}`);
      console.error(msg);
    }
  };

  // Refresh wallet balance and UTXOs
  const refreshBalance = async () => {
    const wallet = currentWallet();
    if (!wallet) return;

    try {
      setBalanceLoading(true);
      const bal = await api.utxo.getBalance(wallet.address);
      setBalance(bal);

      const unspent = await api.utxo.getAll(wallet.address);
      setUTXOs(unspent);
      setLastRefreshTime(Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to refresh balance: ${msg}`);
      console.error(msg);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Submit transaction
  const submitTransaction = async (tx: Transaction): Promise<string> => {
    try {
      setWalletError(null);
      const signed = await api.signTransaction(JSON.stringify(tx));
      const result = await api.submitTransaction(signed);
      await refreshBalance();
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setWalletError(`Failed to submit transaction: ${msg}`);
      throw err;
    }
  };

  // Refresh consensus state
  const refreshConsensus = async () => {
    try {
      setConsensusError(null);
      const state = await api.consensus.getState();
      setConsensusState(state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setConsensusError(`Failed to refresh consensus: ${msg}`);
      console.error(msg);
    }
  };

  // Initialize WebSocket connection for real-time updates
  createEffect(() => {
    if (!initialized()) return;

    // Construct WebSocket URL from API base URL
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
    const wsBase = apiUrl.replace(/^https?:/, "");
    const wsUrl = `${wsProtocol}:${wsBase}/blockchain/ws`;

    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      setWsConnected(true);
      console.log("Blockchain WebSocket connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWsMessage(message);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    });

    ws.addEventListener("close", () => {
      setWsConnected(false);
      // Attempt reconnect after 3 seconds
      setTimeout(() => ws.close(), 3000);
    });

    ws.addEventListener("error", (err) => {
      setWsConnected(false);
      console.error("WebSocket error:", err);
    });

    return () => ws.close();
  });

  const handleWsMessage = (message: any) => {
    switch (message.type) {
      case "blockchain:tx":
        console.log("Transaction update:", message.data);
        break;
      case "blockchain:wallet":
        refreshWalletsList();
        break;
      case "blockchain:balance":
        if (currentWallet()?.address === message.data.address) {
          setBalance(message.data.balance);
        }
        break;
      case "blockchain:block":
        refreshConsensus();
        break;
      default:
        break;
    }
  };

  const refreshWalletsList = async () => {
    try {
      const wallets = await api.wallet.list();
      setAllWallets(wallets);
    } catch (err) {
      console.error("Failed to refresh wallets:", err);
    }
  };

  // Auto-refresh on mount
  onMount(() => {
    init();
    const consensusInterval = setInterval(refreshConsensus, 5000); // Every 5s
    
    // Auto-refresh balance every 10 seconds
    const balanceInterval = setInterval(() => {
      if (currentWallet() && !balanceLoading()) {
        setIsAutoRefreshing(true);
        refreshBalance().finally(() => setIsAutoRefreshing(false));
      }
    }, 10000);
    
    return () => {
      clearInterval(consensusInterval);
      clearInterval(balanceInterval);
    };
  });

  return {
    initialized,
    initError,
    currentWallet,
    allWallets,
    walletError,
    balance,
    utxos,
    balanceLoading,
    lastRefreshTime,
    isAutoRefreshing,
    consensusState,
    consensusError,
    wsConnected,
    init,
    createWallet,
    selectWallet,
    deleteWallet,
    importWallet,
    refreshBalance,
    submitTransaction,
    refreshConsensus,
  };
}
