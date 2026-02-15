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

export default function ProfilePage(props: { onNavigate: (page: string) => void }) {
  const themeLabel = () => {
    const th = theme();
    if (th === 'light') return '☀️ Светлая';
    if (th === 'dark') return '🌙 Тёмная';
    return '⚙️ Системная';
  };

  // Включение/выключение целого отдела
  const toggleDept = (deptId: string) => {
    const deptSkills = getDepartmentSkills(deptId);
    const currentSkills = workerSkills();
    const hasSome = deptSkills.some(s => currentSkills.includes(s.id));
    if (hasSome) {
      // Выключаем все навыки отдела
      const deptSkillIds = deptSkills.map(s => s.id);
      setWorkerSkills(currentSkills.filter(id => !deptSkillIds.includes(id)));
    } else {
      // Включаем все навыки без диплома, для дипломных - нужно подтверждение
      const freeSkills = deptSkills.filter(s => !s.requiresDiploma || verifiedDiplomas().includes(s.id));
      setWorkerSkills([...currentSkills, ...freeSkills.map(s => s.id)]);
    }
  };

  const isDeptActive = (deptId: string) => {
    const deptSkills = getDepartmentSkills(deptId);
    return deptSkills.some(s => workerSkills().includes(s.id));
  };

  const deptSkillCount = (deptId: string) => {
    const deptSkills = getDepartmentSkills(deptId);
    return deptSkills.filter(s => workerSkills().includes(s.id)).length;
  };

  const [expandedDept, setExpandedDept] = createSignal<string | null>(null);
  const [showDiplomaPrompt, setShowDiplomaPrompt] = createSignal<string | null>(null);

  const toggleSkill = (skillId: string, requiresDiploma: boolean) => {
    if (requiresDiploma && !verifiedDiplomas().includes(skillId)) {
      setShowDiplomaPrompt(skillId);
      return;
    }
    const current = workerSkills();
    if (current.includes(skillId)) {
      setWorkerSkills(current.filter(s => s !== skillId));
    } else {
      setWorkerSkills([...current, skillId]);
    }
  };

  const confirmDiploma = (skillId: string) => {
    const nextDiplomas = [...verifiedDiplomas(), skillId];
    setVerifiedDiplomas(nextDiplomas);
    setShowDiplomaPrompt(null);
    setWorkerSkills([...workerSkills(), skillId]);
  };

  const totalActiveSkills = () => workerSkills().length;
  const activeDeptCount = () => departments.filter(d => isDeptActive(d.id)).length;

  // ── Avatar / Photo upload ──
  const AVATAR_KEY = 'bolh_avatar_v1';
  const PORTFOLIO_KEY = 'bolh_portfolio_v1';
  const [avatarUrl, setAvatarUrl] = createSignal<string | null>((() => { try { return localStorage.getItem(AVATAR_KEY); } catch { return null; } })());
  const [portfolio, setPortfolio] = createSignal<string[]>((() => { try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || '[]'); } catch { return []; } })());
  const [showPhotoPicker, setShowPhotoPicker] = createSignal<'avatar' | 'portfolio' | null>(null);

  const handleFileSelect = (e: Event, mode: 'avatar' | 'portfolio') => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (mode === 'avatar') {
        setAvatarUrl(dataUrl);
        try { localStorage.setItem(AVATAR_KEY, dataUrl); } catch {}
      } else {
        const cur = portfolio();
        const next = [...cur, dataUrl];
        setPortfolio(next);
        try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next)); } catch {}
      }
    };
    reader.readAsDataURL(file);
  };

  const removePortfolioItem = (idx: number) => {
    const cur = portfolio();
    const next = cur.filter((_, i) => i !== idx);
    setPortfolio(next);
    try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next)); } catch {}
  };

  const userInitials = () => {
    const u = authUser();
    if (!u) return 'U';
    return u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Статус мастера
  const statusColor = () => {
    const s = workerStatus();
    if (s === 'online') return 'bg-green-500';
    if (s === 'busy') return 'bg-amber-500';
    return 'bg-gray-400';
  };

  const statusText = () => {
    const s = workerStatus();
    if (s === 'online') return t('status.online');
    if (s === 'busy') return busyUntil() ? t('status.busyUntil') + ' ' + busyUntil() : t('status.busy');
    return t('status.offline');
  };

  const cycleStatus = () => {
    const s = workerStatus();
    if (s === 'online') { setWorkerStatus('busy'); }
    else if (s === 'busy') { setWorkerStatus('offline'); setBusyUntil(null); }
    else { setWorkerStatus('online'); setBusyUntil(null); }
  };
  
  const menuItems = () => [
    // ── Security & Identity ──
    { icon: 'shield', label: t('profile.security'), desc: t('profile.securityDesc'), action: 'security', highlight: true },
    { icon: 'userCheck', label: t('profile.verification'), desc: '33% • ' + t('profile.verificationDesc'), action: 'verification', highlight: true },
    { icon: 'folder', label: t('profile.documents'), desc: t('profile.documentsDesc'), action: 'documents', highlight: true },
    // ── Growth & Progress ──
    { icon: 'book', label: t('profile.academy'), desc: t('profile.academyDesc'), action: 'academy', highlight: true },
    { icon: 'award', label: t('achievements.title'), desc: t('achievements.subtitle'), action: 'achievements' },
    { icon: 'activity', label: t('analytics.title'), desc: t('analytics.subtitle'), action: 'analytics' },
    // ── Services ──
    { icon: 'target', label: t('marketplace.title'), desc: t('marketplace.subtitle'), action: 'marketplace' },
    // ── Settings ──
    { icon: 'globe', label: t('profile.language'), desc: getCurrentLanguage().name + ' ' + getCurrentLanguage().flag, action: 'language' },
    { icon: isDark() ? 'moon' : 'sun', label: t('profile.theme'), desc: themeLabel(), action: 'theme' },
    { icon: 'settings', label: t('settings.title'), desc: t('settings.subtitle'), action: 'settings' },
  ];

  return (
    <div class="p-4 animate-fade-in">
      {/* Профиль + статус */}
      <div style="padding: 24px; border-radius: 24px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 16px; text-align: center;">
        <div style="position: relative; display: inline-block; margin-bottom: 16px;">
          {/* Avatar with upload */}
          <div
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => handleFileSelect(e, 'avatar');
              input.click();
            }}
            style="width: 96px; height: 96px; border-radius: 50%; cursor: pointer; overflow: hidden; position: relative; box-shadow: 0 8px 30px rgba(99,102,241,0.3);"
          >
            <Show when={avatarUrl()} fallback={
              <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 32px; font-weight: 800;">
                {userInitials()}
              </div>
            }>
              <img src={avatarUrl()!} style="width: 100%; height: 100%; object-fit: cover;" />
            </Show>
            {/* Camera overlay */}
            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}>
              <span style="font-size: 28px;">📷</span>
            </div>
          </div>
          {/* Status badge */}
          <div style={`position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; border-radius: 50%; border: 3px solid #0a0618; display: flex; align-items: center; justify-content: center; font-size: 12px; ${workerStatus() === 'online' ? 'background: #22c55e;' : workerStatus() === 'busy' ? 'background: #f59e0b;' : 'background: #6b7280;'}`}>
            {workerStatus() === 'online' ? '✓' : workerStatus() === 'busy' ? '⏳' : '—'}
          </div>
          {/* Edit icon */}
          <div style="position: absolute; top: -2px; right: -2px; width: 24px; height: 24px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(99,102,241,0.5); cursor: pointer;">
            <span style="color: #fff; font-size: 11px;">✏️</span>
          </div>
        </div>
        <h1 style="color: #fff; font-size: 20px; font-weight: 800; margin: 0;">{authUser()?.name || 'User'}</h1>
        <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 4px 0 0 0;">{authUser()?.phone || ''}</p>

        {/* Статус кнопка */}
        <button 
          class={`mt-3 px-5 py-2 rounded-full text-sm font-semibold touch-scale inline-flex items-center gap-2 ${
            workerStatus() === 'online' ? 'bg-green-100 text-green-700' :
            workerStatus() === 'busy' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-500'
          }`}
          onClick={cycleStatus}
        >
          <span class={`w-2.5 h-2.5 rounded-full ${statusColor()}`} />
          {statusText()}
        </button>
        
        <div class="flex justify-center gap-8 mt-5">
          <div class="text-center">
            <p class="text-2xl font-bold text-slate-700 dark:text-slate-200">15</p>
            <p class="text-xs text-gray-500">{t('profile.orders')}</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-slate-700 dark:text-slate-200">4.8</p>
            <p class="text-xs text-gray-500">{t('profile.rating')}</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-slate-700 dark:text-slate-200">2</p>
            <p class="text-xs text-gray-500">{t('profile.years')}</p>
          </div>
        </div>
      </div>

      {/* Меню */}
      <div class="glass rounded-3xl overflow-hidden animate-slide-up" style="animation-delay: 0.1s">
        <For each={menuItems()}>
          {(item) => {
            const getIconStyle = () => {
              return { bg: 'from-slate-200 to-slate-300 dark:from-neutral-900 dark:to-neutral-800', text: 'text-slate-600 dark:text-white/90' };
            };
            const style = getIconStyle();
            const isSpecial = (item as any).special;
            return (
              <button 
                class={`w-full p-4 flex items-center gap-4 touch-scale border-b border-gray-100 last:border-0 ${
                  isSpecial ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' :
                  (item as any).highlight ? 'bg-gradient-to-r from-indigo-50/50 to-purple-50/50' : ''
                }`}
                onClick={() => item.action && props.onNavigate(item.action)}
              >
                <div class={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${style.bg} ${isSpecial ? 'animate-pulse' : ''}`}>
                  <Icon name={item.icon as any} class={style.text} />
                </div>
                <div class="flex-1 text-left">
                  <div class="flex items-center gap-2">
                    <p class={`font-medium ${isSpecial ? 'text-amber-800' : 'text-gray-800'}`}>{item.label}</p>
                    <Show when={isSpecial}>
                      <span class="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                        NEW
                      </span>
                    </Show>
                  </div>
                  <p class={`text-sm ${isSpecial ? 'text-amber-600' : 'text-gray-500'}`}>{item.desc}</p>
                </div>
                <Icon name={isSpecial ? 'play' : 'chevronRight'} class={isSpecial ? 'text-indigo-500' : 'text-slate-400 dark:text-gray-300'} size="sm" />
              </button>
            );
          }}
        </For>
      </div>

      {/* ── Portfolio Section (for workers) ── */}
      <Show when={profileMode() === 'worker'}>
        <div style="margin-top: 16px; padding: 16px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">
              📸 {currentLang() === 'en' ? 'My Portfolio' : 'Моё портфолио'}
            </p>
            <span style="color: rgba(255,255,255,0.3); font-size: 12px;">{portfolio().length} {currentLang() === 'en' ? 'photos' : 'фото'}</span>
          </div>

          {/* Portfolio grid */}
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
            <For each={portfolio()}>
              {(photo, idx) => (
                <div style="position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08);">
                  <img src={photo} style="width: 100%; height: 100%; object-fit: cover;" />
                  <button
                    onClick={() => removePortfolioItem(idx())}
                    style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(239,68,68,0.9); border: none; color: #fff; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;"
                  >✕</button>
                </div>
              )}
            </For>

            {/* Add photo button */}
            <div
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (!files) return;
                  Array.from(files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result as string;
                      const cur = portfolio();
                      const next = [...cur, dataUrl];
                      setPortfolio(next);
                      try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(next)); } catch {}
                    };
                    reader.readAsDataURL(file);
                  });
                };
                input.click();
              }}
              style="aspect-ratio: 1; border-radius: 14px; border: 2px dashed rgba(255,255,255,0.12); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; gap: 4px; transition: all 0.2s;"
            >
              <span style="font-size: 24px;">➕</span>
              <span style="color: rgba(255,255,255,0.3); font-size: 10px; font-weight: 600;">{currentLang() === 'en' ? 'Add' : 'Добавить'}</span>
            </div>
          </div>

          <Show when={portfolio().length === 0}>
            <p style="color: rgba(255,255,255,0.25); font-size: 12px; text-align: center; margin: 0;">
              {currentLang() === 'en' ? 'Add photos of your work to attract more clients' : 'Добавьте фото своих работ чтобы привлечь больше клиентов'}
            </p>
          </Show>
        </div>
      </Show>

      <button class="w-full mt-6 glass rounded-3xl p-4 flex items-center justify-center gap-3 touch-scale animate-slide-up" style="animation-delay: 0.2s">
        <Icon name="logout" class="text-red-500" />
        <span class="font-medium text-red-500">{t('profile.logout')}</span>
      </button>
    </div>
  );
}

