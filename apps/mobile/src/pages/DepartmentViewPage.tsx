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

export default function DepartmentViewPage(props: { onNavigate: (page: string) => void; onBack: () => void }) {
  const dept = () => getActiveDept();
  const deptName = () => dept() ? (currentLang() === 'en' ? dept()!.nameEn : dept()!.name) : '';
  const workerLabel = () => dept() ? (currentLang() === 'en' ? dept()!.workerTitleEn : dept()!.workerTitle) : '';

  // Mock workers for the department
  const workers = () => {
    const d = dept();
    if (!d) return [];
    const skills = d.skills.filter(s => !s.isExpert);
    const names = [
      { name: 'Алексей К.', rating: 4.9, reviews: 127, price: 5000, distance: 0.8, online: true, verified: true },
      { name: 'Дмитрий С.', rating: 4.8, reviews: 89, price: 4500, distance: 1.5, online: true, verified: true },
      { name: 'Максим И.', rating: 4.7, reviews: 64, price: 3800, distance: 2.3, online: true, verified: false },
      { name: 'Артём П.', rating: 4.9, reviews: 156, price: 5500, distance: 3.1, online: false, verified: true },
      { name: 'Иван В.', rating: 4.6, reviews: 42, price: 3500, distance: 1.2, online: true, verified: true },
    ];
    return names.map((w, i) => ({
      ...w,
      id: i + 1,
      skill: skills[i % skills.length]?.name || d.workerTitle,
      skillEn: skills[i % skills.length]?.nameEn || d.workerTitleEn,
    }));
  };

  const [filter, setFilter] = createSignal('all');
  const filteredWorkers = () => {
    const w = workers();
    if (filter() === 'online') return w.filter(x => x.online);
    if (filter() === 'nearby') return [...w].sort((a, b) => a.distance - b.distance);
    if (filter() === 'top') return [...w].sort((a, b) => b.rating - a.rating);
    return w;
  };

  return (
    <div class="animate-fade-in">
      {/* Department Header */}
      <div class={`bg-gradient-to-br ${dept()?.color || 'from-indigo-500 to-purple-600'} p-5 pb-6`}>
        <div class="flex items-center gap-3 mb-4">
          <button class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center touch-scale" onClick={props.onBack}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <h1 class="text-xl font-bold text-white">{deptName()}</h1>
            <p class="text-white/90 text-sm">{dept()?.skills.length || 0} {t('dept.skills')}</p>
          </div>
          <SkillIcon icon={dept()?.icon || ''} class="text-white" size="lg" />
        </div>

        {/* Skill pills */}
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <For each={dept()?.skills || []}>
            {(skill) => (
              <span class="px-3 py-1.5 bg-white/35 rounded-full text-white text-xs font-medium whitespace-nowrap flex items-center gap-1">
                <span>{skill.icon}</span>
                <span>{currentLang() === 'en' ? skill.nameEn : skill.name}</span>
                <Show when={skill.isExpert}>
                  <span class="ml-0.5 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded-full font-bold">EXP</span>
                </Show>
                <Show when={skill.requiresDiploma}>
                  <Icon name="graduationCap" size="xs" class="text-indigo-500 inline-block" />
                </Show>
              </span>
            )}
          </For>
        </div>
      </div>

      <div class="p-4">
        {/* Filters */}
        <div class="flex gap-2 mb-5 overflow-x-auto pb-1">
          {[
            { id: 'all', label: t('search.all') },
            { id: 'nearby', label: t('search.nearby') },
            { id: 'top', label: t('search.topRated') },
            { id: 'online', label: t('search.online') },
          ].map(f => (
            <button
              class={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                filter() === f.id
                  ? 'bg-white/90 shadow-sm ' + (dept()?.accentText || 'text-indigo-600')
                  : 'glass text-gray-600'
              }`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Worker List */}
        <div class="space-y-4">
          <For each={filteredWorkers()}>
            {(worker, i) => (
              <div 
                class="glass rounded-3xl p-4 touch-scale animate-slide-up"
                style={`animation-delay: ${0.05 + i() * 0.04}s`}
              >
                <div class="flex items-start gap-4">
                  <div class="relative">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-3xl">
                      👤
                    </div>
                    {worker.online && (
                      <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-gray-800 truncate">{worker.name}</h3>
                      {worker.verified && (
                        <div class="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon name="check" class="text-white w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <p class={`text-xs font-medium mt-0.5 ${dept()?.accentText || 'text-indigo-600'}`}>
                      {currentLang() === 'en' ? worker.skillEn : worker.skill}
                    </p>
                    
                    <div class="flex items-center gap-3 mt-1">
                      <div class="flex items-center gap-1">
                        <Icon name="star" class="text-amber-400 w-4 h-4" />
                        <span class="text-sm font-medium text-gray-700">{worker.rating}</span>
                        <span class="text-xs text-gray-400">({worker.reviews})</span>
                      </div>
                      <div class="flex items-center gap-1 text-gray-400">
                        <Icon name="location" size="sm" class="w-4 h-4" />
                        <span class="text-xs">{worker.distance} {t('search.km')}</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right flex-shrink-0">
                    <p class="text-lg font-bold" style={`color: ${dept()?.colorFrom || '#6366f1'}`}>{worker.price.toLocaleString()}</p>
                    <p class="text-xs text-gray-400">{t('search.perHour')}</p>
                  </div>
                </div>

                <button 
                  class={`w-full mt-4 py-3 bg-gradient-to-r ${dept()?.color || 'from-indigo-500 to-purple-600'} text-white rounded-2xl font-semibold shadow-lg touch-scale`}
                >
                  {t('search.order')}
                </button>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}

