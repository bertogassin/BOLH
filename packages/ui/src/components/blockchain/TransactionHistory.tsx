import { createSignal, For, Show, createEffect } from "solid-js";
import type { BlockchainStore } from "../../hooks/useBlockchain";
import { copyToClipboard } from "../../utils/clipboard";
import "./TransactionHistory.css";

interface TransactionRecords {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  status: "pending" | "confirmed" | "failed";
  fee: number;
}

interface TransactionHistoryProps {
  blockchain: BlockchainStore;
}

export function TransactionHistory(props: TransactionHistoryProps) {
  const [transactions, setTransactions] = createSignal<TransactionRecords[]>([
    {
      id: "tx_123abc...",
      from: "bolh_abc123...",
      to: "bolh_def456...",
      amount: 100_000_000,
      timestamp: "2026-02-08T19:30:00Z",
      status: "confirmed",
      fee: 1000,
    },
    {
      id: "tx_456def...",
      from: "bolh_abc123...",
      to: "bolh_ghi789...",
      amount: 50_000_000,
      timestamp: "2026-02-08T19:15:00Z",
      status: "confirmed",
      fee: 1000,
    },
    {
      id: "tx_789ghi...",
      from: "bolh_xyz999...",
      to: "bolh_abc123...",
      amount: 250_000_000,
      timestamp: "2026-02-08T19:00:00Z",
      status: "pending",
      fee: 1000,
    },
  ]);

  const [searchTerm, setSearchTerm] = createSignal("");
  const [filterType, setFilterType] = createSignal<"txid" | "address" | "all">("all");
  const [filteredTx, setFilteredTx] = createSignal<TransactionRecords[]>([]);

  createEffect(() => {
    const search = searchTerm().toLowerCase().trim();
    const type = filterType();
    const allTx = transactions();

    if (search === "") {
      setFilteredTx(allTx);
      return;
    }

    const filtered = allTx.filter((tx) => {
      if (type === "txid") {
        return tx.id.toLowerCase().includes(search);
      } else if (type === "address") {
        return tx.from.toLowerCase().includes(search) || tx.to.toLowerCase().includes(search);
      } else {
        return (
          tx.id.toLowerCase().includes(search) ||
          tx.from.toLowerCase().includes(search) ||
          tx.to.toLowerCase().includes(search)
        );
      }
    });

    setFilteredTx(filtered);
  });

  const formatAddress = (addr: string) => `${addr.slice(0, 10)}...${addr.slice(-6)}`;
  const formatAmount = (amount: number) => (amount / 100_000_000).toFixed(2);
  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString("ru-RU");

  return (
    <div class="transaction-history">
      <div class="history-header">
        <h2>📝 История транзакций</h2>
        <span class="tx-count">{transactions().length}</span>
      </div>

      <div class="search-controls">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Поиск по ID транзакции, адресу..."
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm() && (
            <button class="search-clear" onClick={() => setSearchTerm("")} title="Очистить поиск">
              ✕
            </button>
          )}
        </div>

        <div class="filter-buttons">
          <button
            class={`filter-btn ${filterType() === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
            title="Поиск везде"
          >
            Везде
          </button>
          <button
            class={`filter-btn ${filterType() === "txid" ? "active" : ""}`}
            onClick={() => setFilterType("txid")}
            title="Поиск по ID"
          >
            ID
          </button>
          <button
            class={`filter-btn ${filterType() === "address" ? "active" : ""}`}
            onClick={() => setFilterType("address")}
            title="Поиск по адресу"
          >
            Адресс
          </button>
        </div>
      </div>

      {searchTerm() && (
        <div class="search-results-info">
          Найдено транзакций: <span class="result-count">{filteredTx().length}</span>
        </div>
      )}

      <Show when={filteredTx().length === 0}>
        <div class="history-empty">
          {searchTerm() ? "❌ Транзакции не найдены" : "Нет транзакций. Начните с отправки BOLH! 📤"}
        </div>
      </Show>

      <div class="tx-timeline">
        <For each={filteredTx()}>
          {(tx) => (
            <div class={`tx-card ${tx.status}`}>
              <div class="tx-header">
                <div
                  class="tx-id"
                  onClick={() => copyToClipboard(tx.id, "Transaction ID copied!")}
                  title="Click to copy"
                >
                  {tx.id}
                </div>
                <div class={`tx-status ${tx.status}`}>
                  {tx.status === "pending" ? "⏳ В ожидании" : ""}
                  {tx.status === "confirmed" ? "✓ Подтверждена" : ""}
                  {tx.status === "failed" ? "✕ Ошибка" : ""}
                </div>
              </div>

              <div class="tx-body">
                <div class="tx-pair">
                  <div class="tx-from">
                    <span class="label">От:</span>
                    <span
                      class="address"
                      onClick={() => copyToClipboard(tx.from, "From address copied!")}
                      title="Click to copy"
                    >
                      {formatAddress(tx.from)}
                    </span>
                  </div>
                  <div class="tx-arrow">→</div>
                  <div class="tx-to">
                    <span class="label">На:</span>
                    <span
                      class="address"
                      onClick={() => copyToClipboard(tx.to, "To address copied!")}
                      title="Click to copy"
                    >
                      {formatAddress(tx.to)}
                    </span>
                  </div>
                </div>

                <div class="tx-amount">
                  {formatAmount(tx.amount)} BOLH
                </div>
              </div>

              <div class="tx-footer">
                <span class="tx-time">{formatTime(tx.timestamp)}</span>
                <span class="tx-fee">Комиссия: {(tx.fee / 100_000_000).toFixed(5)} BOLH</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

