/**
 * Blockchain Explorer Component
 * Browse blocks, transactions, and addresses on the blockchain
 */

import { createSignal, For, Show, createEffect } from "solid-js";
import type { BlockchainStore } from "../hooks/useBlockchain";
import { copyToClipboard } from "../utils/clipboard";
import { QRButton } from "./QRModal";
import "./BlockchainExplorer.css";

interface ExplorerTab {
  id: "overview" | "transactions" | "blocks" | "addresses" | "search";
  label: string;
  icon: string;
}

interface BlockInfo {
  height: number;
  timestamp: string;
  transactions: number;
  miner: string;
  hash: string;
  reward: number;
}

interface AddressInfo {
  address: string;
  balance: number;
  transactions: number;
  firstSeen: string;
  lastActive: string;
  status: "active" | "inactive";
}

interface ExplorerStats {
  totalTransactions: number;
  totalBlocks: number;
  totalAddresses: number;
  networkHashrate: string;
  difficulty: number;
  lastBlockTime: number;
}

export function BlockchainExplorer(props: {
  blockchain: BlockchainStore;
}) {
  const [activeTab, setActiveTab] = createSignal<ExplorerTab["id"]>("overview");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchType, setSearchType] = createSignal<"address" | "txid" | "block">("address");
  const [selectedAddress, setSelectedAddress] = createSignal<AddressInfo | null>(null);

  // Mock data for explorer
  const explorerTabs: ExplorerTab[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "transactions", label: "Transactions", icon: "📝" },
    { id: "blocks", label: "Blocks", icon: "⛓️" },
    { id: "addresses", label: "Addresses", icon: "👤" },
    { id: "search", label: "Search", icon: "🔍" },
  ];

  const stats: ExplorerStats = {
    totalTransactions: 1304,
    totalBlocks: 12847,
    totalAddresses: 2847,
    networkHashrate: "1.24 PH/s",
    difficulty: 42529.89,
    lastBlockTime: 12,
  };

  const recentBlocks: BlockInfo[] = [
    {
      height: 12847,
      timestamp: new Date().toISOString(),
      transactions: 247,
      miner: "validator_1",
      hash: "A7F3E2C9D1B5...",
      reward: 50,
    },
    {
      height: 12846,
      timestamp: new Date(Date.now() - 12000).toISOString(),
      transactions: 189,
      miner: "validator_2",
      hash: "B8G4F3D0E2C6...",
      reward: 50,
    },
    {
      height: 12845,
      timestamp: new Date(Date.now() - 24000).toISOString(),
      transactions: 312,
      miner: "validator_1",
      hash: "C9H5G4E1F3D7...",
      reward: 50,
    },
  ];

  const recentTransactions = [
    {
      txid: "tx_abc123def456...",
      from: "bolh_addr1...",
      to: "bolh_addr2...",
      amount: 100,
      status: "confirmed" as const,
      time: new Date().toISOString(),
      fee: 0.001,
    },
    {
      txid: "tx_xyz789uvw012...",
      from: "bolh_addr3...",
      to: "bolh_addr4...",
      amount: 250,
      status: "confirmed" as const,
      time: new Date(Date.now() - 5000).toISOString(),
      fee: 0.0025,
    },
  ];

  const topAddresses: AddressInfo[] = [
    {
      address: "bolh_exchange...",
      balance: 5000000,
      transactions: 12847,
      firstSeen: "2026-01-01",
      lastActive: new Date().toISOString(),
      status: "active",
    },
    {
      address: "bolh_treasury...",
      balance: 3500000,
      transactions: 4521,
      firstSeen: "2026-01-05",
      lastActive: new Date().toISOString(),
      status: "active",
    },
    {
      address: "bolh_vault...",
      balance: 2750000,
      transactions: 2147,
      firstSeen: "2026-01-10",
      lastActive: "2026-02-05",
      status: "inactive",
    },
  ];

  const handleSearch = () => {
    const query = searchQuery().trim();
    if (!query) return;

    // Mock search result
    if (searchType() === "address") {
      setSelectedAddress({
        address: query,
        balance: Math.floor(Math.random() * 1000000000),
        transactions: Math.floor(Math.random() * 10000),
        firstSeen: "2026-01-15",
        lastActive: new Date().toISOString(),
        status: "active",
      });
      setActiveTab("search");
    }
  };

  return (
    <div class="blockchain-explorer">
      <div class="explorer-header">
        <h2>⛓️ Blockchain Explorer</h2>
        <p class="explorer-subtitle">Browse blocks, transactions, and addresses</p>
      </div>

      {/* Search Bar */}
      <div class="explorer-search">
        <div class="search-wrapper">
          <input
            type="text"
            placeholder="Search by address, transaction ID, or block height..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          <button class="search-btn" onClick={handleSearch}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div class="explorer-tabs">
        <For each={explorerTabs}>
          {(tab) => (
            <button
              class={`tab-btn ${activeTab() === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span class="tab-icon">{tab.icon}</span>
              <span class="tab-label">{tab.label}</span>
            </button>
          )}
        </For>
      </div>

      {/* Overview Tab */}
      <Show when={activeTab() === "overview"}>
        <div class="explorer-content">
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Total Transactions</div>
              <div class="stat-value">{stats.totalTransactions.toLocaleString()}</div>
              <div class="stat-change">+{Math.floor(Math.random() * 100)} today</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Blocks</div>
              <div class="stat-value">{stats.totalBlocks.toLocaleString()}</div>
              <div class="stat-change">Height: {stats.totalBlocks}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Addresses</div>
              <div class="stat-value">{stats.totalAddresses.toLocaleString()}</div>
              <div class="stat-change">+{Math.floor(Math.random() * 50)} today</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Network Hashrate</div>
              <div class="stat-value">{stats.networkHashrate}</div>
              <div class="stat-change">Avg last 24h</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Difficulty</div>
              <div class="stat-value">{stats.difficulty.toFixed(2)}</div>
              <div class="stat-change">Adjusted</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Last Block Time</div>
              <div class="stat-value">{stats.lastBlockTime}s</div>
              <div class="stat-change">Block #12847</div>
            </div>
          </div>

          {/* Recent Blocks Section */}
          <div class="explorer-section">
            <div class="section-header">
              <h3>Recent Blocks</h3>
            </div>
            <div class="blocks-table">
              <div class="table-header">
                <div class="col-height">Height</div>
                <div class="col-hash">Hash</div>
                <div class="col-transactions">Transactions</div>
                <div class="col-miner">Miner</div>
                <div class="col-time">Time</div>
              </div>
              <For each={recentBlocks}>
                {(block) => (
                  <div class="table-row">
                    <div class="col-height">
                      <span class="block-number">#{block.height}</span>
                    </div>
                    <div class="col-hash">
                      <code class="hash-value" onClick={() => copyToClipboard(block.hash, "Block hash copied!")}>
                        {block.hash}
                      </code>
                    </div>
                    <div class="col-transactions">
                      <span class="tx-count">{block.transactions}</span>
                    </div>
                    <div class="col-miner">
                      <span class="miner-name">{block.miner}</span>
                    </div>
                    <div class="col-time">{new Date(block.timestamp).toLocaleTimeString()}</div>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Top Addresses Section */}
          <div class="explorer-section">
            <div class="section-header">
              <h3>Top Addresses by Balance</h3>
            </div>
            <div class="addresses-grid">
              <For each={topAddresses}>
                {(addr) => (
                  <div class="address-card">
                    <div class="address-header">
                      <div class="address-display">
                        <code class="address-text">{addr.address}</code>
                        <button
                          class="copy-btn"
                          onClick={() => copyToClipboard(addr.address, "Address copied!")}
                          title="Copy address"
                        >
                          📋
                        </button>
                        <QRButton value={addr.address} />
                      </div>
                      <span class={`status-badge ${addr.status}`}>{addr.status}</span>
                    </div>
                    <div class="address-stats">
                      <div class="stat">
                        <span class="label">Balance:</span>
                        <span class="value">{(addr.balance / 100_000_000).toFixed(2)} BOLH</span>
                      </div>
                      <div class="stat">
                        <span class="label">Transactions:</span>
                        <span class="value">{addr.transactions.toLocaleString()}</span>
                      </div>
                      <div class="stat">
                        <span class="label">First Seen:</span>
                        <span class="value">{addr.firstSeen}</span>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Transactions Tab */}
      <Show when={activeTab() === "transactions"}>
        <div class="explorer-content">
          <div class="transactions-list">
            <For each={recentTransactions}>
              {(tx) => (
                <div class="transaction-item">
                  <div class="tx-header">
                    <code class="tx-id" onClick={() => copyToClipboard(tx.txid, "TXID copied!")}>
                      {tx.txid}
                    </code>
                    <span class={`status-badge ${tx.status}`}>{tx.status}</span>
                  </div>
                  <div class="tx-details">
                    <div class="detail-row">
                      <span class="label">From:</span>
                      <code class="address">{tx.from}</code>
                    </div>
                    <div class="detail-row">
                      <span class="arrow">→</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">To:</span>
                      <code class="address">{tx.to}</code>
                    </div>
                    <div class="detail-row">
                      <span class="label">Amount:</span>
                      <span class="amount">{tx.amount} BOLH</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Fee:</span>
                      <span class="fee">{tx.fee} BOLH</span>
                    </div>
                    <div class="detail-row">
                      <span class="label">Time:</span>
                      <span class="time">{new Date(tx.time).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Search Results */}
      <Show when={activeTab() === "search" && selectedAddress()}>
        {(addr) => (
          <div class="explorer-content">
            <div class="search-result-card">
              <h3>Address Details</h3>
              <div class="address-details">
                <div class="detail-item">
                  <span class="label">Address:</span>
                  <code class="value">{addr().address}</code>
                  <button
                    class="copy-btn"
                    onClick={() => copyToClipboard(addr().address, "Address copied!")}
                  >
                    📋
                  </button>
                  <QRButton value={addr().address} />
                </div>
                <div class="detail-item">
                  <span class="label">Balance:</span>
                  <span class="value amount">{(addr().balance / 100_000_000).toFixed(2)} BOLH</span>
                </div>
                <div class="detail-item">
                  <span class="label">Total Transactions:</span>
                  <span class="value">{addr().transactions.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                  <span class="label">First Seen:</span>
                  <span class="value">{addr().firstSeen}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Last Active:</span>
                  <span class="value">{new Date(addr().lastActive).toLocaleString()}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Status:</span>
                  <span class={`status-badge ${addr().status}`}>{addr().status}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Empty State for Search */}
      <Show when={activeTab() === "search" && !selectedAddress()}>
        <div class="explorer-content empty-state">
          <div class="empty-message">
            <span class="empty-icon">🔍</span>
            <p>Enter an address, transaction ID, or block height to search</p>
          </div>
        </div>
      </Show>
    </div>
  );
}
