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

export default function SkillDetailPage(props: { onBack: () => void }) {
  const dept = () => activeDepartment() ? getDepartment(activeDepartment()!) : null;
  const dName = () => dept() ? (currentLang() === 'en' ? dept()!.nameEn : dept()!.name) : '';
  const isWorkerMode = () => profileMode() === 'worker';
  const activeSkills = () => isWorkerMode() ? workerSkills() : clientNeeds();
  const activeCount = () => dept()?.skills.filter(s => activeSkills().includes(s.id)).length || 0;
  const totalSkills = () => dept()?.skills.length || 0;

  const [localDiplomaPrompt, setLocalDiplomaPrompt] = createSignal<string | null>(null);

  const localToggleSkill = (skillId: string, requiresDiploma: boolean) => {
    if (isWorkerMode() && requiresDiploma && !verifiedDiplomas().includes(skillId)) {
      setLocalDiplomaPrompt(skillId);
      return;
    }
    if (isWorkerMode()) {
      const current = workerSkills();
      if (current.includes(skillId)) {
        setWorkerSkills(current.filter(s => s !== skillId));
      } else {
        setWorkerSkills([...current, skillId]);
      }
    } else {
      const current = clientNeeds();
      if (current.includes(skillId)) {
        setClientNeeds(current.filter(s => s !== skillId));
      } else {
        setClientNeeds([...current, skillId]);
      }
    }
  };

  const localConfirmDiploma = (skillId: string) => {
    setVerifiedDiplomas([...verifiedDiplomas(), skillId]);
    setLocalDiplomaPrompt(null);
    setWorkerSkills([...workerSkills(), skillId]);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Заголовок с градиентом */}
      <div class={`bg-gradient-to-br ${dept()?.color || 'from-indigo-500 to-purple-600'} px-4 pt-3 pb-5`} style="padding-top: max(env(safe-area-inset-top), 12px)">
        <div class="flex items-center gap-3 mb-4">
          <button type="button" class="w-10 h-10 rounded-2xl bg-white/30 flex items-center justify-center touch-press"
            onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <p class="text-white/90 text-xs font-medium">{isWorkerMode() ? t('profile.myProfessions') : (currentLang() === 'en' ? 'Services I Need' : 'Нужные услуги')}</p>
            <h1 class="text-white font-bold text-lg">{dName()}</h1>
          </div>
          <div class="w-14 h-14 rounded-2xl bg-white/30 flex items-center justify-center">
            <SkillIcon icon={dept()?.icon || ''} class="text-white" size="lg" />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
            <div class="h-full rounded-full bg-white/80 transition-all duration-500" style={`width: ${totalSkills() > 0 ? (activeCount() / totalSkills() * 100) : 0}%`} />
          </div>
          <span class="text-white font-bold text-sm">{activeCount()}/{totalSkills()}</span>
        </div>
      </div>

      {/* Навыки по группам */}
      <div class="px-4 pt-3 pb-28">
        <For each={dept() ? getSkillGroups(dept()!.id) : []}>
          {(group, gi) => {
            const grpActiveCount = () => group.skills.filter(s => activeSkills().includes(s.id)).length;
            return (
              <div class="mb-5 animate-slide-up" style={`animation-delay: ${gi() * 0.05}s`}>
                {/* Заголовок группы */}
                <div class="flex items-center gap-3 mb-3">
                  <div class={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dept()?.color || 'from-indigo-500 to-purple-600'} flex items-center justify-center shadow-lg`}>
                    <SkillIcon icon={group.icon} class="text-white" size="lg" />
                  </div>
                  <div class="flex-1">
                    <h3 class={`font-bold text-base ${isDark() ? 'text-white' : 'text-gray-800'}`}>{currentLang() === 'en' ? group.nameEn : group.name}</h3>
                    <p class="text-xs text-gray-500">{grpActiveCount()}/{group.skillCount} {currentLang() === 'en' ? 'selected' : 'выбрано'}</p>
                  </div>
                </div>

                {/* Сетка навыков в группе */}
                <div class="grid grid-cols-2 gap-2.5">
                  <For each={group.skills}>
                    {(skill) => {
                      const active = () => activeSkills().includes(skill.id);
                      const needsDiploma = isWorkerMode() && skill.requiresDiploma;
                      const hasDiploma = () => verifiedDiplomas().includes(skill.id);
                      const isLocked = needsDiploma && !hasDiploma();

                      return (
                        <button
                          type="button"
                          class="relative flex flex-col items-center p-3 rounded-2xl transition-all text-center touch-scale"
                          style={
                            active()
                              ? isDark()
                                ? `background: rgba(255,255,255,0.1); border: 1.5px solid ${dept()?.colorFrom}60`
                                : `background: white; border: 1.5px solid ${dept()?.colorFrom}40; box-shadow: 0 2px 8px ${dept()?.colorFrom}15`
                              : isDark()
                              ? 'background: rgba(255,255,255,0.04); border: 1.5px solid rgba(255,255,255,0.06)'
                              : 'background: #f9fafb; border: 1.5px solid #e5e7eb'
                          }
                          onClick={() => { playGlobalSound('toggle'); haptic('light'); localToggleSkill(skill.id, isWorkerMode() && skill.requiresDiploma); }}
                        >
                          <div class={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${
                            active()
                              ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow-lg'
                              : isLocked
                              ? (isDark() ? 'bg-neutral-900' : 'bg-gray-200')
                              : (isDark() ? 'bg-neutral-900' : 'bg-gray-100')
                          }`}>
                            <Show when={isLocked} fallback={<SkillIcon icon={skill.icon} class={active() ? 'text-white' : (isDark() ? 'text-white/90' : 'text-gray-600')} size="lg" />}>
                              <Icon name="lock" class="text-gray-400" size="lg" />
                            </Show>
                          </div>
                          <p class={`text-xs font-semibold leading-tight ${active() ? (isDark() ? 'text-white' : 'text-gray-800') : isLocked ? (isDark() ? 'text-gray-300' : 'text-gray-400') : (isDark() ? 'text-white/90' : 'text-gray-600')}`}>
                            {currentLang() === 'en' ? skill.nameEn : skill.name}
                          </p>
                          {/* Теги — эксперт, срочно, диплом (только для мастера) */}
                          <div class="flex items-center gap-1 mt-1.5 flex-wrap justify-center">
                            <Show when={isWorkerMode() && skill.isExpert}>
                              <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-bold rounded-full">{t('skills.expert')}</span>
                            </Show>
                            <Show when={isWorkerMode() && skill.urgent}>
                              <span class="px-1.5 py-0.5 bg-red-100 text-red-700 text-[8px] font-bold rounded-full flex items-center"><Icon name="zap" size="xs" class="text-red-600" /></span>
                            </Show>
                            <Show when={needsDiploma}>
                              <span class={`px-1.5 py-0.5 text-[8px] font-bold rounded-full flex items-center ${hasDiploma() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {hasDiploma() ? <Icon name="checkCircle" size="xs" class="text-emerald-600 dark:text-emerald-400" /> : <Icon name="graduationCap" size="xs" class="text-red-500 dark:text-red-400" />}
                              </span>
                            </Show>
                          </div>
                          {/* Чекбокс — аккуратный кружок */}
                          <div class={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                            active()
                              ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                              : (isDark() ? 'border-2 border-gray-800' : 'border-2 border-gray-300')
                          }`}>
                            <Show when={active()}>
                              <Icon name="check" class="text-white w-2.5 h-2.5" />
                            </Show>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Диплом модалка */}
      <Show when={localDiplomaPrompt()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-6" onClick={() => setLocalDiplomaPrompt(null)}>
          <div class={`glass rounded-3xl p-6 max-w-sm w-full animate-slide-up ${isDark() ? 'bg-black' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-5">
              <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-black/70 flex items-center justify-center mx-auto mb-3">
                <Icon name="graduationCap" size="xl" class="text-indigo-500" />
              </div>
              <h3 class={`text-lg font-bold ${isDark() ? 'text-white' : 'text-gray-800'}`}>{t('skills.diplomaRequired')}</h3>
              <p class={`text-sm mt-2 ${isDark() ? 'text-gray-200' : 'text-gray-500'}`}>{t('skills.diplomaUpload')}</p>
            </div>
            <button type="button" class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-semibold mb-3 touch-scale flex items-center justify-center gap-2"
              onClick={() => localDiplomaPrompt() && localConfirmDiploma(localDiplomaPrompt()!)}>
              <Icon name="uploadCloud" class="text-white" size="sm" />
              {t('skills.uploadDiploma')}
            </button>
            <button type="button" class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale" onClick={() => setLocalDiplomaPrompt(null)}>
              {t('skills.later')}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

