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

export default function WorkerSkillsPage(props: { onBack: () => void }) {
  const [expandedDept, setExpandedDept] = createSignal<string | null>(null);
  const [expandedGroup, setExpandedGroup] = createSignal<string | null>(null);
  const [expandedSkill, setExpandedSkill] = createSignal<string | null>(null);
  const [skills, setSkills] = createSignal<string[]>(workerSkills());
  const [diplomas, setDiplomas] = createSignal<string[]>(verifiedDiplomas());
  const [showDiplomaPrompt, setShowDiplomaPrompt] = createSignal<string | null>(null);
  const [timerInput, setTimerInput] = createSignal('');

  const toggleSkill = (skillId: string, requiresDiploma: boolean) => {
    // Если нужен диплом и он не подтверждён - показываем промпт
    if (requiresDiploma && !diplomas().includes(skillId)) {
      setShowDiplomaPrompt(skillId);
      return;
    }
    setSkills(prev => {
      const next = prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId];
      setWorkerSkills(next);
      return next;
    });
  };

  const confirmDiploma = (skillId: string) => {
    setDiplomas(prev => {
      const next = [...prev, skillId];
      setVerifiedDiplomas(next);
      return next;
    });
    setShowDiplomaPrompt(null);
    // После подтверждения диплома сразу включаем навык
    setSkills(prev => {
      const next = [...prev, skillId];
      setWorkerSkills(next);
      return next;
    });
  };

  const skillCount = (deptId: string) => {
    const deptSkills = getDepartmentSkills(deptId);
    return deptSkills.filter(s => skills().includes(s.id)).length;
  };

  const hasDeptSkills = (deptId: string) => skillCount(deptId) > 0;

  const toggleStatus = () => {
    const s = workerStatus();
    if (s === 'online') setWorkerStatus('busy');
    else if (s === 'busy') setWorkerStatus('offline');
    else setWorkerStatus('online');
  };

  const setAutoOnline = () => {
    const val = timerInput();
    if (val) {
      setAutoOnlineTime(val);
      setBusyUntil(val);
      setWorkerStatus('busy');
    }
  };

  const goOnlineNow = () => {
    setWorkerStatus('online');
    setBusyUntil(null);
    setAutoOnlineTime('');
  };

  const statusColor = () => {
    const s = workerStatus();
    if (s === 'online') return 'from-green-400 to-emerald-500';
    if (s === 'busy') return 'from-amber-400 to-orange-500';
    return 'from-gray-400 to-gray-500';
  };

  const statusLabel = () => {
    const s = workerStatus();
    if (s === 'online') return t('status.online');
    if (s === 'busy') return busyUntil() ? t('status.busyUntil') + ' ' + busyUntil() : t('status.busy');
    return t('status.offline');
  };

  const statusIcon = () => {
    const s = workerStatus();
    if (s === 'online') return '🟢';
    if (s === 'busy') return '🟡';
    return '⚫';
  };

  return (
    <div class="animate-fade-in">
      {/* Header */}
      <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 pb-6">
        <div class="flex items-center gap-3 mb-4">
          <button class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center touch-scale" onClick={props.onBack}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <h1 class="text-xl font-bold text-white">{t('skills.title')}</h1>
            <p class="text-white/90 text-sm">{skills().length} {t('skills.selected')}</p>
          </div>
        </div>

        {/* Статус доступности */}
        <div class="glass rounded-2xl p-4" style="background: rgba(255,255,255,0.15)">
          <div class="flex items-center gap-3 mb-3">
            <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${statusColor()} flex items-center justify-center shadow-md`}>
              <span class="text-xl">{statusIcon()}</span>
            </div>
            <div class="flex-1">
              <p class="text-white font-semibold text-sm">{statusLabel()}</p>
              <p class="text-white/90 text-xs">{t('status.tapToChange')}</p>
            </div>
            <button
              class={`px-4 py-2 rounded-xl font-semibold text-xs touch-scale ${
                workerStatus() === 'online'
                  ? 'bg-green-500 text-white'
                  : workerStatus() === 'busy'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-500 text-white'
              }`}
              onClick={toggleStatus}
            >
              {workerStatus() === 'online' ? t('status.online') : workerStatus() === 'busy' ? t('status.busy') : t('status.offline')}
            </button>
          </div>

          {/* Таймер авто-онлайн */}
          <Show when={workerStatus() === 'busy'}>
            <div class="flex items-center gap-2 mt-2">
              <Icon name="clock" class="text-white/90" size="sm" />
              <input
                type="time"
                value={timerInput()}
                onInput={(e) => setTimerInput(e.currentTarget.value)}
                class="flex-1 bg-white/20 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder:text-white/90"
                placeholder="--:--"
              />
              <button
                class="px-3 py-2 bg-green-500 text-white rounded-lg text-xs font-bold touch-scale"
                onClick={setAutoOnline}
              >
                {t('status.setTimer')}
              </button>
            </div>
            <Show when={busyUntil()}>
              <div class="mt-2 flex items-center justify-between">
                <p class="text-white/90 text-xs">⏰ {t('status.autoOnline')}: {busyUntil()}</p>
                <button class="text-green-300 text-xs font-bold touch-scale" onClick={goOnlineNow}>
                  {t('status.goOnline')}
                </button>
              </div>
            </Show>
          </Show>

          <Show when={workerStatus() === 'offline'}>
            <button
              class="w-full mt-2 py-2 bg-green-500 text-white rounded-xl font-semibold text-sm touch-scale"
              onClick={goOnlineNow}
            >
              {t('status.goOnline')}
            </button>
          </Show>
        </div>
      </div>

      <div class="p-4">
        <p class="text-gray-500 text-sm mb-4">{t('skills.description')}</p>

        {/* Сетка отделов - красивые иконки 3x3 */}
        <div class="grid grid-cols-3 gap-3 mb-5">
          <For each={departments}>
            {(dept) => {
              const count = () => skillCount(dept.id);
              const active = () => hasDeptSkills(dept.id);
              const dName = () => currentLang() === 'en' ? dept.nameEn : dept.name;

              return (
                <button
                  class={`relative rounded-2xl p-3 touch-scale flex flex-col items-center text-center transition-all ${
                    active() ? 'glass shadow-md' : 'glass opacity-60'
                  }`}
                  style={active() ? `border: 2px solid ${dept.colorFrom}40` : 'border: 2px solid transparent'}
                  onClick={() => { setExpandedGroup(null); setExpandedDept(expandedDept() === dept.id ? null : dept.id); }}
                >
                  <div class={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dept.color} flex items-center justify-center mb-2 shadow-lg ${active() ? '' : 'grayscale opacity-50'}`}>
                    <SkillIcon icon={dept.icon} class="text-white" size="lg" />
                  </div>
                  <p class={`font-semibold text-xs leading-tight ${active() ? (isDark() ? 'text-white' : 'text-gray-800') : (isDark() ? 'text-gray-400' : 'text-gray-400')}`}>{dName()}</p>
                  <Show when={count() > 0}>
                    <span class={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${dept.color} shadow`}>
                      {count()}
                    </span>
                  </Show>
                  <LikeBadge likeKey={`dept:${dept.id}`} />
                  <Show when={!active()}>
                    <span class="text-gray-400 text-[9px] mt-0.5">{t('skills.hidden')}</span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>

        {/* Развёрнутый отдел — 3-level: groups → skills */}
        <Show when={expandedDept()}>
          {(() => {
            const dept = () => getDepartment(expandedDept()!);
            const dName = () => dept() ? (currentLang() === 'en' ? dept()!.nameEn : dept()!.name) : '';
            const groups = () => getSkillGroups(expandedDept()!);
            const activeGrp = () => expandedGroup() ? groups().find(g => g.key === expandedGroup()) : null;
            const activeVariantSkill = () => expandedSkill() ? (dept()?.skills || []).find(s => s.id === expandedSkill() && s.variants?.length) : null;
            const closeDeptProfile = () => { setExpandedSkill(null); setExpandedGroup(null); setExpandedDept(null); };
            const goBackProfileGroups = () => { setExpandedSkill(null); setExpandedGroup(null); };
            const goBackProfileSkills = () => setExpandedSkill(null);

            return (
              <div class="glass rounded-2xl overflow-hidden animate-slide-up mb-4">
                {/* Заголовок — adapts to depth level */}
                <div class={`bg-gradient-to-r ${dept()?.color || ''} p-4 flex items-center gap-3`}>
                  <Show when={activeGrp() || activeVariantSkill()} fallback={<SkillIcon icon={dept()?.icon || ''} class="text-white" size="lg" />}>
                    <button class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center touch-scale" onClick={activeVariantSkill() ? goBackProfileSkills : goBackProfileGroups}>
                      <Icon name="chevronLeft" class="text-white" size="sm" />
                    </button>
                  </Show>
                  <div class="flex-1">
                    <p class="text-white font-bold">
                      {activeVariantSkill()
                        ? (currentLang() === 'en' ? activeVariantSkill()!.nameEn : activeVariantSkill()!.name)
                        : activeGrp()
                          ? (currentLang() === 'en' ? activeGrp()!.nameEn : activeGrp()!.name)
                          : dName()
                      }
                    </p>
                    <p class="text-white/90 text-xs">
                      {activeVariantSkill()
                        ? `${activeVariantSkill()!.variants!.length} ${currentLang() === 'en' ? 'options' : 'вариантов'}`
                        : activeGrp()
                          ? `${activeGrp()!.skillCount} ${t('skills.available')}`
                          : `${dept()?.skills.length} ${t('skills.available')}`
                      }
                    </p>
                  </div>
                  <Show when={activeVariantSkill()}>
                    <div class="text-[9px] text-white/90 flex items-center gap-0.5 shrink-0">
                      <SkillIcon icon={dept()?.icon || ''} class="text-white/85" size="xs" /><span>›</span><SkillIcon icon={activeGrp()?.icon || ''} class="text-white/85" size="xs" /><span>›</span><SkillIcon icon={activeVariantSkill()!.icon} class="text-white/85" size="xs" />
                    </div>
                  </Show>
                  <button class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center" onClick={closeDeptProfile}>
                    <Icon name="x" class="text-white" size="sm" />
                  </button>
                </div>

                <div class="p-3">
                  {/* ─── Level 2: Group list (swipe right → close dept) ─── */}
                  <Show when={!activeGrp()}>
                    <SwipeLayer onBack={closeDeptProfile}>
                    <For each={groups()}>
                      {(grp) => {
                        const grpCount = () => grp.skills.filter(s => skills().includes(s.id)).length;
                        return (
                          <button
                            class="w-full flex items-center gap-3 p-3 rounded-xl my-1 transition-all touch-scale"
                            style={grpCount() > 0
                              ? `background: linear-gradient(135deg, ${dept()?.colorFrom}12, ${dept()?.colorTo}08)`
                              : ''
                            }
                            onClick={() => setExpandedGroup(grp.key)}
                          >
                            <div class={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${
                              grpCount() > 0
                                ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow-lg'
                                : isDark() ? 'bg-neutral-900' : 'bg-gray-100'
                            }`}>
                              <SkillIcon icon={grp.icon} class={grpCount() > 0 ? 'text-white' : isDark() ? 'text-gray-300' : 'text-gray-500'} size="lg" />
                              <LikeBadge likeKey={`group:${expandedDept()}:${grp.key}`} compact />
                            </div>
                            <div class="flex-1 text-left">
                              <p class={`text-sm font-semibold ${grpCount() > 0 ? (isDark() ? 'text-white' : 'text-gray-800') : (isDark() ? 'text-gray-400' : 'text-gray-500')}`}>
                                {currentLang() === 'en' ? grp.nameEn : grp.name}
                              </p>
                              <p class={`text-xs ${isDark() ? 'text-gray-400' : 'text-gray-400'}`}>
                                {grp.skillCount} {currentLang() === 'en' ? 'options' : 'вариантов'}
                                {grpCount() > 0 && <span class="text-green-600 ml-1">({grpCount()} {currentLang() === 'en' ? 'active' : 'акт.'})</span>}
                              </p>
                            </div>
                            <Icon name="chevronLeft" class="text-gray-400 rotate-180" size="xs" />
                          </button>
                        );
                      }}
                    </For>
                    </SwipeLayer>
                  </Show>

                  {/* ─── Level 3: Skills within group (swipe right → back to groups) ─── */}
                  <Show when={activeGrp() && !activeVariantSkill()}>
                    <SwipeLayer onBack={goBackProfileGroups}>
                    <div class="animate-fade-in">
                      <For each={activeGrp()!.skills}>
                        {(skill) => {
                          const active = () => skills().includes(skill.id);
                          const needsDiploma = skill.requiresDiploma;
                          const hasDiploma = () => diplomas().includes(skill.id);
                          const isLocked = needsDiploma && !hasDiploma();
                          const hasVariants = () => !!(skill.variants && skill.variants.length > 0);

                          const onSkillClick = () => {
                            if (hasVariants()) {
                              setExpandedSkill(skill.id);
                              haptic('light');
                              return;
                            }
                            toggleSkill(skill.id, skill.requiresDiploma);
                          };

                          return (
                            <button
                              class={`w-full flex items-center gap-3 p-3 rounded-xl my-1 transition-all ${
                                isLocked ? 'opacity-60' : ''
                              }`}
                              style={active() ? `background: linear-gradient(135deg, ${dept()?.colorFrom}15, ${dept()?.colorTo}10)` : ''}
                              onClick={onSkillClick}
                            >
                              <div class={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${
                                active()
                                  ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                                  : isLocked
                                  ? (isDark() ? 'bg-neutral-900' : 'bg-gray-200')
                                  : (isDark() ? 'bg-neutral-900' : 'bg-gray-100')
                              }`}>
                                <Show when={isLocked} fallback={<SkillIcon icon={skill.icon} class={active() ? 'text-white' : isDark() ? 'text-gray-300' : 'text-gray-500'} size="lg" />}>
                                  <Icon name="lock" size="sm" class="text-gray-400" />
                                </Show>
                                <Show when={!isLocked}>
                                  <LikeBadge likeKey={`skill:${skill.id}`} compact />
                                </Show>
                              </div>
                              <div class="flex-1 text-left">
                                <p class={`text-sm font-medium ${active() ? (isDark() ? 'text-white' : 'text-gray-800') : isLocked ? (isDark() ? 'text-gray-500' : 'text-gray-400') : (isDark() ? 'text-gray-200' : 'text-gray-600')}`}>
                                  {currentLang() === 'en' ? skill.nameEn : skill.name}
                                </p>
                                <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <Show when={skill.isExpert}>
                                    <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full">{t('skills.expert')}</span>
                                  </Show>
                                  <Show when={needsDiploma}>
                                    <span class={`px-1.5 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-0.5 ${hasDiploma() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {hasDiploma() ? <><Icon name="checkCircle" size="xs" class="text-emerald-600 dark:text-emerald-400" /> {t('skills.verified')}</> : <><Icon name="graduationCap" size="xs" class="text-red-500 dark:text-red-400" /> {t('skills.diplomaRequired')}</>}
                                    </span>
                                  </Show>
                                  <Show when={skill.urgent}>
                                    <span class="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full flex items-center gap-0.5"><Icon name="zap" size="xs" class="text-red-600" /> {t('skills.urgent')}</span>
                                  </Show>
                                  <Show when={hasVariants()}>
                                    <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-black/70 text-slate-600 dark:text-white/90 text-[9px] font-bold rounded-full">{skill.variants!.length} {currentLang() === 'en' ? 'types' : 'видов'}</span>
                                  </Show>
                                </div>
                              </div>
                              <Show when={hasVariants()} fallback={
                                <div class={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                  active()
                                    ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                                    : isLocked
                                    ? 'bg-gray-200'
                                    : 'border-2 border-gray-300'
                                }`}>
                                  <Show when={active()}>
                                    <Icon name="check" class="text-white w-4 h-4" />
                                  </Show>
                                  <Show when={isLocked && !active()}>
                                    <Icon name="lock" size="xs" class="text-gray-400" />
                                  </Show>
                                </div>
                              }>
                                <Icon name="chevronLeft" class="text-gray-400 rotate-180" size="xs" />
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                    </SwipeLayer>
                  </Show>

                  {/* ─── Level 4: Variants within skill (swipe right → back to skills) ─── */}
                  <Show when={activeVariantSkill()}>
                    <SwipeLayer onBack={goBackProfileSkills}>
                    <div class="animate-fade-in">
                      {/* Parent skill header */}
                      <div class={`flex items-center gap-2 px-1 pb-2 mb-2 border-b ${isDark() ? 'border-white/10' : 'border-gray-200'}`}>
                        <SkillIcon icon={activeVariantSkill()!.icon} class={isDark() ? 'text-gray-200' : 'text-gray-600'} size="sm" />
                        <p class={`text-sm font-bold ${isDark() ? 'text-gray-200' : 'text-gray-600'}`}>
                          {currentLang() === 'en' ? activeVariantSkill()!.nameEn : activeVariantSkill()!.name}
                        </p>
                      </div>
                      <For each={activeVariantSkill()!.variants!}>
                        {(variant) => {
                          const active = () => skills().includes(variant.id);
                          return (
                            <button
                              class="w-full flex items-center gap-3 p-3 rounded-xl my-1 transition-all"
                              style={active() ? `background: linear-gradient(135deg, ${dept()?.colorFrom}15, ${dept()?.colorTo}10)` : ''}
                              onClick={() => toggleSkill(variant.id, false)}
                            >
                              <div class={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${
                                active()
                                  ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                                  : (isDark() ? 'bg-neutral-900' : 'bg-gray-100')
                              }`}>
                                <SkillIcon icon={variant.icon} class={active() ? 'text-white' : isDark() ? 'text-gray-300' : 'text-gray-500'} size="lg" />
                                <LikeBadge likeKey={`skill:${variant.id}`} compact />
                              </div>
                              <div class="flex-1 text-left">
                                <p class={`text-sm font-medium ${active() ? (isDark() ? 'text-white' : 'text-gray-800') : (isDark() ? 'text-gray-200' : 'text-gray-600')}`}>
                                  {currentLang() === 'en' ? variant.nameEn : variant.name}
                                </p>
                              </div>
                              <div class={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                active()
                                  ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                                  : 'border-2 border-gray-300'
                              }`}>
                                <Show when={active()}>
                                  <Icon name="check" class="text-white w-4 h-4" />
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

      {/* Модальное окно подтверждения диплома */}
      <Show when={showDiplomaPrompt()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setShowDiplomaPrompt(null)}>
          <div class="glass rounded-3xl p-6 max-w-sm w-full animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-5">
              <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-black/70 flex items-center justify-center mx-auto mb-3">
                <Icon name="graduationCap" size="xl" class="text-indigo-500" />
              </div>
              <h3 class="text-lg font-bold text-gray-800">{t('skills.diplomaRequired')}</h3>
              <p class="text-gray-500 text-sm mt-2">{t('skills.diplomaUpload')}</p>
            </div>

            <button
              class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-semibold mb-3 touch-scale flex items-center justify-center gap-2"
              onClick={() => confirmDiploma(showDiplomaPrompt()!)}
            >
              <Icon name="uploadCloud" class="text-white" size="sm" />
              {t('skills.uploadDiploma')}
            </button>

            <button
              class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale"
              onClick={() => setShowDiplomaPrompt(null)}
            >
              {t('skills.later')}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
