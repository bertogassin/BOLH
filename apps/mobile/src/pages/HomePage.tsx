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

export default function HomePage(props: { onNavigate: (page: string) => void }) {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('greeting.night');
    else if (hour < 12) return t('greeting.morning');
    else if (hour < 18) return t('greeting.afternoon');
    else return t('greeting.evening');
  };

  const [elinaChatOpen, setElinaChatOpen] = createSignal(false);

  const deptName = (dept: Department) => currentLang() === 'en' ? dept.nameEn : dept.name;
  const deptDesc = (dept: Department) => currentLang() === 'en' ? dept.descriptionEn : dept.description;

  return (
    <div class="p-4 animate-fade-in">
      {/* Elina Chat Panel */}
      <ElinaChatPanel open={elinaChatOpen()} onClose={() => setElinaChatOpen(false)} />

      {/* Header: [Bell] ─── [Elina] */}
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          class="relative w-10 h-10 rounded-full glass flex items-center justify-center text-white touch-scale"
          onClick={() => props.onNavigate('notifications')}
          aria-label={t('notifications.title')}
        >
          <Icon name="bell" class="w-4 h-4" />
          <Show when={unreadCount() > 0}>
            <div class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full border-2 border-black flex items-center justify-center px-0.5"
                 style="animation: pulse 2s infinite;">
              <span class="text-[8px] text-white font-bold">{unreadCount() > 9 ? '9+' : unreadCount()}</span>
            </div>
          </Show>
        </button>
        <div class="shrink-0 touch-scale" onClick={() => { setElinaChatOpen(true); haptic('light'); }}>
          <MobileElina size={42} />
        </div>
      </div>

      {/* Department Section with Toggle */}
      <div class="glass rounded-3xl p-4 mb-6 animate-slide-up" style="animation-delay: 0.1s">
        {/* Toggle: Найти мастера ↔ Я мастер */}
        <div class="flex bg-white/10 rounded-2xl p-1 mb-4">
          <button
            type="button"
            class={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              homeMode() === 'search'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-white/90'
            }`}
            onClick={() => { setHomeMode('search'); setHomeExpandedDept(null); }}
          >
            <span class="flex items-center gap-1.5"><Icon name="search" size="xs" class="text-white" /> {currentLang() === 'en' ? 'Find a Pro' : 'Найти мастера'}</span>
          </button>
          <button
            type="button"
            class={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              homeMode() === 'order'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-white/90'
            }`}
            onClick={() => { setHomeMode('order'); setHomeExpandedDept(null); }}
          >
            {currentLang() === 'en' ? '🛠 I Work' : '🛠 Я мастер'}
          </button>
        </div>

        {/* Ad / Promo Banner */}
        {(() => {
          const [adIdx, setAdIdx] = createSignal(0);
          const ads = [
            { id: 1, text: currentLang() === 'en' ? 'Need a pro fast? Try Urgent Order!' : 'Нужен мастер срочно? Попробуй Срочный заказ!', color: '#6366f1', icon: '⚡', action: 'urgent' },
            { id: 2, text: currentLang() === 'en' ? 'Earn more — add your skills to My Board' : 'Зарабатывай больше — добавь навыки в Моя панель', color: '#8b5cf6', icon: '📌', action: 'myboard' },
            { id: 3, text: currentLang() === 'en' ? 'Invite friends — get bonuses!' : 'Пригласи друзей — получи бонусы!', color: '#ec4899', icon: '🎁', action: 'referral' },
            { id: 4, text: currentLang() === 'en' ? 'Your security — our priority. Verify now' : 'Твоя безопасность — наш приоритет. Верифицируйся', color: '#22c55e', icon: '🛡️', action: 'verification' },
            { id: 5, text: currentLang() === 'en' ? 'Find the perfect pro — Search & Filter now!' : 'Найди идеального мастера — Поиск и фильтры!', color: '#3b82f6', icon: '🔍', action: 'discover' },
          ];
          const ad = () => ads[adIdx() % ads.length];
          // Auto-rotate every 5s
          let timer: any;
          onMount(() => { timer = setInterval(() => setAdIdx(i => i + 1), 5000); });
          onCleanup(() => clearInterval(timer));
          return (
            <div
              style={`display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; margin-bottom: 10px; cursor: pointer; background: ${ad().color}20; border: 1px solid ${ad().color}30; transition: all 0.4s;`}
              onClick={() => props.onNavigate(ad().action)}
            >
              <span style="font-size: 20px; flex-shrink: 0;">{ad().icon}</span>
              <p style="color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600; margin: 0; flex: 1; line-height: 1.4;">{ad().text}</p>
              <span style={`font-size: 9px; color: ${ad().color}; background: ${ad().color}15; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; font-weight: 600;`}>AD</span>
            </div>
          );
        })()}

        {/* Info line */}
        <p class="text-white/90 text-[10px] mb-3 px-1">
          {homeMode() === 'search'
            ? (currentLang() === 'en' ? 'Tap a department → pick ONE service you need' : 'Нажми отдел → выбери ОДНУ услугу')
            : (currentLang() === 'en' ? 'Tap a department → select all skills you offer' : 'Нажми отдел → выбери все навыки')
          }
        </p>

        {/* Department Grid + Overlay detail panel */}
        <div class="relative">
          {/* Grid — always rendered for stable height */}
          <div class={`grid grid-cols-3 gap-2.5 transition-opacity ${homeExpandedDept() ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <For each={departments}>
              {(dept, i) => {
                const isClient = () => homeMode() === 'search';
                const workerCount = () => dept.skills.filter(s => workerSkills().includes(s.id)).length;
                const clientSel = () => clientNeeds().filter(id => dept.skills.some(s => s.id === id));
                const count = () => isClient() ? clientSel().length : workerCount();
                const hasSelection = () => count() > 0;
                return (
                  <button
                    class="relative rounded-2xl p-2.5 touch-scale animate-slide-up flex flex-col items-center text-center transition-all"
                    style={`animation-delay: ${0.1 + i() * 0.03}s; background: rgba(255,255,255,0.06); border: 2px solid ${hasSelection() ? dept.colorFrom + '40' : 'transparent'}`}
                    onClick={() => { setHomeExpandedSkill(null); setHomeExpandedGroup(null); setHomeExpandedDept(dept.id); }}
                  >
                    {/* Icon with fill-up effect */}
                    <div class="dept-icon w-14 h-14 flex items-center justify-center mb-2 shadow-lg"
                      style="background: rgba(255,255,255,0.08)"
                    >
                      {/* Color fill layer — rises from bottom when active */}
                      <div
                        class={`dept-icon-fill ${hasSelection() ? 'active' : ''}`}
                        style={`background: linear-gradient(to top, ${dept.colorFrom}, ${dept.colorTo})`}
                      />
                      {/* Icon always on top */}
                      <div class="relative z-10">
                        <SkillIcon icon={dept.icon} class={hasSelection() ? 'text-white' : 'text-white/60'} size="lg" />
                      </div>
                    </div>
                    <p class={`font-semibold text-xs leading-tight transition-colors ${hasSelection() ? 'text-white' : 'text-white/60'}`}>{deptName(dept)}</p>
                    <Show when={hasSelection()}>
                      <span
                        class="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow"
                        style={`background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo})`}
                      >{count()}</span>
                    </Show>
                    <LikeBadge likeKey={`dept:${dept.id}`} />
                  </button>
                );
              }}
            </For>
          </div>

          {/* ═══ Overlay detail panel — 3-level: dept → groups → skills ═══ */}
          <Show when={homeExpandedDept()}>
            {(() => {
              const dept = () => getDepartment(homeExpandedDept()!);
              const allSkills = () => dept()?.skills || [];
              const groups = () => getSkillGroups(homeExpandedDept()!);
              const activeGroup = () => homeExpandedGroup() ? groups().find(g => g.key === homeExpandedGroup()) : null;
              const isClient = () => homeMode() === 'search';
              const workerCount = () => allSkills().filter(s => workerSkills().includes(s.id)).length;
              const clientCount = () => clientNeeds().filter(id => allSkills().some(s => s.id === id)).length;
              const count = () => isClient() ? clientCount() : workerCount();

              const goBackToGroups = () => { setHomeExpandedSkill(null); setHomeExpandedGroup(null); };
              const goBackToSkills = () => setHomeExpandedSkill(null);
              const closeDept = () => { setHomeExpandedSkill(null); setHomeExpandedGroup(null); setHomeExpandedDept(null); };
              const activeSkillWithVariants = () => homeExpandedSkill() ? allSkills().find(s => s.id === homeExpandedSkill() && s.variants?.length) : null;

              return (
                <div class="absolute inset-0 rounded-2xl overflow-hidden animate-fade-in" style={{
                  background: `linear-gradient(145deg, ${dept()?.colorFrom}18, rgba(0,0,0,0.6))`,
                  'backdrop-filter': 'blur(8px)',
                  '-webkit-backdrop-filter': 'blur(8px)',
                }}>
                  <div class="h-full flex flex-col p-3">
                    {/* Header — adapts to current depth */}
                    <div class="flex items-center gap-3 mb-3 shrink-0">
                      {/* Back button: shows when at level 3 or 4 */}
                      <Show when={activeGroup() || activeSkillWithVariants()} fallback={
                        <div class={`w-10 h-10 rounded-xl bg-gradient-to-br ${dept()?.color || 'from-indigo-500 to-purple-600'} flex items-center justify-center shadow-lg shrink-0`}>
                          <SkillIcon icon={dept()?.icon || ''} class="text-white" size="sm" />
                        </div>
                      }>
                        <button
                          type="button"
                          class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center touch-scale shrink-0"
                          onClick={activeSkillWithVariants() ? goBackToSkills : goBackToGroups}
                        >
                          <Icon name="chevronLeft" class="text-white/90" size="xs" />
                        </button>
                      </Show>
                      <div class="flex-1 min-w-0">
                        <p class="font-bold text-white text-sm truncate">
                          {activeSkillWithVariants()
                            ? (currentLang() === 'en' ? activeSkillWithVariants()!.nameEn : activeSkillWithVariants()!.name)
                            : activeGroup()
                              ? (currentLang() === 'en' ? activeGroup()!.nameEn : activeGroup()!.name)
                              : (currentLang() === 'en' ? dept()?.nameEn : dept()?.name)
                          }
                        </p>
                        <p class="text-white/90 text-[10px]">
                          {activeSkillWithVariants()
                            ? `${activeSkillWithVariants()!.variants!.length} ${currentLang() === 'en' ? 'options' : 'вариантов'}`
                            : activeGroup()
                              ? `${activeGroup()!.skillCount} ${currentLang() === 'en' ? 'services' : 'услуг'}`
                              : `${count()}/${allSkills().length} ${currentLang() === 'en' ? 'selected' : 'выбрано'}`
                          }
                        </p>
                      </div>
                      {/* Breadcrumb trail */}
                      <Show when={activeSkillWithVariants()}>
                        <div class="text-[8px] text-white/85 flex items-center gap-0.5 shrink-0">
                          <SkillIcon icon={dept()?.icon || ''} class="text-white/85" size="xs" />
                          <span>›</span>
                          <SkillIcon icon={activeGroup()?.icon || ''} class="text-white/85" size="xs" />
                          <span>›</span>
                          <SkillIcon icon={activeSkillWithVariants()!.icon} class="text-white/85" size="xs" />
                        </div>
                      </Show>
                      <button
                        type="button"
                        class="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center touch-scale shrink-0"
                        onClick={closeDept}
                      >
                        <Icon name="x" class="text-white/90" size="xs" />
                      </button>
                    </div>

                    {/* ─── Level 2: Groups list (swipe right → close dept) ─── */}
                    <Show when={!activeGroup()}>
                      <SwipeLayer onBack={closeDept}>
                        <div class="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1" style={{ '-webkit-overflow-scrolling': 'touch' }}>
                          <For each={groups()}>
                            {(grp) => {
                              const grpSelected = () => {
                                if (isClient()) {
                                  return grp.skills.filter(s => clientNeeds().includes(s.id)).length;
                                }
                                return grp.skills.filter(s => workerSkills().includes(s.id)).length;
                              };

                              return (
                                <button
                                  type="button"
                                  class="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left touch-scale"
                                  style={grpSelected() > 0
                                    ? `background: linear-gradient(135deg, ${dept()?.colorFrom}25, ${dept()?.colorTo}15); border: 1.5px solid ${dept()?.colorFrom}40`
                                    : 'background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.05)'
                                  }
                                  onClick={() => setHomeExpandedGroup(grp.key)}
                                >
                                  <div class={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                                    grpSelected() > 0
                                      ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow-lg'
                                      : 'bg-white/10'
                                  }`}>
                                    <SkillIcon icon={grp.icon} class="text-white" size="lg" />
                                    <LikeBadge likeKey={`group:${homeExpandedDept()}:${grp.key}`} compact />
                                  </div>
                                  <div class="flex-1 min-w-0">
                                    <p class={`text-sm font-bold truncate ${grpSelected() > 0 ? 'text-white' : 'text-white/90'}`}>
                                      {currentLang() === 'en' ? grp.nameEn : grp.name}
                                    </p>
                                    <p class="text-white/90 text-[10px]">
                                      {grp.skillCount} {currentLang() === 'en' ? 'options' : 'вариантов'}
                                      {grpSelected() > 0 && <span class="text-green-400 ml-1">({grpSelected()} {currentLang() === 'en' ? 'sel.' : 'выбр.'})</span>}
                                    </p>
                                  </div>
                                  <div class="text-white/85 shrink-0">
                                    <Icon name="chevronLeft" class="rotate-180" size="xs" />
                                  </div>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </SwipeLayer>
                    </Show>

                    {/* ─── Level 3: Skills within a group (swipe right → back to groups) ─── */}
                    <Show when={activeGroup() && !activeSkillWithVariants()}>
                      <SwipeLayer onBack={goBackToGroups}>
                      <div class="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1 animate-fade-in" style={{ '-webkit-overflow-scrolling': 'touch' }}>
                        <For each={activeGroup()!.skills}>
                          {(skill) => {
                            const sel = () => isClient()
                              ? clientNeeds().includes(skill.id)
                              : workerSkills().includes(skill.id);

                            const hasVariants = () => !!(skill.variants && skill.variants.length > 0);

                            const onSkillClick = () => {
                              // If skill has 4th-level variants, drill into them
                              if (hasVariants()) {
                                setHomeExpandedSkill(skill.id);
                                haptic('light');
                                return;
                              }
                              if (isClient()) {
                                const cur = clientNeeds();
                                if (cur.includes(skill.id)) {
                                  setClientNeeds(cur.filter(s => s !== skill.id));
                                } else {
                                  setClientNeeds([skill.id]);
                                }
                              } else {
                                const cur = workerSkills();
                                if (cur.includes(skill.id)) {
                                  setWorkerSkills(cur.filter(s => s !== skill.id));
                                } else {
                                  setWorkerSkills([...cur, skill.id]);
                                }
                              }
                            };

                            return (
                              <button
                                type="button"
                                class="w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left touch-scale"
                                style={sel()
                                  ? `background: linear-gradient(135deg, ${dept()?.colorFrom}30, ${dept()?.colorTo}20); border: 1.5px solid ${dept()?.colorFrom}50`
                                  : 'background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.05)'
                                }
                                onClick={onSkillClick}
                              >
                                <div class={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                  sel()
                                    ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow'
                                    : 'bg-white/10'
                                }`}>
                                  <SkillIcon icon={skill.icon} class="text-white" size="sm" />
                                  <LikeBadge likeKey={`skill:${skill.id}`} compact />
                                </div>
                                <p class={`flex-1 text-[11px] font-semibold truncate ${sel() ? 'text-white' : 'text-white/90'}`}>
                                  {currentLang() === 'en' ? skill.nameEn : skill.name}
                                </p>
                                <Show when={skill.isExpert}>
                                  <span class="px-1 py-0.5 bg-yellow-400/20 text-yellow-300 text-[7px] font-bold rounded-full shrink-0">EXP</span>
                                </Show>
                                <Show when={hasVariants()}>
                                  <span class="text-white/85 text-[10px]">{skill.variants!.length}</span>
                                  <Icon name="chevronLeft" class="rotate-180 text-white/85" size="xs" />
                                </Show>
                                <Show when={!hasVariants()}>
                                  <div class={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${
                                    sel()
                                      ? (isClient() ? 'border-amber-400 bg-amber-500' : 'border-green-400 bg-green-500')
                                      : 'border-white/15'
                                  }`}>
                                    <Show when={sel()}>
                                      <Icon name="check" class="text-white w-2.5 h-2.5" />
                                    </Show>
                                  </div>
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                      </SwipeLayer>
                    </Show>

                    {/* ─── Level 4: Variants within a skill (swipe right → back to skills) ─── */}
                    <Show when={activeSkillWithVariants()}>
                      <SwipeLayer onBack={goBackToSkills}>
                      <div class="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1 animate-fade-in" style={{ '-webkit-overflow-scrolling': 'touch' }}>
                        {/* Parent skill header */}
                        <div class="flex items-center gap-2 px-1 pb-1 mb-1 border-b border-white/10">
                          <SkillIcon icon={activeSkillWithVariants()!.icon} class="text-white/90" size="sm" />
                          <p class="text-xs font-bold text-white/90">
                            {currentLang() === 'en' ? activeSkillWithVariants()!.nameEn : activeSkillWithVariants()!.name}
                          </p>
                        </div>
                        <For each={activeSkillWithVariants()!.variants!}>
                          {(variant) => {
                            const sel = () => isClient()
                              ? clientNeeds().includes(variant.id)
                              : workerSkills().includes(variant.id);

                            const onVariantClick = () => {
                              if (isClient()) {
                                const cur = clientNeeds();
                                if (cur.includes(variant.id)) {
                                  setClientNeeds(cur.filter(s => s !== variant.id));
                                } else {
                                  setClientNeeds([variant.id]);
                                }
                              } else {
                                const cur = workerSkills();
                                if (cur.includes(variant.id)) {
                                  setWorkerSkills(cur.filter(s => s !== variant.id));
                                } else {
                                  setWorkerSkills([...cur, variant.id]);
                                }
                              }
                            };

                            return (
                              <button
                                type="button"
                                class="w-full flex items-center gap-2.5 p-2 rounded-xl transition-all text-left touch-scale"
                                style={sel()
                                  ? `background: linear-gradient(135deg, ${dept()?.colorFrom}30, ${dept()?.colorTo}20); border: 1.5px solid ${dept()?.colorFrom}50`
                                  : 'background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.05)'
                                }
                                onClick={onVariantClick}
                              >
                                <div class={`relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  sel()
                                    ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow'
                                    : 'bg-white/10'
                                }`}>
                                  <SkillIcon icon={variant.icon} class="text-white" size="xs" />
                                  <LikeBadge likeKey={`skill:${variant.id}`} compact />
                                </div>
                                <p class={`flex-1 text-[11px] font-semibold truncate ${sel() ? 'text-white' : 'text-white/90'}`}>
                                  {currentLang() === 'en' ? variant.nameEn : variant.name}
                                </p>
                                <div class={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${
                                  sel()
                                    ? (isClient() ? 'border-amber-400 bg-amber-500' : 'border-green-400 bg-green-500')
                                    : 'border-white/15'
                                }`}>
                                  <Show when={sel()}>
                                    <Icon name="check" class="text-white w-2.5 h-2.5" />
                                  </Show>
                                </div>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                      </SwipeLayer>
                    </Show>
                  </div>
                </div>
              );
            })()}
          </Show>
        </div>
      </div>

      {/* Space reserved for future: active orders, promo banners, news */}
    </div>
  );
}

