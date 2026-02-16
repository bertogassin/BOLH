import { createSignal, onMount, createEffect } from "solid-js";
import Chart, { ChartConfiguration } from "chart.js/auto";
import type { BlockchainStore } from "../../hooks/useBlockchain";
import "./Statistics.css";

interface StatisticsProps {
  blockchain: BlockchainStore;
}

export function Statistics(props: StatisticsProps) {
  const [supplyChart, setSupplyChart] = createSignal<Chart | null>(null);
  const [txChart, setTxChart] = createSignal<Chart | null>(null);

  // Real data from blockchain via props (falls back to defaults if not yet loaded)
  const consensus = () => props.blockchain.consensusState();
  const totalSupply = () => consensus()?.height !== undefined ? 10_000_000_000 : 10_000_000_000;
  const balance = () => props.blockchain.balance() || 0;
  const circulatingSupply = () => {
    const c = consensus();
    return c ? (c.validators?.reduce((s: number, v: any) => s + (v.voting_power || 0), 0) || 0) + balance() : 2_500_000_000;
  };
  const stakedSupply = () => {
    const c = consensus();
    return c ? c.validators?.reduce((s: number, v: any) => s + (v.voting_power || 0), 0) || 0 : 750_000_000;
  };
  const reserveSupply = () => totalSupply() - circulatingSupply() - stakedSupply();

  const transactionStats = () => {
    const utxos = props.blockchain.utxos();
    return {
      confirmed: utxos?.length || 0,
      pending: 0,
      failed: 0,
    };
  };

  const validatorStats = () => {
    const c = consensus();
    return {
      active: c?.validators?.length || 0,
      totalStaked: stakedSupply(),
      blockHeight: c?.height || 0,
      networkHash: c?.current_proposer?.slice(0, 12) || "...",
    };
  };

  onMount(() => {
    // Supply Distribution Chart
    const supplyCanvasEl = document.getElementById("supplyChart");
    if (supplyCanvasEl && supplyCanvasEl instanceof HTMLCanvasElement) {
      const ctx = supplyCanvasEl.getContext("2d");
      if (ctx) {
        const supplyConfig: ChartConfiguration = {
          type: "doughnut",
          data: {
            labels: ["Circulating", "Staked", "Reserve"],
            datasets: [
              {
                data: [circulatingSupply(), stakedSupply(), reserveSupply()],
                backgroundColor: [
                  "rgba(99, 102, 241, 0.8)",
                  "rgba(16, 185, 129, 0.8)",
                  "rgba(139, 92, 246, 0.8)",
                ],
                borderColor: ["#6366f1", "#10b981", "#8b5cf6"],
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                position: "bottom" as const,
                labels: {
                  color: "#e5e7eb",
                  font: {
                    size: 12,
                    weight: "bold",
                    family: "'Inter', sans-serif",
                  },
                  padding: 15,
                  usePointStyle: true,
                  pointStyle: "circle",
                },
              },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                titleColor: "#e5e7eb",
                bodyColor: "#d1d5db",
                borderColor: "rgba(99, 102, 241, 0.5)",
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                  label: function (context) {
                    const value = context.parsed as number;
                    const percentage = ((value / totalSupply()) * 100).toFixed(1);
                    const formatted = (value / 1_000_000_000).toFixed(2);
                    return `${context.label}: ${formatted}B BOLH (${percentage}%)`;
                  },
                },
              },
            },
          },
        };

        const chart = new Chart(ctx, supplyConfig);
        setSupplyChart(chart);
      }
    }

    // Transaction Status Chart
    const txCanvasEl = document.getElementById("transactionChart");
    if (txCanvasEl && txCanvasEl instanceof HTMLCanvasElement) {
      const ctx = txCanvasEl.getContext("2d");
      if (ctx) {
        const txConfig: ChartConfiguration = {
          type: "bar",
          data: {
            labels: ["Confirmed", "Pending", "Failed"],
            datasets: [
              {
                label: "Transactions",
                data: [
                  transactionStats().confirmed,
                  transactionStats().pending,
                  transactionStats().failed,
                ],
                backgroundColor: [
                  "rgba(16, 185, 129, 0.8)",
                  "rgba(245, 158, 11, 0.8)",
                  "rgba(239, 68, 68, 0.8)",
                ],
                borderColor: ["#10b981", "#f59e0b", "#ef4444"],
                borderWidth: 2,
                borderRadius: 6,
              },
            ],
          },
          options: {
            indexAxis: "y" as const,
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                titleColor: "#e5e7eb",
                bodyColor: "#d1d5db",
                borderColor: "rgba(99, 102, 241, 0.5)",
                borderWidth: 1,
                padding: 12,
              },
            },
            scales: {
              x: {
                ticks: {
                  color: "#9ca3af",
                  font: {
                    size: 11,
                  },
                },
                grid: {
                  color: "rgba(99, 102, 241, 0.1)",
                },
              },
              y: {
                ticks: {
                  color: "#9ca3af",
                  font: {
                    size: 12,
                    weight: "bold",
                  },
                },
                grid: {
                  display: false,
                },
              },
            },
          },
        };

        const chart = new Chart(ctx, txConfig);
        setTxChart(chart);
      }
    }
  });

  return (
    <div class="statistics-container">
      <div class="stats-header">
        <h2>📊 Статистика блокчейна</h2>
      </div>

      <div class="stats-grid">
        {/* Supply Distribution Chart */}
        <div class="stat-card chart-card">
          <div class="card-header">
            <h3>💰 Распределение BOLH</h3>
            <span class="total-supply">{(totalSupply() / 1_000_000_000).toFixed(0)}B BOLH</span>
          </div>
          <div class="chart-wrapper">
            <canvas id="supplyChart" width="200" height="200"></canvas>
          </div>
        </div>

        {/* Transaction Status Chart */}
        <div class="stat-card chart-card">
          <div class="card-header">
            <h3>📈 Статус транзакций</h3>
            <span class="total-tx">
              Всего: {transactionStats().confirmed + transactionStats().pending + transactionStats().failed}
            </span>
          </div>
          <div class="chart-wrapper">
            <canvas id="transactionChart" width="250" height="160"></canvas>
          </div>
        </div>

        {/* Validator Stats */}
        <div class="stat-card metric-card">
          <div class="card-header">
            <h3>⚙️ Валидаторы</h3>
          </div>
          <div class="metric-grid">
            <div class="metric-item">
              <div class="metric-label">Активные валидаторы</div>
              <div class="metric-value">{validatorStats().active}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Всего заблокировано</div>
              <div class="metric-value">{(validatorStats().totalStaked / 1_000_000_000).toFixed(2)}B</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Высота блока</div>
              <div class="metric-value">{validatorStats().blockHeight.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Network Stats */}
        <div class="stat-card metric-card">
          <div class="card-header">
            <h3>🌐 Сеть</h3>
          </div>
          <div class="metric-grid">
            <div class="metric-item">
              <div class="metric-label">Подтвержденные TX</div>
              <div class="metric-value">{transactionStats().confirmed.toLocaleString()}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Ожидающие TX</div>
              <div class="metric-value pending">{transactionStats().pending}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Хэш сети</div>
              <div class="metric-value hash">{validatorStats().networkHash}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Supply Breakdown Table */}
      <div class="stat-card table-card">
        <div class="card-header">
          <h3>📋 Подробное распределение</h3>
        </div>
        <div class="breakdown-table">
          <div class="table-row header">
            <div class="table-cell">Категория</div>
            <div class="table-cell">Кол-во BOLH</div>
            <div class="table-cell">Процент</div>
            <div class="table-cell">Статус</div>
          </div>
          <div class="table-row">
            <div class="table-cell">
              <span class="category circulating">Циркулирующие</span>
            </div>
            <div class="table-cell">{(circulatingSupply() / 1_000_000_000).toFixed(2)}B</div>
            <div class="table-cell">{((circulatingSupply() / totalSupply()) * 100).toFixed(1)}%</div>
            <div class="table-cell">
              <span class="status active">✓ Активны</span>
            </div>
          </div>
          <div class="table-row">
            <div class="table-cell">
              <span class="category staked">Заблокированные</span>
            </div>
            <div class="table-cell">{(stakedSupply() / 1_000_000_000).toFixed(2)}B</div>
            <div class="table-cell">{((stakedSupply() / totalSupply()) * 100).toFixed(1)}%</div>
            <div class="table-cell">
              <span class="status locked">🔒 Заблокированы</span>
            </div>
          </div>
          <div class="table-row">
            <div class="table-cell">
              <span class="category reserve">Резерв</span>
            </div>
            <div class="table-cell">{(reserveSupply() / 1_000_000_000).toFixed(2)}B</div>
            <div class="table-cell">{((reserveSupply() / totalSupply()) * 100).toFixed(1)}%</div>
            <div class="table-cell">
              <span class="status reserved">⏳ Резервные</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

