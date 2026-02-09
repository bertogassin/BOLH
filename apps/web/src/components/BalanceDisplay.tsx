/**
 * Balance Display Component
 * Shows current wallet balance and UTXO details
 */

import { createSignal, For, Show, createEffect } from "solid-js";
import type { BlockchainStore } from "../hooks/useBlockchain";
import { copyToClipboard } from "../utils/clipboard";
import { Spinner } from "./Spinner";
import { QRButton } from "./QRModal";
import "./BalanceDisplay.css";

interface BalanceDisplayProps {
  blockchain: BlockchainStore;
}

export function BalanceDisplay(props: BalanceDisplayProps) {
  const [showUTXOs, setShowUTXOs] = createSignal(false);
  const [timeAgo, setTimeAgo] = createSignal<string>("never");
  const [manualRefreshing, setManualRefreshing] = createSignal(false);

  const totalUTXOValue = () => {
    return props.blockchain.utxos()
      .filter((u: any) => !u.spent)
      .reduce((sum: number, u: any) => sum + u.amount, 0);
  };

  const formatTimeAgo = (timestamp: number | null) => {
    if (!timestamp) return "never";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Update time display every second
  createEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(props.blockchain.lastRefreshTime()));
    }, 1000);
    return () => clearInterval(interval);
  });

  const handleManualRefresh = async () => {
    setManualRefreshing(true);
    try {
      await props.blockchain.refreshBalance();
      setTimeAgo(formatTimeAgo(props.blockchain.lastRefreshTime()));
    } finally {
      setManualRefreshing(false);
    }
  };

  return (
    <div class="balance-display">
      <div class="balance-card">
        <div class="balance-header">
          <div class="balance-label">Total Balance</div>
          <div class="refresh-controls">
            {props.blockchain.isAutoRefreshing() && (
              <div class="auto-refresh-indicator">
                <Spinner size="small" color="primary" />
              </div>
            )}
            <button
              class="refresh-btn"
              onClick={handleManualRefresh}
              disabled={manualRefreshing()}
              title="Refresh balance"
            >
              {manualRefreshing() ? (
                <Spinner size="small" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        <div class="balance-amount">
          {props.blockchain.balanceLoading() ? (
            <span class="loading">Loading...</span>
          ) : (
            <span>{props.blockchain.balance().toLocaleString()} coins</span>
          )}
        </div>
        <div class="balance-subtext">
          {props.blockchain.allWallets().length} wallet(s) • {props.blockchain.utxos().length} UTXO(s) • Last refresh: {timeAgo()}
        </div>
      </div>

      <Show when={props.blockchain.currentWallet()}>
        {(wallet) => (
          <div class="wallet-details">
            <div class="detail-row">
              <span class="label">Wallet:</span>
              <span class="value">{wallet().name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span>
              <span class="value mono address-container">
                {wallet().address.slice(0, 16)}...
                <button
                  class="copy-btn-inline"
                  onClick={() => copyToClipboard(wallet().address, "Address copied!")}
                  title="Copy full address"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M8 4V16C8 16.5304 8.21071 17.0391 8.58579 17.4142C8.96086 17.7893 9.46957 18 10 18H18C18.5304 18 19.0391 17.7893 19.4142 17.4142C19.7893 17.0391 20 16.5304 20 16V7.242C20 6.97556 19.9467 6.71181 19.8433 6.46624C19.7399 6.22068 19.5885 5.99824 19.398 5.812L16.083 2.57C15.7094 2.20466 15.2076 2.00007 14.685 2H10C9.46957 2 8.96086 2.21071 8.58579 2.58579C8.21071 2.96086 8 3.46957 8 4V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 18V20C16 20.5304 15.7893 21.0391 15.4142 21.4142C15.0391 21.7893 14.5304 22 14 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V9C4 8.46957 4.21071 7.96086 4.58579 7.58579C4.96086 7.21071 5.46957 7 6 7H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <QRButton value={wallet().address} title="Show QR code" />
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Block Height:</span>
              <span class="value">
                {props.blockchain.consensusState()?.height ?? 0}
              </span>
            </div>
          </div>
        )}
      </Show>

      <Show when={props.blockchain.utxos().length > 0}>
        <div class="utxo-section">
          <button
            class="expand-btn"
            onClick={() => setShowUTXOs(!showUTXOs())}
          >
            <span class="arrow">{showUTXOs() ? "▼" : "▶"}</span>
            UTXOs ({props.blockchain.utxos().filter((u: any) => !u.spent).length})
          </button>

          <Show when={showUTXOs()}>
            <div class="utxos-list">
              <For each={props.blockchain.utxos()}>
                {(utxo) => (
                  <div class={`utxo-item ${utxo.spent ? "spent" : "unspent"}`}>
                    <div class="utxo-header">
                      <span class="status">{utxo.spent ? "Spent" : "Unspent"}</span>
                      <span class="amount">{utxo.amount} coins</span>
                    </div>
                    <div class="utxo-txid">{utxo.txid.slice(0, 24)}...</div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
