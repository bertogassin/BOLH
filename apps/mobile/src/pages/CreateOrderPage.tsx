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

export default function CreateOrderPage(props: { onBack: () => void }) {
  const isEn = () => currentLang() === 'en';
  const [step, setStep] = createSignal(1); // 1=dept, 2=skill, 3=details, 4=confirm, 5=searching
  const [selDept, setSelDept] = createSignal<string | null>(null);
  const [selSkill, setSelSkill] = createSignal<string | null>(null);
  const [addr, setAddr] = createSignal('');
  const [date, setDate] = createSignal('');
  const [dur, setDur] = createSignal(1);
  const [budget, setBudget] = createSignal(5000);
  const [notes, setNotes] = createSignal('');

  const dept = () => selDept() ? getDepartment(selDept()!) : null;
  const skills = () => selDept() ? getDepartmentSkills(selDept()!) : [];
  const skill = () => selSkill() ? skills().find(s => s.id === selSkill()) : null;
  const stepLabels = isEn() ? ['Department','Service','Details','Confirm'] : ['Отдел','Услуга','Детали','Подтверждение'];

  const submit = () => {
    setStep(5);
    playGlobalSound('send'); haptic('medium');
    const sName = skill() ? (isEn() ? skill()!.nameEn : skill()!.name) : '';
    // Pay from balance → escrow
    const orderId = String(1200 + Math.floor(Math.random() * 100));
    payForOrder(budget(), orderId, sName, 'Алексей К.');
    notify.order(isEn() ? 'Order Sent!' : 'Заказ отправлен!', `${sName} — ${budget().toLocaleString()} ₸ ${isEn() ? 'held in escrow' : 'удержано в эскроу'}`, 'orders');
    setTimeout(() => {
      playGlobalSound('success'); haptic('heavy');
      notify.success(isEn() ? 'Worker Found!' : 'Мастер найден!', `${isEn() ? 'Aleksey K. accepted your order' : 'Алексей К. принял ваш заказ'}`, 'orders');
      props.onBack();
    }, 3000);
  };

  return (
    <div style="padding: 16px; padding-bottom: 100px; min-height: 100vh;">
      {/* Header */}
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <button style="width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px;" onClick={() => step() > 1 ? setStep(s => s - 1) : props.onBack()}>←</button>
        <div style="flex: 1;">
          <h2 style="font-size: 18px; font-weight: 700; color: #fff; margin: 0;">{isEn() ? 'New Order' : 'Новый заказ'}</h2>
          <p style="font-size: 11px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0;">{isEn() ? 'Step' : 'Шаг'} {Math.min(step(), 4)}/4</p>
        </div>
      </div>
      {/* Progress bar */}
      <div style="display: flex; gap: 4px; margin-bottom: 20px;">
        {stepLabels.map((_, i) => (
          <div style={`flex: 1; height: 4px; border-radius: 2px; transition: all 0.3s; ${step() > i + 1 ? 'background: #22c55e;' : step() === i + 1 ? 'background: linear-gradient(90deg, #6366f1, #8b5cf6);' : 'background: rgba(255,255,255,0.1);'}`} />
        ))}
      </div>

      {/* Step 1: Choose Department */}
      <Show when={step() === 1}>
        <p style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 14px;">{isEn() ? 'What do you need?' : 'Что тебе нужно?'}</p>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <For each={departments}>{(d) => (
            <button
              style={`border-radius: 16px; padding: 14px 6px; display: flex; flex-direction: column; align-items: center; text-align: center; cursor: pointer; transition: all 0.2s; border: none; ${
                selDept() === d.id ? `background: linear-gradient(145deg, ${d.colorFrom}25, ${d.colorTo}15); border: 2px solid ${d.colorFrom}60;` : 'background: rgba(255,255,255,0.05); border: 2px solid transparent;'
              }`}
              onClick={() => { setSelDept(d.id); setSelSkill(null); setTimeout(() => setStep(2), 300); haptic('light'); }}
            >
              <span style="font-size: 28px; margin-bottom: 6px;">{d.icon}</span>
              <p style={`font-size: 10px; font-weight: 600; margin: 0; line-height: 1.3; ${selDept() === d.id ? 'color: #fff;' : 'color: rgba(255,255,255,0.5);'}`}>{isEn() ? d.nameEn : d.name}</p>
            </button>
          )}</For>
        </div>
      </Show>

      {/* Step 2: Choose Skill */}
      <Show when={step() === 2}>
        <Show when={dept()}>
          <div style={`display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 14px; margin-bottom: 16px; background: ${dept()!.colorFrom}15; border: 1px solid ${dept()!.colorFrom}30;`}>
            <span style="font-size: 24px;">{dept()!.icon}</span>
            <p style="color: #fff; font-size: 14px; font-weight: 600; margin: 0;">{isEn() ? dept()!.nameEn : dept()!.name}</p>
          </div>
        </Show>
        <p style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 14px;">{isEn() ? 'Choose a service:' : 'Выбери услугу:'}</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <For each={skills()}>{(s) => (
            <button
              style={`display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; border: none; ${
                selSkill() === s.id ? 'background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.4);' : 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);'
              }`}
              onClick={() => { setSelSkill(s.id); setTimeout(() => setStep(3), 300); haptic('light'); }}
            >
              <span style="font-size: 22px;">{s.icon}</span>
              <div style="flex: 1;">
                <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0;">{isEn() ? s.nameEn : s.name}</p>
                <Show when={s.urgent}><span style="font-size: 10px; color: #f59e0b; margin-top: 2px; display: inline-block;">⚡ {isEn() ? 'Urgent available' : 'Есть срочный'}</span></Show>
              </div>
              <span style="color: rgba(255,255,255,0.3);">›</span>
            </button>
          )}</For>
        </div>
      </Show>

      {/* Step 3: Details */}
      <Show when={step() === 3}>
        <p style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 14px;">{isEn() ? 'Order details' : 'Детали заказа'}</p>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px;">{isEn() ? 'Address' : 'Адрес'}</label>
            <input type="text" value={addr()} onInput={(e:any) => setAddr(e.currentTarget.value)} placeholder={isEn() ? 'Enter address...' : 'Введи адрес...'} style="width: 100%; padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 14px; outline: none; box-sizing: border-box;" />
          </div>
          <div>
            <label style="font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px;">{isEn() ? 'Date & Time' : 'Дата и время'}</label>
            <input type="datetime-local" value={date()} onInput={(e:any) => setDate(e.currentTarget.value)} style="width: 100%; padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 14px; outline: none; box-sizing: border-box;" />
          </div>
          <div>
            <label style="font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px;">{isEn() ? 'Duration (hours)' : 'Длительность (часов)'}</label>
            <div style="display: flex; align-items: center; gap: 16px;">
              <button style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 20px; cursor: pointer;" onClick={() => setDur(Math.max(1, dur() - 1))}>−</button>
              <span style="font-size: 28px; font-weight: 700; color: #fff; width: 40px; text-align: center;">{dur()}</span>
              <button style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.1); border: none; color: #fff; font-size: 20px; cursor: pointer;" onClick={() => setDur(dur() + 1)}>+</button>
            </div>
          </div>
          <div>
            <label style="font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px;">{isEn() ? 'Budget' : 'Бюджет'}: <span style="color: #818cf8; font-weight: 700;">{budget().toLocaleString()} ₸</span></label>
            <input type="range" min="1000" max="100000" step="1000" value={budget()} onInput={(e:any) => setBudget(parseInt(e.currentTarget.value))} style="width: 100%; accent-color: #6366f1;" />
          </div>
          <div>
            <label style="font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 6px;">{isEn() ? 'Notes (optional)' : 'Заметки (необязательно)'}</label>
            <textarea value={notes()} onInput={(e:any) => setNotes(e.currentTarget.value)} rows={3} placeholder={isEn() ? 'Any special requirements...' : 'Особые пожелания...'} style="width: 100%; padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; font-size: 14px; outline: none; resize: none; box-sizing: border-box;" />
          </div>
        </div>
        <button
          style={`width: 100%; margin-top: 20px; padding: 14px; border-radius: 16px; font-size: 15px; font-weight: 700; border: none; cursor: pointer; color: #fff; ${addr() ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 15px rgba(99,102,241,0.4);' : 'background: rgba(255,255,255,0.1); opacity: 0.5;'}`}
          disabled={!addr()}
          onClick={() => setStep(4)}
        >{isEn() ? 'Continue' : 'Продолжить'}</button>
      </Show>

      {/* Step 4: Confirm */}
      <Show when={step() === 4}>
        <p style="font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); margin-bottom: 14px;">{isEn() ? 'Confirm your order' : 'Подтверди заказ'}</p>
        <div style="background: rgba(255,255,255,0.06); border-radius: 20px; padding: 20px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <span style="font-size: 32px;">{dept()?.icon || '📋'}</span>
            <div>
              <p style="color: #fff; font-size: 16px; font-weight: 700; margin: 0;">{skill() ? (isEn() ? skill()!.nameEn : skill()!.name) : '-'}</p>
              <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 2px 0 0 0;">{dept() ? (isEn() ? dept()!.nameEn : dept()!.name) : ''}</p>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between;"><span style="color: rgba(255,255,255,0.4); font-size: 13px;">📍 {isEn() ? 'Address' : 'Адрес'}</span><span style="color: #fff; font-size: 13px; font-weight: 600;">{addr() || '-'}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: rgba(255,255,255,0.4); font-size: 13px;">📅 {isEn() ? 'When' : 'Когда'}</span><span style="color: #fff; font-size: 13px; font-weight: 600;">{date() || (isEn() ? 'ASAP' : 'Как можно скорее')}</span></div>
            <div style="display: flex; justify-content: space-between;"><span style="color: rgba(255,255,255,0.4); font-size: 13px;">⏱ {isEn() ? 'Duration' : 'Длительность'}</span><span style="color: #fff; font-size: 13px; font-weight: 600;">{dur()} {isEn() ? 'hours' : 'ч.'}</span></div>
          </div>
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
            <span style="color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 600;">{isEn() ? 'Budget' : 'Бюджет'}</span>
            <span style="font-size: 22px; font-weight: 800; color: #818cf8;">{budget().toLocaleString()} ₸</span>
          </div>
        </div>
        <button
          style="width: 100%; margin-top: 20px; padding: 16px; border-radius: 16px; font-size: 16px; font-weight: 700; border: none; cursor: pointer; color: #fff; background: linear-gradient(135deg, #22c55e, #16a34a); box-shadow: 0 4px 15px rgba(34,197,94,0.4);"
          onClick={submit}
        >{isEn() ? 'Place Order' : 'Оформить заказ'}</button>
      </Show>

      {/* Step 5: Searching */}
      <Show when={step() === 5}>
        <div style="text-align: center; padding-top: 60px;">
          <div style="width: 80px; height: 80px; margin: 0 auto 24px; border-radius: 50%; background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2)); display: flex; align-items: center; justify-content: center; animation: breathe 2s ease-in-out infinite;">
            <span style="font-size: 40px;">🔍</span>
          </div>
          <h2 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">{isEn() ? 'Finding the best pro...' : 'Ищем лучшего мастера...'}</h2>
          <p style="color: rgba(255,255,255,0.4); font-size: 14px; margin: 0;">{isEn() ? 'This usually takes 10-30 seconds' : 'Обычно это занимает 10-30 секунд'}</p>
          <div style="margin-top: 32px; display: flex; justify-content: center; gap: 8px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #6366f1; animation: breathe 1.5s ease-in-out infinite;" />
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #8b5cf6; animation: breathe 1.5s ease-in-out 0.3s infinite;" />
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #a78bfa; animation: breathe 1.5s ease-in-out 0.6s infinite;" />
          </div>
        </div>
      </Show>
    </div>
  );
}

