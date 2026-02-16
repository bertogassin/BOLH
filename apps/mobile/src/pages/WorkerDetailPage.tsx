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

export default function WorkerDetailPage(props: { onBack: () => void; onNavigate: (page: string) => void }) {
  const isEn = () => currentLang() === 'en';
  const [activeTab, setActiveTab] = createSignal<'about'|'reviews'|'portfolio'>('about');
  const w = {
    name:'Александр Иванов', nameEn:'Alexander Ivanov', rating:4.9, reviews:127, level:4, rate:8000,
    available:true, years:8, orders:245, completionRate:98, responseTime:'~5 мин',
    bio:'Профессиональный специалист с 8-летним опытом работы. Сертифицированный мастер с высшим разрядом. Работаю аккуратно, в срок, с гарантией качества.',
    bioEn:'Professional specialist with 8 years of experience. Certified master with highest qualification. Working accurately, on time, with quality guarantee.',
    specs:['Plumbing','Heating','Emergency Repair','Pipe Welding'],
    portfolio:[{title:'Ремонт ванной',titleEn:'Bathroom Repair',icon:'🚿'},{title:'Установка котла',titleEn:'Boiler Install',icon:'🔥'},{title:'Тёплый пол',titleEn:'Heated Floor',icon:'♨️'},{title:'Канализация',titleEn:'Sewer Work',icon:'🔧'}],
    rvs:[
      {author:'Марат К.',r:5,text:'Отличный профессионал! Всё сделал быстро и качественно.',textEn:'Great professional! Everything done fast and well.',date:'2026-02-01'},
      {author:'Айгерим Б.',r:5,text:'Пунктуальный и ответственный. Рекомендую!',textEn:'Punctual and responsible. Recommended!',date:'2026-01-28'},
      {author:'Дмитрий С.',r:4,text:'Хорошо справился с задачей.',textEn:'Did a good job.',date:'2026-01-20'},
      {author:'Елена М.',r:5,text:'Аккуратная работа, убрал за собой.',textEn:'Neat work, cleaned up after.',date:'2026-01-15'},
    ]
  };
  const lvlBadge = () => w.level>=4 ? {label:'Elite',color:'#f59e0b',bg:'#f59e0b20'} : w.level>=3 ? {label:'Premium',color:'#8b5cf6',bg:'#8b5cf620'} : {label:'Verified',color:'#22c55e',bg:'#22c55e20'};
  const tabs = [{key:'about' as const, label:isEn()?'About':'О мастере'},{key:'reviews' as const, label:isEn()?'Reviews':'Отзывы'},{key:'portfolio' as const, label:isEn()?'Portfolio':'Портфолио'}];

  return (
    <div style="min-height: 100vh; padding-bottom: 100px;">
      {/* Hero */}
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 16px 16px 60px; position: relative;">
        <button onClick={props.onBack} style="display: flex; align-items: center; gap: 8px; background: none; border: none; color: rgba(255,255,255,0.8); font-size: 14px; cursor: pointer; padding: 0; margin-bottom: 8px;">
          <span style="font-size: 18px;">←</span> {isEn() ? 'Back' : 'Назад'}
        </button>
      </div>
      {/* Profile card */}
      <div style="margin: -48px 16px 0; background: rgba(255,255,255,0.15); border-radius: 24px; padding: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; position: relative;">
        <div style="width: 76px; height: 76px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; margin: -56px auto 12px; border: 4px solid #1a1a2e; box-shadow: 0 4px 20px rgba(99,102,241,0.4);">
          <span style="font-size: 32px; color: #fff; font-weight: 700;">А</span>
        </div>
        <h2 style="color: #fff; font-size: 20px; font-weight: 700; margin: 0;">{isEn() ? w.nameEn : w.name}</h2>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;">
          <span style={`padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; color: ${lvlBadge().color}; background: ${lvlBadge().bg};`}>{lvlBadge().label}</span>
          <Show when={w.available}><span style="padding: 3px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #22c55e; background: #22c55e20;">{isEn()?'Online':'Онлайн'}</span></Show>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 8px;">
          <span style="color: #fbbf24;">★</span>
          <span style="color: #fff; font-weight: 600;">{w.rating}</span>
          <span style="color: rgba(255,255,255,0.4); font-size: 13px;">({w.reviews})</span>
        </div>
        {/* Stats row */}
        <div style="display: flex; margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
          <div style="flex: 1; text-align: center;"><p style="font-size: 18px; font-weight: 700; color: #fff; margin: 0;">{w.years}</p><p style="font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0;">{isEn()?'Years':'Лет'}</p></div>
          <div style="flex: 1; text-align: center; border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08);"><p style="font-size: 18px; font-weight: 700; color: #fff; margin: 0;">{w.orders}</p><p style="font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0;">{isEn()?'Orders':'Заказов'}</p></div>
          <div style="flex: 1; text-align: center;"><p style="font-size: 18px; font-weight: 700; color: #818cf8; margin: 0;">{w.rate.toLocaleString()} ₸</p><p style="font-size: 10px; color: rgba(255,255,255,0.4); margin: 2px 0 0 0;">{isEn()?'Per hour':'В час'}</p></div>
        </div>
      </div>
      {/* Tabs */}
      <div style="display: flex; gap: 4px; margin: 16px 16px 0; background: rgba(255,255,255,0.06); border-radius: 14px; padding: 4px;">
        <For each={tabs}>{(tab) => (
          <button
            style={`flex: 1; padding: 10px; border-radius: 12px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; ${
              activeTab() === tab.key ? 'background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;' : 'background: transparent; color: rgba(255,255,255,0.5);'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >{tab.label}</button>
        )}</For>
      </div>
      {/* Tab content */}
      <div style="padding: 16px;">
        <Show when={activeTab() === 'about'}>
          <div style="background: rgba(255,255,255,0.06); border-radius: 18px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">{isEn()?'About':'О мастере'}</p>
            <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.6; margin: 0;">{isEn() ? w.bioEn : w.bio}</p>
          </div>
          <div style="background: rgba(255,255,255,0.06); border-radius: 18px; padding: 16px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px;">
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">{isEn()?'Skills':'Навыки'}</p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <For each={w.specs}>{(s) => (<span style="padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; color: #818cf8; background: rgba(99,102,241,0.15);">{s}</span>)}</For>
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.06); border-radius: 18px; padding: 16px; border: 1px solid rgba(255,255,255,0.08);">
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0;">{isEn()?'Stats':'Статистика'}</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between;"><span style="color: rgba(255,255,255,0.5); font-size: 13px;">{isEn()?'Completion rate':'Завершение'}</span><span style="color: #22c55e; font-weight: 600; font-size: 13px;">{w.completionRate}%</span></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: rgba(255,255,255,0.5); font-size: 13px;">{isEn()?'Response time':'Время ответа'}</span><span style="color: #fff; font-weight: 600; font-size: 13px;">{w.responseTime}</span></div>
            </div>
          </div>
        </Show>
        <Show when={activeTab() === 'reviews'}>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <For each={w.rvs}>{(r) => (
              <div style="background: rgba(255,255,255,0.06); border-radius: 16px; padding: 14px; border: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="color: #fff; font-weight: 600; font-size: 14px;">{r.author}</span>
                  <div style="display: flex; align-items: center; gap: 4px;"><span style="color: #fbbf24;">★</span><span style="color: #fff; font-size: 13px; font-weight: 600;">{r.r}</span></div>
                </div>
                <p style="color: rgba(255,255,255,0.7); font-size: 13px; line-height: 1.5; margin: 0 0 6px 0;">{isEn() ? r.textEn : r.text}</p>
                <p style="color: rgba(255,255,255,0.3); font-size: 11px; margin: 0;">{r.date}</p>
              </div>
            )}</For>
          </div>
        </Show>
        <Show when={activeTab() === 'portfolio'}>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <For each={w.portfolio}>{(p) => (
              <div style="background: rgba(255,255,255,0.06); border-radius: 16px; padding: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
                <span style="font-size: 36px; display: block; margin-bottom: 10px;">{p.icon}</span>
                <p style="color: #fff; font-size: 13px; font-weight: 600; margin: 0;">{isEn() ? p.titleEn : p.title}</p>
              </div>
            )}</For>
          </div>
        </Show>
      </div>
      {/* Bottom actions */}
      <div style="position: fixed; bottom: 0; left: 0; right: 0; padding: 16px; background: rgba(10,10,20,0.95); z-index: 50; display: flex; gap: 12px;">
        <button style="flex: 1; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;" onClick={() => props.onNavigate('chat')}>💬 {isEn()?'Message':'Написать'}</button>
        <button style="flex: 1; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(99,102,241,0.4); display: flex; align-items: center; justify-content: center; gap: 6px;" onClick={() => props.onNavigate('createorder')}>⚡ {isEn()?'Book Now':'Заказать'}</button>
      </div>
    </div>
  );
}

