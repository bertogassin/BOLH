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

export default function PaymentsPage(props: { onBack: () => void }) {
  const isEn = () => currentLang() === 'en';
  const [activeTab, setActiveTab] = createSignal<'balance' | 'cards' | 'history' | 'escrow'>('balance');
  const [showDeposit, setShowDeposit] = createSignal(false);
  const [showWithdraw, setShowWithdraw] = createSignal(false);
  const [showAddCard, setShowAddCard] = createSignal(false);
  const [depositAmount, setDepositAmount] = createSignal('');
  const [withdrawAmount, setWithdrawAmount] = createSignal('');
  const [withdrawDest, setWithdrawDest] = createSignal('Kaspi Gold');
  const [cardNumber, setCardNumber] = createSignal('');
  const [cardExpiry, setCardExpiry] = createSignal('');
  const [processing, setProcessing] = createSignal(false);
  const [txFilter, setTxFilter] = createSignal<'all' | 'earning' | 'payment' | 'deposit' | 'withdrawal'>('all');
  const stats = () => getStats();

  const filteredTx = () => {
    const f = txFilter();
    if (f === 'all') return transactions();
    return transactions().filter(t => t.type === f);
  };

  const handleDeposit = () => {
    const amt = parseInt(depositAmount());
    if (!amt || amt < 100) return;
    setProcessing(true);
    setTimeout(() => {
      deposit(amt);
      notify.success(isEn() ? 'Deposit successful!' : 'Пополнение успешно!', `+${amt.toLocaleString()} ₸`);
      haptic('heavy'); playGlobalSound('success');
      setDepositAmount(''); setShowDeposit(false); setProcessing(false);
    }, 1500);
  };

  const handleWithdraw = () => {
    const amt = parseInt(withdrawAmount());
    if (!amt || amt < 500 || amt > balance()) return;
    setProcessing(true);
    setTimeout(() => {
      const tx = withdraw(amt, withdrawDest());
      if (tx) {
        notify.info(isEn() ? 'Withdrawal processing' : 'Вывод обрабатывается', `${amt.toLocaleString()} ₸ → ${withdrawDest()}`);
        haptic('medium');
      }
      setWithdrawAmount(''); setShowWithdraw(false); setProcessing(false);
    }, 1500);
  };

  const handleAddCard = () => {
    const num = cardNumber().replace(/\s/g, '');
    if (num.length < 16 || !cardExpiry()) return;
    setProcessing(true);
    setTimeout(() => {
      const last4 = num.slice(-4);
      const brand = num.startsWith('4') ? 'visa' : num.startsWith('5') ? 'mastercard' : num.startsWith('2') ? 'mir' : 'unionpay';
      const colors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#1b1b2f'];
      addCard({ last4, brand: brand as any, expiry: cardExpiry(), isDefault: cards().length === 0, color: colors[cards().length % colors.length] });
      notify.success(isEn() ? 'Card added!' : 'Карта добавлена!', `${brand.toUpperCase()} •••• ${last4}`);
      haptic('medium'); playGlobalSound('success');
      setCardNumber(''); setCardExpiry(''); setShowAddCard(false); setProcessing(false);
    }, 2000);
  };

  const txIcon = (type: string) => {
    const m: Record<string, string> = { deposit: '💰', withdrawal: '📤', payment: '🛒', earning: '💵', refund: '↩️', bonus: '🎁', subscription: '⭐' };
    return m[type] || '💳';
  };
  const txColor = (type: string) => {
    const m: Record<string, string> = { deposit: '#22c55e', withdrawal: '#f59e0b', payment: '#ef4444', earning: '#22c55e', refund: '#3b82f6', bonus: '#ec4899', subscription: '#8b5cf6' };
    return m[type] || '#6366f1';
  };

  const quickAmounts = [1000, 5000, 10000, 25000, 50000];

  return (
    <div style={`min-height: 100vh; ${isDark() ? 'background: #0a0a0f;' : 'background: #f5f5f7;'}`}>
      {/* ── Header with Balance ── */}
      <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa); padding: 16px; padding-top: max(16px, env(safe-area-inset-top)); border-radius: 0 0 28px 28px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <button onClick={props.onBack} style="width: 40px; height: 40px; border-radius: 14px; background: rgba(255,255,255,0.2); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            <span style="color: #fff; font-size: 18px;">←</span>
          </button>
          <h1 style="flex: 1; font-size: 20px; font-weight: 800; color: #fff; margin: 0;">{isEn() ? 'Payments' : 'Платежи'}</h1>
        </div>

        {/* Balance Card */}
        <div style="background: rgba(255,255,255,0.25); border-radius: 20px; padding: 20px; border: 1px solid rgba(255,255,255,0.2);">
          <p style="color: rgba(255,255,255,0.7); font-size: 12px; margin: 0 0 4px;">{isEn() ? 'Available Balance' : 'Доступный баланс'}</p>
          <p style="color: #fff; font-size: 36px; font-weight: 800; margin: 0; letter-spacing: -1px;">{balance().toLocaleString()} <span style="font-size: 18px; font-weight: 400; opacity: 0.8;">₸</span></p>
          <Show when={frozenBalance() > 0}>
            <p style="color: rgba(255,255,255,0.5); font-size: 11px; margin: 4px 0 0;">🔒 {isEn() ? 'In escrow' : 'Заморожено'}: {frozenBalance().toLocaleString()} ₸</p>
          </Show>
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button onClick={() => setShowDeposit(true)} style="flex: 1; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.25); border: none; cursor: pointer; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              💰 {isEn() ? 'Top Up' : 'Пополнить'}
            </button>
            <button onClick={() => setShowWithdraw(true)} style="flex: 1; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
              📤 {isEn() ? 'Withdraw' : 'Вывести'}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; text-align: center;">
            <p style="color: #4ade80; font-size: 14px; font-weight: 700; margin: 0;">+{stats().monthEarnings.toLocaleString()}</p>
            <p style="color: rgba(255,255,255,0.5); font-size: 10px; margin: 2px 0 0;">{isEn() ? 'Earned' : 'Заработано'}</p>
          </div>
          <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; text-align: center;">
            <p style="color: #f87171; font-size: 14px; font-weight: 700; margin: 0;">-{stats().monthSpent.toLocaleString()}</p>
            <p style="color: rgba(255,255,255,0.5); font-size: 10px; margin: 2px 0 0;">{isEn() ? 'Spent' : 'Потрачено'}</p>
          </div>
          <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; text-align: center;">
            <p style="color: #fff; font-size: 14px; font-weight: 700; margin: 0;">{stats().txCount}</p>
            <p style="color: rgba(255,255,255,0.5); font-size: 10px; margin: 2px 0 0;">{isEn() ? 'Transactions' : 'Операций'}</p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style="display: flex; gap: 6px; padding: 12px 16px; overflow-x: auto;">
        {[
          { id: 'balance' as const, label: isEn() ? '💳 Cards' : '💳 Карты' },
          { id: 'history' as const, label: isEn() ? '📋 History' : '📋 История' },
          { id: 'escrow' as const, label: isEn() ? '🔒 Escrow' : '🔒 Эскроу' },
        ].map(tab => (
          <button onClick={() => setActiveTab(tab.id)} style={`padding: 8px 16px; border-radius: 20px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; transition: all 0.2s; ${activeTab() === tab.id ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}; color: ${isDark() ? '#ccc' : '#666'};`}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style="padding: 0 16px 120px;">

        {/* ── Cards Tab ── */}
        <Show when={activeTab() === 'balance'}>
          <For each={cards()}>
            {(card) => (
              <div style={`background: ${card.color}; border-radius: 18px; padding: 20px; margin-bottom: 12px; position: relative; overflow: hidden; min-height: 110px;`}>
                <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1);" />
                <div style="position: absolute; bottom: -10px; left: -10px; width: 60px; height: 60px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.08);" />
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                  <p style={`color: #fff; font-size: 12px; font-weight: 600; margin: 0; text-transform: uppercase; letter-spacing: 1px;`}>{card.brand}</p>
                  <Show when={card.isDefault}>
                    <span style="padding: 2px 8px; border-radius: 8px; background: rgba(34,197,94,0.3); color: #4ade80; font-size: 10px; font-weight: 600;">Default</span>
                  </Show>
                </div>
                <p style="color: #fff; font-size: 20px; font-weight: 300; margin: 0; letter-spacing: 3px;">•••• •••• •••• {card.last4}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
                  <p style="color: rgba(255,255,255,0.6); font-size: 11px; margin: 0;">EXP {card.expiry}</p>
                  <div style="display: flex; gap: 8px;">
                    <Show when={!card.isDefault}>
                      <button onClick={() => setDefaultCard(card.id)} style="padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,0.15); border: none; cursor: pointer; color: #fff; font-size: 10px;">{isEn() ? 'Set default' : 'Основная'}</button>
                    </Show>
                    <button onClick={() => { removeCard(card.id); haptic('light'); }} style="padding: 4px 10px; border-radius: 8px; background: rgba(239,68,68,0.3); border: none; cursor: pointer; color: #f87171; font-size: 10px;">✕</button>
                  </div>
                </div>
              </div>
            )}
          </For>
          <button onClick={() => setShowAddCard(true)} style={`width: 100%; padding: 16px; border-radius: 16px; border: 2px dashed ${isDark() ? 'rgba(255,255,255,0.15)' : '#ccc'}; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6366f1; font-size: 14px; font-weight: 600;`}>
            + {isEn() ? 'Add Card' : 'Добавить карту'}
          </button>
        </Show>

        {/* ── Transaction History Tab ── */}
        <Show when={activeTab() === 'history'}>
          <div style="display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px;">
            {[
              { id: 'all' as const, label: isEn() ? 'All' : 'Все' },
              { id: 'earning' as const, label: '💵' },
              { id: 'payment' as const, label: '🛒' },
              { id: 'deposit' as const, label: '💰' },
              { id: 'withdrawal' as const, label: '📤' },
            ].map(f => (
              <button onClick={() => setTxFilter(f.id)} style={`padding: 6px 14px; border-radius: 16px; border: none; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap; ${txFilter() === f.id ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.06)' : '#eee'}; color: ${isDark() ? '#aaa' : '#777'};`}`}>
                {f.label}
              </button>
            ))}
          </div>
          <Show when={filteredTx().length > 0} fallback={
            <div style="text-align: center; padding: 40px;">
              <p style="font-size: 40px;">📭</p>
              <p style={`color: ${isDark() ? '#888' : '#999'}; font-size: 14px; margin-top: 8px;`}>{isEn() ? 'No transactions yet' : 'Пока нет операций'}</p>
            </div>
          }>
            <For each={filteredTx()}>
              {(tx) => {
                const c = txColor(tx.type);
                return (
                  <div style={`display: flex; align-items: center; gap: 12px; padding: 14px; margin-bottom: 8px; border-radius: 16px; ${isDark() ? `background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);` : `background: #fff; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.04);`}`}>
                    <div style={`width: 42px; height: 42px; border-radius: 12px; background: ${c}15; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;`}>
                      {txIcon(tx.type)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <p style={`font-size: 13px; font-weight: 600; margin: 0; color: ${isDark() ? '#fff' : '#111'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{tx.description}</p>
                      <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                        <span style={`font-size: 10px; padding: 1px 6px; border-radius: 6px; background: ${c}15; color: ${c}; font-weight: 600;`}>{tx.status === 'completed' ? '✓' : tx.status === 'processing' ? '⏳' : '✗'}</span>
                        <span style="font-size: 10px; color: #999;">{new Date(tx.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <p style={`font-size: 15px; font-weight: 700; margin: 0; flex-shrink: 0; color: ${tx.amount > 0 ? '#22c55e' : '#ef4444'};`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ₸
                    </p>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>

        {/* ── Escrow Tab ── */}
        <Show when={activeTab() === 'escrow'}>
          <Show when={escrows().length > 0} fallback={
            <div style="text-align: center; padding: 40px;">
              <p style="font-size: 40px;">🔒</p>
              <p style={`color: ${isDark() ? '#888' : '#999'}; font-size: 14px; margin-top: 8px;`}>{isEn() ? 'No active escrow payments' : 'Нет активных эскроу'}</p>
              <p style="color: #aaa; font-size: 12px; margin-top: 4px;">{isEn() ? 'Money is held safely until order completion' : 'Деньги удерживаются до завершения заказа'}</p>
            </div>
          }>
            <For each={escrows()}>
              {(esc) => {
                const statusColors: Record<string, string> = { held: '#f59e0b', released: '#22c55e', refunded: '#3b82f6', disputed: '#ef4444' };
                const statusLabels: Record<string, string> = { held: isEn() ? 'Held' : 'Удержано', released: isEn() ? 'Released' : 'Выплачено', refunded: isEn() ? 'Refunded' : 'Возврат', disputed: isEn() ? 'Disputed' : 'Спор' };
                const c = statusColors[esc.status] || '#6366f1';
                return (
                  <div style={`padding: 16px; margin-bottom: 10px; border-radius: 16px; border-left: 4px solid ${c}; ${isDark() ? 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);' : 'background: #fff; border: 1px solid #eee;'} border-left: 4px solid ${c};`}>
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                      <div>
                        <p style={`font-size: 14px; font-weight: 700; margin: 0; color: ${isDark() ? '#fff' : '#111'};`}>{esc.service}</p>
                        <p style="font-size: 11px; color: #888; margin: 2px 0 0;">Order #{esc.orderId}</p>
                      </div>
                      <span style={`padding: 3px 10px; border-radius: 10px; background: ${c}15; color: ${c}; font-size: 11px; font-weight: 600;`}>{statusLabels[esc.status]}</span>
                    </div>
                    <p style={`font-size: 22px; font-weight: 800; color: ${c}; margin: 8px 0;`}>{esc.amount.toLocaleString()} ₸</p>
                    <Show when={esc.status === 'held'}>
                      <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button onClick={() => { releaseEscrow(esc.id); notify.success(isEn() ? 'Payment released!' : 'Оплата отправлена!', `${esc.amount.toLocaleString()} ₸ → ${isEn() ? 'Worker' : 'Мастеру'}`); haptic('heavy'); }}
                          style="flex: 1; padding: 10px; border-radius: 12px; background: #22c55e; border: none; cursor: pointer; color: #fff; font-size: 12px; font-weight: 700;">
                          ✓ {isEn() ? 'Release' : 'Оплатить'}
                        </button>
                        <button onClick={() => { refundEscrow(esc.id); notify.info(isEn() ? 'Refund processed' : 'Возврат оформлен', `${esc.amount.toLocaleString()} ₸`); haptic('medium'); }}
                          style="flex: 1; padding: 10px; border-radius: 12px; background: rgba(239,68,68,0.15); border: none; cursor: pointer; color: #ef4444; font-size: 12px; font-weight: 700;">
                          ↩ {isEn() ? 'Refund' : 'Вернуть'}
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </div>

      {/* ══════ Deposit Modal ══════ */}
      <Show when={showDeposit()}>
        <div style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.78); display: flex; align-items: flex-end; justify-content: center;" onClick={() => setShowDeposit(false)}>
          <div style={`width: 100%; max-width: 420px; border-radius: 24px 24px 0 0; padding: 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); ${isDark() ? 'background: #1a1a2e;' : 'background: #fff;'} animation: slideUp 0.3s ease-out;`} onClick={(e: any) => e.stopPropagation()}>
            <div style="width: 40px; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.3); margin: 0 auto 16px;" />
            <h3 style={`font-size: 20px; font-weight: 800; margin: 0 0 16px; color: ${isDark() ? '#fff' : '#111'};`}>💰 {isEn() ? 'Top Up Balance' : 'Пополнить баланс'}</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
              <For each={quickAmounts}>
                {(amt) => (
                  <button onClick={() => setDepositAmount(String(amt))} style={`padding: 8px 16px; border-radius: 12px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; ${depositAmount() === String(amt) ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}; color: ${isDark() ? '#ccc' : '#555'};`}`}>
                    {amt.toLocaleString()} ₸
                  </button>
                )}
              </For>
            </div>
            <input type="number" value={depositAmount()} onInput={(e) => setDepositAmount(e.currentTarget.value)} placeholder={isEn() ? 'Or enter amount' : 'Или введите сумму'}
              style={`width: 100%; padding: 14px 16px; border-radius: 14px; border: 2px solid ${isDark() ? 'rgba(255,255,255,0.1)' : '#ddd'}; background: ${isDark() ? 'rgba(255,255,255,0.05)' : '#fafafa'}; color: ${isDark() ? '#fff' : '#111'}; font-size: 18px; font-weight: 600; outline: none; margin-bottom: 12px; box-sizing: border-box;`} />
            <Show when={cards().length > 0}>
              <p style="font-size: 11px; color: #888; margin: 0 0 4px;">{isEn() ? 'From card' : 'С карты'}: {cards().find(c => c.isDefault)?.brand.toUpperCase()} •••• {cards().find(c => c.isDefault)?.last4}</p>
            </Show>
            <button onClick={handleDeposit} disabled={processing() || !depositAmount() || parseInt(depositAmount()) < 100}
              style={`width: 100%; padding: 16px; border-radius: 16px; border: none; cursor: pointer; font-size: 16px; font-weight: 700; margin-top: 12px; color: #fff; background: linear-gradient(135deg, #22c55e, #16a34a); opacity: ${processing() || !depositAmount() ? '0.5' : '1'};`}>
              {processing() ? '⏳ ...' : isEn() ? 'Deposit' : 'Пополнить'}
            </button>
          </div>
        </div>
      </Show>

      {/* ══════ Withdraw Modal ══════ */}
      <Show when={showWithdraw()}>
        <div style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.78); display: flex; align-items: flex-end; justify-content: center;" onClick={() => setShowWithdraw(false)}>
          <div style={`width: 100%; max-width: 420px; border-radius: 24px 24px 0 0; padding: 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); ${isDark() ? 'background: #1a1a2e;' : 'background: #fff;'} animation: slideUp 0.3s ease-out;`} onClick={(e: any) => e.stopPropagation()}>
            <div style="width: 40px; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.3); margin: 0 auto 16px;" />
            <h3 style={`font-size: 20px; font-weight: 800; margin: 0 0 6px; color: ${isDark() ? '#fff' : '#111'};`}>📤 {isEn() ? 'Withdraw' : 'Вывод средств'}</h3>
            <p style="font-size: 12px; color: #888; margin: 0 0 16px;">{isEn() ? 'Available' : 'Доступно'}: {balance().toLocaleString()} ₸</p>
            <input type="number" value={withdrawAmount()} onInput={(e) => setWithdrawAmount(e.currentTarget.value)} placeholder={isEn() ? 'Amount' : 'Сумма'}
              style={`width: 100%; padding: 14px 16px; border-radius: 14px; border: 2px solid ${isDark() ? 'rgba(255,255,255,0.1)' : '#ddd'}; background: ${isDark() ? 'rgba(255,255,255,0.05)' : '#fafafa'}; color: ${isDark() ? '#fff' : '#111'}; font-size: 18px; font-weight: 600; outline: none; margin-bottom: 12px; box-sizing: border-box;`} />
            <p style={`font-size: 12px; margin: 0 0 8px; color: ${isDark() ? '#ccc' : '#333'};`}>{isEn() ? 'Destination' : 'Куда вывести'}:</p>
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
              {['Kaspi Gold', 'Halyk Bank', 'BOLH Token'].map(d => (
                <button onClick={() => setWithdrawDest(d)} style={`flex: 1; padding: 10px; border-radius: 12px; border: none; cursor: pointer; font-size: 11px; font-weight: 600; text-align: center; ${withdrawDest() === d ? 'background: #6366f1; color: #fff;' : `background: ${isDark() ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}; color: ${isDark() ? '#ccc' : '#555'};`}`}>
                  {d}
                </button>
              ))}
            </div>
            <button onClick={handleWithdraw} disabled={processing() || !withdrawAmount() || parseInt(withdrawAmount()) > balance()}
              style={`width: 100%; padding: 16px; border-radius: 16px; border: none; cursor: pointer; font-size: 16px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #f59e0b, #d97706); opacity: ${processing() || !withdrawAmount() ? '0.5' : '1'};`}>
              {processing() ? '⏳ ...' : isEn() ? 'Withdraw' : 'Вывести'}
            </button>
          </div>
        </div>
      </Show>

      {/* ══════ Add Card Modal ══════ */}
      <Show when={showAddCard()}>
        <div style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.78); display: flex; align-items: flex-end; justify-content: center;" onClick={() => setShowAddCard(false)}>
          <div style={`width: 100%; max-width: 420px; border-radius: 24px 24px 0 0; padding: 24px; padding-bottom: max(24px, env(safe-area-inset-bottom)); ${isDark() ? 'background: #1a1a2e;' : 'background: #fff;'} animation: slideUp 0.3s ease-out;`} onClick={(e: any) => e.stopPropagation()}>
            <div style="width: 40px; height: 4px; border-radius: 2px; background: rgba(128,128,128,0.3); margin: 0 auto 16px;" />
            <h3 style={`font-size: 20px; font-weight: 800; margin: 0 0 16px; color: ${isDark() ? '#fff' : '#111'};`}>💳 {isEn() ? 'Add Card' : 'Добавить карту'}</h3>
            <p style={`font-size: 12px; margin: 0 0 6px; color: ${isDark() ? '#aaa' : '#666'};`}>{isEn() ? 'Card Number' : 'Номер карты'}</p>
            <input type="text" maxLength={19} value={cardNumber()} onInput={(e) => {
              let v = e.currentTarget.value.replace(/\D/g, '').substring(0, 16);
              v = v.replace(/(.{4})/g, '$1 ').trim();
              setCardNumber(v);
            }} placeholder="0000 0000 0000 0000"
              style={`width: 100%; padding: 14px 16px; border-radius: 14px; border: 2px solid ${isDark() ? 'rgba(255,255,255,0.1)' : '#ddd'}; background: ${isDark() ? 'rgba(255,255,255,0.05)' : '#fafafa'}; color: ${isDark() ? '#fff' : '#111'}; font-size: 18px; font-weight: 600; outline: none; margin-bottom: 12px; letter-spacing: 2px; box-sizing: border-box;`} />
            <p style={`font-size: 12px; margin: 0 0 6px; color: ${isDark() ? '#aaa' : '#666'};`}>{isEn() ? 'Expiry' : 'Срок действия'}</p>
            <input type="text" maxLength={5} value={cardExpiry()} onInput={(e) => {
              let v = e.currentTarget.value.replace(/\D/g, '').substring(0, 4);
              if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
              setCardExpiry(v);
            }} placeholder="MM/YY"
              style={`width: 50%; padding: 14px 16px; border-radius: 14px; border: 2px solid ${isDark() ? 'rgba(255,255,255,0.1)' : '#ddd'}; background: ${isDark() ? 'rgba(255,255,255,0.05)' : '#fafafa'}; color: ${isDark() ? '#fff' : '#111'}; font-size: 18px; font-weight: 600; outline: none; margin-bottom: 16px; box-sizing: border-box;`} />
            <button onClick={handleAddCard} disabled={processing() || cardNumber().replace(/\s/g, '').length < 16 || cardExpiry().length < 5}
              style={`width: 100%; padding: 16px; border-radius: 16px; border: none; cursor: pointer; font-size: 16px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); opacity: ${processing() || cardNumber().length < 19 ? '0.5' : '1'};`}>
              {processing() ? '⏳ ...' : isEn() ? 'Add Card' : 'Добавить'}
            </button>
          </div>
        </div>
      </Show>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

