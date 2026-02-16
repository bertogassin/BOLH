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

export default function MyBoardPage(props: { onNavigate: (page: string) => void }) {
  const [editing, setEditing] = createSignal(false);
  const [openDept, setOpenDept] = createSignal<string | null>(null);
  const [openGroup, setOpenGroup] = createSignal<string | null>(null);
  const isEn = () => currentLang() === 'en';
  const pinned = () => pinnedDepts().map(id => getDepartment(id)).filter(Boolean) as Department[];
  const isPinned = (id: string) => pinnedDepts().includes(id);

  // Onboarding hint — shown once
  const ONBOARD_KEY = 'bolh_myboard_onboarded';
  const alreadySeen = (() => { try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch { return false; } })();
  const [showOnboard, setShowOnboard] = createSignal(!alreadySeen);
  const [onboardStep, setOnboardStep] = createSignal(0);
  const dismissOnboard = () => { setShowOnboard(false); try { localStorage.setItem(ONBOARD_KEY, '1'); } catch {} };
  const onboardSteps = isEn()
    ? [
        { icon: '👋', title: 'Welcome to My Board!', text: 'This is your personal workspace. Add services you offer or need.' },
        { icon: '✏️', title: 'Tap "Edit"', text: 'Press the Edit button to see all available departments and add them here.' },
        { icon: '📌', title: 'Pin & Unpin', text: 'Tap any department to pin it. Tap again to remove. Your choices are saved.' },
        { icon: '📂', title: 'Dive Deeper', text: 'Tap a pinned department to see its skill groups and individual skills.' },
        { icon: '🟢', title: 'Your Status', text: 'Set yourself Online, Busy, or Offline right from here — clients will see your availability.' },
      ]
    : [
        { icon: '👋', title: 'Добро пожаловать!', text: 'Это твоё личное пространство. Добавляй услуги которые предлагаешь или ищешь.' },
        { icon: '✏️', title: 'Нажми "Изменить"', text: 'Кнопка Изменить покажет все доступные отделы — добавляй нужные.' },
        { icon: '📌', title: 'Закрепляй и убирай', text: 'Нажми на отдел чтобы закрепить. Нажми ещё раз чтобы убрать. Всё сохраняется.' },
        { icon: '📂', title: 'Заходи внутрь', text: 'Нажми на закреплённый отдел — увидишь группы навыков и отдельные услуги.' },
        { icon: '🟢', title: 'Твой статус', text: 'Устанавливай Онлайн, Занят или Офлайн прямо здесь — клиенты видят твою доступность.' },
      ];

  // Current open department data
  const currentDept = () => openDept() ? getDepartment(openDept()!) : null;
  const currentGroups = () => openDept() ? getSkillGroups(openDept()!) : [];
  const currentSkills = () => {
    if (!openDept()) return [];
    const skills = getDepartmentSkills(openDept()!);
    if (openGroup()) return skills.filter(s => s.group === openGroup());
    return skills;
  };

  // Screen level: 1=main, 2=dept groups, 3=skills
  const screen = () => openGroup() ? 3 : openDept() ? 2 : 1;

  const goBack = () => {
    if (openGroup()) setOpenGroup(null);
    else if (openDept()) setOpenDept(null);
  };

  // ─── Screen 3: Skills list ───
  const renderSkills = () => {
    const dept = currentDept();
    if (!dept) return null;
    const grp = openGroup();
    const skills = currentSkills();
    const groupObj = currentGroups().find(g => g.key === grp);
    return (
      <div style="padding: 16px; padding-top: 12px;">
        <button onClick={goBack} style="display: flex; align-items: center; gap: 8px; background: none; border: none; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; margin-bottom: 16px; padding: 0;">
          <span style="font-size: 18px;">←</span> {groupObj ? (isEn() ? groupObj.nameEn : groupObj.name) : (isEn() ? 'Back' : 'Назад')}
        </button>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <For each={skills}>
            {(skill) => (
              <button
                style={`display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); cursor: pointer; text-align: left; width: 100%; transition: all 0.2s;`}
                onClick={() => {
                  setActiveDepartment(dept.id);
                  props.onNavigate('skilldetail');
                }}
              >
                <div style={`width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, ${dept.colorFrom}30, ${dept.colorTo}20); display: flex; align-items: center; justify-content: center; flex-shrink: 0;`}>
                  <span style="font-size: 22px;">{skill.icon}</span>
                </div>
                <div style="flex: 1; min-width: 0;">
                  <p style="color: #fff; font-size: 14px; font-weight: 600; margin: 0 0 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{isEn() ? skill.nameEn : skill.name}</p>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <Show when={skill.requiresDiploma}>
                      <span style="font-size: 10px; color: #f59e0b; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 6px;">🎓 {isEn() ? 'Diploma' : 'Диплом'}</span>
                    </Show>
                    <Show when={skill.urgent}>
                      <span style="font-size: 10px; color: #ef4444; background: rgba(239,68,68,0.15); padding: 2px 6px; border-radius: 6px;">⚡ {isEn() ? 'Urgent' : 'Срочно'}</span>
                    </Show>
                    <Show when={skill.isExpert}>
                      <span style="font-size: 10px; color: #8b5cf6; background: rgba(139,92,246,0.15); padding: 2px 6px; border-radius: 6px;">⭐ {isEn() ? 'Expert' : 'Эксперт'}</span>
                    </Show>
                  </div>
                </div>
                <span style="color: rgba(255,255,255,0.3); font-size: 16px;">›</span>
              </button>
            )}
          </For>
        </div>
      </div>
    );
  };

  // ─── Screen 2: Department groups ───
  const renderDeptGroups = () => {
    const dept = currentDept();
    if (!dept) return null;
    const groups = currentGroups();
    const allSkills = getDepartmentSkills(dept.id);
    return (
      <div style="padding: 16px; padding-top: 12px;">
        <button onClick={goBack} style="display: flex; align-items: center; gap: 8px; background: none; border: none; color: rgba(255,255,255,0.6); font-size: 14px; cursor: pointer; margin-bottom: 16px; padding: 0;">
          <span style="font-size: 18px;">←</span> {isEn() ? 'My Board' : 'Моя панель'}
        </button>
        {/* Department header */}
        <div style={`display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 20px; margin-bottom: 20px; background: linear-gradient(135deg, ${dept.colorFrom}20, ${dept.colorTo}12); border: 1px solid ${dept.colorFrom}30;`}>
          <div style={`width: 56px; height: 56px; border-radius: 18px; background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo}); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px ${dept.colorFrom}40; flex-shrink: 0;`}>
            <span style="font-size: 28px;">{dept.icon}</span>
          </div>
          <div>
            <p style="color: #fff; font-size: 18px; font-weight: 700; margin: 0;">{isEn() ? dept.nameEn : dept.name}</p>
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 4px 0 0 0;">{allSkills.length} {isEn() ? 'skills' : 'навыков'}</p>
          </div>
        </div>
        {/* Groups grid */}
        <Show when={groups.length > 0} fallback={
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <For each={allSkills}>
              {(skill) => (
                <button
                  style={`display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); cursor: pointer; text-align: left; width: 100%;`}
                  onClick={() => { setActiveDepartment(dept.id); props.onNavigate('skilldetail'); }}
                >
                  <span style="font-size: 20px;">{skill.icon}</span>
                  <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0;">{isEn() ? skill.nameEn : skill.name}</p>
                </button>
              )}
            </For>
          </div>
        }>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <For each={groups}>
              {(group) => (
                <button
                  style={`border-radius: 18px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: all 0.2s; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);`}
                  onClick={() => setOpenGroup(group.key)}
                >
                  <span style="font-size: 28px; margin-bottom: 8px;">{group.icon}</span>
                  <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0 0 4px 0; line-height: 1.3;">{isEn() ? group.nameEn : group.name}</p>
                  <p style="color: rgba(255,255,255,0.35); font-size: 11px; margin: 0;">{group.skills.length} {isEn() ? 'skills' : 'навыков'}</p>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    );
  };

  // ─── Screen 1: Main board ───
  const renderMainBoard = () => (
    <div style="padding: 16px; padding-top: 20px; min-height: 80vh;">
      {/* Header */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 800; color: #fff; margin: 0;">{isEn() ? 'My Board' : 'Моя панель'}</h1>
          <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin: 4px 0 0 0;">{isEn() ? 'Your personalized workspace' : 'Твоё персональное пространство'}</p>
        </div>
        <button
          style={`padding: 8px 16px; border-radius: 14px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; ${
            editing()
              ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; box-shadow: 0 4px 15px rgba(99,102,241,0.4);'
              : 'background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);'
          }`}
          onClick={() => setEditing(!editing())}
        >
          {editing() ? (isEn() ? 'Done' : 'Готово') : (isEn() ? 'Edit' : 'Изменить')}
        </button>
      </div>

      {/* Online/Offline status toggle */}
      <Show when={!editing()}>
        {(() => {
          const sColor = () => {
            const s = workerStatus();
            return s === 'online' ? '#22c55e' : s === 'busy' ? '#f59e0b' : '#6b7280';
          };
          const sColorBg = () => {
            const s = workerStatus();
            return s === 'online' ? 'rgba(34,197,94,0.15)' : s === 'busy' ? 'rgba(245,158,11,0.15)' : 'rgba(107,114,128,0.15)';
          };
          const sIcon = () => {
            const s = workerStatus();
            return s === 'online' ? '🟢' : s === 'busy' ? '🟡' : '⚫';
          };
          const sLabel = () => {
            const s = workerStatus();
            return s === 'online' ? (isEn() ? 'Online' : 'Онлайн') : s === 'busy' ? (isEn() ? 'Busy' : 'Занят') : (isEn() ? 'Offline' : 'Офлайн');
          };
          const sNextLabel = () => {
            const s = workerStatus();
            return s === 'online' ? (isEn() ? 'Go Busy' : 'Занят') : s === 'busy' ? (isEn() ? 'Go Offline' : 'Офлайн') : (isEn() ? 'Go Online' : 'Онлайн');
          };
          const toggle = () => {
            const s = workerStatus();
            if (s === 'online') { setWorkerStatus('busy'); notify.warning(isEn() ? 'Status: Busy' : 'Статус: Занят', isEn() ? 'You won\'t receive new orders' : 'Новые заказы не поступят'); }
            else if (s === 'busy') { setWorkerStatus('offline'); notify.info(isEn() ? 'Status: Offline' : 'Статус: Офлайн', isEn() ? 'You are hidden from clients' : 'Вы скрыты от клиентов'); }
            else { setWorkerStatus('online'); notify.success(isEn() ? 'You\'re Online!' : 'Вы Онлайн!', isEn() ? 'Ready to receive orders' : 'Готовы принимать заказы'); }
          };
          return (
            <div style={`display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 18px; margin-bottom: 16px; background: ${sColorBg()}; border: 1px solid ${sColor()}30; transition: all 0.3s;`}>
              <span style="font-size: 24px;">{sIcon()}</span>
              <div style="flex: 1;">
                <p style={`color: ${sColor()}; font-size: 15px; font-weight: 700; margin: 0;`}>{sLabel()}</p>
                <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 2px 0 0 0;">{isEn() ? 'Tap to change status' : 'Нажми чтобы сменить статус'}</p>
              </div>
              <button
                style={`padding: 8px 18px; border-radius: 12px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; color: #fff; background: ${sColor()}; box-shadow: 0 2px 8px ${sColor()}40;`}
                onClick={toggle}
              >
                {sNextLabel()}
              </button>
            </div>
          );
        })()}
      </Show>

      {/* Pinned departments */}
      <Show when={pinned().length > 0 && !editing()}>
        <p style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; padding-left: 4px;">
          {isEn() ? 'Pinned' : 'Закреплённые'}  ({pinned().length})
        </p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
          <For each={pinned()}>
            {(dept) => (
              <button
                style={`position: relative; border-radius: 18px; padding: 14px 8px; display: flex; flex-direction: column; align-items: center; text-align: center; border: 2px solid ${dept.colorFrom}40; background: linear-gradient(145deg, ${dept.colorFrom}18, ${dept.colorTo}10); cursor: pointer; transition: all 0.2s;`}
                onClick={() => setOpenDept(dept.id)}
              >
                <div style={`width: 52px; height: 52px; border-radius: 16px; background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo}); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: 0 4px 12px ${dept.colorFrom}40;`}>
                  <span style="font-size: 26px;">{dept.icon}</span>
                </div>
                <p style="font-weight: 600; color: #fff; font-size: 11px; line-height: 1.3; margin: 0;">{isEn() ? dept.nameEn : dept.name}</p>
                <p style="color: rgba(255,255,255,0.3); font-size: 9px; margin: 3px 0 0 0;">{dept.skills.length} {isEn() ? 'skills' : 'навыков'}</p>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={pinned().length === 0 && !editing()}>
        <div style="background: rgba(255,255,255,0.06); border-radius: 24px; padding: 32px 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="width: 64px; height: 64px; margin: 0 auto 16px; background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2)); border-radius: 20px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 32px;">📌</span>
          </div>
          <p style="color: rgba(255,255,255,0.6); font-size: 15px; font-weight: 600; margin: 0 0 6px 0;">{isEn() ? 'Your board is empty' : 'Твоя панель пуста'}</p>
          <p style="color: rgba(255,255,255,0.3); font-size: 13px; margin: 0 0 16px 0;">{isEn() ? 'Add services you use most' : 'Добавь услуги которые тебе нужны'}</p>
          <button
            style="padding: 10px 24px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-weight: 700; font-size: 13px; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(99,102,241,0.4);"
            onClick={() => setEditing(true)}
          >
            {isEn() ? '+ Add Services' : '+ Добавить услуги'}
          </button>
        </div>
      </Show>

      {/* Edit mode: all departments */}
      <Show when={editing()}>
        <p style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; padding-left: 4px;">
          {isEn() ? 'All services — tap to toggle' : 'Все услуги — нажми чтобы выбрать'}
        </p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <For each={departments}>
            {(dept) => {
              const pin = () => isPinned(dept.id);
              return (
                <button
                  style={`position: relative; border-radius: 16px; padding: 12px 6px; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: all 0.2s; ${
                    pin()
                      ? `background: linear-gradient(145deg, ${dept.colorFrom}20, ${dept.colorTo}12); border: 2px solid ${dept.colorFrom}50;`
                      : 'background: rgba(255,255,255,0.04); border: 2px dashed rgba(255,255,255,0.12);'
                  }`}
                  onClick={() => togglePin(dept.id)}
                >
                  <Show when={pin()}>
                    <div style="position: absolute; top: -4px; right: -4px; width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(34,197,94,0.4);">
                      <span style="color: #fff; font-size: 12px; font-weight: bold;">✓</span>
                    </div>
                  </Show>
                  <div style={`width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; ${
                    pin()
                      ? `background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo}); box-shadow: 0 3px 10px ${dept.colorFrom}30;`
                      : 'background: rgba(255,255,255,0.08);'
                  }`}>
                    <span style={`font-size: 22px; ${pin() ? '' : 'opacity: 0.4;'}`}>{dept.icon}</span>
                  </div>
                  <p style={`font-weight: 600; font-size: 10px; line-height: 1.3; margin: 0; ${pin() ? 'color: #fff;' : 'color: rgba(255,255,255,0.4);'}`}>
                    {isEn() ? dept.nameEn : dept.name}
                  </p>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Quick actions */}
      <Show when={!editing() && pinned().length > 0}>
        <div style="background: rgba(255,255,255,0.06); border-radius: 18px; padding: 16px; margin-top: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; gap: 10px;">
            <button
              style="flex: 1; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 13px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center; gap: 6px;"
              onClick={() => props.onNavigate('home')}
            >
              🔍 {isEn() ? 'Find Pro' : 'Найти мастера'}
            </button>
            <button
              style="flex: 1; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"
              onClick={() => props.onNavigate('map')}
            >
              📍 {isEn() ? 'Map' : 'Карта'}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );

  return (
    <div style="position: relative;">
      <Show when={screen() === 1}>{renderMainBoard()}</Show>
      <Show when={screen() === 2}>{renderDeptGroups()}</Show>
      <Show when={screen() === 3}>{renderSkills()}</Show>

      {/* Onboarding overlay */}
      <Show when={showOnboard()}>
        <div
          style="position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(0,0,0,0.85);"
          onClick={(e) => { if (e.target === e.currentTarget) dismissOnboard(); }}
        >
          <div style="max-width: 340px; width: 100%; border-radius: 28px; overflow: hidden; background: linear-gradient(145deg, #1e1b4b, #312e81); box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
            {/* Progress dots */}
            <div style="display: flex; justify-content: center; gap: 6px; padding: 16px 16px 0;">
              {onboardSteps.map((_, i) => (
                <div style={`width: ${onboardStep() === i ? '24px' : '8px'}; height: 8px; border-radius: 4px; transition: all 0.3s; ${
                  onboardStep() === i
                    ? 'background: linear-gradient(90deg, #818cf8, #a78bfa);'
                    : onboardStep() > i
                    ? 'background: rgba(129,140,248,0.5);'
                    : 'background: rgba(255,255,255,0.15);'
                }`} />
              ))}
            </div>
            {/* Content */}
            <div style="padding: 28px 24px; text-align: center;">
              <div style="width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 22px; background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3)); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.1);">
                <span style="font-size: 36px;">{onboardSteps[onboardStep()].icon}</span>
              </div>
              <h2 style="color: #fff; font-size: 20px; font-weight: 800; margin: 0 0 10px 0;">{onboardSteps[onboardStep()].title}</h2>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px; line-height: 1.5; margin: 0;">{onboardSteps[onboardStep()].text}</p>
            </div>
            {/* Buttons */}
            <div style="display: flex; gap: 10px; padding: 0 24px 24px;">
              <Show when={onboardStep() > 0}>
                <button
                  style="flex: 1; padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 600; border: none; cursor: pointer;"
                  onClick={() => setOnboardStep(s => s - 1)}
                >
                  ←
                </button>
              </Show>
              <button
                style={`flex: 3; padding: 12px; border-radius: 14px; font-size: 14px; font-weight: 700; border: none; cursor: pointer; color: #fff; ${
                  onboardStep() < onboardSteps.length - 1
                    ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 15px rgba(99,102,241,0.4);'
                    : 'background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 4px 15px rgba(34,197,94,0.4);'
                }`}
                onClick={() => {
                  if (onboardStep() < onboardSteps.length - 1) setOnboardStep(s => s + 1);
                  else dismissOnboard();
                }}
              >
                {onboardStep() < onboardSteps.length - 1
                  ? (isEn() ? 'Next' : 'Далее')
                  : (isEn() ? 'Get Started!' : 'Начать!')
                }
              </button>
            </div>
            {/* Skip */}
            <div style="text-align: center; padding: 0 0 16px;">
              <button
                style="background: none; border: none; color: rgba(255,255,255,0.3); font-size: 12px; cursor: pointer; padding: 4px 12px;"
                onClick={dismissOnboard}
              >
                {isEn() ? 'Skip tutorial' : 'Пропустить'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
