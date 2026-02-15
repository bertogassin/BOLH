import { createSignal, For, Show, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import { t, setLanguage, getLanguages, getCurrentLanguage, isRTL, currentLang } from '../i18n';
import { theme, setTheme, isDark, activeTheme } from '../theme';
import { departments, getDepartment, getDepartmentSkills, getSkillGroups, type Department, type SkillGroup } from '../departments';
import { getDailyLesson, lessonTypeLabel, levelLabel } from '../english_learn';
import { BlockchainScreen } from '../components';
import { askElina, addPersonality, createElinaContext, updateContext, type ElinaMessage, type ElinaContext, type ElinaAction } from '../elina';
import { toasts, dismissToast, showToast, notify, requestNotificationPermission, startDemoNotifications, unreadCount, type AppNotification } from '../notifications';
import { balance, frozenBalance, cards, transactions, escrows, deposit, withdraw, payForOrder, releaseEscrow, refundEscrow, addCard, removeCard, setDefaultCard, getStats, type PaymentCard, type Transaction } from '../payments';
import {
  tauriCoreInvoke,
  activeDepartment, setActiveDepartment,
  workerSkills, setWorkerSkills,
  verifiedDiplomas, setVerifiedDiplomas,
  workerStatus, setWorkerStatus,
  busyUntil, setBusyUntil,
  autoOnlineTime, setAutoOnlineTime,
  profileMode, setProfileMode,
  clientNeeds, setClientNeeds,
  homeMode, setHomeMode,
  homeExpandedDept, setHomeExpandedDept,
  homeExpandedGroup, setHomeExpandedGroup,
  homeExpandedSkill, setHomeExpandedSkill,
  getActiveDept,
  pinnedDepts, setPinnedDepts, togglePin,
  initLikes, getLikeCount, hasLiked, likeOnce,
  authUser, setAuthUser, saveAuth, clearAuth, loadAuth, isAuthenticated,
  type AuthUser,
} from '../store';
import { Icon, SkillIcon, Icons, EMOJI_TO_ICON, type NotifType } from '../ui';
import { LikeBadge, SwipeLayer, SwipeBack, playGlobalSound, haptic, hapticOrder, globalSoundEnabled, setGlobalSoundEnabled, globalHapticEnabled, setGlobalHapticEnabled, globalNotifSound, setGlobalNotifSound, globalVolume, setGlobalVolume, vibrationIntensity, setVibrationIntensity, rareEscalationEnabled, setRareEscalationEnabled } from '../ui';
import { MobileElina, ElinaChatPanel } from '../elina-ui';

export default function ReferralPage(props: { onBack: () => void }) {
  const invoke = (cmd: string, args?: any): Promise<any> => {
    const w = window as any;
    if (w.__TAURI_INTERNALS__?.invoke) return w.__TAURI_INTERNALS__.invoke(cmd, args || {});
    return Promise.reject(new Error('Tauri not available'));
  };

  const [copied, setCopied] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'overview' | 'friends' | 'tiers' | 'enter'>('overview');
  const [loading, setLoading] = createSignal(true);
  const [myCode, setMyCode] = createSignal('');
  const [myStats, setMyStats] = createSignal<any>({ referral_count: 0, total_earned: 0 });
  const [programStats, setProgramStats] = createSignal<any>(null);
  const [referralHistory, setReferralHistory] = createSignal<any[]>([]);
  const [invitedBy, setInvitedBy] = createSignal<string | null>(null);
  const [enterCode, setEnterCode] = createSignal('');
  const [applyStatus, setApplyStatus] = createSignal('');
  const [applyLoading, setApplyLoading] = createSignal(false);

  const tiersList = [
    { id: 1, label: 'Tier 1', range: '0 — 1 000', reward: '10 000', color: 'from-slate-300 to-slate-400', icon: 'trophy' as const, iconColor: 'text-slate-500 dark:text-gray-200' },
    { id: 2, label: 'Tier 2', range: '1 001 — 10 000', reward: '2 500', color: 'from-slate-400 to-slate-500', icon: 'award' as const, iconColor: 'text-slate-500 dark:text-gray-200' },
    { id: 3, label: 'Tier 3', range: '10 001 — 100 000', reward: '1 000', color: 'from-slate-500 to-slate-600', icon: 'award' as const, iconColor: 'text-slate-600 dark:text-white/90' },
    { id: 4, label: 'Tier 4', range: '100 001+', reward: '500', color: 'from-indigo-400 to-indigo-500', icon: 'target' as const, iconColor: 'text-indigo-500 dark:text-indigo-400' },
  ];

  const walletName = () => localStorage.getItem('bolh_wallet_name') || 'default';
  const formatBolh = (raw: number) => Math.floor(raw / 100_000_000).toLocaleString();
  const currentTier = () => programStats()?.current_tier || 1;
  const rewardPerPerson = () => programStats()?.current_reward_per_person ? formatBolh(programStats().current_reward_per_person) : '10 000';
  const poolTotal = () => programStats()?.pool_total || 2_000_000_000_00_000_000;
  const poolRemaining = () => programStats()?.pool_remaining || poolTotal();
  const poolPercent = () => programStats()?.pool_used_percent?.toFixed(1) || '0.0';
  const totalUsers = () => programStats()?.user_count || 0;
  const tierMax = () => currentTier() === 1 ? 1000 : currentTier() === 2 ? 10000 : currentTier() === 3 ? 100000 : 1000000;
  const tierMin = () => currentTier() === 1 ? 0 : currentTier() === 2 ? 1000 : currentTier() === 3 ? 10000 : 100000;

  // Shorthand for dark-mode text
  const txt = () => isDark() ? 'text-gray-100' : 'text-gray-900';
  const txtSub = () => isDark() ? 'text-gray-200' : 'text-gray-500';
  const txtMuted = () => isDark() ? 'text-gray-300' : 'text-gray-400';
  const cardBg = () => isDark() ? 'bg-black/70 border border-white/5' : 'glass';
  const inputBg = () => isDark() ? 'bg-black text-white placeholder:text-gray-400' : 'bg-gray-100 text-gray-800 placeholder:text-gray-400';

  const loadData = async () => {
    setLoading(true);
    try {
      const codeRes = await invoke('bolh_get_referral_code', { walletName: walletName() });
      if (codeRes?.code) {
        setMyCode(codeRes.code);
        setMyStats({ referral_count: codeRes.referral_count || 0, total_earned: codeRes.total_earned || 0 });
      }
      const stats = await invoke('bolh_referral_stats');
      if (stats) setProgramStats(stats);
      const hist = await invoke('bolh_referral_history', { walletName: walletName() });
      if (hist?.referrals) setReferralHistory(hist.referrals);
      if (hist?.invited_by) setInvitedBy(hist.invited_by);
    } catch (e) {
      console.error('Referral load error:', e);
    }
    setLoading(false);
  };

  onMount(loadData);

  const copyCode = () => {
    navigator.clipboard?.writeText(myCode());
    setCopied(true);
    haptic('medium');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const url = `https://bolh.app/join/${myCode()}`;
    if (navigator.share) {
      navigator.share({ title: 'BOLH', text: `Регистрируйся и получи ${rewardPerPerson()} BOLH!`, url });
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    haptic('medium');
  };

  const applyReferral = async () => {
    const code = enterCode().trim().toUpperCase();
    if (!code) return;
    setApplyLoading(true);
    setApplyStatus('');
    try {
      const res = await invoke('bolh_apply_referral', { walletName: walletName(), referralCode: code });
      if (res?.success) {
        setApplyStatus(`✅ ${res.message || 'Успешно!'} +${formatBolh(res.invitee_reward || 0)} BOLH`);
        haptic('success');
        setEnterCode('');
        loadData();
      } else {
        setApplyStatus(`❌ ${res?.message || 'Ошибка'}`);
        haptic('error');
      }
    } catch (e: any) {
      setApplyStatus(`❌ ${e.message || 'Ошибка сети'}`);
    }
    setApplyLoading(false);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Gradient header */}
      <div class="bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 px-4 pt-3 pb-5" style="padding-top: max(env(safe-area-inset-top), 12px)">
        <div class="flex items-center gap-3 mb-4">
          <button type="button" class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center touch-press backdrop-blur-sm"
            onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <p class="text-white/90 text-xs font-medium">{currentLang() === 'en' ? 'Blockchain' : 'Блокчейн'}</p>
            <h1 class="text-white font-bold text-lg">{currentLang() === 'en' ? 'Referral Program' : 'Реферальная программа'}</h1>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Icon name="handshake" size="lg" class="text-white" />
          </div>
        </div>
        {/* Mini stats in header */}
        <div class="flex gap-2">
          <div class="flex-1 rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2 text-center">
            <div class="text-white font-bold text-lg">{myStats().referral_count}</div>
            <div class="text-white/90 text-[10px]">{currentLang() === 'en' ? 'Invited' : 'Приглашено'}</div>
          </div>
          <div class="flex-1 rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2 text-center">
            <div class="text-white font-bold text-lg">{formatBolh(myStats().total_earned)}</div>
            <div class="text-white/90 text-[10px]">BOLH</div>
          </div>
          <div class="flex-1 rounded-xl bg-white/15 backdrop-blur-sm px-3 py-2 text-center">
            <div class="text-white font-bold text-lg flex items-center justify-center gap-1"><Icon name={tiersList[currentTier() - 1]?.icon ?? 'trophy'} size="sm" class="text-white" /> T{currentTier()}</div>
            <div class="text-white/90 text-[10px]">{currentLang() === 'en' ? 'Tier' : 'Тир'}</div>
          </div>
        </div>
      </div>

      <div class="px-4 pt-4 pb-28">
        <Show when={loading()}>
          <div class={`text-center py-10 text-sm ${txtSub()}`}>{currentLang() === 'en' ? 'Loading...' : 'Загрузка...'}</div>
        </Show>

        <Show when={!loading()}>
          {/* Referral code card */}
          <div class={`${cardBg()} rounded-2xl p-4 mb-4`}>
            <p class={`text-xs font-medium mb-2 ${txtSub()}`}>{currentLang() === 'en' ? 'Your referral code' : 'Твой реферальный код'}</p>
            <div class="flex items-center gap-2 mb-3">
              <div class={`text-xl font-bold tracking-wider font-mono ${txt()}`}>{myCode() || '—'}</div>
              <Show when={myCode()}>
                <button
                  class={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${copied() ? 'bg-green-500 text-white' : 'bg-indigo-500 text-white'}`}
                  onClick={copyCode}
                >
                  {copied() ? '✓' : (currentLang() === 'en' ? 'Copy' : 'Копировать')}
                </button>
              </Show>
            </div>
            <p class={`text-xs mb-4 ${txtSub()}`}>
              {currentLang() === 'en' ? 'Invite a friend — you' : 'Пригласи друга — вы'} <span class={`font-bold ${txt()}`}>{currentLang() === 'en' ? 'both' : 'оба'}</span> {currentLang() === 'en' ? 'get' : 'получите'} <span class="font-bold text-indigo-500 text-base">{rewardPerPerson()} BOLH</span>
            </p>
            <div class="flex gap-2">
              <button
                class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg touch-scale"
                onClick={shareLink}
              >
                <Icon name="share2" class="text-white" size="sm" />
                {currentLang() === 'en' ? 'Share' : 'Поделиться'}
              </button>
              <Show when={!invitedBy()}>
                <button
                  class={`py-3 px-4 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all touch-scale ${isDark() ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'}`}
                  onClick={() => setActiveTab('enter')}
                >
                  {currentLang() === 'en' ? 'Enter code' : 'Ввести код'}
                </button>
              </Show>
            </div>
          </div>

          {/* Invited-by badge */}
          <Show when={invitedBy()}>
            <div class={`rounded-2xl p-3 mb-4 flex items-center gap-2 ${isDark() ? 'bg-black/70 border border-white/5' : 'bg-slate-50 border border-slate-200/50'}`}>
              <Icon name="checkCircle" size="xs" class="text-emerald-600 dark:text-emerald-400" />
              <span class={`text-xs ${isDark() ? 'text-slate-300' : 'text-slate-600'}`}>{currentLang() === 'en' ? 'Invited by' : 'Вы приглашены'}: <span class="font-mono text-[10px]">{invitedBy()?.substring(0, 16)}...</span></span>
            </div>
          </Show>

          {/* Tabs */}
          <div class={`flex rounded-2xl p-1 mb-4 ${isDark() ? 'bg-neutral-900' : 'bg-gray-100'}`}>
            {([
              { key: 'overview' as const, label: currentLang() === 'en' ? 'Overview' : 'Обзор' },
              { key: 'friends' as const, label: currentLang() === 'en' ? 'Friends' : 'Друзья' },
              { key: 'tiers' as const, label: currentLang() === 'en' ? 'Tiers' : 'Тиры' },
              ...(!invitedBy() ? [{ key: 'enter' as const, label: currentLang() === 'en' ? 'Code' : 'Код' }] : []),
            ]).map((tab) => (
              <button
                class={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab() === tab.key
                    ? (isDark() ? 'bg-neutral-900 text-indigo-400 shadow-sm' : 'bg-white text-indigo-600 shadow-sm')
                    : (isDark() ? 'text-gray-300' : 'text-gray-500')
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ Enter referral code ═══ */}
          <Show when={activeTab() === 'enter'}>
            <div class={`${cardBg()} rounded-2xl p-5 mb-4`}>
              <h3 class={`font-bold mb-2 ${txt()}`}>{currentLang() === 'en' ? 'Enter referral code' : 'Ввести реферальный код'}</h3>
              <p class={`text-xs mb-4 ${txtSub()}`}>
                {currentLang() === 'en' ? `If a friend invited you, enter their code. You'll both get ${rewardPerPerson()} BOLH.` : `Если вас пригласил друг, введите его код. Вы оба получите ${rewardPerPerson()} BOLH.`}
              </p>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="BOLH-XXXXXXXX"
                  value={enterCode()}
                  onInput={(e) => setEnterCode(e.currentTarget.value)}
                  class={`flex-1 px-4 py-3 rounded-xl border-0 outline-none font-mono text-sm uppercase ${inputBg()}`}
                />
                <button
                  class="px-5 py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm active:scale-[0.97] transition-all disabled:opacity-50"
                  onClick={applyReferral}
                  disabled={applyLoading() || !enterCode().trim()}
                >
                  {applyLoading() ? '...' : (currentLang() === 'en' ? 'Apply' : 'Применить')}
                </button>
              </div>
              <Show when={applyStatus()}>
                <div class={`mt-3 text-sm ${txt()}`}>{applyStatus()}</div>
              </Show>
            </div>
          </Show>

          {/* ═══ Overview ═══ */}
          <Show when={activeTab() === 'overview'}>
            {/* How it works */}
            <div class={`${cardBg()} rounded-2xl p-5 mb-4`}>
              <h3 class={`font-bold mb-4 ${txt()}`}>{currentLang() === 'en' ? 'How it works' : 'Как это работает'}</h3>
              <div class="space-y-4">
                {[
                  { n: '1', bg: 'bg-indigo-100 dark:bg-indigo-900/40', tc: 'text-indigo-600', title: currentLang() === 'en' ? 'Share your code' : 'Поделись кодом', desc: currentLang() === 'en' ? 'Send your code or link to a friend' : 'Отправь код или ссылку другу' },
                  { n: '2', bg: 'bg-green-100 dark:bg-green-900/40', tc: 'text-green-600', title: currentLang() === 'en' ? 'Friend signs up' : 'Друг регистрируется', desc: currentLang() === 'en' ? 'Enters your code in the "Code" tab' : 'Вводит код во вкладке "Код"' },
                  { n: '3', bg: 'bg-amber-100 dark:bg-amber-900/40', tc: 'text-amber-600', title: currentLang() === 'en' ? 'Both get rewarded' : 'Оба получают награду', desc: currentLang() === 'en' ? 'Equal reward — fair!' : 'Одинаковая сумма — честно!' },
                ].map((step) => (
                  <div class="flex gap-3">
                    <div class={`w-9 h-9 rounded-full ${step.bg} flex items-center justify-center flex-shrink-0`}>
                      <span class={`${step.tc} font-bold text-sm`}>{step.n}</span>
                    </div>
                    <div>
                      <div class={`font-semibold text-sm ${txt()}`}>{step.title}</div>
                      <div class={`text-xs ${txtSub()}`}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fair badge */}
            <div class={`rounded-2xl p-4 mb-4 flex items-center gap-3 ${isDark() ? 'bg-green-900/20 border border-green-700/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50'}`}>
              <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Icon name="shield" class="text-white" size="sm" />
              </div>
              <div>
                <div class={`font-bold text-sm ${isDark() ? 'text-green-300' : 'text-green-800'}`}>100% {currentLang() === 'en' ? 'fair program' : 'честная программа'}</div>
                <div class={`text-xs ${isDark() ? 'text-green-400' : 'text-green-600'}`}>{currentLang() === 'en' ? 'No hidden fees. Equal reward.' : 'Без скрытых комиссий. Равная награда.'}</div>
              </div>
            </div>

            {/* Referral Pool */}
            <div class={`${cardBg()} rounded-2xl p-5 mb-4`}>
              <div class="flex items-center justify-between mb-3">
                <h3 class={`font-bold text-sm ${txt()}`}>{currentLang() === 'en' ? 'Referral Pool' : 'Реферальный пул'}</h3>
                <span class={`text-xs ${txtSub()}`}>{poolPercent()}%</span>
              </div>
              <div class={`w-full h-3 rounded-full overflow-hidden mb-3 ${isDark() ? 'bg-neutral-900' : 'bg-gray-100'}`}>
                <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={`width: ${Math.min(parseFloat(poolPercent()), 100)}%`} />
              </div>
              <div class="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div class={`text-base font-bold ${txt()}`}>{formatBolh(poolRemaining())}</div>
                  <div class={`text-xs ${txtSub()}`}>{currentLang() === 'en' ? 'Remaining BOLH' : 'Осталось BOLH'}</div>
                </div>
                <div>
                  <div class={`text-base font-bold ${txt()}`}>{programStats()?.total_referrals?.toLocaleString() || '0'}</div>
                  <div class={`text-xs ${txtSub()}`}>{currentLang() === 'en' ? 'Referrals' : 'Рефералов'}</div>
                </div>
              </div>
            </div>

            {/* Current tier progress */}
            <div class={`${cardBg()} rounded-2xl p-5`}>
              <div class="flex items-center justify-between mb-2">
                <h3 class={`font-bold text-sm ${txt()}`}>{currentLang() === 'en' ? 'Current tier' : 'Текущий тир'}</h3>
                <span class={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isDark() ? 'bg-black/70 text-white/90' : 'bg-slate-100 text-slate-600'}`}><Icon name={tiersList[currentTier() - 1]?.icon ?? 'trophy'} size="xs" /> Tier {currentTier()}</span>
              </div>
              <p class={`text-xs mb-3 ${txtSub()}`}>{currentLang() === 'en' ? 'Reward' : 'Награда'}: <span class="font-bold text-indigo-500">{rewardPerPerson()} BOLH</span> {currentLang() === 'en' ? 'each' : 'каждому'}</p>
              <div class="flex items-center gap-2">
                <div class={`text-xs ${txtMuted()}`}>{totalUsers()}</div>
                <div class={`flex-1 h-2 rounded-full overflow-hidden ${isDark() ? 'bg-neutral-900' : 'bg-gray-100'}`}>
                  <div class="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all" style={`width: ${Math.min(((totalUsers() - tierMin()) / (tierMax() - tierMin())) * 100, 100)}%`} />
                </div>
                <div class={`text-xs ${txtMuted()}`}>{tierMax().toLocaleString()}</div>
              </div>
              <p class={`text-xs text-center mt-1.5 ${txtMuted()}`}>{currentLang() === 'en' ? 'More' : 'Ещё'} {Math.max(tierMax() - totalUsers(), 0).toLocaleString()} {currentLang() === 'en' ? 'to' : 'до'} Tier {Math.min(currentTier() + 1, 4)}</p>
            </div>

            {/* Top referrers */}
            <Show when={(programStats()?.top_referrers?.length || 0) > 0}>
              <div class={`${cardBg()} rounded-2xl p-5 mt-4`}>
                <h3 class={`font-bold text-sm mb-3 ${txt()}`}>{currentLang() === 'en' ? 'Top inviters' : 'Топ пригласивших'}</h3>
                <For each={programStats()?.top_referrers || []}>
                  {(r: any, i) => (
                    <div class={`flex items-center gap-3 py-2 border-b last:border-0 ${isDark() ? 'border-white/5' : 'border-gray-100'}`}>
                      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">{i() + 1}</div>
                      <div class="flex-1 min-w-0">
                        <div class={`text-xs font-mono truncate ${isDark() ? 'text-white/90' : 'text-gray-600'}`}>{r.code}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-sm font-bold text-indigo-500">{r.referral_count}</div>
                        <div class={`text-[10px] ${txtMuted()}`}>{formatBolh(r.total_earned)} BOLH</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          {/* ═══ Friends ═══ */}
          <Show when={activeTab() === 'friends'}>
            <Show when={referralHistory().length > 0} fallback={
              <div class={`${cardBg()} rounded-2xl p-8 text-center`}>
                <div class="flex justify-center mb-3"><Icon name="users" size="xl" class={isDark() ? 'text-gray-300' : 'text-gray-400'} /></div>
                <div class={`font-semibold mb-1 ${txt()}`}>{currentLang() === 'en' ? 'No one yet' : 'Пока никого'}</div>
                <div class={`text-xs mb-4 ${txtSub()}`}>{currentLang() === 'en' ? 'Share your code with friends!' : 'Поделитесь кодом с друзьями!'}</div>
                <button class="px-5 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-sm touch-scale" onClick={shareLink}>
                  {currentLang() === 'en' ? 'Share code' : 'Поделиться кодом'}
                </button>
              </div>
            }>
              <div class={`${cardBg()} rounded-2xl overflow-hidden`}>
                <div class={`px-4 py-3 flex items-center justify-between border-b ${isDark() ? 'border-white/5' : 'border-gray-100'}`}>
                  <span class={`font-semibold text-sm ${txt()}`}>{currentLang() === 'en' ? 'Invited friends' : 'Приглашённые друзья'}</span>
                  <span class={`text-xs ${txtSub()}`}>{referralHistory().length}</span>
                </div>
                <For each={referralHistory()}>
                  {(f: any) => (
                    <div class={`px-4 py-3 border-b last:border-0 flex items-center gap-3 ${isDark() ? 'border-gray-800/30' : 'border-gray-50'}`}>
                      <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <span class="text-white font-bold text-xs">T{f.tier}</span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class={`text-sm font-medium truncate font-mono ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{f.invitee?.substring(0, 16)}...</div>
                        <div class={`text-xs ${txtMuted()}`}>{new Date(f.timestamp).toLocaleDateString('ru-RU')}</div>
                      </div>
                      <div class="text-right flex-shrink-0">
                        <div class="text-sm font-bold text-green-500">+{formatBolh(f.reward)}</div>
                        <div class="text-xs text-green-500">✓</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <button class="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg touch-scale" onClick={shareLink}>
              <Icon name="plus" class="text-white" size="sm" />
              {currentLang() === 'en' ? 'Invite more' : 'Пригласить ещё'}
            </button>
          </Show>

          {/* ═══ Tiers ═══ */}
          <Show when={activeTab() === 'tiers'}>
            <div class="space-y-3">
              <For each={tiersList}>
                {(tier) => (
                  <div class={`rounded-2xl overflow-hidden ${tier.id === currentTier() ? (isDark() ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-gray-900' : 'ring-2 ring-indigo-500 ring-offset-2') : 'shadow-sm'}`}>
                    <div class={`bg-gradient-to-r ${tier.color} p-4`}>
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center"><Icon name={tier.icon} size="sm" class="text-white" /></div>
                          <div>
                            <div class="text-white font-bold text-lg">{tier.label}</div>
                            <div class="text-white/90 text-xs">{tier.range}</div>
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="text-white font-bold text-xl">{tier.reward}</div>
                          <div class="text-white/90 text-xs">BOLH {currentLang() === 'en' ? 'each' : 'каждому'}</div>
                        </div>
                      </div>
                      <Show when={tier.id === currentTier()}>
                        <div class="mt-3 bg-white/20 rounded-xl px-3 py-1.5 text-center">
                          <span class="text-white text-xs font-bold flex items-center gap-1"><Icon name="location" size="xs" class="text-white" /> {currentLang() === 'en' ? 'Your current tier' : 'Ваш текущий тир'}</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Rules */}
            <div class={`${cardBg()} rounded-2xl p-5 mt-4`}>
              <h3 class={`font-bold mb-3 text-sm ${txt()}`}>{currentLang() === 'en' ? 'Rules' : 'Правила'}</h3>
              <div class="space-y-2.5">
                {(currentLang() === 'en' ? [
                  'Both get equal reward',
                  'No hidden fees',
                  'One account = one invitation',
                  'Max 50 invites per day',
                  'Pool: 2 billion BOLH',
                  'Early users get more',
                ] : [
                  'Оба получают одинаковую награду',
                  'Без скрытых комиссий',
                  'Один аккаунт = одно приглашение',
                  'Макс. 50 приглашений в день',
                  'Пул: 2 млрд BOLH',
                  'Ранние участники получают больше',
                ]).map((rule) => (
                  <div class="flex items-center gap-2.5">
                    <div class={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDark() ? 'bg-green-900/40' : 'bg-green-100'}`}>
                      <Icon name="check" class="text-emerald-600 dark:text-emerald-400 w-3 h-3" />
                    </div>
                    <span class={`text-xs ${isDark() ? 'text-white/90' : 'text-gray-600'}`}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}

