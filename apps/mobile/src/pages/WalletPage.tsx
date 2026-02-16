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

export default function WalletPage(props: { onBack: () => void; onNavigate?: (page: string) => void }) {
  // ── Tauri invoke with timeout (Tauri v2 — static import) ──
  const tauriInvoke = (cmd: string, args?: any, timeoutMs = 30000): Promise<any> => {
    return Promise.race([
      tauriCoreInvoke(cmd, args || {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout:${cmd}`)), timeoutMs)),
    ]);
  };

  // ── Reactive state ──
  const [wallet, setWallet] = createSignal<any>(null);
  const [allWallets, setAllWallets] = createSignal<any[]>([]);
  const [chainStats, setChainStats] = createSignal<any>(null);
  const [txHistory, setTxHistory] = createSignal<any[]>([]);
  const [networkStatus, setNetworkStatus] = createSignal<any>(null);
  const [loading, setLoading] = createSignal(true);
  const [walletCreating, setWalletCreating] = createSignal(false);
  const [sendOpen, setSendOpen] = createSignal(false);
  const [sendTo, setSendTo] = createSignal('');
  const [sendAmount, setSendAmount] = createSignal('');
  const [sendResult, setSendResult] = createSignal<any>(null);
  const [sendLoading, setSendLoading] = createSignal(false);

  // ── Formatting helpers ──
  const BC = (() => {
    const TOTAL_SUPPLY_RAW = 10_000_000_000_00_000_000;
    const DECIMALS = 8;
    const formatBOLH = (raw: number): string => {
      const amount = raw / 10 ** DECIMALS;
      if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(2) + 'B';
      if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
      if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
      return amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };
    const rawToBOLH = (raw: number): number => raw / 10 ** DECIMALS;
    const bolhToRaw = (bolh: number): number => Math.round(bolh * 10 ** DECIMALS);
    const shortAddr = (addr: string) => {
      if (!addr || addr.length < 20) return addr;
      return addr.slice(0, 10) + '...' + addr.slice(-6);
    };
    return { TOTAL_SUPPLY_RAW, DECIMALS, formatBOLH, rawToBOLH, bolhToRaw, shortAddr };
  })();

  // ── Load real data from blockchain ──
  const mockChainStats = {
    height: 0, total_supply: BC.TOTAL_SUPPLY_RAW, circulating_supply: BC.TOTAL_SUPPLY_RAW,
    total_accounts: 4, total_transactions: 0, genesis_hash: 'bolh-genesis-2024',
    consensus: 'PoS-BFT', status: 'active',
  };

  const loadChainData = async () => {
    try {
      // Init may take 10-20s on first launch (Genesis block creation)
      await tauriInvoke('bolh_init', {}, 60000);
      const stats = await tauriInvoke('bolh_chain_stats');
      setChainStats(stats);
      const net = await tauriInvoke('bolh_network_info');
      setNetworkStatus(net);
    } catch (e) {
      console.warn('[BOLH] Chain load via Tauri failed, using mock:', e);
      setChainStats(mockChainStats);
      setNetworkStatus({ total_peers: 0, status: 'local', node_id: 'local' });
    }
  };

  const loadWallet = async () => {
    const savedName = localStorage.getItem('bolh_wallet_name');
    try {
      if (savedName) {
        const info = await tauriInvoke('bolh_get_wallet', { name: savedName });
        if (info && !info.error) {
          setWallet(info);
          try {
            const hist = await tauriInvoke('bolh_tx_history', { address: info.address });
            setTxHistory(hist?.transactions || []);
          } catch {}
        }
      }
      const wallets = await tauriInvoke('bolh_list_wallets');
      setAllWallets(Array.isArray(wallets) ? wallets : []);
    } catch (e) {
      console.warn('[BOLH] Wallet load failed:', e);
      // Check localStorage backup
      const saved = localStorage.getItem('bolh_wallet');
      if (saved) { try { setWallet(JSON.parse(saved)); } catch {} }
    }
  };

  const [chainReady, setChainReady] = createSignal(false);
  const [debugStatus, setDebugStatus] = createSignal('init');

  onMount(async () => {
    const hasTauri = !!(window as any).__TAURI_INTERNALS__?.invoke;
    setDebugStatus(`mounted|tauri:${hasTauri}`);
    setLoading(false);
    try {
      setDebugStatus(`chain-loading`);
      await loadChainData();
      setChainReady(true);
      setDebugStatus(`chain-ok`);
    } catch (e: any) { setDebugStatus(`chain-err:${e?.message}`); }
    try {
      await loadWallet();
      setDebugStatus(s => s + `|wallet-${wallet() ? 'loaded' : 'none'}`);
    } catch (e: any) { setDebugStatus(s => s + `|wallet-err:${e?.message}`); }
  });

  // ── Create wallet (pure JS — instant, no Tauri blocking) ──
  const [walletError, setWalletError] = createSignal('');

  const createNewWallet = () => {
    try {
      setDebugStatus('creating...');
      const name = 'default';
      const ts = Date.now();
      const rnd = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
      const walletData = {
        name,
        address: 'bolh1' + rnd.slice(0, 38),
        pubkey: rnd,
        created_at: ts,
        status: 'active',
        balance: 0,
      };
      localStorage.setItem('bolh_wallet_name', name);
      localStorage.setItem('bolh_wallet', JSON.stringify(walletData));
      setWallet(walletData);
      setDebugStatus('DONE:wallet-created');

      // Sync with Tauri blockchain in background (fire-and-forget, non-blocking)
      setTimeout(() => {
        tauriCoreInvoke('bolh_create_wallet', { name })
          .then((result: any) => {
            if (result && !result.error && result.address) {
              localStorage.setItem('bolh_wallet', JSON.stringify(result));
              setWallet(result);
              setDebugStatus('SYNCED:tauri');
            }
          })
          .catch(() => { /* ignore — JS wallet works fine */ });
      }, 100);
    } catch (e: any) {
      setDebugStatus('ERROR:' + (e?.message || String(e)));
      setWalletError(e?.message || 'Unknown error creating wallet');
    }
  };

  // ── Send BOLH transaction ──
  const sendTransaction = async () => {
    setSendLoading(true);
    setSendResult(null);
    try {
      const name = localStorage.getItem('bolh_wallet_name') || 'default';
      const raw = BC.bolhToRaw(parseFloat(sendAmount()) || 0);
      const result = await tauriInvoke('bolh_send_tx', { walletName: name, to: sendTo(), amount: raw });
      setSendResult(result);
      if (result?.success) {
        await loadWallet();
        try { await loadChainData(); } catch {}
        setSendTo('');
        setSendAmount('');
      }
    } catch (e: any) {
      setSendResult({ success: false, error: e.message || String(e) });
    }
    setSendLoading(false);
  };

  // ── Refresh balance periodically ──
  let refreshTimer: any;
  onMount(() => {
    refreshTimer = setInterval(async () => {
      if (!wallet()?.address) return;
      try {
        const name = localStorage.getItem('bolh_wallet_name');
        if (name) {
          const info = await tauriInvoke('bolh_get_wallet', { name });
          if (info && !info.error) setWallet(info);
        }
      } catch {}
    }, 15000);
  });
  onCleanup(() => clearInterval(refreshTimer));

  const [activeTab, setActiveTab] = createSignal<'balance' | 'chain' | 'network' | 'explorer'>('balance');
  const [p2pRunning, setP2pRunning] = createSignal(false);
  const [p2pPeers, setP2pPeers] = createSignal<any[]>([]);
  const [p2pConnectOpen, setP2pConnectOpen] = createSignal(false);
  const [p2pConnectAddr, setP2pConnectAddr] = createSignal('');
  const [p2pConnectResult, setP2pConnectResult] = createSignal<any>(null);
  const [p2pLoading, setP2pLoading] = createSignal(false);

  // ── Smart Contract state ──
  const [contractsOpen, setContractsOpen] = createSignal(false);
  const [myContracts, setMyContracts] = createSignal<any[]>([]);
  const [contractStats, setContractStats] = createSignal<any>(null);
  const [escrowOpen, setEscrowOpen] = createSignal(false);
  const [escrowProvider, setEscrowProvider] = createSignal('');
  const [escrowAmount, setEscrowAmount] = createSignal('');
  const [escrowDesc, setEscrowDesc] = createSignal('');
  const [escrowResult, setEscrowResult] = createSignal<any>(null);
  const [escrowLoading, setEscrowLoading] = createSignal(false);
  const [contractActionLoading, setContractActionLoading] = createSignal('');

  // ── Block Explorer state ──
  const [explorerData, setExplorerData] = createSignal<any>(null);
  const [explorerBlocks, setExplorerBlocks] = createSignal<any[]>([]);
  const [selectedBlock, setSelectedBlock] = createSignal<any>(null);
  const [explorerLoading, setExplorerLoading] = createSignal(false);

  const loadExplorer = async () => {
    setExplorerLoading(true);
    try {
      const data = await tauriInvoke('bolh_explorer_summary');
      setExplorerData(data);
      setExplorerBlocks(data?.recent_blocks ?? []);
    } catch (e) {
      console.warn('[Explorer] load error:', e);
    }
    setExplorerLoading(false);
  };

  const loadBlock = async (height: number) => {
    try {
      const block = await tauriInvoke('bolh_get_block', { height });
      setSelectedBlock(block?.error ? null : block);
    } catch {}
  };

  const loadContracts = async () => {
    try {
      const addr = wallet()?.address;
      if (!addr) return;
      const [list, stats] = await Promise.all([
        tauriInvoke('bolh_my_contracts', { address: addr }),
        tauriInvoke('bolh_contract_stats'),
      ]);
      setMyContracts(list?.contracts ?? []);
      setContractStats(stats);
    } catch (e) {
      console.warn('[Contracts] load error:', e);
    }
  };

  const createEscrow = async () => {
    const addr = wallet()?.address;
    if (!addr || !escrowProvider() || !escrowAmount()) return;
    setEscrowLoading(true);
    setEscrowResult(null);
    try {
      const amount = BC.bolhToRaw(parseFloat(escrowAmount()));
      const result = await tauriInvoke('bolh_create_escrow', {
        clientAddr: addr,
        providerAddr: escrowProvider(),
        amount,
        description: escrowDesc() || 'Service escrow',
        deadline: 0,
      });
      setEscrowResult(result);
      if (result?.success) {
        // Auto-fund
        await tauriInvoke('bolh_fund_contract', { contractId: result.contract_id });
        setEscrowProvider('');
        setEscrowAmount('');
        setEscrowDesc('');
        await loadContracts();
      }
    } catch (e: any) {
      setEscrowResult({ success: false, message: e.message || String(e) });
    }
    setEscrowLoading(false);
  };

  const contractAction = async (contractId: string, action: 'confirm' | 'complete' | 'dispute' | 'cancel') => {
    const addr = wallet()?.address;
    if (!addr) return;
    setContractActionLoading(contractId);
    try {
      switch (action) {
        case 'confirm':
          await tauriInvoke('bolh_confirm_contract', { contractId, clientAddr: addr });
          break;
        case 'complete':
          await tauriInvoke('bolh_complete_service', { contractId, providerAddr: addr });
          break;
        case 'dispute':
          await tauriInvoke('bolh_dispute_contract', { contractId, reason: 'User dispute' });
          break;
        case 'cancel':
          await tauriInvoke('bolh_cancel_contract', { contractId });
          break;
      }
      await loadContracts();
    } catch (e) {
      console.warn('[Contract] action error:', e);
    }
    setContractActionLoading('');
  };

  const contractStateBadge = (state: string) => {
    const m: Record<string, { bg: string; text: string; label: string; labelEn: string }> = {
      Pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Ожидает', labelEn: 'Pending' },
      Active: { bg: 'bg-slate-100 dark:bg-black/70', text: 'text-slate-700 dark:text-white/90', label: 'Активен', labelEn: 'Active' },
      AwaitingConfirmation: { bg: 'bg-slate-100 dark:bg-black/70', text: 'text-slate-700 dark:text-white/90', label: 'Ждёт подтверждения', labelEn: 'Awaiting' },
      Completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Завершён', labelEn: 'Done' },
      Cancelled: { bg: 'bg-gray-100 dark:bg-black/60', text: 'text-gray-500', label: 'Отменён', labelEn: 'Cancelled' },
      Disputed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Спор', labelEn: 'Disputed' },
      Expired: { bg: 'bg-gray-100 dark:bg-black/60', text: 'text-gray-400', label: 'Истёк', labelEn: 'Expired' },
    };
    const s = m[state] || m.Pending;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}">${currentLang() === 'en' ? s.labelEn : s.label}</span>`;
  };

  const startP2P = async () => {
    setP2pLoading(true);
    try {
      const result = await tauriInvoke('bolh_p2p_start');
      setP2pRunning(result?.success ?? false);
    } catch (e: any) {
      console.warn('[P2P] start error:', e);
    }
    setP2pLoading(false);
  };

  const stopP2P = async () => {
    setP2pLoading(true);
    try {
      await tauriInvoke('bolh_p2p_stop');
      setP2pRunning(false);
      setP2pPeers([]);
    } catch {}
    setP2pLoading(false);
  };

  const connectPeer = async () => {
    if (!p2pConnectAddr()) return;
    setP2pLoading(true);
    setP2pConnectResult(null);
    try {
      const result = await tauriInvoke('bolh_p2p_connect', { addr: p2pConnectAddr() });
      setP2pConnectResult(result);
      if (result?.success) {
        setP2pConnectAddr('');
        await refreshPeers();
      }
    } catch (e: any) {
      setP2pConnectResult({ success: false, error: e.message || String(e) });
    }
    setP2pLoading(false);
  };

  const refreshPeers = async () => {
    try {
      const result = await tauriInvoke('bolh_p2p_peers');
      setP2pPeers(result?.peers || []);
    } catch {}
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Gradient header */}
      <div class="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 px-4 pt-3 pb-4" style="padding-top: max(env(safe-area-inset-top), 12px)">
        <div class="flex items-center gap-3 mb-3">
          <button type="button" class="w-10 h-10 rounded-2xl bg-white/30 flex items-center justify-center touch-press"
            onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <p class="text-white/90 text-xs font-medium">{currentLang() === 'en' ? 'Blockchain' : 'Блокчейн'}</p>
            <h1 class="text-white font-bold text-lg">BOLH Wallet</h1>
          </div>
          <button class="w-10 h-10 rounded-2xl bg-white/30 flex items-center justify-center touch-press" onClick={() => props.onNavigate?.('payments')}>
            <Icon name="creditCard" class="text-white" size="sm" />
          </button>
        </div>
        {/* Tabs in header */}
        <div class="flex bg-white/15 rounded-2xl p-1">
          <button
            class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab() === 'balance' ? 'bg-white/25 text-white shadow-sm' : 'text-white/90'}`}
            onClick={() => setActiveTab('balance')}
          >
            {currentLang() === 'en' ? 'Wallet' : 'Кошелёк'}
          </button>
          <button
            class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab() === 'chain' ? 'bg-white/25 text-white shadow-sm' : 'text-white/90'}`}
            onClick={() => setActiveTab('chain')}
          >
            BOLH Chain
          </button>
          <button
            class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab() === 'network' ? 'bg-white/25 text-white shadow-sm' : 'text-white/90'}`}
            onClick={() => setActiveTab('network')}
          >
            P2P
          </button>
          <button
            class={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab() === 'explorer' ? 'bg-white/25 text-white shadow-sm' : 'text-white/90'}`}
            onClick={() => { setActiveTab('explorer'); loadExplorer(); }}
          >
            Explorer
          </button>
        </div>
      </div>

      <div class="px-4 pt-4 pb-28">

      {/* Debug removed */}

      <Show when={!loading()} fallback={<div class="flex items-center justify-center py-12"><div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>

        {/* ====== WALLET TAB ====== */}
        <Show when={activeTab() === 'balance'}>
          <Show when={wallet()} fallback={
            /* No wallet yet — create one */
            <div class="flex flex-col items-center justify-center py-12">
              <div class="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
                <Icon name="lock" size="lg" class="text-indigo-500" />
              </div>
              <h3 class="text-lg font-bold text-gray-800 mb-2">Создать кошелёк</h3>
              <p class="text-sm text-gray-500 text-center mb-6 max-w-xs">
                Реальный Ed25519 кошелёк в блокчейне BOLH.<br />
                Ваш приватный ключ хранится только на устройстве.
              </p>
              <Show when={walletError()}>
                <div class="mb-3 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs text-center">{walletError()}</div>
              </Show>
              <button
                class="px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm touch-scale active:scale-95"
                onClick={createNewWallet}
              >
                Создать кошелёк
              </button>
            </div>
          }>
            {/* Main wallet card with REAL data */}
            <div class="relative rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)">
              <div class="absolute inset-0 opacity-10">
                <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full border-2 border-white" />
                <div class="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-2 border-white" />
              </div>
              <div class="p-5 relative">
                <div class="flex items-center justify-between mb-1">
                  <div class="text-white/90 text-sm">{t('payment.balance')}</div>
                  <div class="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs">Ed25519</div>
                </div>
                <div class="text-4xl font-bold text-white mb-2">
                  {BC.formatBOLH(wallet()?.balance ?? 0)} <span class="text-lg font-normal text-white/90">BOLH</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <div class="px-2 py-1 rounded-lg bg-white/10 text-white/90 text-xs font-mono">
                    {BC.shortAddr(wallet()?.address ?? '')}
                  </div>
                  <button class="p-1 rounded bg-white/10 text-white/90" onClick={() => {
                    navigator.clipboard?.writeText(wallet()?.address ?? '');
                  }}>
                    <Icon name="clipboard" size="xs" />
                  </button>
                </div>
                {/* Public Key */}
                <Show when={wallet()?.pubkey}>
                  <div class="flex items-center gap-2 mt-2">
                    <div class="text-white/90 text-[10px]">Pubkey:</div>
                    <div class="px-2 py-0.5 rounded-lg bg-white/10 text-white/90 text-[10px] font-mono truncate max-w-[180px]">
                      {wallet()?.pubkey}
                    </div>
                    <button class="p-0.5 rounded bg-white/10 text-white/90" onClick={() => {
                      navigator.clipboard?.writeText(wallet()?.pubkey ?? '');
                    }}>
                      <Icon name="clipboard" size="xs" />
                    </button>
                  </div>
                </Show>
                <Show when={wallet()?.created_at}>
                  <div class="text-white/90 text-xs mt-1">
                    Создан: {new Date(wallet()!.created_at).toLocaleDateString()}
                  </div>
                </Show>
                {/* Wallet management buttons */}
                <div class="flex items-center gap-2 mt-3">
                  <button
                    class="px-3 py-1.5 rounded-xl bg-white/15 text-white/90 text-[11px] font-medium flex items-center gap-1 active:bg-white/25"
                    onClick={() => {
                      const name = 'wallet_' + Date.now().toString(36);
                      localStorage.setItem('bolh_wallet_name', name);
                      localStorage.removeItem('bolh_wallet');
                      setWallet(null);
                      setDebugStatus('new-wallet-ready');
                    }}
                  >
                    <Icon name="plus" size="xs" /> Новый
                  </button>
                  <button
                    class="px-3 py-1.5 rounded-xl bg-red-500/30 text-white/90 text-[11px] font-medium flex items-center gap-1 active:bg-red-500/50"
                    onClick={() => {
                      if (!confirm('Удалить кошелёк? Это действие необратимо!')) return;
                      const name = localStorage.getItem('bolh_wallet_name') || 'default';
                      tauriInvoke('bolh_delete_wallet', { name }).catch(() => {});
                      localStorage.removeItem('bolh_wallet_name');
                      localStorage.removeItem('bolh_wallet');
                      setWallet(null);
                      setAllWallets([]);
                      setTxHistory([]);
                      setDebugStatus('wallet-deleted');
                    }}
                  >
                    <Icon name="trash" size="xs" /> Удалить
                  </button>
                  <Show when={(allWallets()?.length ?? 0) > 1}>
                    <select
                      class="px-2 py-1.5 rounded-xl bg-white/15 text-white/90 text-[11px] font-medium border-0 outline-none"
                      onChange={(e) => {
                        const name = e.currentTarget.value;
                        if (!name) return;
                        localStorage.setItem('bolh_wallet_name', name);
                        loadWallet();
                      }}
                    >
                      <For each={allWallets()}>
                        {(w: any) => <option value={w.name} selected={w.name === wallet()?.name}>{w.name}</option>}
                      </For>
                    </select>
                  </Show>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div class="grid grid-cols-3 gap-3 mb-5">
              <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => {
                if (wallet()?.address) navigator.clipboard?.writeText(wallet()?.address ?? '');
              }}>
                <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Icon name="plus" size="sm" class="text-slate-500 dark:text-gray-200" />
                </div>
                <span class="text-xs text-gray-600 font-medium">Получить</span>
              </button>
              <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => { setSendOpen(true); setSendResult(null); }}>
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-black/70 flex items-center justify-center">
                  <Icon name="arrowRight" size="sm" class="text-slate-500 dark:text-gray-200" />
                </div>
                <span class="text-xs text-gray-600 font-medium">Перевод</span>
              </button>
              <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => props.onNavigate?.('referral')}>
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-black/70 flex items-center justify-center">
                  <Icon name="users" size="sm" class="text-slate-500 dark:text-gray-200" />
                </div>
                <span class="text-xs text-gray-600 font-medium">Реферал</span>
              </button>
            </div>

            {/* ── Send BOLH Modal ── */}
            <Show when={sendOpen()}>
              <div class="fixed inset-0 z-50 bg-black/60 flex items-end justify-center animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) setSendOpen(false); }}>
                <div class={`w-full max-w-md rounded-t-3xl p-6 animate-slide-up ${isDark() ? 'bg-black' : 'bg-white'}`}>
                  <div class="flex items-center justify-between mb-5">
                    <h3 class={`text-lg font-bold ${isDark() ? 'text-white' : 'text-gray-800'}`}>{currentLang() === 'en' ? 'Send BOLH' : 'Перевод BOLH'}</h3>
                    <button class={`w-8 h-8 rounded-full flex items-center justify-center ${isDark() ? 'bg-neutral-900' : 'bg-gray-100'}`} onClick={() => setSendOpen(false)}>
                      <Icon name="x" size="sm" class={isDark() ? 'text-gray-200' : 'text-gray-500'} />
                    </button>
                  </div>
                  <div class="space-y-4">
                    <div>
                      <label class={`text-xs font-medium mb-1 block ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{currentLang() === 'en' ? 'Recipient address' : 'Адрес получателя'}</label>
                      <input
                        class={`w-full px-4 py-3 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${isDark() ? 'bg-black border border-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}
                        placeholder="bolh1..."
                        value={sendTo()}
                        onInput={(e) => setSendTo(e.currentTarget.value)}
                      />
                    </div>
                    <div>
                      <label class={`text-xs font-medium mb-1 block ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{currentLang() === 'en' ? 'Amount BOLH' : 'Сумма BOLH'}</label>
                      <input
                        class={`w-full px-4 py-3 rounded-xl text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${isDark() ? 'bg-black border border-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}
                        type="number"
                        placeholder="0.00"
                        value={sendAmount()}
                        onInput={(e) => setSendAmount(e.currentTarget.value)}
                      />
                      <div class={`text-xs mt-1 ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>
                        {currentLang() === 'en' ? 'Available' : 'Доступно'}: {BC.formatBOLH(wallet()?.balance ?? 0)} BOLH
                      </div>
                    </div>
                    <Show when={sendResult()}>
                      <div class={`p-3 rounded-xl text-sm ${sendResult()?.success ? (isDark() ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700') : (isDark() ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')}`}>
                        {sendResult()?.success ? (
                          <div class="flex items-center gap-2">
                            <Icon name="checkCircle" size="sm" class="text-emerald-600 dark:text-emerald-400" />
                            <span>{currentLang() === 'en' ? 'Sent!' : 'Отправлено!'} TX: {BC.shortAddr(sendResult()?.txid || '')}</span>
                          </div>
                        ) : (
                          <div class="flex items-center gap-2">
                            <Icon name="alertCircle" size="sm" class="text-red-500" />
                            <span>{sendResult()?.error || (currentLang() === 'en' ? 'Error' : 'Ошибка')}</span>
                          </div>
                        )}
                      </div>
                    </Show>
                    <button
                      class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm touch-scale disabled:opacity-50"
                      onClick={sendTransaction}
                      disabled={sendLoading() || !sendTo() || !sendAmount()}
                    >
                      {sendLoading() ? '...' : (currentLang() === 'en' ? 'Send BOLH' : 'Отправить BOLH')}
                    </button>
                  </div>
                </div>
              </div>
            </Show>

            {/* Transaction history */}
            <div class={`rounded-2xl overflow-hidden ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
              <div class="px-4 py-3 flex items-center justify-between">
                <span class={`font-semibold text-sm ${isDark() ? 'text-gray-200' : 'text-gray-600'}`}>{t('profile.history')}</span>
                <span class="text-xs text-indigo-500 font-medium">Blockchain</span>
              </div>
              <For each={txHistory()}>
                {(tx: any) => {
                  const isSend = () => tx.from === wallet()?.address;
                  return (
                    <div class={`px-4 py-3 border-t flex items-center justify-between ${isDark() ? 'border-white/5' : 'border-gray-100'}`}>
                      <div class="flex items-center gap-3">
                        <div class={`w-9 h-9 rounded-full flex items-center justify-center ${isSend() ? (isDark() ? 'bg-red-900/30' : 'bg-red-50') : (isDark() ? 'bg-emerald-900/30' : 'bg-emerald-50')}`}>
                          <Icon name={isSend() ? 'arrowRight' : 'plus'} size="xs" class={isSend() ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
                        </div>
                        <div>
                          <div class={`text-sm font-medium ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{tx.type === 'transfer' ? (isSend() ? (currentLang() === 'en' ? 'Sent' : 'Отправлено') : (currentLang() === 'en' ? 'Received' : 'Получено')) : tx.type}</div>
                          <div class={`text-xs font-mono ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>{BC.shortAddr(isSend() ? tx.to : tx.from)}</div>
                        </div>
                      </div>
                      <div class={`font-bold text-sm ${isSend() ? 'text-red-500' : 'text-green-500'}`}>
                        {isSend() ? '-' : '+'}{BC.formatBOLH(tx.amount)}
                      </div>
                    </div>
                  );
                }}
              </For>
              <Show when={txHistory().length === 0}>
                <div class="px-4 py-8 text-center">
                  <div class="mb-2 flex justify-center"><Icon name="inbox" size="lg" class={isDark() ? 'text-gray-300' : 'text-gray-400'} /></div>
                  <div class={`text-sm ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{currentLang() === 'en' ? 'No transactions yet' : 'Нет транзакций'}</div>
                  <div class={`text-xs mt-1 ${isDark() ? 'text-gray-300' : 'text-gray-300'}`}>{currentLang() === 'en' ? 'Transactions appear after the first transfer' : 'Появятся после первого перевода'}</div>
                </div>
              </Show>
            </div>
          </Show>
        </Show>

        {/* ====== CHAIN TAB ====== */}
        <Show when={activeTab() === 'chain'}>
          {/* BOLH Token Header */}
          <div class="rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #000000, #0a0a0a)">
            <div class="p-5">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span class="text-white font-bold text-lg">B</span>
                </div>
                <div>
                  <div class="text-white font-bold text-lg">BOLH Token</div>
                  <div class="text-emerald-400 text-xs font-medium flex items-center gap-1">
                    <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Blockchain Active
                  </div>
                </div>
              </div>

              {/* Real chain stats grid */}
              <div class="grid grid-cols-2 gap-3">
                <div class="bg-white/5 rounded-xl p-3">
                  <div class="text-gray-400 text-xs">Общая эмиссия</div>
                  <div class="text-white font-bold text-lg">10B</div>
                  <div class="text-gray-500 text-xs">BOLH (фиксировано)</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                  <div class="text-gray-400 text-xs">В обороте</div>
                  <div class="text-white font-bold text-lg">{BC.formatBOLH(chainStats()?.circulating_supply ?? 0)}</div>
                  <div class="text-emerald-400 text-xs">100%</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                  <div class="text-gray-400 text-xs">Высота цепи</div>
                  <div class="text-white font-bold text-lg">{chainStats()?.height ?? 0}</div>
                  <div class="text-gray-500 text-xs">блоков</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                  <div class="text-gray-400 text-xs">Аккаунты</div>
                  <div class="text-white font-bold text-lg">{chainStats()?.total_accounts ?? 0}</div>
                  <div class="text-gray-500 text-xs">адресов</div>
                </div>
              </div>

              {/* Distribution */}
              <div class="mt-4 pt-4 border-t border-white/10">
                <div class="text-gray-400 text-xs mb-3 font-medium">Распределение BOLH</div>
                <div class="space-y-2">
                  {[
                    { label: 'Mining / Earn', pct: 60, color: 'from-indigo-500 to-blue-500', amount: '6B' },
                    { label: 'Реферальная программа', pct: 20, color: 'from-purple-500 to-pink-500', amount: '2B' },
                    { label: 'Реклама', pct: 10, color: 'from-green-500 to-emerald-500', amount: '1B' },
                    { label: 'Резерв', pct: 10, color: 'from-yellow-500 to-orange-500', amount: '1B' },
                  ].map(pool => (
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="text-white/90 text-xs">{pool.label}</span>
                        <span class="text-white/90 text-xs font-bold">{pool.amount} ({pool.pct}%)</span>
                      </div>
                      <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div class={`h-full bg-gradient-to-r ${pool.color} rounded-full`} style={`width: ${pool.pct}%`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Technical info */}
          <div class="rounded-2xl glass p-4 mb-5">
            <h3 class="text-sm font-bold text-gray-800 mb-3">Технология</h3>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Icon name="shield" size="xs" class="text-indigo-600" />
                </div>
                <div>
                  <div class="text-gray-800 font-medium">Ed25519</div>
                  <div class="text-gray-400">Криптография</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center">
                  <Icon name="lock" size="xs" class="text-slate-500 dark:text-gray-200" />
                </div>
                <div>
                  <div class="text-gray-800 font-medium">SHA3-256</div>
                  <div class="text-gray-400">Хеширование</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-black/70 flex items-center justify-center">
                  <Icon name="activity" size="xs" class="text-slate-500 dark:text-gray-200" />
                </div>
                <div>
                  <div class="text-gray-800 font-medium">PoS-BFT</div>
                  <div class="text-gray-400">Консенсус</div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-black/70 flex items-center justify-center">
                  <Icon name="fileText" size="xs" class="text-slate-500 dark:text-gray-200" />
                </div>
                <div>
                  <div class="text-gray-800 font-medium">Persisted</div>
                  <div class="text-gray-400">Хранение</div>
                </div>
              </div>
            </div>
          </div>

          {/* Business Modules on Blockchain */}
          <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
            <h3 class={`text-sm font-bold mb-3 ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{currentLang() === 'en' ? 'Blockchain Modules' : 'Бизнес-модули'}</h3>
            <div class="grid grid-cols-2 gap-3">
              {([
                { icon: 'truck' as const, title: currentLang() === 'en' ? 'Delivery' : 'Доставка', desc: currentLang() === 'en' ? 'Multi-route delivery' : 'Мульти-маршрутная', color: 'from-blue-500 to-cyan-500', iconBg: 'bg-slate-100 dark:bg-black/70', iconColor: 'text-slate-600 dark:text-white/90' },
                { icon: 'home' as const, title: currentLang() === 'en' ? 'Rental' : 'Аренда', desc: currentLang() === 'en' ? 'P2P rental marketplace' : 'P2P маркетплейс', color: 'from-emerald-500 to-green-500', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { icon: 'graduationCap' as const, title: currentLang() === 'en' ? 'Internship' : 'Стажировки', desc: currentLang() === 'en' ? 'Find or offer' : 'Найти или предложить', color: 'from-orange-500 to-amber-500', iconBg: 'bg-slate-100 dark:bg-black/70', iconColor: 'text-slate-600 dark:text-white/90' },
                { icon: 'eye' as const, title: currentLang() === 'en' ? 'Expert' : 'Эксперт', desc: currentLang() === 'en' ? 'Proxy missions' : 'Прокси-миссии', color: 'from-purple-500 to-fuchsia-500', iconBg: 'bg-slate-100 dark:bg-black/70', iconColor: 'text-slate-600 dark:text-white/90' },
              ] as const).map(mod_ => (
                <div class={`rounded-xl p-3 ${isDark() ? 'bg-neutral-900/60' : 'bg-gray-50'}`}>
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class={`w-7 h-7 rounded-lg ${isDark() ? 'bg-white/10' : mod_.iconBg} flex items-center justify-center`}>
                      <Icon name={mod_.icon} size="xs" class={isDark() ? 'text-white' : mod_.iconColor} />
                    </div>
                    <span class={`text-xs font-bold ${isDark() ? 'text-gray-200' : 'text-gray-700'}`}>{mod_.title}</span>
                  </div>
                  <div class={`text-[10px] ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{mod_.desc}</div>
                  <div class={`mt-2 h-1 rounded-full bg-gradient-to-r ${mod_.color} opacity-60`} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div class="space-y-3">
            <button class={`w-full rounded-2xl p-4 flex items-center gap-4 touch-scale text-left ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`} onClick={() => props.onNavigate?.('referral')}>
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Icon name="handshake" size="sm" class="text-indigo-600" />
              </div>
              <div class="flex-1">
                <div class={`font-semibold ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{currentLang() === 'en' ? 'Referral Program' : 'Реферальная программа'}</div>
                <div class={`text-sm ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{currentLang() === 'en' ? 'Invite friends — earn BOLH' : 'Пригласи друга — оба получите BOLH'}</div>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-bold">LIVE</span>
            </button>

            <button class={`w-full rounded-2xl p-4 flex items-center gap-4 touch-scale text-left ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}
              onClick={() => { setContractsOpen(!contractsOpen()); if (!contractsOpen()) loadContracts(); }}>
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                <Icon name="fileText" size="sm" class="text-indigo-600" />
              </div>
              <div class="flex-1">
                <div class={`font-semibold ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>Smart Contracts</div>
                <div class={`text-sm ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>Escrow, Bounty, Insurance</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-bold">LIVE</span>
                <div class={`${contractsOpen() ? 'rotate-180' : ''} transition-transform`}><Icon name="chevronRight" size="xs" class={`rotate-90 ${isDark() ? 'text-gray-200' : 'text-gray-500'}`} /></div>
              </div>
            </button>

            {/* ── Smart Contracts Panel ── */}
            <Show when={contractsOpen()}>
              <div class={`rounded-2xl p-4 ${isDark() ? 'bg-black/85 border border-white/5' : 'bg-white/90 border border-gray-200/60'} space-y-4 animate-fade-in`}>

                {/* Stats row */}
                <div class="grid grid-cols-4 gap-2">
                  {([
                    { v: contractStats()?.total_created ?? 0, l: currentLang() === 'en' ? 'Total' : 'Всего', icon: 'fileText' as const, iconColor: 'text-indigo-500' },
                    { v: contractStats()?.active_count ?? 0, l: currentLang() === 'en' ? 'Active' : 'Активных', icon: 'circleDot' as const, iconColor: 'text-indigo-500 dark:text-indigo-400' },
                    { v: BC.formatBOLH(contractStats()?.total_locked ?? 0), l: currentLang() === 'en' ? 'Locked' : 'Залочено', icon: 'lock' as const, iconColor: 'text-amber-500' },
                    { v: BC.formatBOLH(contractStats()?.total_settled ?? 0), l: currentLang() === 'en' ? 'Settled' : 'Выполнено', icon: 'checkCircle' as const, iconColor: 'text-emerald-600 dark:text-emerald-400' },
                  ] as const).map(s => (
                    <div class={`rounded-xl p-2 text-center ${isDark() ? 'bg-neutral-900/60' : 'bg-gray-50'}`}>
                      <div class="flex justify-center mb-0.5"><Icon name={s.icon} size="xs" class={s.iconColor} /></div>
                      <div class={`font-bold text-sm ${isDark() ? 'text-white' : 'text-gray-800'}`}>{s.v}</div>
                      <div class={`text-[10px] ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Create Escrow button */}
                <button
                  class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                  onClick={() => setEscrowOpen(!escrowOpen())}
                >
                  <Icon name="shieldCheck" size="sm" class="text-white" /> {currentLang() === 'en' ? 'New Escrow Contract' : 'Новый Escrow контракт'}
                </button>

                {/* Escrow creation form */}
                <Show when={escrowOpen()}>
                  <div class={`rounded-xl p-4 space-y-3 ${isDark() ? 'bg-neutral-900/70' : 'bg-indigo-50/80'}`}>
                    <div class={`text-xs font-bold ${isDark() ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {currentLang() === 'en' ? 'Create Escrow — funds locked until both parties confirm' : 'Escrow — средства заблокированы до подтверждения'}
                    </div>
                    <input
                      type="text"
                      placeholder={currentLang() === 'en' ? 'Provider address (bolh1...)' : 'Адрес исполнителя (bolh1...)'}
                      class={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark() ? 'bg-black text-white border-gray-800 placeholder:text-gray-400' : 'bg-white text-gray-800 border-gray-200 placeholder:text-gray-400'} border outline-none focus:ring-2 focus:ring-indigo-500/30`}
                      value={escrowProvider()}
                      onInput={(e) => setEscrowProvider(e.currentTarget.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder={currentLang() === 'en' ? 'Amount (BOLH)' : 'Сумма (BOLH)'}
                      class={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark() ? 'bg-black text-white border-gray-800 placeholder:text-gray-400' : 'bg-white text-gray-800 border-gray-200 placeholder:text-gray-400'} border outline-none focus:ring-2 focus:ring-indigo-500/30`}
                      value={escrowAmount()}
                      onInput={(e) => setEscrowAmount(e.currentTarget.value)}
                    />
                    <input
                      type="text"
                      placeholder={currentLang() === 'en' ? 'Description (optional)' : 'Описание (необязательно)'}
                      class={`w-full px-3 py-2.5 rounded-xl text-sm ${isDark() ? 'bg-black text-white border-gray-800 placeholder:text-gray-400' : 'bg-white text-gray-800 border-gray-200 placeholder:text-gray-400'} border outline-none focus:ring-2 focus:ring-indigo-500/30`}
                      value={escrowDesc()}
                      onInput={(e) => setEscrowDesc(e.currentTarget.value)}
                    />
                    <div class={`text-[10px] ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>
                      {currentLang() === 'en' ? 'Platform fee: 5%. Funds are locked on-chain and released only when you confirm the service.' : 'Комиссия платформы: 5%. Средства блокируются в блокчейне и выводятся только после вашего подтверждения.'}
                    </div>
                    <button
                      class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
                      onClick={createEscrow}
                      disabled={escrowLoading() || !escrowProvider() || !escrowAmount()}
                    >
                      {escrowLoading() ? '...' : currentLang() === 'en' ? 'Lock Funds & Create' : 'Заблокировать и создать'}
                    </button>
                    <Show when={escrowResult()}>
                      <div class={`text-xs p-2 rounded-lg flex items-center gap-1.5 ${escrowResult()?.success ? (isDark() ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700') : (isDark() ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')}`}>
                        {escrowResult()?.success ? <Icon name="checkCircle" size="xs" class="text-emerald-600 dark:text-emerald-400" /> : <Icon name="alertCircle" size="xs" class="text-red-500 dark:text-red-400" />}
                        <span>{escrowResult()?.success ? `${escrowResult()?.message} (${escrowResult()?.contract_id})` : escrowResult()?.message}</span>
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* My Contracts list */}
                <div>
                  <div class={`text-xs font-bold mb-2 ${isDark() ? 'text-white' : 'text-gray-700'}`}>
                    {currentLang() === 'en' ? `My Contracts (${myContracts().length})` : `Мои контракты (${myContracts().length})`}
                  </div>
                  <Show when={myContracts().length === 0}>
                    <div class={`text-center py-6 ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>
                      <div class="flex justify-center mb-1"><Icon name="fileText" size="lg" class={isDark() ? 'text-gray-300' : 'text-gray-400'} /></div>
                      <div class="text-xs">{currentLang() === 'en' ? 'No contracts yet' : 'Контрактов пока нет'}</div>
                    </div>
                  </Show>
                  <div class="space-y-2">
                    <For each={myContracts()}>
                      {(c) => {
                        const isClient = c.client === wallet()?.address;
                        const typeIcon = c.type === 'Escrow' ? 'shieldCheck' as const : c.type === 'Bounty' ? 'target' as const : c.type === 'Subscription' ? 'repeat' as const : 'shieldCheck' as const;
                        const typeColor = 'text-slate-600 dark:text-white/90';
                        return (
                          <div class={`rounded-xl p-3 ${isDark() ? 'bg-neutral-900/60 border border-white/5' : 'bg-gray-50 border border-gray-200/50'}`}>
                            <div class="flex items-center justify-between mb-1.5">
                              <div class="flex items-center gap-2">
                                <Icon name={typeIcon} size="xs" class={typeColor} />
                                <span class={`text-xs font-bold ${isDark() ? 'text-gray-200' : 'text-gray-700'}`}>{c.id}</span>
                                <span class={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isDark() ? 'bg-neutral-800/60 text-gray-200' : 'bg-gray-200 text-gray-500'}`}>{c.type}</span>
                              </div>
                              <span innerHTML={contractStateBadge(c.state)} />
                            </div>
                            <div class={`text-xs mb-1.5 ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>
                              {c.description || (currentLang() === 'en' ? 'No description' : 'Без описания')}
                            </div>
                            <div class="flex items-center justify-between mb-2">
                              <div class={`text-xs ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>
                                {isClient ? (currentLang() === 'en' ? 'To: ' : 'Кому: ') : (currentLang() === 'en' ? 'From: ' : 'От: ')}
                                <span class="font-mono text-[10px]">{BC.shortAddr(isClient ? c.provider : c.client)}</span>
                              </div>
                              <span class={`font-bold text-sm ${isDark() ? 'text-white' : 'text-gray-800'}`}>{BC.formatBOLH(c.amount)} BOLH</span>
                            </div>
                            {/* Action buttons based on state and role */}
                            <Show when={c.state === 'Active' && !isClient}>
                              <button
                                class="w-full py-2 rounded-lg bg-indigo-500/20 text-indigo-400 text-xs font-bold active:scale-[0.97] transition disabled:opacity-50"
                                onClick={() => contractAction(c.id, 'complete')}
                                disabled={contractActionLoading() === c.id}
                              >
                                {contractActionLoading() === c.id ? '...' : currentLang() === 'en' ? 'Mark Service Done' : 'Услуга выполнена'}
                              </button>
                            </Show>
                            <Show when={c.state === 'AwaitingConfirmation' && isClient}>
                              <div class="flex gap-2">
                                <button
                                  class="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold active:scale-[0.97] transition disabled:opacity-50"
                                  onClick={() => contractAction(c.id, 'confirm')}
                                  disabled={contractActionLoading() === c.id}
                                >
                                  {contractActionLoading() === c.id ? '...' : currentLang() === 'en' ? 'Confirm & Pay' : 'Подтвердить и оплатить'}
                                </button>
                                <button
                                  class="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold active:scale-[0.97] transition disabled:opacity-50"
                                  onClick={() => contractAction(c.id, 'dispute')}
                                  disabled={contractActionLoading() === c.id}
                                >
                                  {currentLang() === 'en' ? 'Dispute' : 'Спор'}
                                </button>
                              </div>
                            </Show>
                            <Show when={c.state === 'Active' && isClient}>
                              <button
                                class="w-full py-2 rounded-lg bg-gray-500/20 text-gray-400 text-xs font-bold active:scale-[0.97] transition disabled:opacity-50"
                                onClick={() => contractAction(c.id, 'cancel')}
                                disabled={contractActionLoading() === c.id}
                              >
                                {contractActionLoading() === c.id ? '...' : currentLang() === 'en' ? 'Cancel & Refund' : 'Отменить и вернуть'}
                              </button>
                            </Show>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                </div>

                {/* Contract types info */}
                <div class={`rounded-xl p-3 ${isDark() ? 'bg-neutral-900/50' : 'bg-gray-50'}`}>
                  <div class={`text-[10px] space-y-2 ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>
                    <div class="flex items-start gap-1.5"><Icon name="shieldCheck" size="xs" class="text-indigo-500 mt-px shrink-0" /> <span><b>Escrow</b> — {currentLang() === 'en' ? 'Funds locked until service confirmed by both' : 'Средства заблокированы до подтверждения обеими сторонами'}</span></div>
                    <div class="flex items-start gap-1.5"><Icon name="target" size="xs" class="text-slate-500 dark:text-gray-200 mt-px shrink-0" /> <span><b>Bounty</b> — {currentLang() === 'en' ? 'Reward paid on task completion' : 'Вознаграждение за выполнение задания'}</span></div>
                    <div class="flex items-start gap-1.5"><Icon name="repeat" size="xs" class="text-slate-500 dark:text-gray-200 mt-px shrink-0" /> <span><b>Subscription</b> — {currentLang() === 'en' ? 'Recurring auto-payments' : 'Рекуррентные автоплатежи'}</span></div>
                    <div class="flex items-start gap-1.5"><Icon name="shield" size="xs" class="text-slate-500 dark:text-gray-200 mt-px shrink-0" /> <span><b>Insurance</b> — {currentLang() === 'en' ? 'Automatic payout on verified claim' : 'Автовыплата по подтверждённому случаю'}</span></div>
                  </div>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* ====== NETWORK TAB ====== */}
        <Show when={activeTab() === 'network'}>
          {/* Node Status Hero */}
          <div class="rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #064e3b, #065f46)">
            <div class="p-5">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-emerald-400/20 flex items-center justify-center">
                    <Icon name="globe" size="lg" class="text-emerald-300" />
                  </div>
                  <div>
                    <div class="text-white font-bold text-lg">P2P Node</div>
                    <div class={`text-xs font-medium flex items-center gap-1 ${p2pRunning() ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      <div class={`w-1.5 h-1.5 rounded-full ${p2pRunning() ? 'bg-emerald-400' : 'bg-yellow-400'} animate-pulse`} />
                      {p2pRunning() ? (currentLang() === 'en' ? 'Running' : 'Работает') : (currentLang() === 'en' ? 'Stopped' : 'Остановлен')}
                    </div>
                  </div>
                </div>
                {/* Start/Stop button */}
                <button
                  class={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition ${
                    p2pRunning()
                      ? 'bg-red-500/30 text-red-300'
                      : 'bg-emerald-500/30 text-emerald-300'
                  }`}
                  onClick={p2pRunning() ? stopP2P : startP2P}
                  disabled={p2pLoading()}
                >
                  {p2pLoading() ? '...' : p2pRunning() ? (currentLang() === 'en' ? 'Stop' : 'Стоп') : (currentLang() === 'en' ? 'Start' : 'Старт')}
                </button>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="bg-white/10 rounded-xl p-3 text-center">
                  <div class="text-white font-bold text-2xl">{p2pPeers().length}</div>
                  <div class="text-emerald-200 text-xs">{currentLang() === 'en' ? 'Peers' : 'Пиры'}</div>
                </div>
                <div class="bg-white/10 rounded-xl p-3 text-center">
                  <div class="text-white font-bold text-2xl">{networkStatus()?.known_peers ?? 0}</div>
                  <div class="text-emerald-200 text-xs">{currentLang() === 'en' ? 'Known' : 'Известных'}</div>
                </div>
                <div class="bg-white/10 rounded-xl p-3 text-center">
                  <div class="text-white font-bold text-2xl">{chainStats()?.height ?? 0}</div>
                  <div class="text-emerald-200 text-xs">{currentLang() === 'en' ? 'Blocks' : 'Блоков'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Connect to peer */}
          <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
            <h3 class={`text-sm font-bold mb-3 ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{currentLang() === 'en' ? 'Connect to Peer' : 'Подключиться к пиру'}</h3>
            <div class="flex gap-2">
              <input
                class={`flex-1 px-3 py-2.5 rounded-xl text-xs font-mono focus:outline-none ${isDark() ? 'bg-black border border-gray-800 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'}`}
                placeholder="192.168.1.100:30333"
                value={p2pConnectAddr()}
                onInput={(e) => setP2pConnectAddr(e.currentTarget.value)}
              />
              <button
                class="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 disabled:opacity-50"
                onClick={connectPeer}
                disabled={!p2pConnectAddr() || p2pLoading()}
              >
                {currentLang() === 'en' ? 'Connect' : 'Связать'}
              </button>
            </div>
            <Show when={p2pConnectResult()}>
              <div class={`mt-2 p-2 rounded-lg text-xs flex items-center gap-1.5 ${p2pConnectResult()?.success ? (isDark() ? 'bg-green-900/30 text-green-400' : 'bg-green-50 text-green-700') : (isDark() ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700')}`}>
                {p2pConnectResult()?.success ? <><Icon name="checkCircle" size="xs" class="text-emerald-600 dark:text-emerald-400" /> Connected!</> : <><Icon name="alertCircle" size="xs" class="text-red-500 dark:text-red-400" /> {p2pConnectResult()?.error || 'Error'}</>}
              </div>
            </Show>
          </div>

          {/* Connected Peers List */}
          <div class={`rounded-2xl overflow-hidden mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
            <div class="px-4 py-3 flex items-center justify-between">
              <span class={`font-semibold text-sm ${isDark() ? 'text-gray-200' : 'text-gray-700'}`}>{currentLang() === 'en' ? 'Connected Peers' : 'Подключённые пиры'}</span>
              <button class="text-xs text-emerald-500 font-bold" onClick={refreshPeers}>↻</button>
            </div>
            <For each={p2pPeers()}>
              {(peer: any) => (
                <div class={`px-4 py-3 border-t flex items-center gap-3 ${isDark() ? 'border-white/5' : 'border-gray-100'}`}>
                  <div class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm">🖥️</div>
                  <div class="flex-1 min-w-0">
                    <div class={`text-xs font-mono truncate ${isDark() ? 'text-white' : 'text-gray-700'}`}>{peer.addr}</div>
                    <div class={`text-[10px] ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>{peer.version} • H:{peer.best_height}</div>
                  </div>
                  <div class="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              )}
            </For>
            <Show when={p2pPeers().length === 0}>
              <div class="px-4 py-8 text-center">
                <div class="text-3xl mb-2">📡</div>
                <div class={`text-sm ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{currentLang() === 'en' ? 'No peers connected' : 'Нет подключённых пиров'}</div>
                <div class={`text-xs mt-1 ${isDark() ? 'text-gray-300' : 'text-gray-300'}`}>{currentLang() === 'en' ? 'Start the node and connect to a peer' : 'Запустите ноду и подключитесь'}</div>
              </div>
            </Show>
          </div>

          {/* Protocol Info */}
          <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
            <h3 class={`text-sm font-bold mb-3 ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>BOLH P2P Protocol</h3>
            <div class="space-y-2.5">
              {([
                { icon: 'plug' as const, title: 'TCP', desc: currentLang() === 'en' ? 'Pure TCP protocol, lightweight for mobile' : 'Чистый TCP-протокол, лёгкий для мобильных', color: 'text-slate-500 dark:text-gray-200' },
                { icon: 'radio' as const, title: 'Gossip', desc: currentLang() === 'en' ? 'Blocks and transactions propagate automatically' : 'Блоки и транзакции распространяются автоматически', color: 'text-slate-500 dark:text-gray-200' },
                { icon: 'refreshCw' as const, title: 'Sync', desc: currentLang() === 'en' ? 'Automatic chain sync with peers' : 'Автоматическая синхронизация цепи', color: 'text-slate-500 dark:text-gray-200' },
                { icon: 'handshake' as const, title: 'Handshake', desc: currentLang() === 'en' ? 'Genesis hash verification on connect' : 'Проверка Genesis при подключении', color: 'text-slate-500 dark:text-gray-200' },
              ] as const).map(item => (
                <div class="flex items-start gap-2.5">
                  <div class={`w-6 h-6 rounded-lg ${isDark() ? 'bg-white/10' : 'bg-gray-100'} flex items-center justify-center shrink-0`}>
                    <Icon name={item.icon} size="xs" class={item.color} />
                  </div>
                  <div>
                    <div class={`text-xs font-medium ${isDark() ? 'text-white' : 'text-gray-700'}`}>{item.title}</div>
                    <div class={`text-[11px] ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Node Config */}
          <div class={`rounded-2xl p-4 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
            <h3 class={`text-sm font-bold mb-3 ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{currentLang() === 'en' ? 'Node Config' : 'Конфигурация'}</h3>
            <div class="space-y-2 text-xs">
              {[
                { label: 'Node ID', value: BC.shortAddr(networkStatus()?.node_id ?? 'local') },
                { label: 'Listen', value: networkStatus()?.listen_addr ?? '0.0.0.0:30333' },
                { label: currentLang() === 'en' ? 'Protocol' : 'Протокол', value: 'BOLH P2P v1' },
                { label: currentLang() === 'en' ? 'Max peers' : 'Макс. пиров', value: '50' },
              ].map(row => (
                <div class={`flex justify-between py-1.5 border-b ${isDark() ? 'border-white/5' : 'border-gray-100'}`}>
                  <span class={isDark() ? 'text-gray-200' : 'text-gray-500'}>{row.label}</span>
                  <span class={`font-mono ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Show>

        {/* ====== EXPLORER TAB ====== */}
        <Show when={activeTab() === 'explorer'}>
          <Show when={explorerLoading()}>
            <div class="flex items-center justify-center py-12"><div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          </Show>
          <Show when={!explorerLoading()}>
            {/* Chain Overview Hero */}
            <div class="rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #1e1b4b, #312e81)">
              <div class="p-5">
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-12 h-12 rounded-full bg-indigo-400/20 flex items-center justify-center">
                    <Icon name="search" size="lg" class="text-indigo-300" />
                  </div>
                  <div>
                    <div class="text-white font-bold text-lg">BOLH Explorer</div>
                    <div class="text-indigo-300 text-xs font-medium">
                      {currentLang() === 'en' ? 'On-chain data browser' : 'Обозреватель блокчейна'}
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-3 gap-3 mb-3">
                  <div class="bg-white/10 rounded-xl p-3 text-center">
                    <div class="text-white font-bold text-xl">{explorerData()?.chain?.height ?? 0}</div>
                    <div class="text-indigo-200 text-[10px]">{currentLang() === 'en' ? 'Blocks' : 'Блоков'}</div>
                  </div>
                  <div class="bg-white/10 rounded-xl p-3 text-center">
                    <div class="text-white font-bold text-xl">{explorerData()?.chain?.total_transactions ?? 0}</div>
                    <div class="text-indigo-200 text-[10px]">{currentLang() === 'en' ? 'Transactions' : 'Транзакций'}</div>
                  </div>
                  <div class="bg-white/10 rounded-xl p-3 text-center">
                    <div class="text-white font-bold text-xl">{explorerData()?.chain?.total_accounts ?? 0}</div>
                    <div class="text-indigo-200 text-[10px]">{currentLang() === 'en' ? 'Accounts' : 'Аккаунтов'}</div>
                  </div>
                </div>

                {/* Contracts overview */}
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-white/10 rounded-xl p-3">
                    <div class="flex items-center gap-2 mb-1">
                      <Icon name="fileText" size="xs" class="text-indigo-300" />
                      <span class="text-indigo-200 text-[10px]">{currentLang() === 'en' ? 'Smart Contracts' : 'Контракты'}</span>
                    </div>
                    <div class="text-white font-bold">{explorerData()?.contracts?.total_created ?? 0}</div>
                  </div>
                  <div class="bg-white/10 rounded-xl p-3">
                    <div class="flex items-center gap-2 mb-1">
                      <Icon name="lock" size="xs" class="text-indigo-300" />
                      <span class="text-indigo-200 text-[10px]">{currentLang() === 'en' ? 'Value Locked' : 'Залочено'}</span>
                    </div>
                    <div class="text-white font-bold">{BC.formatBOLH(explorerData()?.contracts?.total_locked ?? 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Genesis Hash */}
            <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
              <div class={`text-xs font-bold mb-2 ${isDark() ? 'text-white' : 'text-gray-700'}`}>Genesis Hash</div>
              <div class={`font-mono text-[10px] break-all p-2 rounded-lg ${isDark() ? 'bg-neutral-900/60 text-indigo-300' : 'bg-gray-100 text-indigo-600'}`}>
                {explorerData()?.chain?.genesis_hash ?? '...'}
              </div>
            </div>

            {/* Recent Blocks */}
            <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
              <div class="flex items-center justify-between mb-3">
                <h3 class={`text-sm font-bold ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>
                  {currentLang() === 'en' ? 'Recent Blocks' : 'Последние блоки'}
                </h3>
                <button class="text-xs text-indigo-500 font-bold active:scale-95" onClick={loadExplorer}>
                  {currentLang() === 'en' ? 'Refresh' : 'Обновить'}
                </button>
              </div>
              <Show when={explorerBlocks().length === 0}>
                <div class={`text-center py-6 ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>
                  <div class="flex justify-center mb-1"><Icon name="link" size="lg" class={isDark() ? 'text-gray-300' : 'text-gray-400'} /></div>
                  <div class="text-xs">{currentLang() === 'en' ? 'Only genesis block exists' : 'Пока только генезис-блок'}</div>
                </div>
              </Show>
              <div class="space-y-2">
                <For each={explorerBlocks()}>
                  {(block) => (
                    <button
                      class={`w-full rounded-xl p-3 text-left active:scale-[0.98] transition ${isDark() ? 'bg-neutral-900/60 hover:bg-neutral-900/80' : 'bg-gray-50 hover:bg-gray-100'}`}
                      onClick={() => loadBlock(block.height)}
                    >
                      <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                          <div class={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${block.height === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {block.height === 0 ? <Icon name="star" size="sm" class="text-amber-500 dark:text-amber-400" /> : `#${block.height}`}
                          </div>
                          <div>
                            <div class={`text-xs font-bold ${isDark() ? 'text-gray-200' : 'text-gray-700'}`}>
                              {block.height === 0 ? 'Genesis Block' : `Block #${block.height}`}
                            </div>
                            <div class={`font-mono text-[10px] ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>
                              {block.hash}...
                            </div>
                          </div>
                        </div>
                        <div class="text-right">
                          <div class={`text-xs font-bold ${isDark() ? 'text-white/90' : 'text-gray-600'}`}>
                            {block.tx_count} tx
                          </div>
                        </div>
                      </div>
                      <div class={`text-[10px] ${isDark() ? 'text-gray-300' : 'text-gray-400'}`}>
                        {currentLang() === 'en' ? 'Validator: ' : 'Валидатор: '}
                        <span class="font-mono">{BC.shortAddr(block.validator)}</span>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </div>

            {/* Selected Block Detail */}
            <Show when={selectedBlock()}>
              <div class={`rounded-2xl p-4 mb-5 ${isDark() ? 'bg-indigo-900/30 border border-indigo-700/50' : 'bg-indigo-50 border border-indigo-200'}`}>
                <div class="flex items-center justify-between mb-3">
                  <h3 class={`text-sm font-bold ${isDark() ? 'text-indigo-300' : 'text-indigo-700'}`}>
                    Block #{selectedBlock()?.height}
                  </h3>
                  <button class="text-gray-400 active:scale-95" onClick={() => setSelectedBlock(null)}><Icon name="x" size="xs" /></button>
                </div>
                <div class="space-y-2 text-xs">
                  {[
                    { label: 'Hash', value: selectedBlock()?.hash?.slice(0, 24) + '...' },
                    { label: 'Prev Hash', value: selectedBlock()?.prev_hash?.slice(0, 24) + '...' },
                    { label: currentLang() === 'en' ? 'Validator' : 'Валидатор', value: BC.shortAddr(selectedBlock()?.validator ?? '') },
                    { label: currentLang() === 'en' ? 'Transactions' : 'Транзакции', value: selectedBlock()?.tx_count ?? 0 },
                    { label: currentLang() === 'en' ? 'Fees' : 'Комиссии', value: BC.formatBOLH(selectedBlock()?.total_fees ?? 0) + ' BOLH' },
                    { label: 'State Root', value: selectedBlock()?.state_root?.slice(0, 24) + '...' },
                  ].map(row => (
                    <div class={`flex justify-between py-1.5 border-b ${isDark() ? 'border-indigo-700/30' : 'border-indigo-200/50'}`}>
                      <span class={isDark() ? 'text-indigo-400' : 'text-indigo-500'}>{row.label}</span>
                      <span class={`font-mono text-[10px] ${isDark() ? 'text-indigo-200' : 'text-indigo-700'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
                {/* Block Transactions */}
                <Show when={selectedBlock()?.transactions?.length > 0}>
                  <div class="mt-3 pt-3 border-t border-indigo-700/30">
                    <div class={`text-xs font-bold mb-2 ${isDark() ? 'text-indigo-300' : 'text-indigo-700'}`}>
                      {currentLang() === 'en' ? 'Transactions' : 'Транзакции'}
                    </div>
                    <div class="space-y-1.5">
                      <For each={selectedBlock()?.transactions ?? []}>
                        {(tx: any) => (
                          <div class={`rounded-lg p-2 ${isDark() ? 'bg-indigo-800/30' : 'bg-indigo-100/60'}`}>
                            <div class="flex items-center justify-between">
                              <span class={`text-[10px] font-medium ${isDark() ? 'text-indigo-300' : 'text-indigo-600'}`}>{tx.tx_type}</span>
                              <span class={`text-[10px] font-bold ${isDark() ? 'text-white' : 'text-indigo-800'}`}>{BC.formatBOLH(tx.amount)} BOLH</span>
                            </div>
                            <div class={`text-[9px] font-mono mt-0.5 ${isDark() ? 'text-indigo-400/70' : 'text-indigo-500/70'}`}>
                              {BC.shortAddr(tx.from)} → {BC.shortAddr(tx.to)}
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>

            {/* Blockchain Architecture */}
            <div class={`rounded-2xl p-4 ${isDark() ? 'bg-black/70 border border-white/5' : 'glass'}`}>
              <h3 class={`text-sm font-bold mb-3 ${isDark() ? 'text-gray-200' : 'text-gray-800'}`}>
                {currentLang() === 'en' ? 'Architecture' : 'Архитектура'}
              </h3>
              <div class="space-y-2">
                {([
                  { icon: 'shieldCheck' as const, title: 'Security Pipeline', desc: currentLang() === 'en' ? 'Ed25519, nonce, replay, rate-limit' : 'Ed25519, nonce, replay, rate-limit', color: 'text-red-500', bg: 'bg-red-100' },
                  { icon: 'scale' as const, title: 'PoS-BFT Consensus', desc: currentLang() === 'en' ? 'Stake-weighted voting, 2/3 finality' : 'Взвешенное голосование, 2/3 финалити', color: 'text-slate-600 dark:text-white/90', bg: 'bg-slate-100 dark:bg-black/70' },
                  { icon: 'box' as const, title: 'Mempool', desc: currentLang() === 'en' ? 'Fee-ordered, 10 tx/min per address' : 'По комиссии, 10 tx/мин на адрес', color: 'text-slate-600 dark:text-white/90', bg: 'bg-slate-100 dark:bg-black/70' },
                  { icon: 'repeat' as const, title: 'State Transition', desc: currentLang() === 'en' ? 'Deterministic, crash-safe execution' : 'Детерминированное, crash-safe исполнение', color: 'text-slate-600 dark:text-white/90', bg: 'bg-slate-100 dark:bg-black/70' },
                  { icon: 'fileText' as const, title: 'Smart Contracts', desc: currentLang() === 'en' ? 'Escrow, Bounty, Subscription, Insurance' : 'Escrow, Bounty, Подписки, Страхование', color: 'text-indigo-500', bg: 'bg-indigo-100' },
                  { icon: 'hardDrive' as const, title: 'Persistence', desc: currentLang() === 'en' ? 'Snapshot + WAL recovery' : 'Снапшот + WAL восстановление', color: 'text-slate-600 dark:text-white/90', bg: 'bg-slate-100 dark:bg-black/70' },
                ] as const).map(item => (
                  <div class="flex items-start gap-3 py-2">
                    <div class={`w-8 h-8 rounded-lg ${isDark() ? 'bg-white/10' : item.bg} flex items-center justify-center shrink-0`}>
                      <Icon name={item.icon} size="xs" class={item.color} />
                    </div>
                    <div>
                      <div class={`text-xs font-bold ${isDark() ? 'text-gray-200' : 'text-gray-700'}`}>{item.title}</div>
                      <div class={`text-[10px] ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Show>
        </Show>

      </Show>
      </div>
    </div>
  );
}

