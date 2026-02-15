import { createSignal, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Icon, Button } from '@guardio/ui';

// Referral tier info
const tiers = [
  { id: 1, label: 'Tier 1', range: '0 — 1 000', reward: '10 000', color: 'from-yellow-400 to-amber-500', emoji: '🥇', active: false },
  { id: 2, label: 'Tier 2', range: '1 001 — 10 000', reward: '2 500', color: 'from-gray-300 to-gray-400', emoji: '🥈', active: false },
  { id: 3, label: 'Tier 3', range: '10 001 — 100 000', reward: '1 000', color: 'from-amber-600 to-amber-700', emoji: '🥉', active: false },
  { id: 4, label: 'Tier 4', range: '100 001+', reward: '500', color: 'from-indigo-400 to-indigo-500', emoji: '🎯', active: false },
];

// Mock data for demo
const mockUserReferral = {
  code: 'BOLH-A3F8C1D2',
  totalInvited: 7,
  totalEarned: 70000,
  currentTier: 1,
  tierProgress: 7, // 7 out of 1000 for tier 1
  rank: 142,
};

const mockInvitedFriends = [
  { id: '1', name: 'Иван К.', date: '2026-02-12', reward: 10000, status: 'confirmed' },
  { id: '2', name: 'Мария С.', date: '2026-02-11', reward: 10000, status: 'confirmed' },
  { id: '3', name: 'Алексей Р.', date: '2026-02-10', reward: 10000, status: 'confirmed' },
  { id: '4', name: 'Елена Б.', date: '2026-02-09', reward: 10000, status: 'confirmed' },
  { id: '5', name: 'Дмитрий В.', date: '2026-02-08', reward: 10000, status: 'confirmed' },
  { id: '6', name: 'Анна Л.', date: '2026-02-07', reward: 10000, status: 'pending' },
  { id: '7', name: 'Сергей Т.', date: '2026-02-06', reward: 10000, status: 'pending' },
];

const poolStats = {
  totalPool: 2_000_000_000,
  used: 245_000_000,
  totalUsers: 847,
  totalReferrals: 12_540,
};

export default function ReferralPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'overview' | 'friends' | 'tiers'>('overview');
  const [showShareMenu, setShowShareMenu] = createSignal(false);

  const copyCode = () => {
    navigator.clipboard?.writeText(mockUserReferral.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const url = `https://bolh.app/join/${mockUserReferral.code}`;
    if (navigator.share) {
      navigator.share({
        title: 'Присоединяйся к BOLH!',
        text: `Регистрируйся по моей ссылке и получи ${getCurrentReward()} BOLH бесплатно!`,
        url,
      });
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCurrentReward = () => {
    const t = tiers.find(t => t.id === mockUserReferral.currentTier);
    return t?.reward || '500';
  };

  const poolUsedPercent = () => ((poolStats.used / poolStats.totalPool) * 100).toFixed(1);

  return (
    <div class="px-4 py-6 animate-in fade-in pb-24">
      {/* Header */}
      <div class="flex items-center gap-3 mb-5">
        <button
          class="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => navigate(-1)}
        >
          <Icon name="arrowLeft" size="sm" />
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Реферальная программа</h1>
      </div>

      {/* Hero card — your code */}
      <div class="relative rounded-3xl overflow-hidden mb-6" style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #c084fc)">
        {/* Decorative circles */}
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full border-2 border-white/10" />
          <div class="absolute top-20 -right-5 w-24 h-24 rounded-full border border-white/10" />
          <div class="absolute -bottom-8 -left-8 w-32 h-32 rounded-full border-2 border-white/10" />
        </div>

        <div class="p-6 relative">
          <div class="text-white/70 text-sm mb-1">Твой реферальный код</div>
          <div class="flex items-center gap-3 mb-4">
            <div class="text-3xl font-bold text-white tracking-wider font-mono">{mockUserReferral.code}</div>
            <button
              class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                copied() 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              onClick={copyCode}
            >
              {copied() ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          
          <div class="text-white/80 text-sm mb-5">
            Пригласи друга — вы <span class="font-bold text-white">оба</span> получите <span class="font-bold text-white text-lg">{getCurrentReward()} BOLH</span>
          </div>

          {/* Share button */}
          <button
            class="w-full py-3.5 rounded-2xl bg-white text-indigo-600 font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
            onClick={shareLink}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Поделиться ссылкой
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div class="grid grid-cols-3 gap-3 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm">
          <div class="text-2xl font-bold text-indigo-600">{mockUserReferral.totalInvited}</div>
          <div class="text-xs text-gray-500 mt-1">Приглашено</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm">
          <div class="text-2xl font-bold text-green-600">{mockUserReferral.totalEarned.toLocaleString()}</div>
          <div class="text-xs text-gray-500 mt-1">Заработано BOLH</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 text-center shadow-sm">
          <div class="text-2xl font-bold text-amber-600">#{mockUserReferral.rank}</div>
          <div class="text-xs text-gray-500 mt-1">Рейтинг</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 mb-6">
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'overview' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('overview')}
        >
          Обзор
        </button>
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'friends' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('friends')}
        >
          Друзья ({mockUserReferral.totalInvited})
        </button>
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'tiers' ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('tiers')}
        >
          Тиры
        </button>
      </div>

      {/* Overview Tab */}
      <Show when={activeTab() === 'overview'}>
        {/* How it works */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 mb-4 shadow-sm">
          <h3 class="font-bold text-gray-900 dark:text-white mb-4 text-lg">Как это работает</h3>
          <div class="space-y-4">
            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <span class="text-indigo-600 font-bold">1</span>
              </div>
              <div>
                <div class="font-semibold text-gray-800 dark:text-gray-200 text-sm">Поделись кодом</div>
                <div class="text-gray-500 text-xs mt-0.5">Отправь свой код или ссылку другу</div>
              </div>
            </div>
            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <span class="text-green-600 font-bold">2</span>
              </div>
              <div>
                <div class="font-semibold text-gray-800 dark:text-gray-200 text-sm">Друг регистрируется</div>
                <div class="text-gray-500 text-xs mt-0.5">Он вводит код при регистрации</div>
              </div>
            </div>
            <div class="flex gap-4">
              <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <span class="text-amber-600 font-bold">3</span>
              </div>
              <div>
                <div class="font-semibold text-gray-800 dark:text-gray-200 text-sm">Оба получают награду</div>
                <div class="text-gray-500 text-xs mt-0.5">Одинаковая сумма для тебя и друга — честно!</div>
              </div>
            </div>
          </div>
        </div>

        {/* Fair badge */}
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-4 mb-4 flex items-center gap-3 border border-green-200/50 dark:border-green-800/30">
          <div class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div class="font-bold text-green-800 dark:text-green-300 text-sm">100% честная программа</div>
            <div class="text-green-600 dark:text-green-400 text-xs mt-0.5">Без скрытых комиссий. Оба участника получают одинаковую награду.</div>
          </div>
        </div>

        {/* Pool progress */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm mb-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-gray-900 dark:text-white text-sm">Реферальный пул</h3>
            <span class="text-xs text-gray-500">{poolUsedPercent()}% использовано</span>
          </div>
          <div class="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000"
              style={`width: ${poolUsedPercent()}%`}
            />
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">{(poolStats.totalPool - poolStats.used).toLocaleString()}</div>
              <div class="text-xs text-gray-500">Осталось BOLH</div>
            </div>
            <div>
              <div class="text-lg font-bold text-gray-900 dark:text-white">{poolStats.totalReferrals.toLocaleString()}</div>
              <div class="text-xs text-gray-500">Всего рефералов</div>
            </div>
          </div>
        </div>

        {/* Current tier */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-gray-900 dark:text-white text-sm">Текущий тир</h3>
            <span class="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
              🥇 Tier {mockUserReferral.currentTier}
            </span>
          </div>
          <div class="text-gray-500 text-xs mb-3">
            Награда: <span class="font-bold text-indigo-600">{getCurrentReward()} BOLH</span> каждому
          </div>
          <div class="flex items-center gap-2">
            <div class="text-xs text-gray-400">{poolStats.totalUsers}</div>
            <div class="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all"
                style={`width: ${Math.min((poolStats.totalUsers / 1000) * 100, 100)}%`}
              />
            </div>
            <div class="text-xs text-gray-400">1 000</div>
          </div>
          <div class="text-xs text-gray-400 text-center mt-1">
            Ещё {(1000 - poolStats.totalUsers).toLocaleString()} пользователей до Tier 2
          </div>
        </div>
      </Show>

      {/* Friends Tab */}
      <Show when={activeTab() === 'friends'}>
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <span class="text-gray-800 dark:text-gray-200 font-semibold text-sm">Приглашённые друзья</span>
            <span class="text-xs text-gray-500">{mockInvitedFriends.length} чел.</span>
          </div>
          <For each={mockInvitedFriends}>
            {(friend) => (
              <div class="px-4 py-3.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0 flex items-center gap-3">
                {/* Avatar */}
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span class="text-white font-bold text-sm">{friend.name.split(' ').map(n => n[0]).join('')}</span>
                </div>
                {/* Info */}
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{friend.name}</div>
                  <div class="text-xs text-gray-400">{new Date(friend.date).toLocaleDateString('ru-RU')}</div>
                </div>
                {/* Reward + Status */}
                <div class="text-right flex-shrink-0">
                  <div class="text-sm font-bold text-green-600">+{friend.reward.toLocaleString()}</div>
                  <div class={`text-xs ${friend.status === 'confirmed' ? 'text-green-500' : 'text-amber-500'}`}>
                    {friend.status === 'confirmed' ? '✓ Начислено' : '⏳ Ожидание'}
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Invite more CTA */}
        <button
          class="w-full mt-4 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-base hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
          onClick={shareLink}
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Пригласить ещё друзей
        </button>
      </Show>

      {/* Tiers Tab */}
      <Show when={activeTab() === 'tiers'}>
        <div class="space-y-3">
          <For each={tiers}>
            {(tier) => (
              <div class={`rounded-2xl overflow-hidden shadow-sm ${
                tier.id === mockUserReferral.currentTier 
                  ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900' 
                  : ''
              }`}>
                <div class={`bg-gradient-to-r ${tier.color} p-4`}>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">{tier.emoji}</span>
                      <div>
                        <div class="text-white font-bold text-lg">{tier.label}</div>
                        <div class="text-white/80 text-xs">Пользователи: {tier.range}</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-white font-bold text-xl">{tier.reward}</div>
                      <div class="text-white/70 text-xs">BOLH каждому</div>
                    </div>
                  </div>
                  <Show when={tier.id === mockUserReferral.currentTier}>
                    <div class="mt-3 bg-white/20 rounded-xl px-3 py-1.5 text-center">
                      <span class="text-white text-xs font-bold">📍 Ваш текущий тир</span>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Rules */}
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 mt-4 shadow-sm">
          <h3 class="font-bold text-gray-900 dark:text-white mb-3 text-sm">Правила программы</h3>
          <div class="space-y-2.5">
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Оба участника получают <strong>одинаковую</strong> награду</span>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Никаких скрытых комиссий или удержаний</span>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Каждый аккаунт может быть приглашён только один раз</span>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Максимум 50 приглашений в день (антифрод)</span>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Награды начисляются из пула (2 млрд BOLH)</span>
            </div>
            <div class="flex items-start gap-2.5">
              <div class="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span class="text-xs text-gray-600 dark:text-gray-400">Чем раньше — тем больше награда (тиры)</span>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
