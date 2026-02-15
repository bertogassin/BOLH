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

export default function DiscoverPage() {
  const isEn = () => currentLang() === 'en';
  const [query, setQuery] = createSignal('');
  const [deptFilter, setDeptFilter] = createSignal<string | null>(activeDepartment());
  const [sortMode, setSortMode] = createSignal<'all' | 'online' | 'nearby' | 'top' | 'urgent' | 'expert'>('all');
  const [priceRange, setPriceRange] = createSignal<[number, number]>([0, 50000]);
  const [showFilters, setShowFilters] = createSignal(false);
  const [minRating, setMinRating] = createSignal(0);

  // Generate realistic mock workers from departments data
  const firstNames = ['Алексей', 'Дмитрий', 'Максим', 'Артём', 'Иван', 'Сергей', 'Николай', 'Андрей', 'Михаил', 'Олег', 'Виктор', 'Роман', 'Павел', 'Анна', 'Мария', 'Елена', 'Ольга', 'Наталья', 'Татьяна', 'Светлана'];
  const lastNames = ['Козлов', 'Сидоров', 'Иванов', 'Петров', 'Волков', 'Орлов', 'Фёдоров', 'Кузнецов', 'Морозов', 'Соколов', 'Лебедев', 'Новиков', 'Попов', 'Смирнов', 'Васильев', 'Зайцев', 'Павлов', 'Семёнов', 'Голубев', 'Виноградов'];

  const workers = departments.flatMap((dept, di) =>
    dept.skills.slice(0, 3).map((skill, si) => {
      const seed = di * 100 + si;
      return {
        id: `w_${dept.id}_${si}`,
        name: firstNames[seed % firstNames.length] + ' ' + lastNames[(seed + 7) % lastNames.length],
        nameEn: firstNames[seed % firstNames.length] + ' ' + lastNames[(seed + 7) % lastNames.length],
        rating: +(4.2 + (seed % 8) * 0.1).toFixed(1),
        reviews: 15 + (seed * 13) % 200,
        price: 2000 + (seed * 317) % 8000,
        distance: +(0.3 + (seed * 0.7) % 5).toFixed(1),
        online: seed % 3 !== 0,
        verified: seed % 4 !== 0,
        expert: skill.isExpert,
        urgent: skill.urgent,
        deptId: dept.id,
        deptName: dept.name,
        deptNameEn: dept.nameEn,
        deptIcon: dept.icon,
        deptColorFrom: dept.colorFrom,
        deptColorTo: dept.colorTo,
        skillName: skill.name,
        skillNameEn: skill.nameEn,
        skillIcon: skill.icon,
      };
    })
  );

  // Search + Filter logic
  const filtered = () => {
    let list = [...workers];
    // Text search
    const q = query().toLowerCase().trim();
    if (q) {
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.skillName.toLowerCase().includes(q) ||
        w.skillNameEn.toLowerCase().includes(q) ||
        w.deptName.toLowerCase().includes(q) ||
        w.deptNameEn.toLowerCase().includes(q)
      );
    }
    // Department filter
    const df = deptFilter();
    if (df) list = list.filter(w => w.deptId === df);
    // Rating filter
    if (minRating() > 0) list = list.filter(w => w.rating >= minRating());
    // Price filter
    list = list.filter(w => w.price >= priceRange()[0] && w.price <= priceRange()[1]);
    // Sort/filter modes
    if (sortMode() === 'online') list = list.filter(w => w.online);
    if (sortMode() === 'urgent') list = list.filter(w => w.urgent);
    if (sortMode() === 'expert') list = list.filter(w => w.expert);
    if (sortMode() === 'nearby') list = [...list].sort((a, b) => a.distance - b.distance);
    if (sortMode() === 'top') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  };

  const resultCount = () => filtered().length;

  return (
    <div style="padding: 16px; min-height: 100vh;">
      {/* Header */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <h1 style="color: #fff; font-size: 24px; font-weight: 800; margin: 0;">{isEn() ? 'Find a Pro' : 'Найти специалиста'}</h1>
        <button
          onClick={() => setShowFilters(!showFilters())}
          style={`padding: 8px 14px; border-radius: 12px; border: 1px solid ${showFilters() ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}; background: ${showFilters() ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)'}; color: ${showFilters() ? '#a78bfa' : 'rgba(255,255,255,0.6)'}; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;`}
        >
          ⚙️ {isEn() ? 'Filters' : 'Фильтры'}
        </button>
      </div>

      {/* Search bar */}
      <div style="display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 14px;">
        <span style="font-size: 18px; opacity: 0.5;">🔍</span>
        <input
          type="text"
          placeholder={isEn() ? 'Search services, skills, workers...' : 'Поиск услуг, навыков, работников...'}
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          style="flex: 1; background: none; border: none; outline: none; color: #fff; font-size: 15px; font-weight: 500;"
        />
        <Show when={query()}>
          <button onClick={() => setQuery('')} style="background: none; border: none; color: rgba(255,255,255,0.4); font-size: 16px; cursor: pointer; padding: 0 4px;">✕</button>
        </Show>
      </div>

      {/* Department chips - horizontal scroll */}
      <div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 4px; -webkit-overflow-scrolling: touch;">
        <button
          onClick={() => setDeptFilter(null)}
          style={`padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; border: 1px solid ${!deptFilter() ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}; background: ${!deptFilter() ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)'}; color: ${!deptFilter() ? '#a78bfa' : 'rgba(255,255,255,0.5)'}; cursor: pointer; flex-shrink: 0;`}
        >
          {isEn() ? 'All' : 'Все'}
        </button>
        <For each={departments}>
          {(dept) => (
            <button
              onClick={() => setDeptFilter(deptFilter() === dept.id ? null : dept.id)}
              style={`padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; display: flex; align-items: center; gap: 5px; border: 1px solid ${deptFilter() === dept.id ? dept.colorFrom + '60' : 'rgba(255,255,255,0.1)'}; background: ${deptFilter() === dept.id ? dept.colorFrom + '20' : 'rgba(255,255,255,0.04)'}; color: ${deptFilter() === dept.id ? dept.colorFrom : 'rgba(255,255,255,0.5)'}; cursor: pointer; flex-shrink: 0;`}
            >
              <span>{dept.icon}</span>
              <span>{isEn() ? dept.nameEn : dept.name}</span>
            </button>
          )}
        </For>
      </div>

      {/* Sort chips */}
      <div style="display: flex; gap: 6px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 4px; -webkit-overflow-scrolling: touch;">
        {([
          { id: 'all', label: isEn() ? 'All' : 'Все', icon: '📋' },
          { id: 'online', label: isEn() ? 'Online' : 'Онлайн', icon: '🟢' },
          { id: 'nearby', label: isEn() ? 'Nearby' : 'Рядом', icon: '📍' },
          { id: 'top', label: isEn() ? 'Top Rated' : 'Лучшие', icon: '⭐' },
          { id: 'urgent', label: isEn() ? 'Urgent' : 'Срочные', icon: '⚡' },
          { id: 'expert', label: isEn() ? 'Experts' : 'Эксперты', icon: '🏆' },
        ] as const).map(f => (
          <button
            onClick={() => setSortMode(f.id)}
            style={`padding: 7px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; display: flex; align-items: center; gap: 4px; border: none; cursor: pointer; transition: all 0.2s; flex-shrink: 0; ${sortMode() === f.id ? 'background: rgba(99,102,241,0.2); color: #a78bfa;' : 'background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);'}`}
          >
            <span>{f.icon}</span> {f.label}
          </button>
        ))}
      </div>

      {/* Extended filters panel */}
      <Show when={showFilters()}>
        <div style="padding: 16px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 14px;">
          {/* Price range */}
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">{isEn() ? 'Price Range' : 'Бюджет'}</span>
              <span style="color: #a78bfa; font-size: 13px; font-weight: 700;">{priceRange()[0].toLocaleString()} – {priceRange()[1].toLocaleString()} ₸</span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={priceRange()[1]}
              onInput={(e) => setPriceRange([priceRange()[0], +e.currentTarget.value])}
              style="width: 100%; accent-color: #6366f1;"
            />
          </div>
          {/* Min rating */}
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="color: rgba(255,255,255,0.5); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">{isEn() ? 'Min Rating' : 'Мин. рейтинг'}</span>
              <span style="color: #fbbf24; font-size: 13px; font-weight: 700;">{'⭐'.repeat(minRating() || 0)} {minRating() > 0 ? minRating() + '+' : isEn() ? 'Any' : 'Любой'}</span>
            </div>
            <div style="display: flex; gap: 8px;">
              {[0, 3, 4, 4.5, 4.8].map(r => (
                <button
                  onClick={() => setMinRating(r)}
                  style={`flex: 1; padding: 8px 4px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; ${minRating() === r ? 'background: rgba(251,191,36,0.2); color: #fbbf24;' : 'background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4);'}`}
                >
                  {r === 0 ? (isEn() ? 'All' : 'Все') : r + '+'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Show>

      {/* Results count */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 600; margin: 0;">
          {isEn() ? `${resultCount()} professionals found` : `${resultCount()} специалистов найдено`}
        </p>
      </div>

      {/* Results */}
      <Show when={resultCount() > 0} fallback={
        <div style="padding: 48px 20px; text-align: center;">
          <span style="font-size: 48px; display: block; margin-bottom: 16px;">🔍</span>
          <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0 0 6px 0;">{isEn() ? 'No results found' : 'Ничего не найдено'}</p>
          <p style="color: rgba(255,255,255,0.4); font-size: 13px; margin: 0;">{isEn() ? 'Try different search or filters' : 'Попробуйте другой поиск или фильтры'}</p>
        </div>
      }>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <For each={filtered().slice(0, 20)}>
            {(worker, i) => (
              <div
                style={`padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s;`}
                onClick={() => { setActiveDepartment(worker.deptId); }}
              >
                <div style="display: flex; gap: 12px;">
                  {/* Avatar */}
                  <div style="position: relative; flex-shrink: 0;">
                    <div style={`width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, ${worker.deptColorFrom}30, ${worker.deptColorTo}30); display: flex; align-items: center; justify-content: center; font-size: 24px;`}>
                      {worker.skillIcon}
                    </div>
                    <Show when={worker.online}>
                      <div style="position: absolute; bottom: -2px; right: -2px; width: 14px; height: 14px; background: #22c55e; border-radius: 50%; border: 2px solid #0a0618;" />
                    </Show>
                  </div>

                  {/* Info */}
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                      <span style="color: #fff; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{worker.name}</span>
                      <Show when={worker.verified}>
                        <span style="font-size: 12px;">✅</span>
                      </Show>
                      <Show when={worker.expert}>
                        <span style="padding: 1px 6px; border-radius: 6px; background: rgba(251,191,36,0.15); color: #fbbf24; font-size: 9px; font-weight: 700;">PRO</span>
                      </Show>
                    </div>

                    {/* Skill */}
                    <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 4px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {worker.deptIcon} {isEn() ? worker.skillNameEn : worker.skillName}
                    </p>

                    {/* Stats row */}
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="display: flex; align-items: center; gap: 3px; color: #fbbf24; font-size: 12px; font-weight: 600;">
                        ⭐ {worker.rating} <span style="color: rgba(255,255,255,0.3); font-weight: 400;">({worker.reviews})</span>
                      </span>
                      <span style="color: rgba(255,255,255,0.3); font-size: 11px; display: flex; align-items: center; gap: 3px;">
                        📍 {worker.distance} {isEn() ? 'km' : 'км'}
                      </span>
                      <Show when={worker.urgent}>
                        <span style="color: #f97316; font-size: 10px; font-weight: 600;">⚡ {isEn() ? 'urgent' : 'срочно'}</span>
                      </Show>
                    </div>
                  </div>

                  {/* Price */}
                  <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center;">
                    <span style={`color: ${worker.deptColorFrom}; font-size: 16px; font-weight: 800;`}>{worker.price.toLocaleString()}</span>
                    <span style="color: rgba(255,255,255,0.3); font-size: 10px;">₸/{isEn() ? 'hr' : 'час'}</span>
                  </div>
                </div>

                {/* Quick action buttons */}
                <div style="display: flex; gap: 8px; margin-top: 10px;">
                  <button style={`flex: 1; padding: 9px; border-radius: 12px; background: linear-gradient(135deg, ${worker.deptColorFrom}, ${worker.deptColorTo}); color: #fff; font-size: 12px; font-weight: 700; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;`}>
                    ⚡ {isEn() ? 'Book Now' : 'Заказать'}
                  </button>
                  <button style="padding: 9px 14px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    💬 {isEn() ? 'Chat' : 'Чат'}
                  </button>
                  <button style="padding: 9px 14px; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 12px; font-weight: 600; cursor: pointer;">
                    👤
                  </button>
                </div>
              </div>
            )}
          </For>

          {/* Load more hint */}
          <Show when={filtered().length > 20}>
            <div style="padding: 16px; text-align: center;">
              <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">{isEn() ? `Showing 20 of ${filtered().length} results` : `Показано 20 из ${filtered().length} результатов`}</p>
            </div>
          </Show>
        </div>
      </Show>

      {/* Quick skill search - suggested skills */}
      <Show when={!query() && !deptFilter()}>
        <div style="margin-top: 20px;">
          <p style="color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">{isEn() ? 'Popular Services' : 'Популярные услуги'}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            {departments.slice(0, 6).flatMap(d => d.skills.slice(0, 2)).map(skill => (
              <button
                onClick={() => setQuery(isEn() ? skill.nameEn : skill.name)}
                style="padding: 6px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap;"
              >
                <span>{skill.icon}</span> {isEn() ? skill.nameEn : skill.name}
              </button>
            ))}
          </div>
        </div>
      </Show>
    </div>
  );
}

