import { createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, Button, Icon, Badge } from '@bolh/ui';

// Mock data
const mockBalance = { balance: 1250, locked: 300 };
const mockStats = { supply_total: 100000000, supply_circulating: 12500000, rate_usd: '0.042' };
const mockLedger = [
  { id: '1', direction: 'credit', amount: 500, source: 'Заказ #2024-001', created_at: '2026-02-12T14:30:00Z' },
  { id: '2', direction: 'debit', amount: 150, source: 'Перевод', created_at: '2026-02-11T10:00:00Z' },
  { id: '3', direction: 'credit', amount: 200, source: 'Staking reward', created_at: '2026-02-10T08:00:00Z' },
  { id: '4', direction: 'credit', amount: 1000, source: 'Регистрация бонус', created_at: '2026-02-01T12:00:00Z' },
  { id: '5', direction: 'debit', amount: 300, source: 'Staking lock', created_at: '2026-02-01T12:05:00Z' },
];

export default function WalletPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<'balance' | 'blockchain'>('balance');
  const [balance] = createSignal(mockBalance);
  const [stats] = createSignal(mockStats);
  const [ledger] = createSignal(mockLedger);

  return (
    <div class="px-4 py-6 animate-in fade-in">
      {/* Header */}
      <div class="flex items-center justify-between mb-5">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
        <button
          class="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => navigate('/payments')}
        >
          <Icon name="creditCard" size="sm" />
        </button>
      </div>

      {/* Tab switcher */}
      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 mb-6">
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'balance' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('balance')}
        >
          Баланс
        </button>
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'blockchain' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('blockchain')}
        >
          BOLH Chain
        </button>
      </div>

      {/* Balance Tab */}
      <Show when={activeTab() === 'balance'}>
        {/* Main balance card */}
        <div class="relative rounded-3xl overflow-hidden mb-6" style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)">
          <div class="absolute inset-0 opacity-10">
            <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full border-2 border-white" />
            <div class="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-2 border-white" />
          </div>
          <div class="p-6 relative">
            <div class="text-white/70 text-sm mb-1">Баланс</div>
            <div class="text-4xl font-bold text-white mb-4">{balance().balance.toLocaleString()} <span class="text-lg font-normal text-white/80">BOLH</span></div>
            <div class="flex items-center gap-6">
              <div>
                <div class="text-white/60 text-xs">Заморожено</div>
                <div class="text-white font-semibold">{balance().locked}</div>
              </div>
              <div>
                <div class="text-white/60 text-xs">USD</div>
                <div class="text-white font-semibold">${(Number(stats().rate_usd) * balance().balance).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div class="grid grid-cols-3 gap-3 mb-6">
          <button class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Icon name="plus" size="sm" class="text-green-600" />
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">Пополнить</span>
          </button>
          <button class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow">
            <div class="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Icon name="arrowRight" size="sm" class="text-blue-600" />
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">Перевод</span>
          </button>
          <button
            class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow"
            onClick={() => navigate('/payments')}
          >
            <div class="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Icon name="creditCard" size="sm" class="text-purple-600" />
            </div>
            <span class="text-xs text-gray-600 dark:text-gray-400 font-medium">Карты</span>
          </button>
        </div>

        {/* Transaction history */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <span class="text-gray-800 dark:text-gray-200 font-semibold text-sm">История</span>
            <span class="text-xs text-indigo-500 font-medium cursor-pointer">Все</span>
          </div>
          <For each={ledger()}>
            {(item) => (
              <div class="px-4 py-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class={`w-9 h-9 rounded-full flex items-center justify-center ${item.direction === 'credit' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <Icon name={item.direction === 'credit' ? 'plus' : 'minus'} size="xs" class={item.direction === 'credit' ? 'text-green-600' : 'text-red-600'} />
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-800 dark:text-gray-200">{item.source}</div>
                    <div class="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('ru-RU')}</div>
                  </div>
                </div>
                <div class={`font-bold text-sm ${item.direction === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {item.direction === 'credit' ? '+' : '-'}{item.amount} BOLH
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Blockchain Tab */}
      <Show when={activeTab() === 'blockchain'}>
        {/* Token info card */}
        <div class="rounded-3xl overflow-hidden mb-6" style="background: linear-gradient(135deg, #0f172a, #1e293b)">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span class="text-white font-bold text-xl">B</span>
              </div>
              <div>
                <div class="text-white font-bold text-lg">BOLH Token</div>
                <div class="text-gray-400 text-sm">ERC-20 compatible</div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-white/5 rounded-xl p-3">
                <div class="text-gray-400 text-xs">Курс</div>
                <div class="text-white font-bold text-xl">${stats().rate_usd}</div>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <div class="text-gray-400 text-xs">Баланс</div>
                <div class="text-white font-bold text-xl">{balance().balance} BOLH</div>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <div class="text-gray-400 text-xs">Эмиссия</div>
                <div class="text-white font-bold">{stats().supply_total.toLocaleString()}</div>
              </div>
              <div class="bg-white/5 rounded-xl p-3">
                <div class="text-gray-400 text-xs">В обороте</div>
                <div class="text-white font-bold">{stats().supply_circulating.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Blockchain features */}
        <div class="space-y-3">
          <button
            class="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
            onClick={() => navigate('/referral')}
          >
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
              <Icon name="users" size="md" class="text-indigo-600" />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-gray-800 dark:text-gray-200">Реферальная программа</div>
              <div class="text-sm text-gray-500">Пригласи друга — оба получите BOLH</div>
            </div>
            <div class="flex items-center gap-1">
              <span class="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-bold">NEW</span>
              <Icon name="chevronRight" size="sm" class="text-gray-400" />
            </div>
          </button>

          <button
            class="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
            onClick={() => navigate('/blockchain')}
          >
            <div class="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Icon name="shield" size="md" class="text-indigo-600" />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-gray-800 dark:text-gray-200">Smart Contracts</div>
              <div class="text-sm text-gray-500">Escrow, Bounty, Insurance</div>
            </div>
            <Icon name="chevronRight" size="sm" class="text-gray-400" />
          </button>

          <button
            class="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
            onClick={() => navigate('/blockchain')}
          >
            <div class="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Icon name="lock" size="md" class="text-green-600" />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-gray-800 dark:text-gray-200">Безопасность</div>
              <div class="text-sm text-gray-500">Антифрод, rate-limit, защита от атак</div>
            </div>
            <Icon name="chevronRight" size="sm" class="text-gray-400" />
          </button>

          <button
            class="w-full bg-white dark:bg-gray-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
            onClick={() => navigate('/blockchain')}
          >
            <div class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Icon name="globe" size="md" class="text-blue-600" />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-gray-800 dark:text-gray-200">Explorer</div>
              <div class="text-sm text-gray-500">История транзакций в блокчейне</div>
            </div>
            <Icon name="chevronRight" size="sm" class="text-gray-400" />
          </button>
        </div>
      </Show>
    </div>
  );
}
