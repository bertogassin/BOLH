import { createSignal, For, Show, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t, setLanguage, getLanguages, getCurrentLanguage, isRTL, currentLang } from './i18n';
import { theme, setTheme, isDark, activeTheme } from './theme';
import { departments, getDepartment, getDepartmentSkills, type Department } from './departments';
import { BlockchainScreen } from './components';

// Global department state
const [activeDepartment, setActiveDepartment] = createSignal<string | null>(null);
const [workerSkills, setWorkerSkills] = createSignal<string[]>([]);
const [verifiedDiplomas, setVerifiedDiplomas] = createSignal<string[]>([]); // skill IDs with verified diplomas
const [workerStatus, setWorkerStatus] = createSignal<'online' | 'busy' | 'offline'>('online');
const [busyUntil, setBusyUntil] = createSignal<string | null>(null); // ISO time when auto-online
const [autoOnlineTime, setAutoOnlineTime] = createSignal<string>(''); // HH:MM for auto-online

// Profile mode: 'worker' = I offer my skills, 'client' = I need services
const [profileMode, setProfileMode] = createSignal<'worker' | 'client'>('worker');
const [clientNeeds, setClientNeeds] = createSignal<string[]>([]);

// Home screen mode: 'search' = find a pro, 'order' = quick order
const [homeMode, setHomeMode] = createSignal<'search' | 'order'>('search');
const [homeExpandedDept, setHomeExpandedDept] = createSignal<string | null>(null);

const getActiveDept = () => activeDepartment() ? getDepartment(activeDepartment()!) : null;

// ============== SWIPE BACK WRAPPER ==============
function SwipeBack(props: { onBack: () => void; children: any }) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let swiping = false;
  let el: HTMLDivElement | undefined;

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    // только если палец начинает с левых 60px экрана
    if (touch.clientX > 60) return;
    startX = touch.clientX;
    startY = touch.clientY;
    currentX = 0;
    swiping = true;
    if (el) el.style.transition = 'none';
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!swiping) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    // если больше вертикально — отменяем
    if (Math.abs(dy) > Math.abs(dx) && currentX < 10) { swiping = false; return; }
    if (dx < 0) return;
    currentX = dx;
    if (el) {
      const pct = Math.min(dx / window.innerWidth, 1);
      el.style.transform = `translate3d(${dx}px, 0, 0)`;
      el.style.opacity = `${1 - pct * 0.3}`;
    }
  };

  const onTouchEnd = () => {
    if (!swiping) return;
    swiping = false;
    if (currentX > window.innerWidth * 0.3) {
      // свайп достаточный — уезжаем вправо
      if (el) {
        el.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
        el.style.transform = `translate3d(${window.innerWidth}px, 0, 0)`;
        el.style.opacity = '0';
      }
      haptic('light');
      playGlobalSound('swoosh');
      setTimeout(() => props.onBack(), 200);
    } else {
      // возвращаем обратно
      if (el) {
        el.style.transition = 'transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
        el.style.transform = 'translate3d(0,0,0)';
        el.style.opacity = '1';
      }
    }
  };

  return (
    <div
      ref={el}
      style="will-change: transform; min-height: 100vh;"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {props.children}
    </div>
  );
}

// ============== GLOBAL SOUND & HAPTIC SYSTEM ==============
const [globalSoundEnabled, setGlobalSoundEnabled] = createSignal(true);
const [globalHapticEnabled, setGlobalHapticEnabled] = createSignal(true);
const [globalNotifSound, setGlobalNotifSound] = createSignal(true);
const [globalVolume, setGlobalVolume] = createSignal(0.7); // 0-1

// Один AudioContext на всё приложение — не создаём новый каждый раз
let _audioCtx: AudioContext | null = null;
const getAudioCtx = (): AudioContext => {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new AudioContext();
  }
  // Возобновляем если заморожен (требование браузера после паузы)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
};

const playGlobalSound = (type: 'tap' | 'success' | 'error' | 'notify' | 'send' | 'receive' | 'toggle' | 'delete' | 'levelup' | 'swoosh') => {
  if (!globalSoundEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const vol = globalVolume() * 0.4;

    switch (type) {
      case 'tap':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        osc.start(); osc.stop(ctx.currentTime + 0.04);
        break;
      case 'success':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(); osc.stop(ctx.currentTime + 0.35);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        break;
      case 'notify': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(vol * 0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        break;
      }
      case 'send':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
        break;
      case 'receive':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(); osc.stop(ctx.currentTime + 0.2);
        break;
      case 'toggle':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        gain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
        osc.start(); osc.stop(ctx.currentTime + 0.06);
        break;
      case 'delete':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        break;
      case 'levelup': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.16);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start(); osc.stop(ctx.currentTime + 0.45);
        break;
      }
      case 'swoosh':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(vol * 0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(); osc.stop(ctx.currentTime + 0.12);
        break;
    }
    // Очищаем осциллятор после завершения звука
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  } catch (e) {}
};

const haptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  if (!globalHapticEnabled()) return;
  try {
    if ('vibrate' in navigator) {
      const ms = style === 'light' ? 10 : style === 'medium' ? 25 : 50;
      navigator.vibrate(ms);
    }
  } catch (e) {}
};

// ============== SVG Icons ==============
const Icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  location: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  message: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 3v5h5"/>
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  minus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  creditCard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  fileText: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  fingerprint: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 11c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z"/>
      <path d="M12 11v2c0 2.21 1.79 4 4 4s4-1.79 4-4v-2"/>
      <path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"/>
      <path d="M12 13c-2.21 0-4 1.79-4 4v3M16 17v-2c0-1.1.9-2 2-2"/>
      <path d="M8 21v-2c0-1.1-.9-2-2-2"/>
      <path d="M20 11v2c0 2.21-1.79 4-4 4"/>
    </svg>
  ),
  repeat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  dollarSign: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  ),
  alertCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  checkCircle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),
  userCheck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <polyline points="17 11 19 13 23 9"/>
    </svg>
  ),
  uploadCloud: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  // Game icons
  fire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  lifeBuoy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/>
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/>
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/>
      <line x1="14.83" y1="9.17" x2="18.36" y2="5.64"/>
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>
    </svg>
  ),
  droplet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
    </svg>
  ),
  thermometer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>
  ),
  alertTriangle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  ),
  volume2: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg>
  ),
  volumeX: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/>
      <line x1="17" y1="9" x2="23" y2="15"/>
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  checkDouble: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2h-5"/>
      <polyline points="16 5 9 12 2 7"/>
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  printer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    </svg>
  ),
};

// ============== Components ==============

function Icon(props: { name: keyof typeof Icons; class?: string; size?: string }) {
  const sizeClass = () => {
    switch (props.size) {
      case 'xs': return 'w-3 h-3';
      case 'sm': return 'w-5 h-5';
      case 'lg': return 'w-8 h-8';
      case 'xl': return 'w-12 h-12';
      default: return 'w-6 h-6';
    }
  };
  
  return (
    <div class={`${sizeClass()} ${props.class || ''}`}>
      {Icons[props.name]}
    </div>
  );
}

// ============== Elina v3 Component (Mobile) ==============
// Two twisted octagons = 16 points, looks like a circle but organic
// Real fire, gas ignition sound, deep pomegranate colors

const ELINA_COLORS: Record<string, { base: string; mid: string; light: string; deep: string; glow: string }> = {
  pomegranate: { base: '#6B1520', mid: '#9B1B30', light: '#D4374B', deep: '#3D0A12', glow: 'rgba(155,27,48,0.5)' },
  ocean:      { base: '#0C3547', mid: '#1A6B8A', light: '#2FA4D4', deep: '#061E2B', glow: 'rgba(26,107,138,0.5)' },
  forest:     { base: '#0B3D1F', mid: '#1B7A3E', light: '#2EC465', deep: '#062210', glow: 'rgba(27,122,62,0.5)' },
  sunset:     { base: '#7A3D08', mid: '#C4620D', light: '#F0A030', deep: '#4A2504', glow: 'rgba(196,98,13,0.5)' },
  midnight:   { base: '#2D1248', mid: '#5B2496', light: '#8B4CD0', deep: '#1A0A2B', glow: 'rgba(91,36,150,0.5)' },
};

// Clean graphic octagon — 8-sided, bold, vector-art look
const OCTAGON_SHAPE = 'polygon(29.3% 0%, 70.7% 0%, 100% 29.3%, 100% 70.7%, 70.7% 100%, 29.3% 100%, 0% 70.7%, 0% 29.3%)';

// WebAudio: gas hiss → ignition → fire roar
function elinaSound(type: 'tap' | 'secret' | 'drag' | 'return') {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    if (type === 'tap') {
      // Soft organic pop
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.06);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    }

    if (type === 'secret') {
      // Layer 1: Gas hiss (white noise)
      const bufLen = ctx.sampleRate * 0.4;
      const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 3000;
      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
      noiseGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.15);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      noiseSrc.start(ctx.currentTime);
      noiseSrc.stop(ctx.currentTime + 0.4);

      // Layer 2: Ignition thump (low)
      const thump = ctx.createOscillator();
      const tg = ctx.createGain();
      thump.connect(tg); tg.connect(ctx.destination);
      thump.type = 'sine';
      thump.frequency.setValueAtTime(80, ctx.currentTime + 0.15);
      thump.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
      tg.gain.setValueAtTime(0, ctx.currentTime);
      tg.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.18);
      tg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      thump.start(ctx.currentTime + 0.15);
      thump.stop(ctx.currentTime + 0.6);

      // Layer 3: Fire whoosh (rising filtered noise)
      const fireBuf = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
      const fData = fireBuf.getChannelData(0);
      for (let i = 0; i < fData.length; i++) fData[i] = (Math.random() * 2 - 1);
      const fireSrc = ctx.createBufferSource();
      fireSrc.buffer = fireBuf;
      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'bandpass';
      fireFilter.frequency.setValueAtTime(400, ctx.currentTime + 0.2);
      fireFilter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.5);
      fireFilter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.0);
      fireFilter.Q.value = 2;
      const fireGain = ctx.createGain();
      fireSrc.connect(fireFilter);
      fireFilter.connect(fireGain);
      fireGain.connect(ctx.destination);
      fireGain.gain.setValueAtTime(0, ctx.currentTime);
      fireGain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.25);
      fireGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.5);
      fireGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      fireSrc.start(ctx.currentTime + 0.2);
      fireSrc.stop(ctx.currentTime + 1.0);

      // Layer 4: Sparkle overtone
      const spark = ctx.createOscillator();
      const sg = ctx.createGain();
      spark.connect(sg); sg.connect(ctx.destination);
      spark.type = 'sine';
      spark.frequency.setValueAtTime(2200, ctx.currentTime + 0.2);
      spark.frequency.exponentialRampToValueAtTime(4400, ctx.currentTime + 0.6);
      sg.gain.setValueAtTime(0.04, ctx.currentTime + 0.2);
      sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      spark.start(ctx.currentTime + 0.2);
      spark.stop(ctx.currentTime + 0.7);
    }

    if (type === 'drag') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = 500;
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08);
    }

    if (type === 'return') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(1000, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.35);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.4);
    }
  } catch (_) { /* AudioContext not available */ }
}

function MobileElina(props: { size?: number }) {
  const sz = () => props.size || 48;
  const [eState, setEState] = createSignal<string>('idle');
  const [tapCnt, setTapCnt] = createSignal(0);
  const [lastTapMs, setLastTapMs] = createSignal(0);
  const [colorKey, setColorKey] = createSignal('pomegranate');
  const [showColors, setShowColors] = createSignal(false);
  const [particles, setParticles] = createSignal<{ id: number; x: number; y: number; size: number; color: string; type: string; delay: number }[]>([]);
  const [screenFlash, setScreenFlash] = createSignal(false);
  const [flames, setFlames] = createSignal(false);

  // Drag state
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragPos, setDragPos] = createSignal<{ x: number; y: number } | null>(null);
  const [isReturning, setIsReturning] = createSignal(false);
  let dragStartX = 0, dragStartY = 0, dragOffsetX = 0, dragOffsetY = 0;
  let returnTimer: any = null;
  let longPressTimer: any = null;
  let pid = 0;

  const c = () => ELINA_COLORS[colorKey()] || ELINA_COLORS.pomegranate;

  // Fire particles — realistic upward movement
  const spawnFire = (n: number) => {
    const fireColors = ['#FF0800', '#FF2400', '#FF4500', '#FF6600', '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#FFF8DC'];
    const np = Array.from({ length: n }, () => {
      const angle = (Math.random() - 0.5) * 1.2; // Mostly upward
      const dist = Math.random() * sz() * 1.5;
      const delay = Math.random() * 300;
      return {
        id: ++pid,
        x: Math.sin(angle) * dist * 0.6,
        y: -Math.abs(Math.cos(angle) * dist) - sz() * 0.3,
        size: 3 + Math.random() * 8,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        type: 'fire',
        delay,
      };
    });
    setParticles(p => [...p, ...np]);
    setTimeout(() => setParticles(p => p.filter(pp => !np.find(x => x.id === pp.id))), 1800);
  };

  const spawnSparks = (n: number) => {
    const np = Array.from({ length: n }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = (Math.random() * 0.5 + 0.5) * sz();
      return {
        id: ++pid,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 2 + Math.random() * 3,
        color: c().light,
        type: 'spark',
        delay: 0,
      };
    });
    setParticles(p => [...p, ...np]);
    setTimeout(() => setParticles(p => p.filter(pp => !np.find(x => x.id === pp.id))), 800);
  };

  const onTap = (e: MouseEvent | TouchEvent) => {
    if (isDragging()) return;
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    if (now - lastTapMs() <= 500) { setTapCnt(x => x + 1); } else { setTapCnt(1); }
    setLastTapMs(now);

    if (tapCnt() >= 15) {
      // === SECRET: GAS IGNITION ===
      setEState('secret');
      setTapCnt(0);
      elinaSound('secret');
      haptic('heavy');
      // Multiple fire waves
      setFlames(true);
      spawnFire(30);
      setTimeout(() => spawnFire(20), 150);
      setTimeout(() => spawnFire(15), 300);
      setTimeout(() => spawnFire(10), 500);
      // Screen flash
      setScreenFlash(true);
      setTimeout(() => setScreenFlash(false), 800);
      setTimeout(() => { setFlames(false); setEState('idle'); }, 4500);
      return;
    }

    // Normal tap
    setEState('happy');
    elinaSound('tap');
    spawnSparks(6);
    haptic('light');
    setTimeout(() => setEState('idle'), 1000);
  };

  // === DRAG & DROP ===
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    longPressTimer = setTimeout(() => {
      setIsDragging(true);
      elinaSound('drag');
      haptic('medium');
      dragOffsetX = 0; dragOffsetY = 0;
    }, 300);
  };

  const onTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX;
    const dy = touch.clientY - dragStartY;
    if (!isDragging() && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      if (longPressTimer) clearTimeout(longPressTimer);
    }
    if (isDragging()) {
      e.preventDefault();
      dragOffsetX = dx; dragOffsetY = dy;
      setDragPos({ x: dx, y: dy });
      if (returnTimer) { clearTimeout(returnTimer); returnTimer = null; }
    }
  };

  const onTouchEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    if (isDragging()) {
      setIsDragging(false);
      if (Math.abs(dragOffsetX) > 10 || Math.abs(dragOffsetY) > 10) {
        returnTimer = setTimeout(() => {
          setIsReturning(true);
          elinaSound('return');
          haptic('light');
          setTimeout(() => { setDragPos(null); setIsReturning(false); }, 50);
        }, 30000);
      } else { setDragPos(null); }
    }
  };

  const onShapeLongPress = () => { setShowColors(s => !s); haptic('light'); };

  const animCls = () => {
    if (isReturning()) return '';
    switch (eState()) {
      case 'happy': return 'el3-bounce';
      case 'secret': return 'el3-secret';
      default: return 'el3-breathe';
    }
  };

  const glowShadow = () => {
    const g = c().glow;
    if (eState() === 'secret') return `0 0 ${sz()}px ${g}, 0 0 ${sz() * 2}px rgba(255,69,0,0.4), 0 0 ${sz() * 3}px rgba(255,140,0,0.2)`;
    if (eState() === 'happy') return `0 0 ${sz() * 0.4}px ${g}`;
    if (isDragging()) return `0 0 ${sz() * 0.5}px ${g}, 0 4px 15px rgba(0,0,0,0.25)`;
    return `0 0 ${sz() * 0.15}px ${g}`;
  };

  const scaleVal = () => {
    if (isDragging()) return 1.2;
    if (eState() === 'secret') return 1.35;
    if (eState() === 'happy') return 1.12;
    return 1;
  };

  const posStyle = () => {
    const dp = dragPos();
    if (!dp) return {};
    return {
      transform: `translate(${dp.x}px, ${dp.y}px)`,
      transition: isReturning() ? 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
      'z-index': '999',
    };
  };

  onCleanup(() => {
    if (returnTimer) clearTimeout(returnTimer);
    if (longPressTimer) clearTimeout(longPressTimer);
  });

  return (
    <div
      class="relative inline-flex items-center justify-center"
      style={{ width: `${sz() * 1.2}px`, height: `${sz() * 1.2}px`, 'touch-action': 'none', ...posStyle() }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Screen flash — fire glow */}
      <Show when={screenFlash()}>
        <div class="fixed inset-0 pointer-events-none z-[9999] el3-flash" style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(255,100,0,0.5) 0%, rgba(255,50,0,0.2) 40%, transparent 70%)',
        }} />
      </Show>

      {/* CSS Flame effect on secret */}
      <Show when={flames()}>
        <div class="absolute pointer-events-none el3-flame-container" style={{
          width: `${sz() * 1.2}px`, height: `${sz() * 2}px`,
          bottom: `${sz() * 0.3}px`, left: '50%', transform: 'translateX(-50%)',
        }}>
          <div class="el3-flame el3-flame-1" style={{ background: 'linear-gradient(to top, #FF4500, #FF8C00, #FFD700, transparent)', width: `${sz() * 0.5}px`, height: `${sz() * 1.5}px` }} />
          <div class="el3-flame el3-flame-2" style={{ background: 'linear-gradient(to top, #FF0000, #FF4500, #FFA500, transparent)', width: `${sz() * 0.35}px`, height: `${sz() * 1.2}px` }} />
          <div class="el3-flame el3-flame-3" style={{ background: 'linear-gradient(to top, #FF6600, #FFD700, #FFFF00, transparent)', width: `${sz() * 0.25}px`, height: `${sz() * 1.0}px` }} />
        </div>
      </Show>

      {/* Particles */}
      {particles().map(p => (
        <div
          class={`absolute pointer-events-none ${p.type === 'fire' ? 'el3-fire-p' : 'el3-spark-p'}`}
          style={{
            width: `${p.size}px`, height: `${p.size}px`,
            background: p.color,
            left: `calc(50% + ${p.x}px)`, top: `calc(50% + ${p.y}px)`,
            'border-radius': p.type === 'fire' ? '50% 50% 50% 20%' : '50%',
            filter: p.type === 'fire' ? `blur(${p.size * 0.3}px)` : 'none',
            'animation-delay': `${p.delay}ms`,
          }}
        />
      ))}

      {/* === 2D ILLUSTRATED OCTAGON — cartoon/vector-art style === */}
      <div class={`cursor-pointer relative ${animCls()}`} style={{
        width: `${sz()}px`, height: `${sz()}px`,
        transform: `scale(${scaleVal()})`,
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        filter: `drop-shadow(${glowShadow()})`,
      }} onClick={onTap} onDblClick={onShapeLongPress}>

        {/* Thick cartoon outline */}
        <div class="absolute" style={{
          inset: `-${Math.max(sz() * 0.04, 2)}px`,
          'clip-path': OCTAGON_SHAPE,
          background: c().deep,
        }} />

        {/* Main body — flat 2D fill with subtle gradient */}
        <div class="absolute inset-0" style={{
          'clip-path': OCTAGON_SHAPE,
          background: `linear-gradient(160deg, ${c().light} 0%, ${c().mid} 45%, ${c().base} 100%)`,
        }}>
          {/* 2D cell-shading — hard light/shadow split */}
          <div class="absolute inset-0" style={{
            background: `linear-gradient(145deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.08) 40%, transparent 50%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.3) 100%)`,
            'clip-path': OCTAGON_SHAPE,
          }} />

          {/* Specular highlight — cartoon shine spot */}
          <div class="absolute" style={{
            top: `${sz() * 0.12}px`, left: `${sz() * 0.15}px`,
            width: `${sz() * 0.25}px`, height: `${sz() * 0.18}px`,
            background: 'rgba(255,255,255,0.45)',
            'border-radius': '50%',
            transform: 'rotate(-25deg)',
            filter: `blur(${sz() * 0.02}px)`,
          }} />

          {/* Small secondary shine */}
          <div class="absolute" style={{
            top: `${sz() * 0.22}px`, left: `${sz() * 0.55}px`,
            width: `${sz() * 0.08}px`, height: `${sz() * 0.06}px`,
            background: 'rgba(255,255,255,0.3)',
            'border-radius': '50%',
          }} />
        </div>

        {/* Face — 2D illustrated style */}
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ 'z-index': '5' }}>
          {eState() === 'secret'
            ? <span style={{ 'font-size': `${sz() * 0.4}px`, filter: 'drop-shadow(0 0 8px rgba(255,80,0,0.9)) drop-shadow(0 0 16px rgba(255,140,0,0.5))' }}>{'\u{1F525}'}</span>
            : <>
              {/* Eyes */}
              <div class="flex items-center" style={{ gap: `${sz() * 0.14}px`, 'margin-top': `-${sz() * 0.04}px` }}>
                {/* Left eye */}
                <div style={{
                  width: `${sz() * 0.15}px`,
                  height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.15}px`,
                  background: eState() === 'happy' ? 'transparent' : 'white',
                  'border-radius': eState() === 'happy' ? '0' : '50%',
                  'border-bottom': eState() === 'happy' ? `${Math.max(sz() * 0.03, 1.5)}px solid ${c().deep}` : 'none',
                  border: eState() === 'happy' ? 'none' : `${Math.max(sz() * 0.02, 1)}px solid ${c().deep}`,
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  <Show when={eState() !== 'happy'}>
                    {/* Pupil */}
                    <div style={{
                      width: `${sz() * 0.07}px`, height: `${sz() * 0.07}px`,
                      background: c().deep,
                      'border-radius': '50%',
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      {/* Pupil highlight */}
                      <div style={{
                        width: `${sz() * 0.025}px`, height: `${sz() * 0.025}px`,
                        background: 'white',
                        'border-radius': '50%',
                        position: 'absolute',
                        top: `${sz() * 0.01}px`, right: `${sz() * 0.01}px`,
                      }} />
                    </div>
                  </Show>
                </div>
                {/* Right eye */}
                <div style={{
                  width: `${sz() * 0.15}px`,
                  height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.15}px`,
                  background: eState() === 'happy' ? 'transparent' : 'white',
                  'border-radius': eState() === 'happy' ? '0' : '50%',
                  'border-bottom': eState() === 'happy' ? `${Math.max(sz() * 0.03, 1.5)}px solid ${c().deep}` : 'none',
                  border: eState() === 'happy' ? 'none' : `${Math.max(sz() * 0.02, 1)}px solid ${c().deep}`,
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}>
                  <Show when={eState() !== 'happy'}>
                    <div style={{
                      width: `${sz() * 0.07}px`, height: `${sz() * 0.07}px`,
                      background: c().deep,
                      'border-radius': '50%',
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}>
                      <div style={{
                        width: `${sz() * 0.025}px`, height: `${sz() * 0.025}px`,
                        background: 'white',
                        'border-radius': '50%',
                        position: 'absolute',
                        top: `${sz() * 0.01}px`, right: `${sz() * 0.01}px`,
                      }} />
                    </div>
                  </Show>
                </div>
              </div>

              {/* Blush spots */}
              <div class="absolute flex" style={{
                gap: `${sz() * 0.32}px`,
                top: `${sz() * 0.52}px`,
              }}>
                <div style={{
                  width: `${sz() * 0.09}px`, height: `${sz() * 0.05}px`,
                  background: `${c().light}55`,
                  'border-radius': '50%',
                }} />
                <div style={{
                  width: `${sz() * 0.09}px`, height: `${sz() * 0.05}px`,
                  background: `${c().light}55`,
                  'border-radius': '50%',
                }} />
              </div>

              {/* Mouth */}
              <div style={{
                'margin-top': `${sz() * 0.03}px`,
                width: eState() === 'happy' ? `${sz() * 0.12}px` : `${sz() * 0.06}px`,
                height: eState() === 'happy' ? `${sz() * 0.06}px` : `${sz() * 0.03}px`,
                background: 'transparent',
                'border-bottom': `${Math.max(sz() * 0.025, 1.5)}px solid ${c().deep}`,
                'border-radius': eState() === 'happy' ? '0 0 50% 50%' : '0 0 50% 50%',
                transition: 'all 0.2s ease',
              }} />
            </>
          }
        </div>
      </div>

      {/* Color picker */}
      <Show when={showColors()}>
        <div class="absolute flex gap-1.5 p-2 rounded-2xl bg-black/70 shadow-xl el3-fade z-50"
          style={{ bottom: `-${sz() * 0.55}px`, left: '50%', transform: 'translateX(-50%)' }}>
          {Object.entries(ELINA_COLORS).map(([key, val]) => (
            <button
              class={`rounded-full transition-all active:scale-90 ${colorKey() === key ? 'ring-2 ring-white scale-110' : ''}`}
              style={{
                width: `${Math.max(sz() * 0.38, 22)}px`, height: `${Math.max(sz() * 0.38, 22)}px`,
                background: `linear-gradient(135deg, ${val.base}, ${val.light})`,
              }}
              onClick={(e) => { e.stopPropagation(); setColorKey(key); haptic('light'); }}
            />
          ))}
        </div>
      </Show>

      <Show when={isDragging()}>
        <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-white/40 whitespace-nowrap">drag me</div>
      </Show>

      <style>{`
        @keyframes el3-breathe-kf { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes el3-bounce-kf { 0%{transform:scale(1)} 25%{transform:scale(1.18)} 50%{transform:scale(0.96)} 75%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes el3-secret-kf { 0%{transform:scale(1) rotate(0)} 15%{transform:scale(1.5) rotate(60deg)} 30%{transform:scale(1.1) rotate(120deg)} 45%{transform:scale(1.45) rotate(180deg)} 60%{transform:scale(1.05) rotate(240deg)} 75%{transform:scale(1.4) rotate(300deg)} 100%{transform:scale(1) rotate(360deg)} }
        @keyframes el3-fire-kf { 0%{opacity:1;transform:scale(1) translateY(0)} 40%{opacity:0.9} 100%{opacity:0;transform:scale(0.2) translateY(-40px)} }
        @keyframes el3-spark-kf { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0) translateY(-15px)} }
        @keyframes el3-flash-kf { 0%{opacity:0.7} 100%{opacity:0} }
        @keyframes el3-fade-kf { from{opacity:0;transform:translateX(-50%) scale(0.9)} to{opacity:1;transform:translateX(-50%) scale(1)} }
        @keyframes el3-flame-kf {
          0%{transform:translateX(-50%) scaleY(0.3) scaleX(1);opacity:0}
          15%{transform:translateX(-50%) scaleY(1.1) scaleX(0.9);opacity:1}
          30%{transform:translateX(-48%) scaleY(0.95) scaleX(1.1);opacity:0.9}
          50%{transform:translateX(-52%) scaleY(1.05) scaleX(0.85);opacity:0.85}
          70%{transform:translateX(-50%) scaleY(0.9) scaleX(1.05);opacity:0.7}
          100%{transform:translateX(-50%) scaleY(0.3) scaleX(0.5);opacity:0}
        }
        .el3-breathe{animation:el3-breathe-kf 3s ease-in-out infinite}
        .el3-bounce{animation:el3-bounce-kf 0.45s cubic-bezier(0.34,1.56,0.64,1)}
        .el3-secret{animation:el3-secret-kf 1s cubic-bezier(0.22,1,0.36,1)}
        .el3-fire-p{animation:el3-fire-kf 1.2s ease-out forwards}
        .el3-spark-p{animation:el3-spark-kf 0.6s ease-out forwards}
        .el3-flash{animation:el3-flash-kf 0.8s ease-out forwards}
        .el3-fade{animation:el3-fade-kf 0.2s ease-out}
        .el3-flame-container{position:relative;pointer-events:none}
        .el3-flame{position:absolute;bottom:0;left:50%;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;
          animation:el3-flame-kf 1.5s ease-in-out forwards;transform-origin:bottom center;filter:blur(2px)}
        .el3-flame-1{animation-delay:0.05s}
        .el3-flame-2{animation-delay:0.15s}
        .el3-flame-3{animation-delay:0.25s}
      `}</style>
    </div>
  );
}

// ============== Pages ==============

function HomePage(props: { onNavigate: (page: string) => void }) {
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('greeting.night');
    else if (hour < 12) return t('greeting.morning');
    else if (hour < 18) return t('greeting.afternoon');
    else return t('greeting.evening');
  };

  const deptName = (dept: Department) => currentLang() === 'en' ? dept.nameEn : dept.name;
  const deptDesc = (dept: Department) => currentLang() === 'en' ? dept.descriptionEn : dept.description;

  return (
    <div class="p-4 animate-fade-in home-screen">
      <p class="text-gray-700 text-sm font-semibold mb-3">да я могу тут написать</p>

      {/* Header with Elina */}
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          {/* Elina — living mascot */}
          <MobileElina size={48} />
          <div>
            <p class="text-gray-500 text-sm">{greeting()}</p>
            <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">BOLH</h1>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="w-12 h-12 rounded-2xl glass border border-slate-200/70 flex items-center justify-center text-gray-700 touch-scale"
            onClick={() => props.onNavigate('notifications')}
            aria-label={t('notifications.title')}
          >
            <Icon name="bell" class="w-5 h-5" />
          </button>
          <div 
            class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg touch-scale cursor-pointer"
            onClick={() => props.onNavigate('profile')}
          >
            А
          </div>
        </div>
      </div>

      {/* Urgent Order Button */}
      <button 
        class="w-full mb-5 animate-slide-up touch-scale"
        style="animation-delay: 0.05s"
        onClick={() => props.onNavigate('urgent')}
      >
        <div class="relative overflow-hidden glass rounded-2xl p-5 flex items-center gap-4 border border-amber-300/60">
          <div class="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-2xl" />
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
            <Icon name="zap" class="text-white" size="lg" />
          </div>
          <div class="text-left flex-1">
            <p class="font-bold text-lg text-gray-800">{t('home.urgentOrder')}</p>
            <p class="text-gray-500 text-sm">{t('home.guardIn15min')}</p>
          </div>
          <Icon name="chevronRight" class="text-amber-500" />
        </div>
      </button>

      {/* Department Section with Toggle */}
      <div class="glass rounded-2xl p-4 mb-6 animate-slide-up border border-slate-200/60" style="animation-delay: 0.1s">
        {/* Toggle: Найти мастера ↔ Я мастер */}
        <div class="flex bg-slate-100/80 rounded-xl p-1 mb-4">
          <button
            type="button"
            class={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
              homeMode() === 'search'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-gray-500'
            }`}
            onClick={() => { setHomeMode('search'); setHomeExpandedDept(null); }}
          >
            {currentLang() === 'en' ? '🔍 Find a Pro' : '🔍 Найти мастера'}
          </button>
          <button
            type="button"
            class={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
              homeMode() === 'order'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                : 'text-gray-500'
            }`}
            onClick={() => { setHomeMode('order'); setHomeExpandedDept(null); }}
          >
            {currentLang() === 'en' ? '🛠 I Work' : '🛠 Я мастер'}
          </button>
        </div>

        {/* Info line */}
        <p class="text-gray-500 text-[10px] mb-3 px-1">
          {homeMode() === 'search'
            ? (currentLang() === 'en' ? 'Tap a department → pick ONE service you need' : 'Нажми отдел → выбери ОДНУ услугу')
            : (currentLang() === 'en' ? 'Tap a department → select all skills you offer' : 'Нажми отдел → выбери все навыки')
          }
        </p>

        {/* Department Grid — each dept is a card that expands inline */}
        <div class="grid grid-cols-3 gap-2.5">
          <For each={departments}>
            {(dept, i) => {
              const isClient = () => homeMode() === 'search';
              const isWorkerMode = () => homeMode() === 'order';
              const workerCount = () => dept.skills.filter(s => workerSkills().includes(s.id)).length;
              const clientSel = () => clientNeeds().filter(id => dept.skills.some(s => s.id === id));
              const count = () => isClient() ? clientSel().length : workerCount();
              const isExpanded = () => homeExpandedDept() === dept.id;
              return (
                <div
                  class={`relative rounded-xl p-2.5 touch-scale animate-slide-up flex flex-col items-center text-center transition-all cursor-pointer ${
                    isExpanded() ? 'col-span-3 !p-3' : ''
                  }`}
                  style={`animation-delay: ${0.1 + i() * 0.03}s; ${
                    isExpanded()
                      ? `background: linear-gradient(135deg, ${dept.colorFrom}14, ${dept.colorTo}0D); border: 1.5px solid ${dept.colorFrom}35`
                      : count() > 0
                      ? `background: linear-gradient(135deg, ${dept.colorFrom}10, ${dept.colorTo}08); border: 1.5px solid ${dept.colorFrom}25`
                      : 'background: rgba(248,250,252,0.92); border: 1.5px solid rgba(148,163,184,0.22)'
                  }`}
                >
                  {/* Department header — always shown */}
                  <div
                    class={`flex ${isExpanded() ? 'items-center gap-3 w-full' : 'flex-col items-center'}`}
                    onClick={() => setHomeExpandedDept(isExpanded() ? null : dept.id)}
                  >
                    <div class={`${isExpanded() ? 'w-11 h-11' : 'w-14 h-14 mb-2'} rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center shadow-lg shrink-0`}>
                      <span class={isExpanded() ? 'text-xl' : 'text-2xl'}>{dept.icon}</span>
                    </div>
                    <Show when={isExpanded()}>
                      <div class="flex-1 text-left">
                        <p class="font-bold text-gray-800 text-sm">{deptName(dept)}</p>
                        <p class="text-gray-500 text-[10px]">
                          {count()} {currentLang() === 'en' ? 'selected' : 'выбрано'} • {dept.skills.length} {currentLang() === 'en' ? 'total' : 'всего'}
                        </p>
                      </div>
                      <Icon name="chevronUp" class="text-gray-400" size="sm" />
                    </Show>
                    <Show when={!isExpanded()}>
                      <p class="font-semibold text-gray-700 text-xs leading-tight">{deptName(dept)}</p>
                    </Show>
                  </div>

                  {/* Badge */}
                  <Show when={!isExpanded() && count() > 0}>
                    <span
                      class="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow"
                      style={`background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo})`}
                    >{count()}</span>
                  </Show>

                  {/* Inline expanded skills list */}
                  <Show when={isExpanded()}>
                    <div class="w-full mt-3 pt-3 border-t border-slate-200/70 space-y-1.5">
                      <For each={dept.skills}>
                        {(skill) => {
                          const sel = () => isClient()
                            ? clientNeeds().includes(skill.id)
                            : workerSkills().includes(skill.id);

                          const onSkillClick = () => {
                            if (isClient()) {
                              // CLIENT: single select — if already selected, deselect. If not selected, replace.
                              const cur = clientNeeds();
                              if (cur.includes(skill.id)) {
                                // Double-tap to deselect
                                setClientNeeds(cur.filter(s => s !== skill.id));
                              } else {
                                // Replace: remove any other from ALL depts, set only this one
                                setClientNeeds([skill.id]);
                              }
                            } else {
                              // WORKER: multi select — toggle freely
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
                              class="w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left touch-scale"
                              style={sel()
                                ? `background: linear-gradient(135deg, ${dept.colorFrom}16, ${dept.colorTo}10); border: 1.5px solid ${dept.colorFrom}35`
                                : 'background: rgba(248,250,252,0.92); border: 1.5px solid rgba(148,163,184,0.22)'
                              }
                              onClick={onSkillClick}
                            >
                              <div class={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                sel()
                                  ? 'bg-gradient-to-br ' + dept.color + ' shadow'
                                  : 'bg-slate-200/80'
                              }`}>
                                <span class="text-sm">{skill.icon}</span>
                              </div>
                              <div class="flex-1 min-w-0">
                                <p class={`text-[11px] font-semibold ${sel() ? 'text-gray-800' : 'text-gray-500'}`}>
                                  {currentLang() === 'en' ? skill.nameEn : skill.name}
                                </p>
                                <div class="flex gap-1 mt-0.5 flex-wrap">
                                  <Show when={skill.isExpert}>
                                    <span class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[7px] font-bold rounded-full">EXP</span>
                                  </Show>
                                  <Show when={skill.urgent}>
                                    <span class="px-1.5 py-0.5 bg-red-100 text-red-600 text-[7px] font-bold rounded-full">⚡</span>
                                  </Show>
                                </div>
                              </div>
                              <div class={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                                sel()
                                  ? (isClient() ? 'border-amber-400 bg-amber-500' : 'border-green-400 bg-green-500')
                                  : 'border-slate-300'
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
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Active Order Card */}
      <div class="glass rounded-2xl p-5 animate-slide-up border border-slate-200/60" style="animation-delay: 0.5s">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
            <Icon name="shield" class="text-white" size="sm" />
          </div>
          <div>
            <p class="text-gray-800 font-semibold">{t('home.activeOrder')}</p>
            <p class="text-gray-500 text-sm">{t('home.guardOnWay')}</p>
          </div>
          <div class="ml-auto">
            <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              {t('home.active')}
            </span>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
            <div class="w-full h-full flex items-center justify-center text-2xl">👤</div>
          </div>
          <div class="flex-1">
            <p class="font-semibold text-gray-800">Алексей К.</p>
            <div class="flex items-center gap-1 text-amber-500">
              <Icon name="star" size="xs" />
              <span class="text-sm font-medium">4.9</span>
            </div>
          </div>
          <button 
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg touch-scale"
            onClick={() => props.onNavigate('tracking')}
          >
            <Icon name="location" class="text-white" size="sm" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Department View ==============
function DepartmentViewPage(props: { onNavigate: (page: string) => void; onBack: () => void }) {
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
            <p class="text-white/70 text-sm">{dept()?.skills.length || 0} {t('dept.skills')}</p>
          </div>
          <span class="text-4xl">{dept()?.icon}</span>
        </div>

        {/* Skill pills */}
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <For each={dept()?.skills || []}>
            {(skill) => (
              <span class="px-3 py-1.5 bg-white/20 backdrop-blur rounded-full text-white text-xs font-medium whitespace-nowrap flex items-center gap-1">
                <span>{skill.icon}</span>
                <span>{currentLang() === 'en' ? skill.nameEn : skill.name}</span>
                <Show when={skill.isExpert}>
                  <span class="ml-0.5 bg-yellow-400 text-yellow-900 text-[9px] px-1 rounded-full font-bold">EXP</span>
                </Show>
                <Show when={skill.requiresDiploma}>
                  <span>🎓</span>
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
                        <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
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

// ============== Worker Skills Page ==============
function WorkerSkillsPage(props: { onBack: () => void }) {
  const [expandedDept, setExpandedDept] = createSignal<string | null>(null);
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
            <p class="text-white/70 text-sm">{skills().length} {t('skills.selected')}</p>
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
              <p class="text-white/60 text-xs">{t('status.tapToChange')}</p>
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
              <Icon name="clock" class="text-white/70" size="sm" />
              <input
                type="time"
                value={timerInput()}
                onInput={(e) => setTimerInput(e.currentTarget.value)}
                class="flex-1 bg-white/20 text-white rounded-lg px-3 py-2 text-sm outline-none placeholder:text-white/40"
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
                <p class="text-white/60 text-xs">⏰ {t('status.autoOnline')}: {busyUntil()}</p>
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
                  onClick={() => setExpandedDept(expandedDept() === dept.id ? null : dept.id)}
                >
                  <div class={`w-14 h-14 rounded-2xl bg-gradient-to-br ${dept.color} flex items-center justify-center mb-2 shadow-lg ${active() ? '' : 'grayscale opacity-50'}`}>
                    <span class="text-2xl">{dept.icon}</span>
                  </div>
                  <p class={`font-semibold text-xs leading-tight ${active() ? 'text-gray-800' : 'text-gray-400'}`}>{dName()}</p>
                  <Show when={count() > 0}>
                    <span class={`absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${dept.color} shadow`}>
                      {count()}
                    </span>
                  </Show>
                  <Show when={!active()}>
                    <span class="text-gray-400 text-[9px] mt-0.5">{t('skills.hidden')}</span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>

        {/* Развёрнутый отдел с навыками */}
        <Show when={expandedDept()}>
          {(() => {
            const dept = () => getDepartment(expandedDept()!);
            const dName = () => dept() ? (currentLang() === 'en' ? dept()!.nameEn : dept()!.name) : '';

            return (
              <div class="glass rounded-2xl overflow-hidden animate-slide-up mb-4">
                {/* Заголовок отдела */}
                <div class={`bg-gradient-to-r ${dept()?.color || ''} p-4 flex items-center gap-3`}>
                  <span class="text-3xl">{dept()?.icon}</span>
                  <div class="flex-1">
                    <p class="text-white font-bold">{dName()}</p>
                    <p class="text-white/70 text-xs">{dept()?.skills.length} {t('skills.available')}</p>
                  </div>
                  <button class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center" onClick={() => setExpandedDept(null)}>
                    <Icon name="x" class="text-white" size="sm" />
                  </button>
                </div>

                {/* Список навыков */}
                <div class="p-3">
                  <For each={dept()?.skills || []}>
                    {(skill) => {
                      const active = () => skills().includes(skill.id);
                      const needsDiploma = skill.requiresDiploma;
                      const hasDiploma = () => diplomas().includes(skill.id);
                      const isLocked = needsDiploma && !hasDiploma();

                      return (
                        <button
                          class={`w-full flex items-center gap-3 p-3 rounded-xl my-1 transition-all ${
                            isLocked ? 'opacity-60' : ''
                          }`}
                          style={active() ? `background: linear-gradient(135deg, ${dept()?.colorFrom}15, ${dept()?.colorTo}10)` : ''}
                          onClick={() => toggleSkill(skill.id, skill.requiresDiploma)}
                        >
                          <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            active()
                              ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600')
                              : isLocked
                              ? 'bg-gray-200'
                              : 'bg-gray-100'
                          }`}>
                            <Show when={isLocked} fallback={<span class="text-lg">{skill.icon}</span>}>
                              <span class="text-lg">🔒</span>
                            </Show>
                          </div>
                          <div class="flex-1 text-left">
                            <p class={`text-sm font-medium ${active() ? 'text-gray-800' : isLocked ? 'text-gray-400' : 'text-gray-600'}`}>
                              {currentLang() === 'en' ? skill.nameEn : skill.name}
                            </p>
                            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                              <Show when={skill.isExpert}>
                                <span class="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full">{t('skills.expert')}</span>
                              </Show>
                              <Show when={needsDiploma}>
                                <span class={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${hasDiploma() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {hasDiploma() ? '✅ ' + t('skills.verified') : '🎓 ' + t('skills.diplomaRequired')}
                                </span>
                              </Show>
                              <Show when={skill.urgent}>
                                <span class="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full">⚡ {t('skills.urgent')}</span>
                              </Show>
                            </div>
                          </div>
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
                              <span class="text-[10px]">🔒</span>
                            </Show>
                          </div>
                        </button>
                      );
                    }}
                  </For>
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
              <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <span class="text-3xl">🎓</span>
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

function UrgentOrderPage(props: { onBack: () => void }) {
  // Steps: form -> confirm -> waiting -> offers -> selected -> success
  const [step, setStep] = createSignal<'form' | 'confirm' | 'waiting' | 'offers' | 'selected' | 'success'>('form');
  const [budget, setBudget] = createSignal(15000);
  const [duration, setDuration] = createSignal(2);
  const [address, setAddress] = createSignal('ул. Абая 150, Алматы');
  const [offers, setOffers] = createSignal<any[]>([]);
  const [countdown, setCountdown] = createSignal(30);
  const [selectedOffer, setSelectedOffer] = createSignal<any>(null);
  const [searchRadius, setSearchRadius] = createSignal(0);

  // Price per hour calculation
  const pricePerHour = () => Math.round(budget() / duration());

  // Simulate incoming offers with better data
  createEffect(() => {
    if (step() === 'waiting') {
      // Animate search radius
      const radiusTimer = setInterval(() => {
        setSearchRadius(r => r < 3 ? r + 0.1 : 3);
      }, 100);

      const timer = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(timer);
            clearInterval(radiusTimer);
            if (offers().length > 0) {
              setStep('offers');
            }
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      // Guard 1: Accepts your price
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 1,
          name: 'Алексей Козлов',
          avatar: '👨‍✈️',
          rating: 4.9,
          reviews: 127,
          experienceKey: 'urgent.experience5Years',
          distance: 1.2,
          eta: 8,
          price: budget(),
          originalPrice: budget(),
          type: 'accept',
          badgeKey: 'urgent.badgeTop',
          badgeColor: 'bg-amber-500'
        }]);
      }, 3000);

      // Guard 2: Wants more (closer, faster)
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 2,
          name: 'Дмитрий Сидоров',
          avatar: '🧔',
          rating: 4.8,
          reviews: 89,
          experienceKey: 'urgent.experience3Years',
          distance: 0.8,
          eta: 5,
          price: budget() + 3000,
          originalPrice: budget(),
          type: 'counter',
          badgeKey: 'urgent.badgeFast',
          badgeColor: 'bg-blue-500'
        }]);
      }, 5000);

      // Guard 3: Offers discount (further away)
      setTimeout(() => {
        setOffers(prev => [...prev, {
          id: 3,
          name: 'Артём Петров',
          avatar: '👮',
          rating: 4.9,
          reviews: 156,
          experienceKey: 'urgent.experience7Years',
          distance: 2.1,
          eta: 12,
          price: budget() - 2000,
          originalPrice: budget(),
          type: 'discount',
          badgeKey: 'urgent.badgeDiscount',
          badgeColor: 'bg-green-500'
        }]);
        setStep('offers');
      }, 8000);

      return () => {
        clearInterval(timer);
        clearInterval(radiusTimer);
      };
    }
  });

  // Handle guard selection
  const handleSelectGuard = (offer: any) => {
    setSelectedOffer(offer);
    setStep('selected');
  };

  // Confirm selection
  const handleConfirmSelection = () => {
    setStep('success');
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header with Step Indicator */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={() => {
              if (step() === 'confirm') setStep('form');
              else if (step() === 'offers') setStep('waiting');
              else if (step() === 'selected') setStep('offers');
              else props.onBack();
            }}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">{t('urgent.title')}</h1>
          
          {/* Step indicator */}
          <Show when={step() !== 'success'}>
            <div class="flex gap-1">
              <div class={`w-2 h-2 rounded-full ${['form', 'confirm', 'waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['confirm', 'waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['waiting', 'offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['offers', 'selected'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </Show>
        </div>

        {/* Progress bar */}
        <Show when={step() !== 'success'}>
          <div class="h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              class="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
              style={`width: ${
                step() === 'form' ? '25%' : 
                step() === 'confirm' ? '50%' : 
                step() === 'waiting' ? '62.5%' : 
                step() === 'offers' ? '75%' : 
                step() === 'selected' ? '87.5%' : '100%'
              }`}
            />
          </div>
        </Show>
      </div>

      <Switch>
        {/* ========== Step 1: Form ========== */}
        <Match when={step() === 'form'}>
          <div class="p-4 space-y-5">
            {/* Location */}
            <div class="glass rounded-3xl p-5">
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-medium text-gray-700">{t('urgent.address')}</label>
                <span class="text-xs text-indigo-600 font-medium">📍 GPS</span>
              </div>
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Icon name="location" class="text-indigo-600" size="sm" />
                </div>
                <input 
                  type="text" 
                  value={address()}
                  onInput={(e) => setAddress(e.currentTarget.value)}
                  class="flex-1 bg-transparent text-gray-800 font-medium outline-none"
                />
              </div>
            </div>

            {/* Duration */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-4 block">{t('urgent.duration')}</label>
              <div class="flex items-center justify-between">
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale active:bg-gray-200"
                  onClick={() => setDuration(d => Math.max(1, d - 1))}
                >
                  <Icon name="minus" class="text-gray-600" />
                </button>
                <div class="text-center flex-1">
                  <div class="text-5xl font-bold text-gray-800">{duration()}</div>
                  <div class="text-gray-500 text-sm mt-1">{t('urgent.hours')}</div>
                </div>
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale active:bg-gray-200"
                  onClick={() => setDuration(d => Math.min(24, d + 1))}
                >
                  <Icon name="plus" class="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Budget */}
            <div class="glass rounded-3xl p-5">
              <div class="flex items-center justify-between mb-4">
                <label class="text-sm font-medium text-gray-700">{t('urgent.budget')}</label>
                <span class="text-xs text-gray-400">{pricePerHour().toLocaleString()} ₸/{t('urgent.hours').slice(0, 3)}</span>
              </div>
              <div class="text-center mb-6">
                <span class="text-5xl font-bold text-gray-800">{budget().toLocaleString()}</span>
                <span class="text-2xl text-gray-400 ml-1">₸</span>
              </div>
              
              {/* Custom slider */}
              <div class="relative">
                <input 
                  type="range" 
                  min="5000" 
                  max="50000" 
                  step="1000"
                  value={budget()}
                  onInput={(e) => setBudget(parseInt(e.currentTarget.value))}
                  class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <div class="flex justify-between text-xs text-gray-400 mt-3">
                  <span>5 000 ₸</span>
                  <span class="text-indigo-500 font-medium">{t('urgent.recommend')}</span>
                  <span>50 000 ₸</span>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Icon name="zap" class="text-amber-600" />
                </div>
                <div>
                  <p class="font-medium text-gray-800 mb-1">{t('urgent.howItWorks')}</p>
                  <p class="text-sm text-gray-600">
                    {t('urgent.info')}
                  </p>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale"
              onClick={() => setStep('confirm')}
            >
              {t('urgent.continue')}
            </button>
          </div>
        </Match>

        {/* ========== Step 2: Confirm Order ========== */}
        <Match when={step() === 'confirm'}>
          <div class="p-4 space-y-5">
            {/* Order Summary Card */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <p class="text-white/80 text-sm mb-1">{t('urgent.yourOrder')}</p>
                <p class="text-3xl font-bold">{budget().toLocaleString()} ₸</p>
                <p class="text-white/70 text-sm mt-1">{pricePerHour().toLocaleString()} ₸ × {duration()} {t('urgent.hours')}</p>
              </div>
              
              <div class="p-5 space-y-4">
                {/* Address */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Icon name="location" class="text-indigo-600" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.address')}</p>
                    <p class="font-medium text-gray-800">{address()}</p>
                  </div>
                </div>

                {/* Duration */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <Icon name="clock" class="text-cyan-600" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.duration')}</p>
                    <p class="font-medium text-gray-800">{duration()} {t('urgent.hours')}</p>
                  </div>
                </div>

                {/* Search radius */}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="shield" class="text-green-600" size="sm" />
                  </div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.searchRadius')}</p>
                    <p class="font-medium text-gray-800">3 {t('urgent.km')} (~15 {t('urgent.guards')})</p>
                  </div>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div class="glass rounded-3xl p-5">
              <p class="font-semibold text-gray-800 mb-4">{t('urgent.whatNext')}</p>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">1</div>
                  <p class="text-sm text-gray-600">{t('urgent.step1')}</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">2</div>
                  <p class="text-sm text-gray-600">{t('urgent.step2a')}<span class="text-green-600 font-medium">{t('urgent.accept')}</span>{t('urgent.step2b')}<span class="text-amber-600 font-medium">{t('urgent.offerOwn')}</span></p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">3</div>
                  <p class="text-sm text-gray-600">{t('urgent.step3')}</p>
                </div>
              </div>
            </div>

            {/* Important note */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-center gap-2 text-amber-700">
                <Icon name="zap" size="sm" />
                <span class="text-sm font-medium">{t('urgent.paymentNote')}</span>
              </div>
            </div>

            {/* Confirm Button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => {
                setSearchRadius(0);
                setOffers([]);
                setCountdown(30);
                setStep('waiting');
              }}
            >
              <Icon name="send" class="text-white" size="sm" />
              {t('urgent.submit')}
            </button>
          </div>
        </Match>

        {/* ========== Step 3: Waiting for offers ========== */}
        <Match when={step() === 'waiting'}>
          <div class="p-4">
            {/* Animated search visualization */}
            <div class="relative flex items-center justify-center py-12">
              {/* Expanding rings */}
              <div class="absolute w-48 h-48 rounded-full border-2 border-amber-400/20 animate-ping" style="animation-duration: 2s" />
              <div class="absolute w-64 h-64 rounded-full border-2 border-amber-400/10 animate-ping" style="animation-duration: 3s" />
              <div class="absolute w-80 h-80 rounded-full border-2 border-amber-400/5 animate-ping" style="animation-duration: 4s" />
              
              {/* Center icon */}
              <div class="relative">
                <div class="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
                  <Icon name="zap" class="text-white" size="xl" />
                </div>
                
                {/* Radius indicator */}
                <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 glass rounded-full px-3 py-1">
                  <span class="text-xs font-medium text-gray-700">{searchRadius().toFixed(1)} {t('urgent.km')}</span>
                </div>
              </div>
            </div>
            
            {/* Status text */}
            <div class="text-center mb-6">
              <h2 class="text-2xl font-bold text-white mb-2">{t('urgent.searching')}</h2>
              <p class="text-white/70">{t('urgent.waiting')}</p>
            </div>
            
            {/* Countdown and offers counter */}
            <div class="flex gap-4 mb-6">
              <div class="flex-1 glass rounded-2xl p-4 text-center">
                <div class="text-3xl font-bold text-indigo-600">{countdown()}</div>
                <div class="text-xs text-gray-500 mt-1">{t('urgent.sec')}</div>
              </div>
              <div class="flex-1 glass rounded-2xl p-4 text-center">
                <div class="text-3xl font-bold text-green-600">{offers().length}</div>
                <div class="text-xs text-gray-500 mt-1">{t('urgent.responses')}</div>
              </div>
            </div>

            {/* Live offers preview */}
            <Show when={offers().length > 0}>
              <div class="space-y-3">
                <p class="text-sm text-white/70 font-medium">{t('urgent.responsesReceived')}</p>
                <For each={offers()}>
                  {(offer) => (
                    <div class="glass rounded-2xl p-3 flex items-center gap-3 animate-slide-up">
                      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xl">
                        {offer.avatar}
                      </div>
                      <div class="flex-1">
                        <p class="font-medium text-gray-800 text-sm">{offer.name}</p>
                        <p class="text-xs text-gray-500">{offer.eta} {t('urgent.min')} • {offer.price.toLocaleString()} ₸</p>
                      </div>
                      <Show when={offer.type === 'accept'}>
                        <span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{t('urgent.yourPrice')}</span>
                      </Show>
                      <Show when={offer.type === 'counter'}>
                        <span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{t('urgent.ownPriceBadge')}</span>
                      </Show>
                      <Show when={offer.type === 'discount'}>
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{t('urgent.discount')}</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* Skip button */}
            <Show when={offers().length >= 2}>
              <button 
                class="w-full mt-6 py-3 glass rounded-2xl text-indigo-600 font-medium touch-scale"
                onClick={() => setStep('offers')}
              >
                {t('urgent.viewOffers')} {offers().length} {t('urgent.offers')} →
              </button>
            </Show>
          </div>
        </Match>

        {/* ========== Step 4: View Offers ========== */}
        <Match when={step() === 'offers'}>
          <div class="p-4">
            {/* Summary bar */}
            <div class="glass rounded-2xl p-4 mb-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Icon name="check" class="text-green-600" size="xs" />
                  </div>
                  <span class="font-medium text-gray-700">{offers().length} {t('urgent.guardsResponded')}</span>
                </div>
                <div class="text-right">
                  <p class="text-xs text-gray-400">{t('urgent.yourBudget')}</p>
                  <p class="font-bold text-indigo-600">{budget().toLocaleString()} ₸</p>
                </div>
              </div>
            </div>

            {/* Sort/Filter tabs */}
            <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button class="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium whitespace-nowrap">
                {t('urgent.all')} ({offers().length})
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.acceptedPrice')}
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.cheaper')}
              </button>
              <button class="px-4 py-2 glass rounded-full text-sm font-medium text-gray-600 whitespace-nowrap">
                {t('urgent.faster')}
              </button>
            </div>

            {/* Offers list */}
            <div class="space-y-4">
              <For each={offers()}>
                {(offer, i) => {
                  const priceDiff = () => offer.price - budget();
                  const isAccept = () => offer.type === 'accept';
                  const isDiscount = () => offer.type === 'discount';
                  
                  return (
                    <div 
                      class={`glass rounded-3xl overflow-hidden animate-slide-up ${isAccept() ? 'ring-2 ring-green-400' : isDiscount() ? 'ring-2 ring-blue-400' : ''}`}
                      style={`animation-delay: ${i() * 0.1}s`}
                    >
                      {/* Badge header */}
                      <Show when={offer.badgeKey}>
                        <div class={`${offer.badgeColor} text-white text-xs font-medium py-1.5 px-4 flex items-center gap-1`}>
                          <Show when={isAccept()}>✓</Show>
                          <Show when={isDiscount()}>↓</Show>
                          <Show when={offer.type === 'counter'}>⚡</Show>
                          {t(offer.badgeKey)}
                        </div>
                      </Show>
                      
                      <div class="p-5">
                        {/* Guard info */}
                        <div class="flex items-start gap-4 mb-4">
                          <div class="relative">
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-3xl">
                              {offer.avatar}
                            </div>
                            <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                          </div>
                          
                          <div class="flex-1">
                            <h3 class="font-bold text-gray-800 text-lg">{offer.name}</h3>
                            <div class="flex items-center gap-2 mt-1">
                              <div class="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                                <Icon name="star" class="text-amber-400 w-4 h-4" />
                                <span class="text-sm font-semibold text-amber-700">{offer.rating}</span>
                              </div>
                              <span class="text-sm text-gray-400">{offer.reviews} {t('urgent.reviews')}</span>
                            </div>
                            <p class="text-xs text-gray-400 mt-1">{t('urgent.experience')}: {offer.experienceKey ? t(offer.experienceKey) : ''}</p>
                          </div>
                        </div>

                        {/* Distance and ETA */}
                        <div class="flex gap-3 mb-4">
                          <div class="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                            <div class="flex items-center justify-center gap-1 text-gray-500 mb-1">
                              <Icon name="location" size="xs" />
                              <span class="text-xs">{t('urgent.distance')}</span>
                            </div>
                            <p class="font-bold text-gray-800">{offer.distance} {t('urgent.km')}</p>
                          </div>
                          <div class="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                            <div class="flex items-center justify-center gap-1 text-gray-500 mb-1">
                              <Icon name="clock" size="xs" />
                              <span class="text-xs">{t('urgent.arrivesIn')}</span>
                            </div>
                            <p class="font-bold text-gray-800">{offer.eta} {t('urgent.min')}</p>
                          </div>
                        </div>

                        {/* Price section */}
                        <div class={`p-4 rounded-2xl mb-4 ${
                          isAccept() ? 'bg-green-50 border border-green-200' : 
                          isDiscount() ? 'bg-blue-50 border border-blue-200' :
                          'bg-amber-50 border border-amber-200'
                        }`}>
                          <div class="flex items-center justify-between">
                            <div>
                              <Show when={isAccept()}>
                                <p class="text-green-700 font-medium flex items-center gap-1">
                                  <Icon name="check" size="xs" />
                                  {t('urgent.acceptedYourPrice')}
                                </p>
                              </Show>
                              <Show when={isDiscount()}>
                                <p class="text-blue-700 font-medium">
                                  {t('urgent.offersDiscount')} -{Math.abs(priceDiff()).toLocaleString()} ₸
                                </p>
                              </Show>
                              <Show when={offer.type === 'counter'}>
                                <p class="text-amber-700 font-medium">
                                  {t('urgent.asksMore')} +{priceDiff().toLocaleString()} ₸
                                </p>
                              </Show>
                            </div>
                            <div class="text-right">
                              <p class="text-3xl font-bold text-gray-800">{offer.price.toLocaleString()}</p>
                              <p class="text-xs text-gray-400">₸ {t('urgent.for')} {duration()} {t('urgent.hours')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Select button */}
                        <button 
                          class={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg touch-scale flex items-center justify-center gap-2 ${
                            isAccept() ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' :
                            isDiscount() ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white' :
                            'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                          }`}
                          onClick={() => handleSelectGuard(offer)}
                        >
                          {t('urgent.select')}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Match>

        {/* ========== Step 5: Confirm Selection ========== */}
        <Match when={step() === 'selected'}>
          <Show when={selectedOffer()}>
            <div class="p-4 space-y-5">
              {/* Guard card */}
              <div class="glass rounded-3xl overflow-hidden">
                <div class="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-center">
                  <div class="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl mx-auto mb-4">
                    {selectedOffer().avatar}
                  </div>
                  <h2 class="text-2xl font-bold">{selectedOffer().name}</h2>
                  <div class="flex items-center justify-center gap-2 mt-2">
                    <div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                      <Icon name="star" class="text-amber-300 w-4 h-4" />
                      <span class="font-medium">{selectedOffer().rating}</span>
                    </div>
                    <span class="text-white/70">{selectedOffer().reviews} {t('urgent.reviews')}</span>
                  </div>
                </div>
                
                <div class="p-5">
                  {/* Details */}
                  <div class="grid grid-cols-2 gap-3 mb-5">
                    <div class="bg-gray-50 rounded-xl p-3 text-center">
                      <p class="text-xs text-gray-400">{t('urgent.arrivesIn')}</p>
                      <p class="text-xl font-bold text-gray-800">{selectedOffer().eta} {t('urgent.min')}</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-3 text-center">
                      <p class="text-xs text-gray-400">{t('urgent.distance')}</p>
                      <p class="text-xl font-bold text-gray-800">{selectedOffer().distance} {t('urgent.km')}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div class="border-t border-gray-100 my-5" />

                  {/* Order summary */}
                  <div class="space-y-3">
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.address')}</span>
                      <span class="font-medium text-gray-800 text-right">{address()}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.duration')}</span>
                      <span class="font-medium text-gray-800">{duration()} {t('urgent.hours')}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">{t('urgent.yourBudget')}</span>
                      <span class="text-gray-400">{budget().toLocaleString()} ₸</span>
                    </div>
                    <div class="border-t border-gray-100 pt-3 flex justify-between">
                      <span class="font-semibold text-gray-800">{t('urgent.totalToPay')}</span>
                      <span class="text-2xl font-bold text-indigo-600">{selectedOffer().price.toLocaleString()} ₸</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirmation note */}
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="shield" class="text-green-600" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">{t('urgent.secureDeal')}</p>
                    <p class="text-xs text-green-600">{t('urgent.moneyNote')}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div class="space-y-3">
                <button 
                  class="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
                  onClick={handleConfirmSelection}
                >
                  <Icon name="check" class="text-white" size="sm" />
                  {t('urgent.confirmOrder')}
                </button>
                <button 
                  class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale"
                  onClick={() => setStep('offers')}
                >
                  {t('urgent.chooseAnother')}
                </button>
              </div>
            </div>
          </Show>
        </Match>

        {/* ========== Step 6: Success ========== */}
        <Match when={step() === 'success'}>
          <div class="p-4 flex flex-col items-center justify-center min-h-[70vh]">
            {/* Success animation */}
            <div class="relative mb-8">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-bounce shadow-2xl">
                <Icon name="check" class="text-white w-16 h-16" />
              </div>
              <div class="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-400/30 animate-ping" />
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2">{t('urgent.orderConfirmed')}</h2>
            <p class="text-white/70 text-center mb-8 max-w-xs">
              {selectedOffer()?.name} {t('urgent.enRouteToYou')} ~{selectedOffer()?.eta} {t('urgent.min')}
            </p>
            
            {/* Order card */}
            <div class="w-full glass rounded-3xl p-5 mb-6">
              <div class="flex items-center gap-4 mb-4">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">
                  {selectedOffer()?.avatar}
                </div>
                <div class="flex-1">
                  <p class="font-bold text-gray-800">{selectedOffer()?.name}</p>
                  <p class="text-sm text-gray-500">{t('urgent.orderNumber')}{Math.floor(Math.random() * 9000 + 1000)}</p>
                </div>
                <div class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {t('urgent.enRoute')}
                </div>
              </div>
              
              <div class="flex gap-3">
                <button class="flex-1 py-3 glass rounded-xl flex items-center justify-center gap-2 touch-scale">
                  <Icon name="phone" class="text-indigo-600" size="sm" />
                  <span class="font-medium text-gray-700">{t('tracking.call')}</span>
                </button>
                <button class="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center gap-2 shadow-lg touch-scale">
                  <Icon name="message" class="text-white" size="sm" />
                  <span class="font-medium text-white">{t('tracking.message')}</span>
                </button>
              </div>
            </div>

            {/* Track button */}
            <button 
              class="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={props.onBack}
            >
              <Icon name="map" class="text-white" size="sm" />
              {t('urgent.trackOnMap')}
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

function DiscoverPage() {
  const [deptFilter, setDeptFilter] = createSignal<string | null>(activeDepartment());
  const [searchFilter, setSearchFilter] = createSignal('all');

  const guards = [
    { id: 1, name: 'Алексей Козлов', rating: 4.9, reviews: 127, price: 5000, distance: 1.2, online: true, verified: true, dept: 'security' },
    { id: 2, name: 'Дмитрий Сидоров', rating: 4.8, reviews: 89, price: 4500, distance: 2.5, online: true, verified: true, dept: 'security' },
    { id: 3, name: 'Максим Иванов', rating: 4.7, reviews: 64, price: 4000, distance: 3.1, online: false, verified: false, dept: 'plumbing' },
    { id: 4, name: 'Артём Петров', rating: 4.9, reviews: 156, price: 5500, distance: 0.8, online: true, verified: true, dept: 'electrical' },
    { id: 5, name: 'Иван Волков', rating: 4.6, reviews: 42, price: 3500, distance: 1.5, online: true, verified: true, dept: 'handyman' },
    { id: 6, name: 'Сергей Орлов', rating: 4.8, reviews: 95, price: 4000, distance: 2.0, online: true, verified: true, dept: 'cleaning' },
    { id: 7, name: 'Николай Фёдоров', rating: 4.5, reviews: 38, price: 3000, distance: 0.5, online: true, verified: false, dept: 'tech' },
    { id: 8, name: 'Андрей Кузнецов', rating: 4.7, reviews: 71, price: 4200, distance: 1.8, online: false, verified: true, dept: 'auto' },
  ];

  const filteredGuards = () => {
    let list = guards;
    const df = deptFilter();
    if (df) list = list.filter(g => g.dept === df);
    if (searchFilter() === 'online') list = list.filter(g => g.online);
    if (searchFilter() === 'nearby') list = [...list].sort((a, b) => a.distance - b.distance);
    if (searchFilter() === 'top') list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  };

  return (
    <div class="p-4 animate-fade-in">
      <h1 class="text-2xl font-bold text-white mb-4">{t('search.title')}</h1>
      
      {/* Search */}
      <div class="glass rounded-2xl px-4 py-3 flex items-center gap-3 mb-4">
        <Icon name="search" class="text-gray-400" size="sm" />
        <input
          type="text"
          placeholder={t('search.placeholder')}
          class="flex-1 bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
        />
      </div>

      {/* Department quick filter */}
      <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
        <button
          class={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
            !deptFilter() ? 'bg-white/90 text-indigo-600 shadow-sm' : 'glass text-gray-500'
          }`}
          onClick={() => setDeptFilter(null)}
        >
          {t('search.all')}
        </button>
        <For each={departments}>
          {(dept) => (
            <button
              class={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
                deptFilter() === dept.id ? 'bg-white/90 shadow-sm ' + dept.accentText : 'glass text-gray-500'
              }`}
              onClick={() => setDeptFilter(deptFilter() === dept.id ? null : dept.id)}
            >
              <span>{dept.icon}</span>
              <span>{currentLang() === 'en' ? dept.nameEn : dept.name}</span>
            </button>
          )}
        </For>
      </div>

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
              searchFilter() === f.id ? 'bg-white/90 text-indigo-600 shadow-sm' : 'glass text-gray-600'
            }`}
            onClick={() => setSearchFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Guards List */}
      <div class="space-y-4">
        <For each={filteredGuards()}>
          {(guard, i) => {
            const gd = () => getDepartment(guard.dept);
            return (
              <div 
                class="glass rounded-3xl p-4 touch-scale animate-slide-up"
                style={`animation-delay: ${0.05 + i() * 0.04}s`}
              >
                <div class="flex items-start gap-4">
                  <div class="relative">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-3xl">
                      👤
                    </div>
                    {guard.online && (
                      <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-gray-800 truncate">{guard.name}</h3>
                      {guard.verified && (
                        <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon name="check" class="text-white w-3 h-3" />
                        </div>
                      )}
                    </div>
                    {/* Dept badge */}
                    <Show when={gd()}>
                      <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${gd()!.accentBg} ${gd()!.accentText}`}>
                        <span>{gd()!.icon}</span>
                        <span>{currentLang() === 'en' ? gd()!.nameEn : gd()!.name}</span>
                      </span>
                    </Show>
                    
                    <div class="flex items-center gap-3 mt-1">
                      <div class="flex items-center gap-1">
                        <Icon name="star" class="text-amber-400 w-4 h-4" />
                        <span class="text-sm font-medium text-gray-700">{guard.rating}</span>
                        <span class="text-xs text-gray-400">({guard.reviews})</span>
                      </div>
                      <div class="flex items-center gap-1 text-gray-400">
                        <Icon name="location" size="sm" class="w-4 h-4" />
                        <span class="text-xs">{guard.distance} {t('search.km')}</span>
                      </div>
                    </div>
                  </div>

                  <div class="text-right flex-shrink-0">
                    <p class="text-lg font-bold" style={`color: ${gd()?.colorFrom || '#6366f1'}`}>{guard.price.toLocaleString()}</p>
                    <p class="text-xs text-gray-400">{t('search.perHour')}</p>
                  </div>
                </div>

                <button class={`w-full mt-4 py-3 bg-gradient-to-r ${gd()?.color || 'from-indigo-500 to-purple-600'} text-white rounded-2xl font-semibold shadow-lg touch-scale`}>
                  {t('search.order')}
                </button>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

// --------------- Map Page: real GPS + nearby workers ---------------
const ALMATY = { lat: 43.238949, lng: 76.945465 };

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function generateNearbyWorkers(center: { lat: number; lng: number }, count: number) {
  const names = ['Алексей К.', 'Дмитрий С.', 'Максим И.', 'Артём П.', 'Иван В.', 'Сергей О.', 'Николай Ф.', 'Андрей К.', 'Евгений М.', 'Павел Н.', 'Олег Т.', 'Виктор Л.'];
  const deptIds = departments.map(d => d.id);
  const workers: Array<{
    id: string;
    name: string;
    profession: string;
    departmentId: string;
    rating: number;
    reviews: number;
    distance: number;
    lat: number;
    lng: number;
    status: 'available' | 'busy';
  }> = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    const deptId = deptIds[Math.floor(Math.random() * deptIds.length)];
    const dept = getDepartment(deptId)!;
    const profession = currentLang() === 'en' ? dept.workerTitleEn : dept.workerTitle;
    const distKm = randomInRange(0.3, 2.8);
    const bearing = Math.random() * 2 * Math.PI;
    const R = 6371;
    const d = distKm / R;
    const lat1 = (center.lat * Math.PI) / 180;
    const lng1 = (center.lng * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    const lat = (lat2 * 180) / Math.PI;
    const lng = (lng2 * 180) / Math.PI;
    let name = names[i % names.length];
    while (usedNames.has(name)) name = names[Math.floor(Math.random() * names.length)];
    usedNames.add(name);
    workers.push({
      id: `w-${i}-${Date.now()}`,
      name,
      profession,
      departmentId: deptId,
      rating: Math.round((randomInRange(4.2, 5)) * 10) / 10,
      reviews: Math.floor(randomInRange(20, 200)),
      distance: Math.round(distKm * 10) / 10,
      lat,
      lng,
      status: Math.random() > 0.3 ? 'available' : 'busy',
    });
  }
  return workers.sort((a, b) => a.distance - b.distance);
}

function MapPage() {
  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | undefined;
  let tileLayer: L.TileLayer | undefined;
  let userMarker: L.Marker | undefined;
  const workerMarkers: L.Marker[] = [];

  const [mapRef, setMapRef] = createSignal<L.Map | null>(null);
  const [userPos, setUserPos] = createSignal<{ lat: number; lng: number } | null>(null);
  const [workers, setWorkers] = createSignal<ReturnType<typeof generateNearbyWorkers>>([]);
  const [departmentFilter, setDepartmentFilter] = createSignal<string | null>(null);

  const filteredWorkers = () => {
    const list = workers();
    const df = departmentFilter();
    if (!df) return list;
    return list.filter(w => w.departmentId === df);
  };

  const center = () => userPos() || ALMATY;

  onMount(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(coords);
        setWorkers(generateNearbyWorkers(coords, 8 + Math.floor(Math.random() * 5)));
      },
      () => {
        setUserPos(ALMATY);
        setWorkers(generateNearbyWorkers(ALMATY, 8 + Math.floor(Math.random() * 5)));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  onMount(() => {
    if (!mapContainer) return;
    const c = center();
    map = L.map(mapContainer, { zoomControl: false }).setView([c.lat, c.lng], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const url = isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    tileLayer = L.tileLayer(url, { attribution: '© OSM', maxZoom: 19 }).addTo(map);
    setMapRef(map);
  });

  createEffect(() => {
    const m = mapRef();
    const pos = userPos();
    const list = filteredWorkers();
    if (!m) return;
    userMarker?.remove();
    userMarker = undefined;
    const showPos = pos ?? ALMATY;
    const userIcon = L.divIcon({
      className: 'map-user-marker',
      html: `<div class="map-user-pulse"><span class="map-user-dot"></span></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    userMarker = L.marker([showPos.lat, showPos.lng], { icon: userIcon })
      .addTo(m)
      .bindPopup(t('map.myLocation'));
    workerMarkers.forEach(mk => mk.remove());
    workerMarkers.length = 0;
    list.forEach((w) => {
      const dept = getDepartment(w.departmentId);
      const colorFrom = dept?.colorFrom ?? '#6366f1';
      const colorTo = dept?.colorTo ?? '#9333ea';
      const emoji = dept?.icon ?? '👤';
      const icon = L.divIcon({
        className: 'map-worker-marker',
        html: `<div class="map-worker-circle" style="background: linear-gradient(135deg, ${colorFrom}, ${colorTo}); box-shadow: 0 4px 20px ${colorFrom}40;"><span class="map-worker-emoji">${emoji}</span></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const statusText = w.status === 'available' ? t('map.available') : t('map.busy');
      const popupContent = `<div class="map-popup"><strong>${w.name}</strong><br/><span class="text-gray-600">${w.profession}</span><br/><span class="text-amber-600">★ ${w.rating}</span> (${w.reviews}) · ${w.distance} km ${t('map.fromYou')}<br/><span class="text-xs text-gray-500">${statusText}</span></div>`;
      const marker = L.marker([w.lat, w.lng], { icon }).addTo(m).bindPopup(popupContent);
      workerMarkers.push(marker);
    });
    if (pos && list.length > 0) {
      setTimeout(() => m.setView([pos.lat, pos.lng], 14), 100);
    }
  });

  createEffect(() => {
    const m = mapRef();
    if (!m || !tileLayer) return;
    isDark();
    const url = isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    m.removeLayer(tileLayer);
    tileLayer = L.tileLayer(url, { attribution: '© OSM', maxZoom: 19 }).addTo(m);
  });

  const goToMyLocation = () => {
    const pos = userPos();
    const m = mapRef();
    if (m && pos) {
      m.setView([pos.lat, pos.lng], 15);
      userMarker?.openPopup();
    }
  };

  onCleanup(() => {
    workerMarkers.forEach(m => m.remove());
    userMarker?.remove();
    tileLayer?.remove();
    map?.remove();
  });

  return (
    <div class="h-full relative animate-fade-in overflow-hidden">
      <div ref={mapContainer} class="absolute inset-0" style="z-index: 1" />

      {/* Floating search / department filter - glassmorphism */}
      <div class="absolute top-4 left-4 right-4 z-10">
        <div class="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl border border-white/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
          <Icon name="search" class="text-gray-500 dark:text-gray-400" size="sm" />
          <input
            type="text"
            placeholder={t('map.searchHere')}
            class="flex-1 bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-500"
          />
          <div class="flex gap-1.5 overflow-x-auto max-w-[50%]">
            <button
              class={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                !departmentFilter()
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-white/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => setDepartmentFilter(null)}
            >
              {t('map.nearby')}
            </button>
            <For each={departments}>
              {(dept) => (
                <button
                  class={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-all ${
                    departmentFilter() === dept.id
                      ? 'shadow-md text-white'
                      : 'bg-white/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
                  }`}
                  style={departmentFilter() === dept.id ? `background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo})` : ''}
                  onClick={() => setDepartmentFilter(departmentFilter() === dept.id ? null : dept.id)}
                >
                  <span>{dept.icon}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* My Location button - bottom right */}
      <button
        type="button"
        class="absolute bottom-36 right-4 z-10 w-12 h-12 rounded-2xl shadow-xl border border-white/20 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 touch-scale"
        onClick={goToMyLocation}
        title={t('map.myLocation')}
      >
        <Icon name="location" size="sm" />
      </button>

      {/* Bottom swipeable cards - nearest workers (2–3 visible) */}
      <div class="absolute bottom-0 left-0 right-0 z-10 pt-2 pb-8 px-2">
        <div class="rounded-t-3xl overflow-hidden border border-white/20 border-b-0 shadow-2xl backdrop-blur-xl bg-white/90 dark:bg-gray-900/90">
          <p class="px-4 pt-3 pb-2 text-sm font-semibold text-gray-600 dark:text-gray-300">{t('map.nearby')}</p>
          <div class="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 px-4" style="scrollbar-width: none;">
            <For each={filteredWorkers()}>
              {(worker, i) => {
                const dept = () => getDepartment(worker.departmentId);
                return (
                  <div
                    class="flex-shrink-0 w-[min(42vw,180px)] snap-center rounded-2xl overflow-hidden border border-white/40 shadow-lg bg-gradient-to-br from-white/95 to-gray-100/95 dark:from-gray-800/95 dark:to-gray-900/95 touch-scale"
                    style={`animation-delay: ${i() * 0.03}s`}
                  >
                    <div class="p-3">
                      <div class="flex items-center gap-2 mb-2">
                        <div
                          class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={`background: linear-gradient(135deg, ${dept()?.colorFrom ?? '#6366f1'}, ${dept()?.colorTo ?? '#9333ea'}); box-shadow: 0 4px 12px ${dept()?.colorFrom ?? '#6366f1'}40;`}
                        >
                          {dept()?.icon ?? '👤'}
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="font-semibold text-gray-800 dark:text-gray-200 truncate text-sm">{worker.name}</p>
                          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{worker.profession}</p>
                        </div>
                      </div>
                      <div class="flex items-center justify-between text-xs">
                        <span class="text-amber-600 dark:text-amber-400 font-medium">★ {worker.rating}</span>
                        <span class="text-gray-500 dark:text-gray-400">{worker.distance} km {t('map.fromYou')}</span>
                      </div>
                      <span class={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${worker.status === 'available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                        {worker.status === 'available' ? t('map.available') : t('map.busy')}
                      </span>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      <style>{`
        .map-user-marker { background: none !important; border: none !important; }
        .map-user-pulse {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.35);
          animation: map-pulse 2s ease-out infinite;
          display: flex; align-items: center; justify-content: center;
        }
        .map-user-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: 3px solid white;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4);
        }
        @keyframes map-pulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .map-worker-marker { background: none !important; border: none !important; }
        .map-worker-circle {
          width: 44px; height: 44px;
          border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.9);
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s ease;
        }
        .map-worker-circle:hover { transform: scale(1.1); }
        .map-worker-emoji { font-size: 22px; line-height: 1; }
        .map-popup { min-width: 160px; padding: 2px 0; }
      `}</style>
    </div>
  );
}

function TrackingPage() {
  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | undefined;
  
  const [guardLocation] = createSignal({ lat: 43.238949, lng: 76.945465 });
  const [userLocation] = createSignal({ lat: 43.240000, lng: 76.950000 });

  onMount(() => {
    if (!mapContainer) return;

    map = L.map(mapContainer, {
      zoomControl: false,
    }).setView([guardLocation().lat, guardLocation().lng], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const guardIcon = L.divIcon({
      className: 'guard-marker-container',
      html: `
        <div style="
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981, #059669);
          border: 3px solid white;
          box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
      `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
    });

    L.marker([guardLocation().lat, guardLocation().lng], { icon: guardIcon })
      .addTo(map)
      .bindPopup(`<b>Алексей Козлов</b><br>${t('tracking.onTheWay')}`);

    const userIcon = L.divIcon({
      className: 'user-marker-container',
      html: `
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #6366f1;
          border: 3px solid white;
          box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.3);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([userLocation().lat, userLocation().lng], { icon: userIcon })
      .addTo(map)
      .bindPopup(t('tracking.youAreHere'));

    const routeCoords: L.LatLngExpression[] = [
      [guardLocation().lat, guardLocation().lng],
      [43.239200, 76.946500],
      [43.239500, 76.948000],
      [userLocation().lat, userLocation().lng],
    ];

    L.polyline(routeCoords, {
      color: '#6366f1',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 10',
    }).addTo(map);
  });

  onCleanup(() => {
    map?.remove();
  });

  return (
    <div class="h-full relative animate-fade-in">
      <div ref={mapContainer} class="absolute inset-0" style="z-index: 1" />
      
      <div class="absolute top-4 left-4 right-4 z-10">
        <div class="glass rounded-2xl px-4 py-3 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-pulse">
            <Icon name="location" class="text-white" size="sm" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-800">{t('tracking.guardOnWay')}</p>
            <p class="text-xs text-gray-500">{t('tracking.arrivesIn')} ~5 {t('tracking.minutes')}</p>
          </div>
          <span class="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-semibold">
            1.2 {t('search.km')}
          </span>
        </div>
      </div>

      <div class="absolute bottom-24 left-4 right-4 z-10">
        <div class="glass rounded-3xl p-5">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-3xl">
              👤
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-gray-800">Алексей Козлов</h3>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1 text-amber-500">
                  <Icon name="star" size="xs" />
                  <span class="text-sm font-medium">4.9</span>
                </div>
                <span class="text-gray-300">•</span>
                <span class="text-sm text-gray-500">127 {t('tracking.orders')}</span>
              </div>
            </div>
          </div>

          <div class="flex gap-3">
            <button class="flex-1 py-3 glass rounded-2xl flex items-center justify-center gap-2 touch-scale">
              <Icon name="phone" class="text-indigo-600" size="sm" />
              <span class="font-medium text-gray-700">{t('tracking.call')}</span>
            </button>
            <button class="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center gap-2 shadow-lg touch-scale">
              <Icon name="message" class="text-white" size="sm" />
              <span class="font-medium text-white">{t('tracking.message')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrdersPage() {
  const orders = [
    { id: '1234', guard: 'Алексей Козлов', date: 'Сегодня', time: '14:00 - 18:00', status: 'active', price: 20000 },
    { id: '1233', guard: 'Дмитрий Сидоров', date: 'Вчера', time: '10:00 - 14:00', status: 'completed', price: 18000 },
    { id: '1232', guard: 'Максим Иванов', date: '3 февраля', time: '09:00 - 17:00', status: 'completed', price: 32000 },
  ];

  const statusStyles = () => ({
    active: { bg: 'bg-green-100', text: 'text-green-700', label: t('orders.active') },
    completed: { bg: 'bg-gray-100', text: 'text-gray-600', label: t('orders.completed') },
    cancelled: { bg: 'bg-red-100', text: 'text-red-600', label: t('orders.cancelled') },
  });

  return (
    <div class="p-4 animate-fade-in">
      <h1 class="text-2xl font-bold text-white mb-6">{t('orders.title')}</h1>

      <div class="space-y-4">
        <For each={orders}>
          {(order, i) => {
            const style = () => statusStyles()[order.status as keyof ReturnType<typeof statusStyles>];
            return (
              <div 
                class="glass rounded-3xl p-5 touch-scale animate-slide-up"
                style={`animation-delay: ${0.1 + i() * 0.05}s`}
              >
                <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon name="shield" class="text-white" size="sm" />
                    </div>
                    <div>
                      <p class="font-semibold text-gray-800">{t('orders.order')} #{order.id}</p>
                      <p class="text-sm text-gray-500">{order.guard}</p>
                    </div>
                  </div>
                  <span class={`px-3 py-1 ${style().bg} ${style().text} rounded-full text-xs font-medium`}>
                    {style().label}
                  </span>
                </div>

                <div class="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <div class="flex items-center gap-1">
                    <Icon name="clock" size="sm" class="text-gray-400" />
                    <span>{order.date}, {order.time}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span class="text-gray-500">{t('orders.total')}</span>
                  <span class="text-xl font-bold text-indigo-600">{order.price.toLocaleString()} ₸</span>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

function ThemePage(props: { onBack: () => void }) {
  const themes = [
    { id: 'light' as const, nameKey: 'theme.light', descKey: 'theme.lightDesc', icon: 'sun' },
    { id: 'dark' as const, nameKey: 'theme.dark', descKey: 'theme.darkDesc', icon: 'moon' },
    { id: 'system' as const, nameKey: 'theme.system', descKey: 'theme.systemDesc', icon: 'settings' },
  ];

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4 flex items-center gap-4">
        <button 
          class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
          onClick={props.onBack}
        >
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <h1 class="text-xl font-bold text-white">{t('theme.title')}</h1>
      </div>

      {/* Theme Options */}
      <div class="p-4 space-y-3">
        <For each={themes}>
          {(th) => {
            const isSelected = () => theme() === th.id;
            return (
              <button
                class={`w-full glass rounded-2xl p-5 text-left touch-scale animate-slide-up transition-all ${
                  isSelected() ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => setTheme(th.id)}
              >
                <div class="flex items-center gap-4">
                  <div class={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    th.id === 'light' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                    th.id === 'dark' ? 'bg-gradient-to-br from-indigo-600 to-purple-700' :
                    'bg-gradient-to-br from-gray-400 to-gray-600'
                  }`}>
                    <Icon name={th.icon as any} class="text-white" size="lg" />
                  </div>
                  
                  <div class="flex-1">
                    <p class="font-semibold text-gray-800 text-lg">{t(th.nameKey)}</p>
                    <p class="text-sm text-gray-500">{t(th.descKey)}</p>
                  </div>
                  
                  <Show when={isSelected()}>
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon name="check" class="text-white w-5 h-5" />
                    </div>
                  </Show>
                </div>
              </button>
            );
          }}
        </For>
      </div>

      {/* Preview */}
      <div class="p-4">
        <p class="text-sm text-white/70 font-medium mb-3">{t('theme.preview')}</p>
        <div class="glass rounded-3xl p-5">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Icon name="shield" class="text-white" size="sm" />
            </div>
            <div>
              <p class="font-semibold text-gray-800">{t('theme.sampleCard')}</p>
              <p class="text-sm text-gray-500">{t('theme.interfaceLook')}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="flex-1 py-2 bg-gray-100 rounded-xl text-gray-700 text-sm font-medium">
              {t('theme.cancel')}
            </button>
            <button class="flex-1 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-sm font-medium">
              {t('theme.confirm')}
            </button>
          </div>
        </div>
      </div>

      {/* Auto info */}
      <div class="p-4">
        <div class="glass rounded-2xl p-4 border border-indigo-200/50 bg-indigo-50/30">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="zap" class="text-indigo-600" size="sm" />
            </div>
            <div>
              <p class="font-medium text-gray-800">{t('theme.activeTheme')}</p>
              <p class="text-sm text-gray-500">
                {activeTheme() === 'dark' ? `🌙 ${t('theme.dark')}` : `☀️ ${t('theme.light')}`}
                {theme() === 'system' && ` ${t('theme.auto')}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Contracts & Payments ==============

interface ContractType {
  id: string;
  name: string;
  nameRu: string;
  icon: string;
  descriptionKey: string;
  durationKey: string;
  escrow: boolean;
  fee: number;
  color: string;
}

const contractTypes: ContractType[] = [
  { id: 'instant', name: 'Instant', nameRu: 'Срочный', icon: '⚡', descriptionKey: 'contracts.descInstant', durationKey: 'contracts.durationInstant', escrow: true, fee: 15, color: 'from-amber-400 to-orange-500' },
  { id: 'short', name: 'Short', nameRu: 'Краткий', icon: '📅', descriptionKey: 'contracts.descShort', durationKey: 'contracts.durationShort', escrow: true, fee: 12, color: 'from-blue-400 to-cyan-500' },
  { id: 'monthly', name: 'Monthly', nameRu: 'Месячный', icon: '📆', descriptionKey: 'contracts.descMonthly', durationKey: 'contracts.durationMonthly', escrow: true, fee: 10, color: 'from-indigo-500 to-purple-600' },
  { id: 'subscription', name: 'Subscription', nameRu: 'Подписка', icon: '🔄', descriptionKey: 'contracts.descSubscription', durationKey: 'contracts.durationUnlimited', escrow: false, fee: 8, color: 'from-green-400 to-emerald-500' },
];

const paymentMethods = [
  { id: 'kaspi', name: 'Kaspi Pay', nameKey: null as string | null, descKey: 'payment.instantTransfer', icon: '🏦', desc: 'Visa, Mastercard', fee: 0, popular: true },
  { id: 'card', name: null as string | null, nameKey: 'payment.card', descKey: null, icon: '💳', desc: 'Visa, Mastercard', fee: 2, popular: false },
  { id: 'apple', name: 'Apple Pay', nameKey: null, descKey: null, icon: '🍎', desc: 'iPhone / iPad', fee: 0, popular: false },
  { id: 'google', name: 'Google Pay', nameKey: null, descKey: null, icon: '🤖', desc: 'Android', fee: 0, popular: false },
  { id: 'balance', name: null, nameKey: 'payment.balance', descKey: null, icon: '👛', desc: '15 000 ₸', fee: 0, popular: false },
];

function ContractsPage(props: { onNavigate: (page: string) => void }) {
  const [expandedContract, setExpandedContract] = createSignal<string | null>(null);
  
  // Contracts with progress data
  const contracts = [
    { id: '2024-001', type: 'instant', guard: 'Алексей Козлов', avatar: '👨‍✈️', status: 'active', start: 'Сегодня 14:00', end: '18:00', total: 20000, paid: true, progress: 65, hoursWorked: 2.5, hoursTotal: 4, phases: [
      { phaseKey: 'phaseArrival', done: true },
      { phaseKey: 'phaseOnSite', done: true },
      { phaseKey: 'phasePatrol', done: false },
      { phaseKey: 'phaseComplete', done: false },
    ]},
    { id: '2024-002', type: 'monthly', guard: 'Дмитрий Сидоров', avatar: '🧔', status: 'active', start: '1 февраля', end: '28 февраля', total: 180000, paid: true, progress: 22, hoursWorked: 44, hoursTotal: 200, phases: [
      { phaseKey: 'phaseWeek', phaseNum: 1, done: true },
      { phaseKey: 'phaseWeek', phaseNum: 2, done: false },
      { phaseKey: 'phaseWeek', phaseNum: 3, done: false },
      { phaseKey: 'phaseWeek', phaseNum: 4, done: false },
    ]},
    { id: '2023-098', type: 'short', guard: 'Максим Иванов', avatar: '👮', status: 'completed', start: '25 января', end: '27 января', total: 45000, paid: true, progress: 100, hoursWorked: 48, hoursTotal: 48, phases: [
      { phaseKey: 'phaseDay', phaseNum: 1, done: true },
      { phaseKey: 'phaseDay', phaseNum: 2, done: true },
      { phaseKey: 'phaseComplete', done: true },
    ]},
    { id: '2023-095', type: 'instant', guard: 'Артём Петров', avatar: '🕵️', status: 'completed', start: '20 января', end: '20 января', total: 8000, paid: true, progress: 100, hoursWorked: 2, hoursTotal: 2, phases: [
      { phaseKey: 'phaseDone', done: true },
    ]},
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-green-100', text: 'text-green-700', label: t('contracts.statusActive') };
      case 'pending': return { bg: 'bg-amber-100', text: 'text-amber-700', label: t('contracts.statusPending') };
      case 'completed': return { bg: 'bg-gray-100', text: 'text-gray-600', label: t('contracts.statusCompleted') };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    }
  };

  const getTypeInfo = (typeId: string) => contractTypes.find(t => t.id === typeId) || contractTypes[0];
  
  // Get gradient colors for progress ring
  const getProgressColors = (progress: number, status: string) => {
    if (status === 'completed') return { stroke: '#10b981', bg: '#d1fae5' };
    if (progress >= 75) return { stroke: '#10b981', bg: '#d1fae5' };
    if (progress >= 50) return { stroke: '#6366f1', bg: '#e0e7ff' };
    if (progress >= 25) return { stroke: '#f59e0b', bg: '#fef3c7' };
    return { stroke: '#ef4444', bg: '#fee2e2' };
  };

  // Circular Progress Component
  const CircularProgress = (props: { progress: number; size: number; status: string; icon: string }) => {
    const colors = () => getProgressColors(props.progress, props.status);
    const circumference = 2 * Math.PI * 28; // radius = 28
    const strokeDashoffset = () => circumference - (props.progress / 100) * circumference;
    
    return (
      <div class="relative" style={`width: ${props.size}px; height: ${props.size}px`}>
        {/* Background ring */}
        <svg class="absolute inset-0 transform -rotate-90" width={props.size} height={props.size}>
          <circle
            cx={props.size / 2}
            cy={props.size / 2}
            r="28"
            stroke={colors().bg}
            stroke-width="6"
            fill="none"
          />
          {/* Progress ring */}
          <circle
            cx={props.size / 2}
            cy={props.size / 2}
            r="28"
            stroke={colors().stroke}
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
            stroke-dasharray={circumference.toString()}
            stroke-dashoffset={strokeDashoffset().toString()}
            class="transition-all duration-1000 ease-out"
            style={props.status === 'active' ? 'filter: drop-shadow(0 0 6px ' + colors().stroke + ')' : ''}
          />
        </svg>
        {/* Icon in center */}
        <div class="absolute inset-0 flex items-center justify-center text-2xl">
          {props.icon}
        </div>
        {/* Percentage badge */}
        <div 
          class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow-lg"
          style={`background: ${colors().stroke}; color: white`}
        >
          {props.progress}
        </div>
      </div>
    );
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <h1 class="text-2xl font-bold text-white">{t('contracts.title')}</h1>
          <button 
            class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg touch-scale"
            onClick={() => props.onNavigate('newcontract')}
          >
            <Icon name="plus" class="text-white" size="sm" />
          </button>
        </div>
        <p class="text-white/70">{t('contracts.subtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div class="px-4 mb-6">
        <div class="glass rounded-3xl p-5">
          <div class="grid grid-cols-3 gap-4">
            <div class="text-center">
              <p class="text-3xl font-bold text-indigo-600">2</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.active')}</p>
            </div>
            <div class="text-center border-x border-gray-200">
              <p class="text-3xl font-bold text-green-600">253K</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.paid')}</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-amber-500">200K</p>
              <p class="text-xs text-gray-500 mt-1">{t('contracts.inEscrow')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Types */}
      <div class="px-4 mb-6">
        <p class="text-sm font-medium text-white/70 mb-3">{t('contracts.create')}</p>
        <div class="grid grid-cols-2 gap-3">
          <For each={contractTypes}>
            {(type, i) => (
              <button 
                class="glass rounded-2xl p-4 text-left touch-scale animate-slide-up"
                style={`animation-delay: ${i() * 0.05}s`}
                onClick={() => props.onNavigate('newcontract')}
              >
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center text-2xl mb-3 shadow-lg`}>
                  {type.icon}
                </div>
                <p class="font-semibold text-gray-800">{t(`contracts.${type.id}`)}</p>
                <p class="text-xs text-gray-500">{t(type.durationKey)} • {type.fee}% {t('contracts.commission')}</p>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Active tracking banner */}
      <Show when={contracts.some(c => c.status === 'active')}>
        <div class="px-4 mb-4">
          <button
            class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-blue-600/20 touch-scale"
            onClick={() => props.onNavigate('tracking')}
          >
            <div class="relative">
              <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Icon name="location" size="lg" class="text-white" />
              </div>
              <div class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-blue-600 animate-pulse" />
            </div>
            <div class="flex-1 text-left">
              <p class="text-white font-semibold">{t('tracking.guardOnWay')}</p>
              <p class="text-blue-200 text-sm">Алексей Козлов • {t('tracking.arrivesIn')} ~5 {t('tracking.minutes')}</p>
            </div>
            <div class="text-right">
              <p class="text-white font-bold text-lg">~5 мин</p>
              <p class="text-blue-200 text-xs">{t('urgent.trackOnMap')} →</p>
            </div>
          </button>
        </div>
      </Show>

      {/* Active Contracts with Progress */}
      <div class="px-4">
        <p class="text-sm font-medium text-white/70 mb-3">{t('contracts.myContracts')}</p>
        <div class="space-y-3">
          <For each={contracts}>
            {(contract, i) => {
              const type = getTypeInfo(contract.type);
              const status = getStatusStyle(contract.status);
              const isExpanded = () => expandedContract() === contract.id;
              const colors = () => getProgressColors(contract.progress, contract.status);
              
              return (
                <div 
                  class="glass rounded-3xl overflow-hidden animate-slide-up"
                  style={`animation-delay: ${0.1 + i() * 0.05}s`}
                >
                  {/* Progress bar at top */}
                  <div class="h-1.5 bg-gray-100">
                    <div 
                      class="h-full transition-all duration-1000 ease-out rounded-full"
                      style={`width: ${contract.progress}%; background: ${colors().stroke}`}
                    />
                  </div>
                  
                  <div 
                    class="p-5 cursor-pointer touch-scale"
                    onClick={() => setExpandedContract(isExpanded() ? null : contract.id)}
                  >
                    <div class="flex items-start gap-4">
                      {/* Circular Progress with Icon */}
                      <CircularProgress 
                        progress={contract.progress} 
                        size={68} 
                        status={contract.status}
                        icon={contract.avatar}
                      />
                      
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                          <p class="font-semibold text-gray-800 truncate">{contract.guard}</p>
                          <span class={`px-2 py-0.5 ${status.bg} ${status.text} rounded-full text-xs font-medium flex-shrink-0`}>
                            {status.label}
                          </span>
                        </div>
                        <p class="text-xs text-gray-500 mb-2">#{contract.id} • {t(`contracts.${type.id}`)}</p>
                        
                        {/* Time info */}
                        <div class="flex items-center gap-3 text-xs text-gray-500">
                          <span class="flex items-center gap-1">
                            <Icon name="clock" size="xs" />
                            {contract.hoursWorked}/{contract.hoursTotal} {t('contracts.hoursShort')}
                          </span>
                          <span class="flex items-center gap-1">
                            <Icon name="calendar" size="xs" />
                            {contract.start}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <Show when={isExpanded()}>
                      <div class="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                        {/* Progress phases */}
                        <p class="text-xs font-medium text-gray-500 mb-3">{t('contracts.stages')}</p>
                        <div class="flex items-center gap-1 mb-4">
                          <For each={contract.phases}>
                            {(phase, phaseIdx) => (
                              <div class="flex-1">
                                <div 
                                  class={`h-2 rounded-full transition-all ${
                                    phase.done 
                                      ? 'bg-gradient-to-r from-green-400 to-emerald-500' 
                                      : 'bg-gray-200'
                                  }`}
                                />
                                <p class={`text-xs mt-1 truncate ${phase.done ? 'text-green-600' : 'text-gray-400'}`}>
                                  {'phaseNum' in phase && phase.phaseNum
                                    ? `${t('contracts.' + phase.phaseKey)} ${phase.phaseNum}`
                                    : t('contracts.' + phase.phaseKey)}
                                </p>
                              </div>
                            )}
                          </For>
                        </div>

                        {/* Stats row */}
                        <div class="grid grid-cols-3 gap-3 mb-4">
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold" style={`color: ${colors().stroke}`}>{contract.progress}%</p>
                            <p class="text-xs text-gray-500">{t('contracts.completed')}</p>
                          </div>
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold text-indigo-600">{contract.hoursWorked}</p>
                            <p class="text-xs text-gray-500">{t('contracts.hours')}</p>
                          </div>
                          <div class="bg-gray-50 rounded-xl p-3 text-center">
                            <p class="text-lg font-bold text-amber-500">{Math.round(contract.total * contract.progress / 100).toLocaleString()}</p>
                            <p class="text-xs text-gray-500">{t('contracts.earned')}</p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div class="flex gap-2 flex-wrap">
                          <Show when={contract.status === 'active'}>
                            <button 
                              class="w-full py-3 mb-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 touch-scale shadow-lg shadow-blue-500/30"
                              onClick={(e) => { e.stopPropagation(); props.onNavigate('tracking'); }}
                            >
                              <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                              <Icon name="location" size="xs" />
                              {t('urgent.trackOnMap')}
                            </button>
                          </Show>
                          <button class="flex-1 min-w-0 py-2.5 glass rounded-xl text-gray-700 font-medium text-sm flex items-center justify-center gap-2 touch-scale">
                            <Icon name="phone" size="xs" />
                            {t('contracts.call')}
                          </button>
                          <button class="flex-1 min-w-0 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 touch-scale shadow-lg" onClick={() => props.onNavigate('chat')}>
                            <Icon name="message" size="xs" />
                            {t('contracts.message')}
                          </button>
                          <Show when={contract.status === 'completed'}>
                            <button
                              onClick={() => props.onNavigate('rating')}
                              class="w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 touch-scale bg-amber-100 text-amber-800 border border-amber-300"
                            >
                              <Icon name="star" size="xs" class="text-amber-500" />
                              {t('contracts.rate')}
                            </button>
                          </Show>
                        </div>
                      </div>
                    </Show>

                    {/* Collapsed bottom section */}
                    <Show when={!isExpanded()}>
                      <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <div>
                          <p class="text-xs text-gray-400">{t('contracts.amount')}</p>
                          <p class="text-xl font-bold text-gray-800">{contract.total.toLocaleString()} ₸</p>
                        </div>
                        <Show when={contract.status === 'active'}>
                          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full" style={`background: ${colors().bg}`}>
                            <div class="w-2 h-2 rounded-full animate-pulse" style={`background: ${colors().stroke}`} />
                            <span class="text-sm font-medium" style={`color: ${colors().stroke}`}>{contract.progress}% {t('contracts.done')}</span>
                          </div>
                        </Show>
                        <Show when={contract.status === 'completed'}>
                          <div class="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                            <Icon name="checkCircle" class="text-green-500 w-4 h-4" />
                            <span class="text-sm font-medium text-green-700">{t('contracts.finished')}</span>
                          </div>
                        </Show>
                      </div>
                    </Show>

                    {/* Expand hint */}
                    <div class="flex justify-center mt-3">
                      <div class={`w-10 h-1 rounded-full bg-gray-200 transition-all ${isExpanded() ? 'bg-indigo-400' : ''}`} />
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Escrow Info */}
      <div class="p-4 mt-4">
        <div class="glass rounded-2xl p-4 border border-indigo-200/50 bg-indigo-50/30">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Icon name="lock" class="text-indigo-600" size="sm" />
            </div>
            <div>
              <p class="font-medium text-gray-800">{t('contracts.secureEscrow')}</p>
              <p class="text-xs text-gray-600 mt-1">
                {t('contracts.secureEscrowDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewContractPage(props: { onBack: () => void }) {
  const [step, setStep] = createSignal<'type' | 'details' | 'payment' | 'confirm' | 'success'>('type');
  const [contractType, setContractType] = createSignal<ContractType>(contractTypes[0]);
  const [selectedPayment, setSelectedPayment] = createSignal(paymentMethods[0]);
  const [duration, setDuration] = createSignal(4);
  const [hourlyRate] = createSignal(5000);
  const [address, setAddress] = createSignal('ул. Абая 150, Алматы');
  const [startDate, setStartDate] = createSignal<'today' | 'tomorrow' | 'select'>('today');
  const [processing, setProcessing] = createSignal(false);
  // Legal consent signals
  const [termsAccepted, setTermsAccepted] = createSignal(false);
  const [privacyAccepted, setPrivacyAccepted] = createSignal(false);
  const [cancellationAccepted, setCancellationAccepted] = createSignal(false);
  const [showTermsDetail, setShowTermsDetail] = createSignal<string | null>(null);
  const allLegalAccepted = () => termsAccepted() && privacyAccepted() && cancellationAccepted();

  // Price calculations
  const subtotal = () => hourlyRate() * duration();
  const platformFee = () => Math.round(subtotal() * (contractType().fee / 100));
  const paymentFee = () => Math.round(subtotal() * (selectedPayment().fee / 100));
  const total = () => subtotal() + platformFee() + paymentFee();
  const escrowAmount = () => contractType().escrow ? total() : 0;

  const handleConfirmPayment = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      setStep('success');
    }, 2000);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={() => {
              if (step() === 'type') props.onBack();
              else if (step() === 'details') setStep('type');
              else if (step() === 'payment') setStep('details');
              else if (step() === 'confirm') setStep('payment');
            }}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">
            {step() === 'type' && t('newContract.step1')}
            {step() === 'details' && t('newContract.step2')}
            {step() === 'payment' && t('newContract.step3')}
            {step() === 'confirm' && t('newContract.step4')}
            {step() === 'success' && t('newContract.step5')}
          </h1>
          
          {/* Step indicator */}
          <Show when={step() !== 'success'}>
            <div class="flex gap-1">
              <div class={`w-2 h-2 rounded-full ${['type', 'details', 'payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['details', 'payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['payment', 'confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
              <div class={`w-2 h-2 rounded-full ${['confirm'].includes(step()) ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </Show>
        </div>
      </div>

      <Switch>
        {/* ========== Step 1: Contract Type ========== */}
        <Match when={step() === 'type'}>
          <div class="p-4 space-y-4">
            <p class="text-white/70 text-sm mb-2">{t('newContract.chooseType')}</p>
            
            <For each={contractTypes}>
              {(type, i) => {
                const isSelected = () => contractType().id === type.id;
                return (
                  <button
                    class={`w-full glass rounded-3xl p-5 text-left touch-scale animate-slide-up ${
                      isSelected() ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={`animation-delay: ${i() * 0.05}s`}
                    onClick={() => setContractType(type)}
                  >
                    <div class="flex items-start gap-4">
                      <div class={`w-16 h-16 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center text-3xl shadow-lg`}>
                        {type.icon}
                      </div>
                      
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <h3 class="font-bold text-gray-800 text-lg">{t(`contracts.${type.id}`)}</h3>
                          <Show when={isSelected()}>
                            <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                              <Icon name="check" class="text-white w-4 h-4" />
                            </div>
                          </Show>
                        </div>
                        <p class="text-gray-500 text-sm mt-1">{t(type.descriptionKey)}</p>
                        
                        <div class="flex items-center gap-3 mt-3">
                          <span class="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                            {t(type.durationKey)}
                          </span>
                          <span class="px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                            {type.fee}% {t('newContract.commission')}
                          </span>
                          <Show when={type.escrow}>
                            <span class="px-2 py-1 bg-green-100 rounded-lg text-xs font-medium text-green-700 flex items-center gap-1">
                              <Icon name="lock" size="xs" />
                              {t('contracts.escrow')}
                            </span>
                          </Show>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              }}
            </For>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('details')}
            >
              {t('newContract.continue')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 2: Details ========== */}
        <Match when={step() === 'details'}>
          <div class="p-4 space-y-5">
            {/* Selected type indicator */}
            <div class={`glass rounded-2xl p-4 border-2 border-opacity-50 ${
              contractType().id === 'instant' ? 'border-amber-400' :
              contractType().id === 'short' ? 'border-blue-400' :
              contractType().id === 'monthly' ? 'border-indigo-400' :
              'border-green-400'
            }`}>
              <div class="flex items-center gap-3">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${contractType().color} flex items-center justify-center text-2xl`}>
                  {contractType().icon}
                </div>
                <div>
                  <p class="font-semibold text-gray-800">{t(`contracts.${contractType().id}`)} {t('contracts.title').toLowerCase()}</p>
                  <p class="text-xs text-gray-500">{t(contractType().durationKey)}</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-3 block">{t('newContract.address')}</label>
              <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Icon name="location" class="text-indigo-600" size="sm" />
                </div>
                <input 
                  type="text" 
                  value={address()}
                  onInput={(e) => setAddress(e.currentTarget.value)}
                  class="flex-1 bg-transparent text-gray-800 font-medium outline-none"
                />
              </div>
            </div>

            {/* Start Date */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-3 block">{t('newContract.startDate')}</label>
              <div class="grid grid-cols-3 gap-2">
                {(['today', 'tomorrow', 'select'] as const).map(dateKey => (
                  <button
                    class={`py-3 rounded-xl font-medium text-sm transition-all ${
                      startDate() === dateKey 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-700'
                    }`}
                    onClick={() => setStartDate(dateKey)}
                  >
                    {t(`newContract.${dateKey}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div class="glass rounded-3xl p-5">
              <label class="text-sm font-medium text-gray-700 mb-4 block">{t('newContract.duration')}</label>
              <div class="flex items-center justify-between">
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale"
                  onClick={() => setDuration(d => Math.max(1, d - 1))}
                >
                  <Icon name="minus" class="text-gray-600" />
                </button>
                <div class="text-center flex-1">
                  <div class="text-5xl font-bold text-gray-800">{duration()}</div>
                  <div class="text-gray-500 text-sm mt-1">
                    {contractType().id === 'monthly' ? t('newContract.weeks') : 
                     contractType().id === 'subscription' ? t('newContract.months') : t('newContract.hoursUnit')}
                  </div>
                </div>
                <button 
                  class="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center touch-scale"
                  onClick={() => setDuration(d => Math.min(24, d + 1))}
                >
                  <Icon name="plus" class="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Price Summary */}
            <div class="glass rounded-3xl p-5 bg-gradient-to-br from-indigo-50 to-purple-50">
              <p class="text-sm font-medium text-gray-700 mb-3">{t('newContract.costCalc')}</p>
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{hourlyRate().toLocaleString()} ₸ × {duration()} ч</span>
                  <span class="text-gray-800">{subtotal().toLocaleString()} ₸</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('newContract.commission')} ({contractType().fee}%)</span>
                  <span class="text-gray-800">{platformFee().toLocaleString()} ₸</span>
                </div>
                <div class="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span class="font-semibold text-gray-800">{t('newContract.total')}</span>
                  <span class="text-2xl font-bold text-indigo-600">{total().toLocaleString()} ₸</span>
                </div>
              </div>
            </div>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('payment')}
            >
              {t('newContract.selectPayment')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 3: Payment Method ========== */}
        <Match when={step() === 'payment'}>
          <div class="p-4 space-y-4">
            <p class="text-white/70 text-sm mb-2">{t('newContract.choosePayment')}</p>
            
            <For each={paymentMethods}>
              {(method, i) => {
                const isSelected = () => selectedPayment().id === method.id;
                return (
                  <button
                    class={`w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up ${
                      isSelected() ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={`animation-delay: ${i() * 0.05}s`}
                    onClick={() => setSelectedPayment(method)}
                  >
                    <div class="flex items-center gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-3xl">
                        {method.icon}
                      </div>
                      
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-semibold text-gray-800">{method.name}</p>
                          <Show when={method.popular}>
                            <span class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">{t('newContract.popular')}</span>
                          </Show>
                        </div>
                        <p class="text-sm text-gray-500">{method.desc}</p>
                      </div>
                      
                      <div class="text-right">
                        <Show when={method.fee > 0}>
                          <span class="text-xs text-amber-600">+{method.fee}%</span>
                        </Show>
                        <Show when={method.fee === 0}>
                          <span class="text-xs text-green-600">{t('newContract.free')}</span>
                        </Show>
                      </div>

                      <Show when={isSelected()}>
                        <div class="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Icon name="check" class="text-white w-4 h-4" />
                        </div>
                      </Show>
                    </div>
                  </button>
                );
              }}
            </For>

            {/* Escrow explanation */}
            <Show when={contractType().escrow}>
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="lock" class="text-green-600" size="sm" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">{t('newContract.escrowProtection')}</p>
                    <p class="text-xs text-green-700 mt-1">
                      {t('newContract.escrowDescLong')}
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            {/* Subscription explanation */}
            <Show when={!contractType().escrow}>
              <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <Icon name="repeat" class="text-green-600" size="sm" />
                  </div>
                  <div>
                    <p class="font-medium text-green-800">Автоматическая подписка</p>
                    <p class="text-xs text-green-700 mt-1">
                      {total().toLocaleString()} ₸/мес будет списываться автоматически. 
                      Отменить подписку можно в любое время в профиле.
                    </p>
                  </div>
                </div>
              </div>
            </Show>

            <button 
              class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
              onClick={() => setStep('confirm')}
            >
              {t('newContract.confirm')}
              <Icon name="arrowRight" class="text-white" size="sm" />
            </button>
          </div>
        </Match>

        {/* ========== Step 4: Confirm ========== */}
        <Match when={step() === 'confirm'}>
          <div class="p-4 space-y-5">
            {/* Order Summary */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class={`p-5 bg-gradient-to-br ${contractType().color} text-white`}>
                <div class="flex items-center gap-3 mb-3">
                  <span class="text-4xl">{contractType().icon}</span>
                  <div>
                    <p class="font-bold text-xl">{t(`contracts.${contractType().id}`)} {t('contracts.contractWord')}</p>
                    <p class="text-white/80 text-sm">{t(contractType().durationKey)}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-3xl font-bold">{total().toLocaleString()} ₸</p>
                </div>
              </div>
              
              <div class="p-5 space-y-4">
                <div class="flex items-center gap-3">
                  <Icon name="location" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('urgent.address')}</p>
                    <p class="font-medium text-gray-800">{address()}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <Icon name="calendar" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('newContract.start')}</p>
                    <p class="font-medium text-gray-800">{t(`newContract.${startDate()}`)}</p>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <Icon name="clock" class="text-gray-400" size="sm" />
                  <div class="flex-1">
                    <p class="text-xs text-gray-400">{t('newContract.duration')}</p>
                    <p class="font-medium text-gray-800">
                      {duration()} {contractType().id === 'monthly' ? t('newContract.weeks') : 
                                    contractType().id === 'subscription' ? t('newContract.months') : t('newContract.hoursUnit')}
                    </p>
                  </div>
                </div>

                {/* Subscription auto-renewal info */}
                <Show when={contractType().id === 'subscription'}>
                  <div class="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <Icon name="repeat" class="text-green-600" size="sm" />
                    <div class="flex-1">
                      <p class="text-xs text-green-600">{t('newContract.autoRenewal')}</p>
                      <p class="font-medium text-green-800">{t('newContract.everyMonth')}</p>
                    </div>
                  </div>
                </Show>

                <div class="border-t border-gray-100 pt-4">
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">{selectedPayment().icon}</span>
                    <div class="flex-1">
                      <p class="text-xs text-gray-400">{t('payment.method')}</p>
                      <p class="font-medium text-gray-800">{selectedPayment().name ?? (selectedPayment().nameKey ? t(selectedPayment().nameKey || '') : '')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div class="glass rounded-2xl p-4">
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('payment.subtotal')}</span>
                  <span class="text-gray-800">{subtotal().toLocaleString()} ₸</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-500">{t('payment.fee')} ({contractType().fee}%)</span>
                  <span class="text-gray-800">{platformFee().toLocaleString()} ₸</span>
                </div>
                <Show when={paymentFee() > 0}>
                  <div class="flex justify-between text-sm">
                    <span class="text-gray-500">{t('payment.fee')} {selectedPayment().name ?? (selectedPayment().nameKey ? t(selectedPayment().nameKey || '') : '')}</span>
                    <span class="text-gray-800">{paymentFee().toLocaleString()} ₸</span>
                  </div>
                </Show>
                <div class="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                  <span class="font-semibold text-gray-800">{t('payment.total')}</span>
                  <span class="text-xl font-bold text-indigo-600">{total().toLocaleString()} ₸</span>
                </div>
              </div>
            </div>

            {/* Escrow info */}
            <Show when={escrowAmount() > 0}>
              <div class="glass rounded-2xl p-4 border border-indigo-200 bg-indigo-50/30">
                <div class="flex items-center gap-3">
                  <Icon name="lock" class="text-indigo-600" />
                  <div>
                    <p class="font-medium text-indigo-800">{t('contracts.escrow')}: {escrowAmount().toLocaleString()} ₸</p>
                    <p class="text-xs text-indigo-600">{t('contracts.secureEscrowDesc')}</p>
                  </div>
                </div>
              </div>
            </Show>

            {/* ===== Legal Compliance Block ===== */}
            <div class="glass rounded-3xl p-5 space-y-4">
              <div class="flex items-center gap-2 mb-1">
                <Icon name="fileText" class="text-gray-600" size="sm" />
                <p class="font-semibold text-gray-800">{t('legal.title')}</p>
              </div>

              {/* 1. Terms of Service */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setTermsAccepted(!termsAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    termsAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={termsAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('legal.acceptTerms')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'terms' ? null : 'terms'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'terms'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.termsTitle')}</p>
                    <p>{t('legal.termsContent1')}</p>
                    <p class="mt-2">{t('legal.termsContent2')}</p>
                    <p class="mt-2">{t('legal.termsContent3')}</p>
                    <p class="mt-2">{t('legal.termsContent4')}</p>
                  </div>
                </Show>
              </div>

              {/* 2. Privacy Policy */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setPrivacyAccepted(!privacyAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    privacyAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={privacyAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('legal.acceptPrivacy')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'privacy' ? null : 'privacy'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'privacy'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.privacyTitle')}</p>
                    <p>{t('legal.privacyContent1')}</p>
                    <p class="mt-2">{t('legal.privacyContent2')}</p>
                    <p class="mt-2">{t('legal.privacyContent3')}</p>
                  </div>
                </Show>
              </div>

              {/* 3. Cancellation & Refund Policy */}
              <div class="space-y-2">
                <button
                  type="button"
                  class="w-full flex items-center gap-3 text-left"
                  onClick={() => { haptic('light'); setCancellationAccepted(!cancellationAccepted()); }}
                >
                  <div class={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    cancellationAccepted() ? 'bg-green-500' : isDark() ? 'border-2 border-gray-500' : 'border-2 border-gray-300'
                  }`}>
                    <Show when={cancellationAccepted()}>
                      <Icon name="check" class="text-white w-4 h-4" />
                    </Show>
                  </div>
                  <p class={`text-sm flex-1 ${isDark() ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t('legal.acceptCancellation')}
                  </p>
                  <span
                    role="button"
                    tabindex="0"
                    class="text-indigo-500 text-xs font-medium underline shrink-0 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowTermsDetail(showTermsDetail() === 'cancel' ? null : 'cancel'); }}
                  >{t('legal.readMore')}</span>
                </button>
                <Show when={showTermsDetail() === 'cancel'}>
                  <div class={`p-3 rounded-xl text-xs leading-relaxed animate-fade-in ${isDark() ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-600'}`}>
                    <p class="font-semibold mb-2">{t('legal.cancelTitle')}</p>
                    <p>{t('legal.cancelContent1')}</p>
                    <p class="mt-2">{t('legal.cancelContent2')}</p>
                    <p class="mt-2">{t('legal.cancelContent3')}</p>
                    <Show when={contractType().escrow}>
                      <p class="mt-2 font-medium">{t('legal.escrowNote')}</p>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Platform liability disclaimer */}
              <div class={`p-3 rounded-xl text-xs ${isDark() ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                <div class="flex items-start gap-2">
                  <span class="text-base">⚠️</span>
                  <p>{t('legal.liability')}</p>
                </div>
              </div>

              {/* Dispute resolution info */}
              <div class={`p-3 rounded-xl text-xs ${isDark() ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-800'}`}>
                <div class="flex items-start gap-2">
                  <span class="text-base">⚖️</span>
                  <p>{t('legal.dispute')}</p>
                </div>
              </div>
            </div>

            {/* Pay button — disabled until all consents given */}
            <button 
              class={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-all ${
                processing() 
                  ? 'bg-gray-400 text-white' 
                  : !allLegalAccepted()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white touch-scale'
              }`}
              onClick={() => { if (allLegalAccepted()) handleConfirmPayment(); }}
              disabled={processing() || !allLegalAccepted()}
            >
              <Show when={!processing()}>
                <Show when={contractType().escrow}>
                  <Icon name="lock" class="text-white" size="sm" />
                  {t('newContract.payButton')} {total().toLocaleString()} ₸
                </Show>
                <Show when={!contractType().escrow}>
                  <Icon name="repeat" class="text-white" size="sm" />
                  {t('newContract.subscribeButton')} {total().toLocaleString()} ₸/мес
                </Show>
              </Show>
              <Show when={processing()}>
                <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('payment.processing')}
              </Show>
            </button>
            <Show when={!allLegalAccepted()}>
              <p class="text-center text-xs text-amber-400">{t('legal.mustAcceptAll')}</p>
            </Show>
          </div>
        </Match>

        {/* ========== Step 5: Success ========== */}
        <Match when={step() === 'success'}>
          <div class="p-4 flex flex-col items-center justify-center min-h-[70vh]">
            {/* Success animation */}
            <div class="relative mb-8">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center animate-bounce shadow-2xl">
                <Icon name="check" class="text-white w-16 h-16" />
              </div>
              <div class="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-400/30 animate-ping" />
            </div>
            
            <h2 class="text-3xl font-bold text-white mb-2">Оплата прошла!</h2>
            <p class="text-white/70 text-center mb-8 max-w-xs">
              <Show when={contractType().escrow}>
                Контракт создан. Ваши деньги защищены эскроу до выполнения заказа.
              </Show>
              <Show when={!contractType().escrow}>
                {t('newContract.successSubscription')}
              </Show>
            </p>
            
            {/* Receipt card */}
            <div class="w-full glass rounded-3xl p-5 mb-6">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${contractType().color} flex items-center justify-center text-xl`}>
                    {contractType().icon}
                  </div>
                  <div>
                    <p class="font-bold text-gray-800">{t('contracts.contractNumber')} {Math.floor(Math.random() * 9000 + 1000)}</p>
                    <p class="text-xs text-gray-500">{t(`contracts.${contractType().id}`)}</p>
                  </div>
                </div>
                <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {t('newContract.paidLabel')}
                </span>
              </div>
              
              <div class="border-t border-gray-100 pt-4 flex justify-between items-center">
                <div>
                  <p class="text-xs text-gray-400">{t('newContract.amountLabel')}</p>
                  <p class="text-xl font-bold text-gray-800">{total().toLocaleString()} ₸</p>
                </div>
                <Show when={contractType().escrow}>
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full">
                    <Icon name="lock" class="text-indigo-600 w-4 h-4" />
                    <span class="text-sm font-medium text-indigo-700">{t('newContract.inEscrowLabel')}</span>
                  </div>
                </Show>
                <Show when={!contractType().escrow}>
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                    <Icon name="repeat" class="text-green-600 w-4 h-4" />
                    <span class="text-sm font-medium text-green-700">{t('newContract.autoRenewal')}</span>
                  </div>
                </Show>
              </div>
            </div>

            {/* Action buttons */}
            <div class="w-full space-y-3">
              <button 
                class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2"
                onClick={props.onBack}
              >
                <Icon name="fileText" class="text-white" size="sm" />
                {t('contracts.myContracts')}
              </button>
              <button 
                class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale"
                onClick={props.onBack}
              >
                {t('nav.home')}
              </button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

// ============== Document Vault (Сейф документов) ==============

interface Document {
  id: string;
  name: string;
  nameEn: string;
  type: 'payslip' | 'contract' | 'receipt' | 'certificate' | 'id' | 'diploma' | 'license' | 'insurance' | 'tax';
  date: string;
  size: string;
  encrypted: boolean;
  sender?: string;
  status: 'received' | 'signed' | 'pending' | 'expired' | 'rejected';
  expiresAt?: string;
  shared?: boolean;
  pinned?: boolean;
  tags?: string[];
}

const DOCUMENTS_MOCK: Document[] = [
  { id: '1', name: 'Расчётка Январь 2026', nameEn: 'Payslip January 2026', type: 'payslip', date: '31.01.2026', size: '156 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received', pinned: true },
  { id: '2', name: 'Контракт охраны #2026-001', nameEn: 'Security Contract #2026-001', type: 'contract', date: '15.01.2026', size: '2.3 MB', encrypted: true, sender: 'ТОО "Астана Плаза"', status: 'signed' },
  { id: '3', name: 'Расчётка Декабрь 2025', nameEn: 'Payslip December 2025', type: 'payslip', date: '31.12.2025', size: '148 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '4', name: 'Чек оплаты #8847', nameEn: 'Payment Receipt #8847', type: 'receipt', date: '20.12.2025', size: '45 KB', encrypted: true, status: 'received' },
  { id: '5', name: 'Сертификат охранника', nameEn: 'Security Guard Certificate', type: 'certificate', date: '10.12.2025', size: '1.1 MB', encrypted: true, status: 'signed', expiresAt: '10.12.2026' },
  { id: '6', name: 'Контракт #2025-089', nameEn: 'Contract #2025-089', type: 'contract', date: '01.12.2025', size: '2.1 MB', encrypted: true, sender: 'ИП Сидоров', status: 'signed' },
  { id: '7', name: 'Расчётка Ноябрь 2025', nameEn: 'Payslip November 2025', type: 'payslip', date: '30.11.2025', size: '151 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '8', name: 'Полис страхования', nameEn: 'Insurance Policy', type: 'insurance', date: '15.11.2025', size: '890 KB', encrypted: true, sender: 'СК "Надёжность"', status: 'received', expiresAt: '15.11.2026' },
  { id: '9', name: 'Удостоверение личности', nameEn: 'National ID Card', type: 'id', date: '01.10.2025', size: '2.5 MB', encrypted: true, status: 'signed', expiresAt: '01.10.2035' },
  { id: '10', name: 'Диплом сантехника', nameEn: 'Plumbing Diploma', type: 'diploma', date: '20.06.2023', size: '3.2 MB', encrypted: true, status: 'signed' },
  { id: '11', name: 'Лицензия электрика', nameEn: 'Electrician License', type: 'license', date: '01.03.2024', size: '1.8 MB', encrypted: true, status: 'signed', expiresAt: '01.03.2026' },
  { id: '12', name: 'Налоговый отчёт 2025', nameEn: 'Tax Report 2025', type: 'tax', date: '15.01.2026', size: '456 KB', encrypted: true, status: 'received' },
  { id: '13', name: 'Контракт уборки #126', nameEn: 'Cleaning Contract #126', type: 'contract', date: '28.01.2026', size: '1.5 MB', encrypted: true, sender: 'БЦ "Мегаполис"', status: 'pending', tags: ['urgent'] },
  { id: '14', name: 'Расчётка Октябрь 2025', nameEn: 'Payslip October 2025', type: 'payslip', date: '31.10.2025', size: '149 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '15', name: 'Акт выполненных работ', nameEn: 'Work Completion Certificate', type: 'receipt', date: '25.01.2026', size: '320 KB', encrypted: true, sender: 'ТОО "Астана Плаза"', status: 'pending' },
  { id: '16', name: 'Водительское удостоверение', nameEn: "Driver's License", type: 'license', date: '01.05.2024', size: '2.1 MB', encrypted: true, status: 'signed', expiresAt: '01.05.2034' },
  { id: '17', name: 'Расчётка Сентябрь 2025', nameEn: 'Payslip September 2025', type: 'payslip', date: '30.09.2025', size: '147 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '18', name: 'Медицинская справка', nameEn: 'Medical Certificate', type: 'certificate', date: '15.08.2025', size: '780 KB', encrypted: true, status: 'signed', expiresAt: '15.02.2026' },
  { id: '19', name: 'Расчётка Август 2025', nameEn: 'Payslip August 2025', type: 'payslip', date: '31.08.2025', size: '152 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '20', name: 'Справка о несудимости', nameEn: 'Criminal Record Certificate', type: 'certificate', date: '01.07.2025', size: '320 KB', encrypted: true, status: 'signed', expiresAt: '01.07.2026' },
  { id: '21', name: 'Расчётка Июль 2025', nameEn: 'Payslip July 2025', type: 'payslip', date: '31.07.2025', size: '150 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
  { id: '22', name: 'Доп. соглашение #5', nameEn: 'Supplementary Agreement #5', type: 'contract', date: '10.07.2025', size: '890 KB', encrypted: true, sender: 'ИП Сидоров', status: 'expired', expiresAt: '10.01.2026' },
  { id: '23', name: 'Сертификат первой помощи', nameEn: 'First Aid Certificate', type: 'certificate', date: '20.05.2025', size: '1.4 MB', encrypted: true, status: 'signed', expiresAt: '20.05.2027' },
  { id: '24', name: 'Расчётка Июнь 2025', nameEn: 'Payslip June 2025', type: 'payslip', date: '30.06.2025', size: '146 KB', encrypted: true, sender: 'ООО "Гвардия"', status: 'received' },
];

const ACCESS_HISTORY_MOCK = [
  { type: 'viewed' as const, docName: 'Расчётка Январь 2026', time: 'Сегодня, 14:32', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'downloaded' as const, docName: 'Контракт #2026-001', time: 'Вчера, 09:15', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'shared' as const, docName: 'Сертификат охранника', time: '5 янв 2026', device: 'Safari', ip: '10.0.0.2' },
  { type: 'viewed' as const, docName: 'Полис страхования', time: '3 янв 2026', device: 'iPhone 15', ip: '192.168.1.1' },
  { type: 'deleted_attempt' as const, docName: 'Черновик', time: '1 янв 2026', device: 'Chrome', ip: '172.16.0.5' },
];

function DocumentVaultPage(props: { onBack: () => void }) {
  const [selectedCategory, setSelectedCategory] = createSignal('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [showSearch, setShowSearch] = createSignal(false);
  const [previewDoc, setPreviewDoc] = createSignal<Document | null>(null);
  const [showUpload, setShowUpload] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  const [uploading, setUploading] = createSignal(false);
  const [uploadSuccess, setUploadSuccess] = createSignal(false);
  const [showShare, setShowShare] = createSignal(false);
  const [shareDoc, setShareDoc] = createSignal<Document | null>(null);
  const [shareTimer, setShareTimer] = createSignal('24h');
  const [sharePin, setSharePin] = createSignal(false);
  const [shareLinkCopied, setShareLinkCopied] = createSignal(false);

  const dark = () => isDark();
  const docName = (doc: Document) => currentLang() === 'ru' ? doc.name : doc.nameEn;

  const categories = () => [
    { id: 'all', label: t('docs.catAll'), icon: '📁', count: 24 },
    { id: 'payslip', label: t('docs.catPayslips'), icon: '💰', count: 8 },
    { id: 'contract', label: t('docs.catContracts'), icon: '📄', count: 5 },
    { id: 'receipt', label: t('docs.catReceipts'), icon: '🧾', count: 3 },
    { id: 'certificate', label: t('docs.catCertificates'), icon: '🏆', count: 4 },
    { id: 'id', label: t('docs.catIds'), icon: '🪪', count: 1 },
    { id: 'diploma', label: t('docs.catDiplomas'), icon: '🎓', count: 1 },
    { id: 'license', label: t('docs.catLicenses'), icon: '📜', count: 2 },
    { id: 'insurance', label: t('docs.catInsurance'), icon: '🛡️', count: 1 },
    { id: 'tax', label: t('docs.catTax'), icon: '📊', count: 1 },
  ];

  const filteredDocs = () => {
    let list = DOCUMENTS_MOCK;
    if (selectedCategory() !== 'all') list = list.filter(d => d.type === selectedCategory());
    const q = searchQuery().toLowerCase();
    if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || d.nameEn.toLowerCase().includes(q));
    return list;
  };

  const pendingCount = () => DOCUMENTS_MOCK.filter(d => d.status === 'pending').length;
  const expiringCount = () => DOCUMENTS_MOCK.filter(d => d.expiresAt && new Date(d.expiresAt.split('.').reverse().join('-')) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length;
  const attentionCount = () => pendingCount() + expiringCount();

  const getTypeIcon = (type: Document['type']) => {
    const map: Record<Document['type'], string> = { payslip: '💰', contract: '📄', receipt: '🧾', certificate: '🏆', id: '🪪', diploma: '🎓', license: '📜', insurance: '🛡️', tax: '📊' };
    return map[type] || '📁';
  };

  const getTypeBg = (type: Document['type']) => {
    if (dark()) return 'from-indigo-500/30 to-purple-600/30';
    return 'from-indigo-100 to-purple-100';
  };

  const getStatusKey = (status: Document['status']) => {
    switch (status) {
      case 'received': return 'docs.statusReceived';
      case 'signed': return 'docs.statusSigned';
      case 'pending': return 'docs.statusPending';
      case 'expired': return 'docs.statusExpired';
      case 'rejected': return 'docs.statusRejected';
      default: return 'docs.statusReceived';
    }
  };

  const getStatusClass = (status: Document['status']) => {
    switch (status) {
      case 'received': case 'signed': return 'bg-green-500/20 text-green-700 dark:text-green-300';
      case 'pending': return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
      case 'expired': case 'rejected': return 'bg-red-500/20 text-red-700 dark:text-red-300';
      default: return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
    }
  };

  const startUpload = () => {
    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);
    const interval = setInterval(() => {
      setUploadProgress(p => {
        if (p >= 100) { clearInterval(interval); setUploading(false); setUploadSuccess(true); return 100; }
        return p + 12;
      });
    }, 120);
  };

  const openShare = (doc: Document) => { setShareDoc(doc); setShowShare(true); setShareLinkCopied(false); };
  const copyShareLink = () => { setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 2000); };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Section 0: Header */}
      <div class="p-4 pb-2">
        <div class="flex items-center gap-3 mb-1">
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={props.onBack} aria-label="Back">
            <Icon name="chevronLeft" class={dark() ? 'text-white' : 'text-gray-700'} size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1 truncate">{t('docs.title')}</h1>
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => { setShowUpload(true); setUploadSuccess(false); }} aria-label="Upload">
            <Icon name="uploadCloud" class="text-indigo-400" size="sm" />
          </button>
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => setShowSearch(s => !s)} aria-label="Search">
            <Icon name="search" class={dark() ? 'text-white' : 'text-gray-600'} size="sm" />
          </button>
        </div>
        <p class="text-white/70 text-sm ml-[3.25rem]">{t('docs.encrypted')}</p>
        <div class="mt-2 px-1">
          <p class="text-xs text-white/60 mb-1">{t('docs.storageUsed')}</p>
          <div class="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-400 transition-all duration-500" style={{ width: '48%' }} />
          </div>
        </div>
      </div>

      <Show when={showSearch()}>
        <div class="px-4 pb-2 animate-slide-up">
          <input
            type="text"
            placeholder={t('search.placeholder')}
            class="w-full rounded-xl glass px-4 py-2.5 text-white placeholder-white/50 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
            value={searchQuery()}
            onInput={e => setSearchQuery(e.currentTarget.value)}
          />
        </div>
      </Show>

      {/* Section 1: Security Banner */}
      <div class="px-4 mb-3">
        <div class={`rounded-2xl p-4 border overflow-hidden ${dark() ? 'bg-gradient-to-br from-green-900/60 to-emerald-900/40 border-green-500/30' : 'bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-400/40'} glass animate-slide-up`} style="animation-delay: 0.05s">
          <div class="flex items-center gap-3">
            <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${dark() ? 'bg-green-500/30' : 'bg-green-400/30'}`}>
              <Icon name="lock" class="text-green-400" size="sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-green-800 dark:text-green-200">{t('docs.aes256')}</p>
              <p class="text-xs text-green-700 dark:text-green-300/90">{t('docs.onlyYou')}</p>
            </div>
            <div class="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center animate-pulse">
              <Icon name="shield" class="text-green-500" size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Quick Stats */}
      <div class="px-4 mb-3 overflow-x-auto">
        <div class="flex gap-3 pb-2 -mx-1 animate-slide-up" style="animation-delay: 0.1s">
          <div class="flex-shrink-0 glass rounded-xl px-4 py-3 min-w-[120px]">
            <p class="text-2xl font-bold text-white">24</p>
            <p class="text-xs text-white/70">{t('docs.total')}</p>
          </div>
          <div class="flex-shrink-0 glass rounded-xl px-4 py-3 min-w-[120px]">
            <p class="text-2xl font-bold text-white">8</p>
            <p class="text-xs text-white/70">{t('docs.receivedMonth')}</p>
          </div>
          <div class="flex-shrink-0 rounded-xl px-4 py-3 min-w-[120px] bg-amber-500/20 border border-amber-400/30">
            <p class="text-2xl font-bold text-amber-200">3</p>
            <p class="text-xs text-amber-200/80">{t('docs.pendingSign')}</p>
          </div>
          <div class="flex-shrink-0 rounded-xl px-4 py-3 min-w-[120px] bg-red-500/20 border border-red-400/30 animate-pulse">
            <p class="text-2xl font-bold text-red-200">2</p>
            <p class="text-xs text-red-200/80">{t('docs.expiringSoon')}</p>
          </div>
        </div>
      </div>

      {/* Section 3: Notifications Bar */}
      <Show when={attentionCount() > 0}>
        <div class="px-4 mb-3">
          <div class="rounded-xl px-4 py-2.5 bg-amber-500/20 border border-amber-400/40 flex items-center justify-between gap-2 animate-slide-up" style="animation-delay: 0.12s">
            <span class="text-amber-200 text-sm font-medium">{attentionCount()} {t('docs.needAttention')}</span>
            <Icon name="chevronRight" class="text-amber-400 w-5 h-5 flex-shrink-0" />
          </div>
        </div>
      </Show>

      {/* Section 4: Categories */}
      <div class="px-4 mb-3">
        <div class="flex gap-2 overflow-x-auto pb-2 animate-slide-up" style="animation-delay: 0.15s">
          <For each={categories()}>
            {(cat) => (
              <button
                class={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap transition-all touch-scale ${
                  selectedCategory() === cat.id
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'glass text-white/90'
                }`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                <span class="font-medium text-sm">{cat.label}</span>
                <span class={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory() === cat.id ? 'bg-white/20' : 'bg-white/20 text-white/80'}`}>{cat.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Section 5: Document List */}
      <div class="px-4 space-y-3 pb-6">
        <For each={filteredDocs()}>
          {(doc, i) => (
            <div
              class="glass rounded-2xl p-4 animate-slide-up border border-white/10 touch-scale"
              style={`animation-delay: ${Math.min(i() * 0.03, 0.4)}s`}
            >
              <div class="flex items-start gap-3">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${getTypeBg(doc.type)} flex items-center justify-center text-2xl flex-shrink-0`}>
                  {getTypeIcon(doc.type)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-white truncate">{docName(doc)}</p>
                    <Show when={doc.pinned}>
                      <Icon name="star" class="text-amber-400 w-4 h-4 flex-shrink-0" size="xs" />
                    </Show>
                  </div>
                  <Show when={doc.sender}>
                    <p class="text-xs text-white/60 mt-0.5">{t('docs.from')}: {doc.sender}</p>
                  </Show>
                  <div class="flex flex-wrap items-center gap-2 mt-1">
                    <span class="text-xs text-white/50">{doc.date}</span>
                    <span class="text-white/30">•</span>
                    <span class="text-xs text-white/50">{doc.size}</span>
                    <Show when={doc.encrypted}>
                      <span class="text-xs text-green-400/90 flex items-center gap-1">
                        <Icon name="lock" size="xs" />
                        {t('docs.encryptedBadge')}
                      </span>
                    </Show>
                  </div>
                  <div class="flex flex-wrap gap-2 mt-2">
                    <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusClass(doc.status)}`}>
                      {t(getStatusKey(doc.status))}
                    </span>
                    <Show when={doc.expiresAt}>
                      <span class="text-xs text-amber-400/90">{t('docs.expires')}: {doc.expiresAt}</span>
                    </Show>
                  </div>
                </div>
                <div class="flex flex-col gap-1.5 flex-shrink-0">
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" onClick={() => setPreviewDoc(doc)} title={t('docs.view')}>
                    <Icon name="eye" class="text-white/80" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" title={t('docs.download')}>
                    <Icon name="download" class="text-indigo-300" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg glass flex items-center justify-center touch-scale" onClick={() => openShare(doc)} title={t('docs.share')}>
                    <Icon name="share" class="text-white/80" size="sm" />
                  </button>
                  <button class="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center rounded-lg touch-scale" title={t('docs.delete')}>
                    <Icon name="trash" class="text-red-300" size="sm" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Section 9: Access History */}
      <div class="p-4 pt-2 pb-8">
        <p class="text-sm font-medium text-white/70 mb-3">{t('docs.accessHistory')}</p>
        <div class="glass rounded-2xl p-4 border border-white/10">
          <div class="space-y-0">
            <For each={ACCESS_HISTORY_MOCK}>
              {(entry, idx) => (
                <div class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      entry.type === 'viewed' ? 'bg-green-500/20' :
                      entry.type === 'downloaded' ? 'bg-blue-500/20' :
                      entry.type === 'shared' ? 'bg-amber-500/20' : 'bg-red-500/20'
                    }`}>
                      <Switch>
                        <Match when={entry.type === 'viewed'}><Icon name="eye" class="text-green-400" size="xs" /></Match>
                        <Match when={entry.type === 'downloaded'}><Icon name="download" class="text-blue-400" size="xs" /></Match>
                        <Match when={entry.type === 'shared'}><Icon name="share" class="text-amber-400" size="xs" /></Match>
                        <Match when={entry.type === 'deleted_attempt'}><Icon name="trash" class="text-red-400" size="xs" /></Match>
                      </Switch>
                    </div>
                    <Show when={idx() < ACCESS_HISTORY_MOCK.length - 1}>
                      <div class="w-0.5 min-h-[24px] bg-white/10 my-0.5" />
                    </Show>
                  </div>
                  <div class="flex-1 min-w-0 pb-4">
                    <p class="text-sm text-white/90">{entry.docName}</p>
                    <p class="text-xs text-white/50">{entry.time} · {entry.device}</p>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Section 7: Document Preview Modal */}
      <Show when={previewDoc()}>
        {(doc) => (
          <div
            class="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={() => setPreviewDoc(null)}
          >
            <div class="p-4 flex items-center justify-between border-b border-white/10">
              <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={() => setPreviewDoc(null)}>
                <Icon name="x" class="text-white" size="sm" />
              </button>
              <h2 class="text-white font-semibold truncate flex-1 mx-2">{docName(doc())}</h2>
            </div>
            <div class="flex-1 overflow-auto p-4" onClick={e => e.stopPropagation()}>
              <p class="text-white/60 text-sm">{doc().date}{doc().sender ? ` · ${doc().sender}` : ''}</p>
              <div class="mt-4 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center aspect-[3/4] min-h-[280px]">
                <Icon name="fileText" class="text-white/40 w-20 h-20" size="xl" />
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <span class={`text-xs px-2 py-1 rounded-full ${getStatusClass(doc().status)}`}>{t(getStatusKey(doc().status))}</span>
              </div>
            </div>
            <div class="p-4 border-t border-white/10 flex gap-2 flex-wrap">
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="download" size="sm" />
                {t('docs.download')}
              </button>
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2" onClick={() => { setPreviewDoc(null); openShare(doc()); }}>
                <Icon name="share" size="sm" />
                {t('docs.share')}
              </button>
              <button class="flex-1 min-w-[80px] py-2.5 rounded-xl glass text-white text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="printer" size="sm" />
                {t('docs.print')}
              </button>
              <button class="py-2.5 px-4 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="trash" size="sm" />
                {t('docs.delete')}
              </button>
            </div>
          </div>
        )}
      </Show>

      {/* Section 8: Upload Flow */}
      <Show when={showUpload()}>
        <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !uploading() && setShowUpload(false)}>
          <div class="w-full max-w-lg rounded-t-3xl glass border-t border-white/20 p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
            <Switch>
              <Match when={uploadSuccess()}>
                <div class="text-center py-4">
                  <div class="w-16 h-16 rounded-full bg-green-500/30 flex items-center justify-center mx-auto mb-3">
                    <Icon name="check" class="text-green-400 w-8 h-8" size="lg" />
                  </div>
                  <p class="text-white font-semibold text-lg">{t('docs.uploadSuccess')}</p>
                  <button class="mt-4 px-6 py-2 rounded-xl bg-indigo-500 text-white font-medium touch-scale" onClick={() => { setShowUpload(false); setUploadSuccess(false); }}>{t('nav.home')}</button>
                </div>
              </Match>
              <Match when={uploading()}>
                <div class="py-4">
                  <p class="text-white font-medium mb-2">{t('docs.uploading')}</p>
                  <div class="h-2 rounded-full bg-white/20 overflow-hidden">
                    <div class="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress()}%` }} />
                  </div>
                </div>
              </Match>
              <Match when={!uploading() && !uploadSuccess()}>
                <p class="text-white font-semibold mb-4">{t('docs.title')}</p>
                <div class="grid grid-cols-1 gap-2">
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="camera" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.takePhoto')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="image" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.chooseGallery')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="fileText" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.uploadFile')}</span>
                  </button>
                  <button class="flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left" onClick={startUpload}>
                    <Icon name="camera" class="text-indigo-400" size="sm" />
                    <span class="text-white">{t('docs.scanDocument')}</span>
                  </button>
                </div>
                <button class="mt-4 w-full py-2.5 rounded-xl border border-white/30 text-white/80 touch-scale" onClick={() => setShowUpload(false)}>{t('security.cancel')}</button>
              </Match>
            </Switch>
          </div>
        </div>
      </Show>

      {/* Section 10: Sharing Controls */}
      <Show when={showShare() && shareDoc()}>
        {(doc) => (
          <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowShare(false)}>
            <div class="w-full max-w-lg rounded-t-3xl glass border-t border-white/20 p-6 pb-10 animate-slide-up" onClick={e => e.stopPropagation()}>
              <p class="text-white font-semibold mb-4">{t('docs.share')}: {docName(doc())}</p>
              <div class="space-y-3">
                <button class="w-full flex items-center gap-3 p-3 rounded-xl glass touch-scale text-left">
                  <Icon name="send" class="text-indigo-400" size="sm" />
                  <span class="text-white">{t('docs.shareViaLink')}</span>
                </button>
                <div class="flex items-center gap-2">
                  <span class="text-white/70 text-sm">{t('docs.shareWithTimer')}</span>
                  <select
                    class="rounded-lg bg-white/10 text-white border border-white/20 px-3 py-2 text-sm"
                    value={shareTimer()}
                    onInput={e => setShareTimer((e.target as HTMLSelectElement).value)}
                  >
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>
                <label class="flex items-center gap-3 p-3 rounded-xl glass cursor-pointer">
                  <input type="checkbox" checked={sharePin()} onInput={e => setSharePin(e.currentTarget.checked)} class="rounded" />
                  <span class="text-white text-sm">{t('docs.requirePin')}</span>
                </label>
                <div class="rounded-xl bg-white/10 border border-white/20 p-3 flex items-center justify-between gap-2">
                  <code class="text-white/80 text-sm truncate">https://bolh.app/s/enc-xxxx</code>
                  <button class="flex-shrink-0 py-1.5 px-3 rounded-lg bg-indigo-500 text-white text-sm font-medium touch-scale" onClick={copyShareLink}>
                    {shareLinkCopied() ? t('docs.linkCopied') : t('docs.copyLink')}
                  </button>
                </div>
              </div>
              <button class="mt-4 w-full py-2.5 rounded-xl border border-white/30 text-white/80 touch-scale" onClick={() => setShowShare(false)}>{t('security.cancel')}</button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

// ============== Verification System ==============

function VerificationPage(props: { onBack: () => void }) {
  const [activeTab, setActiveTab] = createSignal<'status' | 'upload' | 'photo'>('status');

  const verificationItems = [
    { id: 'identity', name: 'Удостоверение личности', status: 'verified', icon: 'userCheck' },
    { id: 'phone', name: 'Номер телефона', status: 'verified', icon: 'phone' },
    { id: 'address', name: 'Адрес проживания', status: 'pending', icon: 'location' },
    { id: 'diploma', name: 'Диплом/Сертификат', status: 'not_submitted', icon: 'award' },
    { id: 'license', name: 'Лицензия охранника', status: 'not_submitted', icon: 'shield' },
    { id: 'background', name: 'Проверка судимости', status: 'pending', icon: 'checkCircle' },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'verified': return { bg: 'bg-green-100', text: 'text-green-700', label: '✓ Подтверждено' };
      case 'pending': return { bg: 'bg-amber-100', text: 'text-amber-700', label: '⏳ На проверке' };
      case 'rejected': return { bg: 'bg-red-100', text: 'text-red-700', label: '✗ Отклонено' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600', label: '○ Не отправлено' };
    }
  };

  const verificationScore = () => {
    const verified = verificationItems.filter(i => i.status === 'verified').length;
    return Math.round((verified / verificationItems.length) * 100);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-4">
          <button 
            class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
            onClick={props.onBack}
          >
            <Icon name="chevronLeft" class="text-gray-700" size="sm" />
          </button>
          <h1 class="text-xl font-bold text-white flex-1">Верификация</h1>
        </div>
      </div>

      {/* Verification Score */}
      <div class="px-4 mb-6">
        <div class="glass rounded-3xl p-5">
          <div class="flex items-center gap-4">
            <div class="relative">
              <svg class="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="36" stroke="#e5e7eb" stroke-width="8" fill="none" />
                <circle 
                  cx="40" cy="40" r="36" 
                  stroke="url(#gradient)" 
                  stroke-width="8" 
                  fill="none"
                  stroke-linecap="round"
                  stroke-dasharray={`${verificationScore() * 2.26} 226`}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#6366f1" />
                    <stop offset="100%" stop-color="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-2xl font-bold text-gray-800">{verificationScore()}%</span>
              </div>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-gray-800 text-lg">Уровень доверия</p>
              <p class="text-sm text-gray-500 mt-1">
                {verificationScore() >= 80 ? 'Высокий уровень верификации' :
                 verificationScore() >= 50 ? 'Средний уровень. Загрузите документы' :
                 'Низкий уровень. Пройдите проверку'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="px-4 mb-4">
        <div class="flex gap-2">
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'status' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('status')}
          >
            Статус
          </button>
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'upload' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            Загрузить
          </button>
          <button
            class={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
              activeTab() === 'photo' ? 'bg-indigo-600 text-white' : 'glass text-gray-700'
            }`}
            onClick={() => setActiveTab('photo')}
          >
            Фото на месте
          </button>
        </div>
      </div>

      <Switch>
        {/* Status Tab */}
        <Match when={activeTab() === 'status'}>
          <div class="px-4 space-y-3">
            <For each={verificationItems}>
              {(item, i) => {
                const status = getStatusStyle(item.status);
                return (
                  <div 
                    class="glass rounded-2xl p-4 animate-slide-up"
                    style={`animation-delay: ${i() * 0.05}s`}
                  >
                    <div class="flex items-center gap-4">
                      <div class={`w-12 h-12 rounded-xl ${
                        item.status === 'verified' ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
                        item.status === 'pending' ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                        'bg-gradient-to-br from-gray-300 to-gray-400'
                      } flex items-center justify-center`}>
                        <Icon name={item.icon as any} class="text-white" size="sm" />
                      </div>
                      
                      <div class="flex-1">
                        <p class="font-medium text-gray-800">{item.name}</p>
                        <span class={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                      </div>

                      <Show when={item.status === 'not_submitted'}>
                        <button class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium touch-scale">
                          Загрузить
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Match>

        {/* Upload Tab */}
        <Match when={activeTab() === 'upload'}>
          <div class="px-4 space-y-4">
            <div class="glass rounded-3xl p-5 border-2 border-dashed border-indigo-300">
              <div class="text-center">
                <div class="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="uploadCloud" class="text-indigo-600" size="lg" />
                </div>
                <p class="font-semibold text-gray-800 mb-1">Загрузить документ</p>
                <p class="text-sm text-gray-500 mb-4">PDF, JPG или PNG до 10 MB</p>
                <button class="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium touch-scale">
                  Выбрать файл
                </button>
              </div>
            </div>

            <div class="glass rounded-2xl p-4">
              <p class="font-medium text-gray-800 mb-3">Требования к документам:</p>
              <ul class="space-y-2 text-sm text-gray-600">
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-green-500" size="xs" />
                  Чёткое фото без бликов
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-green-500" size="xs" />
                  Все углы документа видны
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-green-500" size="xs" />
                  Текст легко читается
                </li>
                <li class="flex items-center gap-2">
                  <Icon name="check" class="text-green-500" size="xs" />
                  Документ действителен
                </li>
              </ul>
            </div>

            {/* Privacy notice */}
            <div class="glass rounded-2xl p-4 border border-green-200 bg-green-50/50">
              <div class="flex items-start gap-3">
                <Icon name="lock" class="text-green-600" size="sm" />
                <div>
                  <p class="font-medium text-green-800">Конфиденциальность</p>
                  <p class="text-xs text-green-700 mt-1">
                    Документы шифруются и хранятся в защищённом хранилище. 
                    Доступ только у вас и верификаторов.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Match>

        {/* Photo Verification Tab */}
        <Match when={activeTab() === 'photo'}>
          <div class="px-4 space-y-4">
            {/* Camera preview placeholder */}
            <div class="glass rounded-3xl overflow-hidden">
              <div class="aspect-[4/3] bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                <div class="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center mb-4">
                  <Icon name="camera" class="text-white/50" size="xl" />
                </div>
                <p class="text-white/70 font-medium">Камера для верификации</p>
                <p class="text-white/50 text-sm mt-1">Сделайте фото на месте работы</p>
              </div>
              
              <div class="p-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                <div class="flex items-center justify-between text-white">
                  <div class="flex items-center gap-2">
                    <Icon name="location" size="sm" />
                    <span class="text-sm">GPS: Готово</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Icon name="clock" size="sm" />
                    <span class="text-sm">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div class="glass rounded-2xl p-4">
              <p class="font-medium text-gray-800 mb-3">Как это работает:</p>
              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">1</div>
                  <p class="text-sm text-gray-600">Охранник прибывает на место и делает селфи</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">2</div>
                  <p class="text-sm text-gray-600">Фото привязывается к GPS-координатам и времени</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">3</div>
                  <p class="text-sm text-gray-600">Клиент получает уведомление и подтверждает</p>
                </div>
                <div class="flex items-start gap-3">
                  <div class="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-indigo-600">4</div>
                  <p class="text-sm text-gray-600">Фото автоматически удаляется через 24 часа</p>
                </div>
              </div>
            </div>

            {/* Auto-delete notice */}
            <div class="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/50">
              <div class="flex items-start gap-3">
                <Icon name="trash" class="text-amber-600" size="sm" />
                <div>
                  <p class="font-medium text-amber-800">Авто-удаление</p>
                  <p class="text-xs text-amber-700 mt-1">
                    Для защиты конфиденциальности все фото верификации 
                    автоматически удаляются из системы через 24 часа после подтверждения.
                  </p>
                </div>
              </div>
            </div>

            {/* Take photo button */}
            <button class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-xl touch-scale flex items-center justify-center gap-2">
              <Icon name="camera" class="text-white" size="sm" />
              Сделать фото
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

// ============== Academy Game ==============
function AcademyGamePage(props: { onBack: () => void }) {
  const [currentModule, setCurrentModule] = createSignal<string | null>(null);
  const [currentLevel, setCurrentLevel] = createSignal(0);
  const [score, setScore] = createSignal(0);
  const [streak, setStreak] = createSignal(0);
  const [showResult, setShowResult] = createSignal(false);
  const [lastAnswer, setLastAnswer] = createSignal<'correct' | 'wrong' | null>(null);
  const [selectedAnswer, setSelectedAnswer] = createSignal<number | null>(null);
  const [gameStarted, setGameStarted] = createSignal(false);
  const [lives, setLives] = createSignal(3);
  const [totalProgress, setTotalProgress] = createSignal(0);

  // Use global sound system
  const soundEnabled = globalSoundEnabled;
  const setSoundEnabled = setGlobalSoundEnabled;
  const playSound = (type: 'correct' | 'wrong' | 'levelup' | 'click') => {
    if (type === 'correct') playGlobalSound('success');
    else if (type === 'wrong') playGlobalSound('error');
    else if (type === 'levelup') playGlobalSound('levelup');
    else playGlobalSound('tap');
  };

  // Training modules
  // Training modules with difficulty levels (d: 1=easy, 2=medium, 3=hard)
  // SECTION 1: Professional department modules (9 departments)
  // SECTION 2: General safety modules (fire, first aid, rescue, hazmat, security, emergency, traffic)

  const professionalModules = [
    // ═══════ 1. PLUMBING ═══════
    {
      id: 'pro_plumbing',
      name: 'Сантехника: правила и стандарты',
      nameEn: 'Plumbing: Rules & Standards',
      icon: 'settings',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-100',
      description: 'ISO 21542, безопасность труб, водоснабжение',
      dept: 'plumbing',
      levels: [
        { title: 'Главный кран', question: 'Первое действие при аварии водоснабжения?', image: '🔧', options: ['Вызвать мастера', 'Перекрыть главный кран', 'Подставить ведро', 'Позвонить соседям'], correct: 1, explanation: 'Всегда перекрывайте главный кран! Это минимизирует ущерб.', titleEn: 'Main Valve', questionEn: 'First action during a water emergency?', optionsEn: ['Call a plumber', 'Shut off the main valve', 'Place a bucket', 'Call neighbors'], explanationEn: 'Always shut off the main valve! This minimizes damage.', d: 1 },
        { title: 'Давление воды', question: 'Нормальное давление воды в квартире?', image: '💧', options: ['0.5 бар', '1.5-4 бар', '8-10 бар', '15 бар'], correct: 1, explanation: 'Стандарт: 1.5-4 бар. Выше 6 бар нужен редуктор.', titleEn: 'Water Pressure', questionEn: 'Normal water pressure in an apartment?', optionsEn: ['0.5 bar', '1.5-4 bar', '8-10 bar', '15 bar'], explanationEn: 'Standard: 1.5-4 bar. Above 6 bar requires a pressure reducer.', d: 1 },
        { title: 'Сифон', question: 'Зачем нужен сифон под раковиной?', image: '🚰', options: ['Для красоты', 'Блокирует запах канализации', 'Для фильтрации', 'Для нагрева воды'], correct: 1, explanation: 'Водяной затвор в сифоне блокирует газы из канализации.', titleEn: 'Trap/Siphon', questionEn: 'Why is a trap needed under the sink?', optionsEn: ['For appearance', 'Blocks sewer gases', 'For filtration', 'To heat water'], explanationEn: 'The water seal in the trap blocks gases from the sewer.', d: 1 },
        { title: 'Тефлоновая лента', question: 'Как наматывать ФУМ-ленту на резьбу?', image: '🔩', options: ['Против резьбы', 'По ходу резьбы', 'Неважно', 'Крест-накрест'], correct: 1, explanation: 'По ходу резьбы (по часовой стрелке) — чтобы не разматывалась.', titleEn: 'PTFE Tape', questionEn: 'How to wrap PTFE tape on threads?', optionsEn: ['Against the thread', 'With the thread direction', 'Doesn\'t matter', 'Criss-cross'], explanationEn: 'With the thread direction (clockwise) — so it doesn\'t unravel.', d: 1 },
        { title: 'Температура воды', question: 'Безопасная температура горячей воды?', image: '🌡️', options: ['70°C', '60°C для хранения, 49°C на выходе', '30°C', '90°C'], correct: 1, explanation: '60°C убивает легионеллу, но на выходе крана ≤49°C чтобы не обжечь.', titleEn: 'Water Temperature', questionEn: 'Safe hot water temperature?', optionsEn: ['70°C', '60°C for storage, 49°C at outlet', '30°C', '90°C'], explanationEn: '60°C kills Legionella, but outlet must be ≤49°C to prevent scalding.', d: 2 },
        { title: 'Медные трубы', question: 'Почему нельзя соединять медь и сталь напрямую?', image: '🔗', options: ['Разный диаметр', 'Электрохимическая коррозия', 'Слишком дорого', 'Не держит давление'], correct: 1, explanation: 'Гальваническая коррозия разрушает стык. Нужен диэлектрик.', d: 2 },
        { title: 'Обратный клапан', question: 'Где обязателен обратный клапан?', image: '🔄', options: ['На холодной воде', 'На вводе водонагревателя', 'На сливе', 'Нигде'], correct: 1, explanation: 'Обратный клапан на бойлере предотвращает обратный поток горячей воды.', d: 2 },
        { title: 'Засор', question: 'Чем НЕЛЬЗЯ прочищать пластиковые трубы?', image: '🚿', options: ['Вантуз', 'Кислотные средства', 'Трос', 'Горячая вода'], correct: 1, explanation: 'Кислота может растворить пластик! Используйте щелочные средства.', d: 2 },
        { title: 'Уклон канализации', question: 'Минимальный уклон канализационной трубы 110мм?', image: '📐', options: ['0.5 см/м', '2 см/м', '5 см/м', '10 см/м'], correct: 1, explanation: 'Стандарт СНиП: 2 см на метр для трубы 110мм.', d: 2 },
        { title: 'Гидроудар', question: 'Что вызывает гидроудар?', image: '💥', options: ['Холодная вода', 'Резкое закрытие крана', 'Фильтр', 'Низкое давление'], correct: 1, explanation: 'Быстрое закрытие создаёт ударную волну. Решение — компенсатор.', d: 3 },
        { title: 'Легионелла', question: 'При какой температуре размножается легионелла?', image: '🦠', options: ['0-10°C', '20-45°C', '60-80°C', '90°C+'], correct: 1, explanation: 'Опасная зона 20-45°C. Бойлер держите на 60°C минимум.', d: 3 },
        { title: 'PPR трубы', question: 'Температура пайки полипропилена?', image: '🔥', options: ['100°C', '260°C', '400°C', '500°C'], correct: 1, explanation: '260°C — стандарт для пайки PPR труб. Перегрев сужает проход.', d: 3 },
      ]
    },
    // ═══════ 2. ELECTRICAL ═══════
    {
      id: 'pro_electrical',
      name: 'Электрика: безопасность и нормы',
      nameEn: 'Electrical: Safety & Codes',
      icon: 'zap',
      color: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-100',
      description: 'IEC, NEC стандарты, защита от тока',
      dept: 'electrical',
      levels: [
        { title: 'Смертельный ток', question: 'Какой ток опасен для жизни?', image: '⚡', options: ['10 А', '0.1 А (100 мА)', '5 А', '50 А'], correct: 1, explanation: '100 мА через сердце = фибрилляция. Даже 30 мА может убить.', titleEn: 'Lethal Current', questionEn: 'What current is dangerous to life?', optionsEn: ['10 A', '0.1 A (100 mA)', '5 A', '50 A'], explanationEn: '100 mA through the heart = fibrillation. Even 30 mA can be lethal.', d: 1 },
        { title: 'УЗО', question: 'Что такое УЗО/RCD и зачем?', image: '🔌', options: ['Счётчик', 'Защита от утечки тока', 'Усилитель', 'Выключатель'], correct: 1, explanation: 'RCD отключает при утечке 30 мА за 0.03 сек — спасает жизнь.', titleEn: 'RCD/GFCI', questionEn: 'What is an RCD and what is it for?', optionsEn: ['Meter', 'Protection from current leakage', 'Amplifier', 'Switch'], explanationEn: 'RCD trips on 30 mA leakage in 0.03 sec — saves lives.', d: 1 },
        { title: 'Заземление', question: 'Цвет провода заземления по МЭК?', image: '🔗', options: ['Красный', 'Жёлто-зелёный', 'Синий', 'Белый'], correct: 1, explanation: 'Жёлто-зелёный = земля (PE). Синий = нейтраль. Коричневый/чёрный = фаза.', titleEn: 'Grounding', questionEn: 'IEC ground wire color?', optionsEn: ['Red', 'Yellow-green', 'Blue', 'White'], explanationEn: 'Yellow-green = ground (PE). Blue = neutral. Brown/black = live.', d: 1 },
        { title: 'Автомат', question: 'Когда срабатывает автомат на 16А?', image: '🔧', options: ['Всегда', 'При перегрузке или КЗ', 'При низком напряжении', 'Никогда'], correct: 1, explanation: 'При перегрузке (тепловой расцеп.) и коротком замыкании (электромагн.).', titleEn: 'Circuit Breaker', questionEn: 'When does a 16A breaker trip?', optionsEn: ['Always', 'On overload or short circuit', 'On low voltage', 'Never'], explanationEn: 'On overload (thermal) and short circuit (electromagnetic).', d: 1 },
        { title: 'Сечение провода', question: 'Сечение кабеля для розеток 16А?', image: '📏', options: ['1.0 мм²', '1.5 мм²', '2.5 мм²', '4.0 мм²'], correct: 2, explanation: '2.5 мм² для розеток (16А). 1.5 мм² — для освещения (10А).', titleEn: 'Wire Gauge', questionEn: 'Cable cross-section for 16A outlets?', optionsEn: ['1.0 mm²', '1.5 mm²', '2.5 mm²', '4.0 mm²'], explanationEn: '2.5 mm² for outlets (16A). 1.5 mm² for lighting (10A).', d: 2 },
        { title: 'Дуга', question: 'Что вызывает электрическую дугу?', image: '🔥', options: ['Мокрые руки', 'Плохой контакт/зазор', 'Длинный кабель', 'Тёмное помещение'], correct: 1, explanation: 'Плохой контакт, окисление, ослабленный зажим = искра → пожар.', titleEn: 'Arc Flash', questionEn: 'What causes an electrical arc?', optionsEn: ['Wet hands', 'Poor contact/gap', 'Long cable', 'Dark room'], explanationEn: 'Poor contact, oxidation, loose terminal = spark → fire.', d: 2 },
        { title: 'Мокрые помещения', question: 'Класс защиты розетки в ванной?', image: '🚿', options: ['IP20', 'IP44', 'IP65', 'IP00'], correct: 1, explanation: 'IP44 минимум. Зона 0 (душ) — никаких розеток. Зона 2 — IP44+.', titleEn: 'Wet Rooms', questionEn: 'IP rating for bathroom outlet?', optionsEn: ['IP20', 'IP44', 'IP65', 'IP00'], explanationEn: 'IP44 minimum. Zone 0 (shower) — no outlets. Zone 2 — IP44+.', d: 2 },
        { title: 'LOTO', question: 'Что такое LOTO в электрике?', image: '🔒', options: ['Лотерея', 'Lockout/Tagout', 'Тип провода', 'Лампа'], correct: 1, explanation: 'Lock Out / Tag Out — блокировка и маркировка перед работой. Стандарт OSHA.', titleEn: 'LOTO', questionEn: 'What is LOTO in electrical work?', optionsEn: ['Lottery', 'Lockout/Tagout', 'Wire type', 'Lamp'], explanationEn: 'Lock Out / Tag Out — lock and tag before work. OSHA standard.', d: 2 },
        { title: 'Кондиционер линия', question: 'Нужна ли отдельная линия для кондиционера?', image: '❄️', options: ['Нет, любая розетка', 'Да, отдельный автомат', 'Через удлинитель', 'Через соседнюю розетку'], correct: 1, explanation: 'Кондиционер требует отдельную линию с автоматом и УЗО.', titleEn: 'AC Circuit', questionEn: 'Does an AC unit need a dedicated circuit?', optionsEn: ['No, any outlet', 'Yes, dedicated breaker', 'Via extension cord', 'From adjacent outlet'], explanationEn: 'AC requires a dedicated circuit with breaker and RCD.', d: 2 },
        { title: 'Электроожог', question: 'Первая помощь при электроожоге?', image: '🤕', options: ['Мазь', 'Отключить ток, CPR, 112', 'Вода', 'Растирание'], correct: 1, explanation: 'Отключить источник! Не трогать голыми руками. CPR при остановке сердца.', titleEn: 'Electric Shock', questionEn: 'First aid for electric shock?', optionsEn: ['Ointment', 'Cut power, CPR, 112', 'Water', 'Rub'], explanationEn: 'Cut power source! Don\'t touch with bare hands. CPR if cardiac arrest.', d: 3 },
        { title: 'Фаза на выключатель', question: 'Почему фазу ведут через выключатель?', image: '💡', options: ['Для экономии', 'Чтобы при выключении лампа была обесточена', 'Неважно', 'Для яркости'], correct: 1, explanation: 'Если нейтраль через выключатель — патрон под напряжением даже выключенный!', d: 3 },
        { title: 'Селективность', question: 'Что такое селективность автоматов?', image: '📊', options: ['Один автомат', 'Отключается только ближайший к аварии', 'Все отключаются', 'Дизайн щита'], correct: 1, explanation: 'При КЗ срабатывает только автомат на повреждённой линии, остальные работают.', titleEn: 'Selectivity', questionEn: 'What is breaker selectivity?', optionsEn: ['One breaker', 'Only the breaker nearest the fault trips', 'All trip', 'Panel design'], explanationEn: 'On short circuit only the faulted circuit\'s breaker trips, others stay on.', d: 3 },
      ]
    },
    // ═══════ 3. LOCKS & DOORS ═══════
    {
      id: 'pro_locks',
      name: 'Замки: безопасность и стандарты',
      nameEn: 'Locks: Security & Standards',
      icon: 'lock',
      color: 'from-slate-500 to-gray-700',
      bgColor: 'bg-slate-100',
      description: 'EN 12209, классы замков, методы вскрытия',
      dept: 'locks',
      levels: [
        { title: 'Типы замков', question: 'Какой замок самый надёжный для входной двери?', image: '🔐', options: ['Навесной', 'Сувальдный + цилиндровый', 'Щеколда', 'Электронный (только)'], correct: 1, explanation: 'Комбинация двух типов — сувальдный + цилиндровый — максимальная защита.', titleEn: 'Lock Types', questionEn: 'Which lock is most secure for an entry door?', optionsEn: ['Padlock', 'Lever tumbler + cylinder', 'Latch', 'Electronic only'], explanationEn: 'Combination of two types — lever tumbler + cylinder — maximum protection.', d: 1 },
        { title: 'Цилиндр', question: 'Что означает класс Euro Profile?', image: '🔑', options: ['Европейский дизайн', 'Стандартный размер цилиндра DIN', 'Дорогой замок', 'Электронный'], correct: 1, explanation: 'Euro Profile (DIN) — стандарт размера цилиндра, совместим со всеми замками.', titleEn: 'Cylinder', questionEn: 'What does Euro Profile class mean?', optionsEn: ['European design', 'Standard DIN cylinder size', 'Expensive lock', 'Electronic'], explanationEn: 'Euro Profile (DIN) — standard cylinder size, compatible with all locks.', d: 1 },
        { title: 'Броненакладка', question: 'Зачем нужна броненакладка?', image: '🛡️', options: ['Декор', 'Защита цилиндра от высверливания/выбивания', 'Звукоизоляция', 'От ржавчины'], correct: 1, explanation: 'Броненакладка из закалённой стали защищает от физического взлома.', titleEn: 'Cylinder Guard', questionEn: 'Why is a cylinder guard needed?', optionsEn: ['Decoration', 'Protects cylinder from drilling/bumping', 'Sound insulation', 'Rust prevention'], explanationEn: 'Reinforced plate of hardened steel protects against physical break-in.', d: 1 },
        { title: 'Бампинг', question: 'Что такое бампинг замка?', image: '🔨', options: ['Удар по двери', 'Вскрытие спецключом + удар', 'Сверление', 'Отмычка'], correct: 1, explanation: 'Bump key + удар выстраивает пины. Защита: антибампинговые цилиндры.', titleEn: 'Lock Bumping', questionEn: 'What is lock bumping?', optionsEn: ['Hitting the door', 'Special key + impact to align pins', 'Drilling', 'Picking'], explanationEn: 'Bump key + impact aligns pins. Protection: anti-bump cylinders.', d: 2 },
        { title: 'Класс безопасности', question: 'Сколько классов взломостойкости по EN 12209?', image: '📊', options: ['2', '3', '5', '7'], correct: 2, explanation: 'EN 12209: 5 классов (1-5). Класс 5 — максимальная взломостойкость.', d: 2 },
        { title: 'Мастер-система', question: 'Что такое мастер-система?', image: '🗝️', options: ['Один ключ открывает все', 'Много ключей к одному замку', 'Электронный замок', 'Кодовый замок'], correct: 0, explanation: 'Один мастер-ключ открывает все замки системы. Каждый свой — только свой.', titleEn: 'Master Key System', questionEn: 'What is a master key system?', optionsEn: ['One key opens all', 'Many keys to one lock', 'Electronic lock', 'Keypad lock'], explanationEn: 'One master key opens all locks in the system. Each user key opens only its lock.', d: 2 },
        { title: 'Дверная коробка', question: 'Главное слабое место — замок или коробка?', image: '🚪', options: ['Замок', 'Дверная коробка и притвор', 'Ключ', 'Ручка'], correct: 1, explanation: 'Чаще выбивают коробку. Усиленная стальная коробка + длинные анкера.', titleEn: 'Door Frame', questionEn: 'Main weak point — lock or frame?', optionsEn: ['Lock', 'Door frame and strike', 'Key', 'Handle'], explanationEn: 'Frames are kicked in most often. Reinforced steel frame + long anchors.', d: 2 },
        { title: 'Электронный замок', question: 'Питание электрозамка отключилось. Что произойдёт?', image: '🔋', options: ['Заблокируется навсегда', 'Зависит от типа: Fail-Safe или Fail-Secure', 'Откроется', 'Сирена'], correct: 1, explanation: 'Fail-Safe открывается (для эвакуации). Fail-Secure остаётся закрытым.', titleEn: 'Electric Lock', questionEn: 'Power failed on electric lock. What happens?', optionsEn: ['Locks permanently', 'Depends on type: Fail-Safe or Fail-Secure', 'Opens', 'Alarm'], explanationEn: 'Fail-Safe opens (for evacuation). Fail-Secure stays locked.', d: 3 },
        { title: 'Пожарные двери', question: 'Требование к замку пожарной двери?', image: '🔥', options: ['Максимальная защита', 'Открываться без ключа изнутри', 'Не иметь замка', 'Автоматический'], correct: 1, explanation: 'EN 179/1125: Panic exit — открытие нажатием/давлением без ключа!', titleEn: 'Fire Doors', questionEn: 'Requirement for fire door lock?', optionsEn: ['Maximum security', 'Open without key from inside', 'No lock allowed', 'Automatic'], explanationEn: 'EN 179/1125: Panic exit — opens by push/pressure without key!', d: 3 },
        { title: 'Anti-snap', question: 'Что такое anti-snap цилиндр?', image: '💪', options: ['Гибкий цилиндр', 'Ломается в безопасной точке, замок остаётся', 'Не ломается', 'Из пластика'], correct: 1, explanation: 'Anti-snap ломается в точке разлома, но ядро и замок остаются защищены.', d: 3 },
      ]
    },
    // ═══════ 4. TECH REPAIR ═══════
    {
      id: 'pro_tech',
      name: 'Ремонт техники: правила',
      nameEn: 'Tech Repair: Rules & Safety',
      icon: 'settings',
      color: 'from-violet-500 to-purple-700',
      bgColor: 'bg-violet-100',
      description: 'ESD защита, диагностика, стандарты',
      dept: 'tech',
      levels: [
        { title: 'ESD', question: 'Что такое ESD и почему опасно?', image: '⚡', options: ['Экран', 'Статический разряд — убивает микросхемы', 'Программа', 'Ошибка'], correct: 1, explanation: 'ESD: 20В убивает чип. Человек чувствует только от 3000В!', titleEn: 'ESD', questionEn: 'What is ESD and why is it dangerous?', optionsEn: ['Screen', 'Static discharge — kills microchips', 'Program', 'Error'], explanationEn: 'ESD: 20V kills a chip. Humans only feel from 3000V!', d: 1 },
        { title: 'Антистатика', question: 'Обязательное при ремонте ПК внутри?', image: '🖥️', options: ['Перчатки', 'Антистатический браслет', 'Шапка', 'Ботинки'], correct: 1, explanation: 'ESD-браслет заземляет вас и защищает компоненты.', titleEn: 'Antistatic', questionEn: 'Required when repairing PC internals?', optionsEn: ['Gloves', 'Antistatic wrist strap', 'Cap', 'Boots'], explanationEn: 'ESD wrist strap grounds you and protects components.', d: 1 },
        { title: 'Мультиметр', question: 'Чем измеряют напряжение?', image: '📊', options: ['Отвёрткой', 'Мультиметром', 'Термометром', 'Линейкой'], correct: 1, explanation: 'Мультиметр: напряжение, ток, сопротивление — основной инструмент.', titleEn: 'Multimeter', questionEn: 'What measures voltage?', optionsEn: ['Screwdriver', 'Multimeter', 'Thermometer', 'Ruler'], explanationEn: 'Multimeter: voltage, current, resistance — essential tool.', d: 1 },
        { title: 'Конденсатор', question: 'Чем опасен конденсатор в телевизоре/микроволновке?', image: '💥', options: ['Запахом', 'Хранит смертельный заряд даже выключенный', 'Весом', 'Температурой'], correct: 1, explanation: 'Конденсатор в СВЧ = до 4000В! Всегда разряжайте перед работой.', titleEn: 'Capacitor', questionEn: 'Why is a capacitor in a TV/microwave dangerous?', optionsEn: ['Smell', 'Holds lethal charge even when off', 'Weight', 'Temperature'], explanationEn: 'Capacitor in microwave = up to 4000V! Always discharge before work.', d: 2 },
        { title: 'Термопаста', question: 'Как часто менять термопасту на CPU?', image: '🌡️', options: ['Никогда', 'Каждый месяц', 'Раз в 2-3 года', 'Каждый день'], correct: 2, explanation: 'Каждые 2-3 года. Высохшая паста = перегрев = throttling.', titleEn: 'Thermal Paste', questionEn: 'How often to replace thermal paste on CPU?', optionsEn: ['Never', 'Every month', 'Every 2-3 years', 'Every day'], explanationEn: 'Every 2-3 years. Dried paste = overheating = throttling.', d: 2 },
        { title: 'Компрессор', question: 'Чем чистить пыль внутри ПК?', image: '💨', options: ['Пылесосом', 'Сжатым воздухом', 'Мокрой тряпкой', 'Феном'], correct: 1, explanation: 'Сжатый воздух! Пылесос создаёт статику. Фен — горячий воздух.', titleEn: 'Compressed Air', questionEn: 'How to clean dust inside a PC?', optionsEn: ['Vacuum', 'Compressed air', 'Wet cloth', 'Hair dryer'], explanationEn: 'Compressed air! Vacuum creates static. Hair dryer = hot air.', d: 1 },
        { title: 'BIOS reset', question: 'Как сбросить BIOS?', image: '🔧', options: ['Удалить файл', 'Вынуть батарейку CMOS', 'Переустановить ОС', 'Ударить'], correct: 1, explanation: 'Батарейка CR2032 + перемычка Clear CMOS на 10 секунд.', titleEn: 'BIOS Reset', questionEn: 'How to reset BIOS?', optionsEn: ['Delete file', 'Remove CMOS battery', 'Reinstall OS', 'Physical impact'], explanationEn: 'CR2032 battery + Clear CMOS jumper for 10 seconds.', d: 2 },
        { title: 'Правильная отвёртка', question: 'Почему важен правильный размер отвёртки?', image: '🔩', options: ['Скорость', 'Не сорвать шлиц/головку', 'Красота', 'Неважно'], correct: 1, explanation: 'Неподходящая отвёртка срывает шлиц. Потом болт не выкрутить!', titleEn: 'Correct Screwdriver', questionEn: 'Why is the correct screwdriver size important?', optionsEn: ['Speed', 'Avoid stripping the head', 'Appearance', 'Doesn\'t matter'], explanationEn: 'Wrong size strips the screw head. Then the bolt cannot be removed!', d: 1 },
        { title: 'Резервная копия', question: 'Правило 3-2-1 для бэкапов?', image: '💾', options: ['3 файла', '3 копии, 2 типа носителя, 1 вне здания', 'Раз в 3 дня', '3 диска'], correct: 1, explanation: '3 копии данных, на 2 типах носителей, 1 копия в другом месте.', d: 3 },
        { title: 'SSD vs HDD', question: 'Можно ли восстановить данные с SSD после TRIM?', image: '💿', options: ['Легко', 'Практически невозможно', 'Всегда', 'С программой'], correct: 1, explanation: 'TRIM обнуляет ячейки. Восстановление после TRIM почти невозможно!', d: 3 },
        { title: 'Пайка', question: 'Температура пайки электроники (бессвинцовый)?', image: '🔥', options: ['100°C', '250°C', '350-370°C', '500°C'], correct: 2, explanation: '350-370°C для бессвинцового припоя. Свинцовый: 300-320°C.', d: 3 },
      ]
    },
    // ═══════ 5. HANDYMAN ═══════
    {
      id: 'pro_handyman',
      name: 'Домашний мастер: стандарты',
      nameEn: 'Handyman: Standards & Skills',
      icon: 'settings',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-orange-100',
      description: 'Инструменты, мебель, отделка, безопасность',
      dept: 'handyman',
      levels: [
        { title: 'Дюбель в бетон', question: 'Чем сверлить бетон?', image: '🔩', options: ['Обычным сверлом', 'Перфоратором с буром', 'Шуруповёртом', 'Отвёрткой'], correct: 1, explanation: 'Перфоратор (ударное сверление) + бур SDS. Дрель не справится.', titleEn: 'Concrete Anchor', questionEn: 'How to drill concrete?', optionsEn: ['Regular drill bit', 'Hammer drill with masonry bit', 'Screwdriver', 'Screwdriver bit'], explanationEn: 'Hammer drill (impact) + SDS masonry bit. Regular drill won\'t work.', d: 1 },
        { title: 'Уровень', question: 'Зачем проверять уровнем?', image: '📏', options: ['Для красоты', 'Горизонтальность и вертикальность', 'Измерить длину', 'Найти провода'], correct: 1, explanation: 'Строительный уровень/лазер — всё должно быть ровно!', titleEn: 'Level', questionEn: 'Why check with a level?', optionsEn: ['For looks', 'Horizontal and vertical alignment', 'Measure length', 'Find wires'], explanationEn: 'Spirit level/laser — everything must be level!', d: 1 },
        { title: 'Скрытая проводка', question: 'Как найти провод в стене?', image: '🔌', options: ['Наугад', 'Детектором скрытой проводки', 'По звуку', 'По температуре'], correct: 1, explanation: 'Детектор проводки обязателен! Просверлить провод = КЗ или удар током.', titleEn: 'Hidden Wiring', questionEn: 'How to locate wires in a wall?', optionsEn: ['Guess', 'Cable/wire detector', 'By sound', 'By temperature'], explanationEn: 'Cable detector is essential! Drilling into a wire = short circuit or electric shock.', d: 1 },
        { title: 'Гипсокартон нагрузка', question: 'Максимальная нагрузка на дюбель в гипсокартоне?', image: '📺', options: ['50 кг', '5-15 кг (обычный дюбель)', '100 кг', '1 кг'], correct: 1, explanation: '5-15 кг на дюбель-бабочку. Тяжёлое (ТВ) — только в профиль/стену за ГКЛ!', titleEn: 'Drywall Load', questionEn: 'Max load for anchor in drywall?', optionsEn: ['50 kg', '5-15 kg (toggle anchor)', '100 kg', '1 kg'], explanationEn: '5-15 kg per toggle anchor. Heavy items (TV) — only into stud or wall behind drywall!', d: 2 },
        { title: 'Герметик', question: 'Через сколько схватывается силиконовый герметик?', image: '🧴', options: ['Мгновенно', 'Поверхность: 20 мин, полностью: 24ч', '5 минут', '1 неделя'], correct: 1, explanation: 'Корка за 20 минут. Полная полимеризация — 24 часа. Не мочить!', titleEn: 'Silicone Sealant', questionEn: 'Silicone sealant cure time?', optionsEn: ['Instant', 'Skin: 20 min, fully cured: 24h', '5 minutes', '1 week'], explanationEn: 'Skin in 20 minutes. Full cure — 24 hours. Don\'t get wet!', d: 2 },
        { title: 'Типы дюбелей', question: 'Какой дюбель для пустотелого кирпича?', image: '🧱', options: ['Обычный пластиковый', 'Химический анкер или дюбель-бабочка', 'Деревянный', 'Без дюбеля'], correct: 1, explanation: 'Пустотелый кирпич: химический анкер или специальные распорные дюбели.', titleEn: 'Anchor Types', questionEn: 'Which anchor for hollow brick?', optionsEn: ['Regular plastic', 'Chemical anchor or toggle', 'Wooden', 'No anchor'], explanationEn: 'Hollow brick: chemical anchor or special toggle anchors.', d: 2 },
        { title: 'Ламинат зазор', question: 'Зазор ламината от стены?', image: '🏠', options: ['Впритык', '8-10 мм', '50 мм', '1 мм'], correct: 1, explanation: '8-10 мм — температурный зазор. Ламинат расширяется при нагреве!', titleEn: 'Laminate Gap', questionEn: 'Laminate expansion gap from wall?', optionsEn: ['Flush', '8-10 mm', '50 mm', '1 mm'], explanationEn: '8-10 mm — thermal expansion gap. Laminate expands when heated!', d: 2 },
        { title: 'Плиточный клей', question: 'Через сколько можно ходить по плитке?', image: '🧱', options: ['Сразу', 'Через 24-48 часов', 'Через 1 час', 'Через неделю'], correct: 1, explanation: '24-48 часов. Затирку швов — через 24 часа после укладки.', titleEn: 'Tile Adhesive', questionEn: 'When can you walk on newly laid tile?', optionsEn: ['Immediately', 'After 24-48 hours', 'After 1 hour', 'After a week'], explanationEn: '24-48 hours. Grout joints — 24 hours after laying.', d: 2 },
        { title: 'Мебель крепёж', question: 'Чем скрепить мебель из ЛДСП (IKEA-тип)?', image: '🪑', options: ['Гвоздями', 'Конфирмат (евровинт)', 'Клеем', 'Скотчем'], correct: 1, explanation: 'Конфирмат (6.4×50) — стандартный мебельный крепёж для ЛДСП.', titleEn: 'Furniture Fasteners', questionEn: 'How to join particleboard furniture (IKEA-type)?', optionsEn: ['Nails', 'Confirmat (euro screw)', 'Glue', 'Tape'], explanationEn: 'Confirmat (6.4×50) — standard furniture fastener for particleboard.', d: 1 },
        { title: 'Малярный скотч', question: 'Когда снимать малярный скотч?', image: '🎨', options: ['После высыхания', 'Пока краска влажная', 'Через неделю', 'Никогда'], correct: 1, explanation: 'Снимать пока краска не высохла полностью! Иначе отрывает вместе с краской.', titleEn: 'Painter\'s Tape', questionEn: 'When to remove painter\'s tape?', optionsEn: ['After paint dries', 'While paint is still wet', 'After a week', 'Never'], explanationEn: 'Remove before paint fully dries! Otherwise it tears the paint off.', d: 2 },
        { title: 'СИЗ', question: 'Обязательные СИЗ при работе с болгаркой?', image: '🥽', options: ['Ничего', 'Очки + перчатки + наушники', 'Только перчатки', 'Каска'], correct: 1, explanation: 'Защитные очки, перчатки, наушники. Волосы убрать! Искры = пожар.', titleEn: 'PPE', questionEn: 'Required PPE when using an angle grinder?', optionsEn: ['Nothing', 'Goggles + gloves + ear protection', 'Gloves only', 'Hard hat'], explanationEn: 'Safety goggles, gloves, ear protection. Tie back hair! Sparks = fire risk.', d: 1 },
      ]
    },
    // ═══════ 6. CLEANING ═══════
    {
      id: 'pro_cleaning',
      name: 'Клининг: стандарты чистоты',
      nameEn: 'Cleaning: Standards & Methods',
      icon: 'check',
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-100',
      description: 'ISO 14644, дезинфекция, химия, безопасность',
      dept: 'cleaning',
      levels: [
        { title: 'Направление уборки', question: 'Правильный порядок уборки помещения?', image: '🧹', options: ['От пола к потолку', 'Сверху вниз, от дальнего угла к выходу', 'Случайно', 'Только пол'], correct: 1, explanation: 'Сверху вниз — пыль падает. От дальнего угла — не наступать на чистое.', titleEn: 'Cleaning direction', questionEn: 'Correct order for cleaning a room?', optionsEn: ['From floor to ceiling', 'Top to bottom, from far corner to exit', 'Random', 'Floor only'], explanationEn: 'Top to bottom — dust falls down. From far corner — avoid stepping on clean areas.', d: 1 },
        { title: 'Микрофибра', question: 'Почему микрофибра лучше обычной тряпки?', image: '🧽', options: ['Дешевле', 'Собирает бактерии без химии', 'Ярче', 'Тяжелее'], correct: 1, explanation: 'Микрофибра захватывает 99% бактерий. Обычная тряпка размазывает грязь.', titleEn: 'Microfiber', questionEn: 'Why is microfiber better than a regular cloth?', optionsEn: ['Cheaper', 'Captures bacteria without chemicals', 'Brighter', 'Heavier'], explanationEn: 'Microfiber captures 99% of bacteria. Regular cloth spreads dirt around.', d: 1 },
        { title: 'Хлорка + аммиак', question: 'Что нельзя смешивать с хлоркой?', image: '☠️', options: ['Воду', 'Аммиак (нашатырь)', 'Соду', 'Мыло'], correct: 1, explanation: 'Хлорка + аммиак = хлорамин, токсичный газ! Может убить.', titleEn: 'Bleach + ammonia', questionEn: 'What must never be mixed with bleach?', optionsEn: ['Water', 'Ammonia', 'Baking soda', 'Soap'], explanationEn: 'Bleach + ammonia = chloramine, toxic gas! Can be fatal.', d: 1 },
        { title: 'Время дезинфекции', question: 'Сколько дезинфектант должен оставаться на поверхности?', image: '⏱️', options: ['1 секунда', '5-10 минут (по инструкции)', 'Мгновенно', '1 час'], correct: 1, explanation: 'Contact time — время контакта. Обычно 5-10 минут для убийства бактерий.', titleEn: 'Disinfection time', questionEn: 'How long must disinfectant stay on the surface?', optionsEn: ['1 second', '5-10 minutes (per instructions)', 'Instantly', '1 hour'], explanationEn: 'Contact time is critical. Usually 5-10 minutes to kill bacteria.', d: 2 },
        { title: 'Цветовая кодировка', question: 'Красная тряпка в международной системе?', image: '🔴', options: ['Кухня', 'Санузлы', 'Офис', 'Стёкла'], correct: 1, explanation: 'Красный = санузлы. Синий = общие. Зелёный = кухня. Жёлтый = изоляция.', titleEn: 'Color coding', questionEn: 'What does a red cloth mean in the international system?', optionsEn: ['Kitchen', 'Restrooms', 'Office', 'Glass'], explanationEn: 'Red = restrooms. Blue = general. Green = kitchen. Yellow = isolation.', d: 2 },
        { title: 'Каменная столешница', question: 'Чем НЕЛЬЗЯ мыть мрамор?', image: '🧴', options: ['Мыльной водой', 'Кислотными средствами (уксус)', 'Тёплой водой', 'Специальным средством'], correct: 1, explanation: 'Кислота растворяет мрамор! Только pH-нейтральные средства.', titleEn: 'Stone countertop', questionEn: 'What must NOT be used to clean marble?', optionsEn: ['Soapy water', 'Acidic cleaners (vinegar)', 'Warm water', 'Special cleaner'], explanationEn: 'Acid dissolves marble! Use only pH-neutral products.', d: 2 },
        { title: 'HEPA фильтр', question: 'Что задерживает HEPA-фильтр?', image: '💨', options: ['Только пыль', '99.97% частиц ≥0.3 мкм', '50% бактерий', 'Запахи'], correct: 1, explanation: 'HEPA: 99.97% частиц 0.3 микрон и больше. Обязателен для аллергиков.', titleEn: 'HEPA filter', questionEn: 'What does a HEPA filter capture?', optionsEn: ['Dust only', '99.97% of particles ≥0.3 µm', '50% of bacteria', 'Odors'], explanationEn: 'HEPA: 99.97% of particles 0.3 microns and larger. Essential for allergy sufferers.', d: 2 },
        { title: 'Ковёр', question: 'Метод горячей экстракции ковров?', image: '🧶', options: ['Пылесос', 'Горячая вода + химия → вакуум', 'Стирка в машинке', 'Выбивание'], correct: 1, explanation: 'Горячая экстракция: 60-70°C раствор впрыскивается и тут же всасывается.', titleEn: 'Carpet', questionEn: 'What is hot water extraction for carpets?', optionsEn: ['Vacuum only', 'Hot water + chemicals injected then vacuumed', 'Machine wash', 'Beating'], explanationEn: 'Hot extraction: 60-70°C solution is injected and immediately vacuumed up.', d: 2 },
        { title: 'Биологические', question: 'Как убирать биологические жидкости (кровь)?', image: '🩸', options: ['Обычной тряпкой', 'В СИЗ + дезинфекция + спецпакет', 'Водой', 'Игнорировать'], correct: 1, explanation: 'Перчатки + маска. Дезинфекция хлоросодержащим. Утилизация в биопакет.', d: 3 },
        { title: 'Плесень', question: 'Как правильно удалить плесень?', image: '🦠', options: ['Протереть', 'Антиплесневое + обработать причину влаги', 'Закрасить', 'Пылесосом'], correct: 1, explanation: 'Убить плесень + устранить источник влаги. Иначе вернётся через неделю.', d: 3 },
        { title: 'SDS клининг', question: 'Что такое SDS для моющего средства?', image: '📋', options: ['Реклама', 'Паспорт безопасности (Safety Data Sheet)', 'Цена', 'Рецепт'], correct: 1, explanation: 'SDS: состав, опасности, первая помощь, хранение. Обязателен по закону.', d: 3 },
      ]
    },
    // ═══════ 7. MOVING & DELIVERY ═══════
    {
      id: 'pro_moving',
      name: 'Переезд: правила перевозки',
      nameEn: 'Moving: Transport Rules',
      icon: 'map',
      color: 'from-rose-500 to-red-700',
      bgColor: 'bg-rose-100',
      description: 'Грузоподъёмность, упаковка, безопасность',
      dept: 'moving',
      levels: [
        { title: 'Подъём груза', question: 'Правильная техника подъёма тяжёлого?', image: '📦', options: ['Спиной, наклонясь', 'Ногами, спина прямая', 'Одной рукой', 'Рывком'], correct: 1, explanation: 'Ногами! Спина прямая, колени согнуты. Спина ≠ подъёмный кран.', titleEn: 'Lifting loads', questionEn: 'Correct technique for lifting heavy objects?', optionsEn: ['Back bent', 'Legs, back straight', 'One hand', 'Jerk'], explanationEn: 'Use legs! Back straight, knees bent. Your back is not a crane.', d: 1 },
        { title: 'Максимальный вес', question: 'Макс. вес для одного человека (ISO 11228)?', image: '⚖️', options: ['50 кг', '25 кг', '100 кг', '10 кг'], correct: 1, explanation: 'ISO 11228: максимум 25 кг для мужчин в идеальных условиях.', titleEn: 'Maximum weight', questionEn: 'Max weight for one person (ISO 11228)?', optionsEn: ['50 kg', '25 kg', '100 kg', '10 kg'], explanationEn: 'ISO 11228: maximum 25 kg for men under ideal conditions.', d: 1 },
        { title: 'Холодильник', question: 'Как перевозить холодильник?', image: '🧊', options: ['Лёжа', 'Строго вертикально или под углом ≤45°', 'Вверх ногами', 'На боку'], correct: 1, explanation: 'Вертикально! Если лёжа — масло вытечет из компрессора. После перевозки ждать 4ч.', titleEn: 'Refrigerator', questionEn: 'How to transport a refrigerator?', optionsEn: ['Lying down', 'Strictly upright or at angle ≤45°', 'Upside down', 'On its side'], explanationEn: 'Upright! If horizontal — oil leaks from compressor. Wait 4 hours after moving before plugging in.', d: 1 },
        { title: 'Стекло', question: 'Как транспортировать стекло/зеркало?', image: '🪟', options: ['Горизонтально', 'Вертикально, в пузырчатой плёнке', 'В газете', 'Без упаковки'], correct: 1, explanation: 'Всегда вертикально + пузырчатая плёнка + картонные углы. Горизонтально = трещина.', titleEn: 'Glass', questionEn: 'How to transport glass/mirror?', optionsEn: ['Horizontally', 'Vertically, in bubble wrap', 'In newspaper', 'Unpackaged'], explanationEn: 'Always vertical + bubble wrap + cardboard corners. Horizontal = crack.', d: 1 },
        { title: 'Стрейч-плёнка', question: 'Зачем оборачивать мебель стрейч-плёнкой?', image: '📋', options: ['Для красоты', 'Защита от царапин + фиксация дверей/ящиков', 'Для веса', 'Не нужно'], correct: 1, explanation: 'Стрейч: защита + фиксация выдвижных частей. Дёшево и эффективно.', titleEn: 'Stretch film', questionEn: 'Why wrap furniture in stretch film?', optionsEn: ['For looks', 'Scratch protection + secures doors/drawers', 'For weight', 'Not needed'], explanationEn: 'Stretch film: protection + secures moving parts. Cheap and effective.', d: 2 },
        { title: 'Развесовка', question: 'Как правильно загружать фургон?', image: '🚛', options: ['Как попало', 'Тяжёлое внизу у кабины, лёгкое сверху', 'Тяжёлое сверху', 'Лёгкое первым'], correct: 1, explanation: 'Тяжёлое: низ + ближе к кабине = устойчивость. Лёгкое и хрупкое — сверху.', titleEn: 'Load distribution', questionEn: 'How to correctly load a van?', optionsEn: ['Randomly', 'Heavy at bottom near cab, light on top', 'Heavy on top', 'Light first'], explanationEn: 'Heavy: low + near cab = stability. Light and fragile — on top.', d: 2 },
        { title: 'Ремни крепления', question: 'Чем фиксировать груз в кузове?', image: '🔗', options: ['Ничем', 'Стяжные ремни (рэтчеты)', 'Верёвкой', 'Надеяться на лучшее'], correct: 1, explanation: 'Рэтчеты (стяжные ремни) с сертификатом. Верёвка ненадёжна!', titleEn: 'Cargo straps', questionEn: 'How to secure cargo in the van?', optionsEn: ['Nothing', 'Ratchet straps', 'Rope', 'Hope for the best'], explanationEn: 'Certified ratchet straps. Rope is unreliable!', d: 2 },
        { title: 'Стиральная машина', question: 'Что обязательно перед перевозкой стиралки?', image: '🧺', options: ['Ничего', 'Закрутить транспортировочные болты', 'Заполнить водой', 'Снять дверцу'], correct: 1, explanation: 'Транспортировочные болты фиксируют барабан. Без них = поломка при тряске.', titleEn: 'Washing machine', questionEn: 'What is required before transporting a washing machine?', optionsEn: ['Nothing', 'Install transport bolts', 'Fill with water', 'Remove door'], explanationEn: 'Transport bolts secure the drum. Without them = damage from vibration.', d: 2 },
        { title: 'Пианино', question: 'Минимум людей для перевозки пианино?', image: '🎹', options: ['1', '2', '4 человека + оборудование', '10'], correct: 2, explanation: 'Пианино: 200-400 кг. Минимум 4 человека + рохля/ремни. Нет места для ошибки.', titleEn: 'Piano', questionEn: 'Minimum people to move a piano?', optionsEn: ['1', '2', '4 people + equipment', '10'], explanationEn: 'Piano: 200-400 kg. Minimum 4 people + dolly/straps. No room for error.', d: 3 },
        { title: 'Лифт грузоподъёмность', question: 'Средняя грузоподъёмность пассажирского лифта?', image: '🛗', options: ['100 кг', '400-630 кг', '2000 кг', '50 кг'], correct: 1, explanation: '400-630 кг типичный. НИКОГДА не перегружать! Проверяйте табличку.', titleEn: 'Elevator capacity', questionEn: 'Typical passenger elevator capacity?', optionsEn: ['100 kg', '400-630 kg', '2000 kg', '50 kg'], explanationEn: '400-630 kg typical. NEVER overload! Check the placard.', d: 2 },
        { title: 'Документы', question: 'Какие документы при коммерческой перевозке?', image: '📝', options: ['Никаких', 'ТТН + опись + страховка', 'Только паспорт', 'Визитка'], correct: 1, explanation: 'Товарно-транспортная накладная + опись имущества + страхование.', titleEn: 'Documents', questionEn: 'What documents for commercial moving?', optionsEn: ['None', 'Bill of lading + inventory + insurance', 'Passport only', 'Business card'], explanationEn: 'Bill of lading + property inventory + insurance.', d: 3 },
      ]
    },
    // ═══════ 8. SECURITY (PROFESSIONAL) ═══════
    {
      id: 'pro_security',
      name: 'Охрана: законы и тактика',
      nameEn: 'Security: Law & Tactics',
      icon: 'shield',
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-100',
      description: 'Правовые основы, тактика, оборудование',
      dept: 'security',
      levels: [
        { title: 'Необходимая оборона', question: 'Когда охранник может применить силу?', image: '🛡️', options: ['Всегда', 'При реальной угрозе жизни/здоровью', 'По настроению', 'Никогда'], correct: 1, explanation: 'Только при реальной и непосредственной угрозе. Соразмерно!', titleEn: 'Self-defense', questionEn: 'When may a security guard use force?', optionsEn: ['Always', 'When there is a real threat to life/health', 'When they feel like it', 'Never'], explanationEn: 'Only when there is a real and imminent threat. Proportional response!', d: 1 },
        { title: 'Документирование', question: 'Что записывать в журнал охраны?', image: '📝', options: ['Только ЧП', 'ВСЁ: время, события, посетители, проверки', 'Ничего', 'Погоду'], correct: 1, explanation: 'Всё! Время, обход, посетители, инциденты. Журнал = доказательство.', titleEn: 'Documentation', questionEn: 'What to record in the security log?', optionsEn: ['Emergencies only', 'EVERYTHING: time, events, visitors, checks', 'Nothing', 'Weather'], explanationEn: 'Everything! Time, patrols, visitors, incidents. Log = evidence.', d: 1 },
        { title: 'Обход', question: 'Почему менять маршрут обхода?', image: '🚶', options: ['Скука', 'Чтобы злоумышленник не предсказал', 'Физнагрузка', 'Правила'], correct: 1, explanation: 'Предсказуемый маршрут = уязвимость. Меняйте время и путь!', titleEn: 'Patrol', questionEn: 'Why vary the patrol route?', optionsEn: ['Boredom', 'So intruders cannot predict it', 'Exercise', 'Rules'], explanationEn: 'Predictable route = vulnerability. Vary time and path!', d: 1 },
        { title: 'Радиообмен', question: 'Правильный радиопозывной?', image: '📻', options: ['Алло', 'Позывной + сообщение + приём', 'Кричать', 'Шёпот'], correct: 1, explanation: '"Пост-1, Базе. Обход завершён. Норма. Приём." — стандарт.', titleEn: 'Radio protocol', questionEn: 'Correct radio call format?', optionsEn: ['Hello', 'Call sign + message + over', 'Yelling', 'Whispering'], explanationEn: '"Post-1 to Base. Patrol complete. All clear. Over." — standard format.', d: 2 },
        { title: 'CCTV', question: 'Сколько хранить видео с камер?', image: '📹', options: ['1 день', '30 дней минимум (GDPR)', '1 час', 'Навсегда'], correct: 1, explanation: '30 дней — стандарт. GDPR/закон требует обоснования дольше.', titleEn: 'CCTV', questionEn: 'How long to store surveillance footage?', optionsEn: ['1 day', '30 days minimum (GDPR)', '1 hour', 'Forever'], explanationEn: '30 days — standard. GDPR/law requires justification for longer retention.', d: 2 },
        { title: 'Досмотр', question: 'Может ли частный охранник проводить досмотр?', image: '🔍', options: ['Всегда', 'Только с согласия или по правилам объекта', 'Никогда', 'Полицейский может'], correct: 1, explanation: 'Частный охранник — только с согласия лица. Принудительный досмотр = полиция.', titleEn: 'Search', questionEn: 'Can a private security guard conduct a search?', optionsEn: ['Always', 'Only with consent or per site rules', 'Never', 'Only police can'], explanationEn: 'Private guard — only with person\'s consent. Forced search = police matter.', d: 2 },
        { title: 'Пожар на объекте', question: 'Порядок действий охранника при пожаре?', image: '🔥', options: ['Тушить', 'Тревога → эвакуация → вызов → доклад', 'Убежать', 'Ждать'], correct: 1, explanation: '1. Сигнал тревоги. 2. Эвакуация. 3. Вызов 101/112. 4. Доклад.', titleEn: 'Fire on premises', questionEn: 'Security guard procedure during fire?', optionsEn: ['Fight fire', 'Alarm → evacuate → call 101/112 → report', 'Run away', 'Wait'], explanationEn: '1. Sound alarm. 2. Evacuate. 3. Call 101/112. 4. Report.', d: 2 },
        { title: 'Задержание', question: 'Максимальное время задержания охранником?', image: '⏱️', options: ['Сколько хочет', 'До приезда полиции (разумное время)', '24 часа', '1 минута'], correct: 1, explanation: 'Только до прибытия полиции. Обычно 30-60 минут максимум.', titleEn: 'Detention', questionEn: 'Maximum detention time by security guard?', optionsEn: ['As long as they want', 'Until police arrive (reasonable time)', '24 hours', '1 minute'], explanationEn: 'Only until police arrive. Usually 30-60 minutes maximum.', d: 3 },
        { title: 'Оружие', question: 'Когда охранник может применить оружие?', image: '🔫', options: ['Всегда', 'Крайняя необходимость, угроза жизни', 'По желанию', 'Никогда'], correct: 1, explanation: 'Только при непосредственной угрозе жизни. Предупреждение → предупредительный выстрел → применение.', titleEn: 'Weapons', questionEn: 'When may a security guard use a weapon?', optionsEn: ['Always', 'Extreme necessity, threat to life', 'At will', 'Never'], explanationEn: 'Only when there is direct threat to life. Warning → warning shot → use.', d: 3 },
        { title: 'Социальная инженерия', question: 'Что такое социальная инженерия?', image: '🎭', options: ['Строительство', 'Обман для получения доступа', 'Программирование', 'Маркетинг'], correct: 1, explanation: '"Я из ИТ, нужен ваш пропуск" — типичная атака. Всегда проверяйте!', titleEn: 'Social engineering', questionEn: 'What is social engineering?', optionsEn: ['Construction', 'Deception to gain access', 'Programming', 'Marketing'], explanationEn: '"I\'m from IT, I need your badge" — typical attack. Always verify!', d: 3 },
        { title: 'Периметр', question: 'Принцип "защита в глубину"?', image: '🏰', options: ['Один забор', 'Несколько уровней: периметр → здание → зона → объект', 'Камеры', 'Охранник'], correct: 1, explanation: 'Defense in depth: каждый уровень замедляет и обнаруживает. Не полагайтесь на одно!', titleEn: 'Perimeter', questionEn: 'What is "defense in depth" principle?', optionsEn: ['One fence', 'Multiple layers: perimeter → building → zone → asset', 'Cameras', 'Guard'], explanationEn: 'Defense in depth: each layer slows and detects. Don\'t rely on one!', d: 3 },
      ]
    },
    // ═══════ 9. AUTO & GARAGE ═══════
    {
      id: 'pro_auto',
      name: 'Авто: техника и безопасность',
      nameEn: 'Auto: Mechanics & Safety',
      icon: 'settings',
      color: 'from-zinc-600 to-stone-800',
      bgColor: 'bg-zinc-100',
      description: 'Диагностика, буксировка, шиномонтаж',
      dept: 'auto',
      levels: [
        { title: 'Домкрат', question: 'Куда ставить домкрат?', image: '🚗', options: ['Куда угодно', 'Только на усиленные точки кузова', 'На бампер', 'На порог'], correct: 1, explanation: 'Только на заводские точки поддомкрачивания! Иначе помнёте кузов.', titleEn: 'Jack', questionEn: 'Where to place the jack?', optionsEn: ['Anywhere', 'Only on reinforced body jack points', 'On bumper', 'On rocker panel'], explanationEn: 'Only on factory jacking points! Otherwise you will damage the body.', d: 1 },
        { title: 'Масло', question: 'Как часто менять масло?', image: '🛢️', options: ['Раз в год', 'По регламенту: 10-15 тыс. км или раз в год', 'Никогда', 'Каждую неделю'], correct: 1, explanation: 'Регламент производителя. Обычно 10-15 тыс. км или 1 год.', titleEn: 'Oil', questionEn: 'How often to change oil?', optionsEn: ['Once a year', 'Per manual: 10-15k km or annually', 'Never', 'Every week'], explanationEn: 'Follow manufacturer schedule. Usually 10-15k km or 1 year.', d: 1 },
        { title: 'Колесо', question: 'Порядок затяжки болтов колеса?', image: '🛞', options: ['По кругу', 'Крест-накрест (звёздочкой)', 'Случайно', 'Все сразу'], correct: 1, explanation: 'Крест-накрест = равномерный прижим. По кругу = перекос диска!', titleEn: 'Wheel', questionEn: 'Correct order for tightening wheel bolts?', optionsEn: ['In sequence', 'Criss-cross (star pattern)', 'Random', 'All at once'], explanationEn: 'Criss-cross = even clamping. Sequential = disk warping!', d: 1 },
        { title: 'Давление шин', question: 'Когда проверять давление?', image: '📊', options: ['После поездки', 'На холодных шинах', 'После накачки', 'Неважно'], correct: 1, explanation: 'Только на холодных! После езды давление выше на 0.2-0.5 бар.', titleEn: 'Tire pressure', questionEn: 'When to check tire pressure?', optionsEn: ['After driving', 'On cold tires', 'After inflating', 'Doesn\'t matter'], explanationEn: 'Only when cold! After driving pressure is 0.2-0.5 bar higher.', d: 1 },
        { title: 'Антифриз', question: 'Можно ли смешивать антифризы разных цветов?', image: '🧪', options: ['Да', 'Нет, возможна реакция и осадок', 'Только красный с зелёным', 'Все одинаковые'], correct: 1, explanation: 'Разные составы могут реагировать! Осадок забивает радиатор. Только одинаковые.', titleEn: 'Antifreeze', questionEn: 'Can you mix antifreezes of different colors?', optionsEn: ['Yes', 'No, reaction and sediment possible', 'Only red with green', 'All are the same'], explanationEn: 'Different formulations can react! Sediment clogs radiator. Same type only.', d: 2 },
        { title: 'Буксировка АКПП', question: 'Можно ли буксировать авто с АКПП?', image: '🚛', options: ['Да, без ограничений', 'Ограничено: 50 км/ч, до 50 км, N', 'Нет, только эвакуатор', 'На любой скорости'], correct: 1, explanation: 'Режим N, скорость ≤50 км/ч, дистанция ≤50 км. Иначе = ремонт АКПП.', titleEn: 'Towing automatic', questionEn: 'Can you tow a car with automatic transmission?', optionsEn: ['Yes, no limits', 'Limited: 50 km/h, up to 50 km, N', 'No, tow truck only', 'Any speed'], explanationEn: 'Neutral, speed ≤50 km/h, distance ≤50 km. Otherwise = transmission repair.', d: 2 },
        { title: 'OBD2', question: 'Что такое OBD2?', image: '📊', options: ['Масло', 'Бортовая диагностика (порт ошибок)', 'Тип двигателя', 'Навигация'], correct: 1, explanation: 'OBD2: стандартный порт диагностики. Читает ошибки двигателя и систем.', titleEn: 'OBD2', questionEn: 'What is OBD2?', optionsEn: ['Oil', 'On-board diagnostics (fault code port)', 'Engine type', 'Navigation'], explanationEn: 'OBD2: standard diagnostic port. Reads engine and system error codes.', d: 2 },
        { title: 'Тормозная жидкость', question: 'Почему менять тормозную жидкость?', image: '⚠️', options: ['Для цвета', 'Впитывает воду → снижается температура кипения', 'Не нужно', 'Для запаха'], correct: 1, explanation: 'DOT-жидкость гигроскопична. Вода = пузыри при нагреве = отказ тормозов!', titleEn: 'Brake fluid', questionEn: 'Why change brake fluid?', optionsEn: ['For color', 'Absorbs water → boiling point drops', 'Not needed', 'For smell'], explanationEn: 'DOT fluid is hygroscopic. Water = vapor bubbles when hot = brake failure!', d: 2 },
        { title: 'Аккумулятор', question: 'Порядок подключения проводов прикуривания?', image: '🔋', options: ['Минус первый', 'Плюс→Плюс, Минус→Масса', 'Как хочешь', 'Минус→Плюс'], correct: 1, explanation: 'Красный: + донора → + севшего. Чёрный: - донора → масса (двигатель) севшего.', d: 3 },
        { title: 'Момент затяжки', question: 'Зачем нужен динамометрический ключ?', image: '🔧', options: ['Для скорости', 'Точный момент затяжки = безопасность', 'Для красоты', 'Неважно'], correct: 1, explanation: 'Колёсные болты: 100-130 Нм. Недотянуто = отпадёт. Перетянуто = сорвёт резьбу.', titleEn: 'Torque wrench', questionEn: 'Why use a torque wrench?', optionsEn: ['For speed', 'Precise torque = safety', 'For looks', 'Doesn\'t matter'], explanationEn: 'Wheel bolts: 100-130 Nm. Under-torqued = wheel falls off. Over-torqued = stripped threads.', d: 3 },
        { title: 'Гибрид/электро', question: 'Главная опасность при работе с электрокаром?', image: '⚡', options: ['Шум', 'Высоковольтная батарея 400-800В', 'Запах', 'Вибрация'], correct: 1, explanation: '400-800В = смертельно! Оранжевые провода = высокое напряжение. Не трогать!', titleEn: 'Hybrid/Electric', questionEn: 'Main hazard when working on an electric car?', optionsEn: ['Noise', '400-800V high-voltage battery', 'Smell', 'Vibration'], explanationEn: '400-800V = lethal! Orange cables = high voltage. Do not touch!', d: 3 },
      ]
    },
  ];

  const generalModules = [
    {
      id: 'fire',
      name: 'Пожарная безопасность',
      nameEn: 'Fire Safety',
      icon: 'fire',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-orange-100',
      description: 'Международные стандарты тушения и эвакуации',
      levels: [
        { title: 'Эвакуация', question: 'При пожаре в высотном здании, что нужно делать?', image: '🏢', options: ['Использовать лифт', 'Спускаться по лестнице', 'Открыть все окна', 'Ждать на месте'], correct: 1, explanation: 'Всегда используйте лестницу! Лифты могут остановиться или открыться на горящем этаже.', titleEn: 'Evacuation', questionEn: 'In a high-rise fire, what should you do?', optionsEn: ['Use elevator', 'Use stairs', 'Open all windows', 'Wait in place'], explanationEn: 'Always use stairs! Elevators may stop or open on a burning floor.', d: 1 },
        { title: 'Дым', question: 'Как двигаться в задымлённом помещении?', image: '💨', options: ['Бегом во весь рост', 'Низко пригнувшись', 'На четвереньках спиной', 'Прыжками'], correct: 1, explanation: 'Дым и горячий воздух поднимаются вверх. Внизу больше кислорода.', titleEn: 'Smoke', questionEn: 'How to move in a smoke-filled room?', optionsEn: ['Run upright', 'Stay low', 'Crawl backward on all fours', 'Jump'], explanationEn: 'Smoke and hot air rise. More oxygen near the floor.', d: 1 },
        { title: 'Горящая одежда', question: 'Что делать, если на человеке загорелась одежда?', image: '🔥', options: ['Бежать', 'Остановись-Упади-Катайся', 'Снять одежду', 'Облить бензином'], correct: 1, explanation: 'Stop-Drop-Roll — международный стандарт при горящей одежде.', titleEn: 'Burning Clothing', questionEn: 'What to do if clothing catches fire?', optionsEn: ['Run', 'Stop-Drop-Roll', 'Remove clothing', 'Douse with gasoline'], explanationEn: 'Stop-Drop-Roll — international standard for burning clothing.', d: 1 },
        { title: 'Пожарная сигнализация', question: 'Что делать при срабатывании пожарной сигнализации?', image: '🔔', options: ['Игнорировать', 'Начать эвакуацию', 'Искать огонь', 'Позвонить в офис'], correct: 1, explanation: 'Всегда эвакуируйтесь при сигнале! Ваша жизнь важнее.', titleEn: 'Fire Alarm', questionEn: 'What to do when fire alarm activates?', optionsEn: ['Ignore it', 'Begin evacuation', 'Search for fire', 'Call office'], explanationEn: 'Always evacuate when alarm sounds! Your life matters most.', d: 1 },
        { title: 'Типы огнетушителей', question: 'Какой огнетушитель для электрооборудования?', image: '🧯', options: ['Водный (A)', 'Пенный (AB)', 'CO₂ (BCE)', 'Порошковый (A)'], correct: 2, explanation: 'CO₂ огнетушители безопасны для электрооборудования.', titleEn: 'Fire Extinguisher Types', questionEn: 'Which extinguisher for electrical equipment?', optionsEn: ['Water (A)', 'Foam (AB)', 'CO₂ (BCE)', 'Dry powder (A)'], explanationEn: 'CO₂ extinguishers are safe for electrical equipment.', d: 2 },
        { title: 'P.A.S.S. Техника', question: 'Что означает буква "P" в технике P.A.S.S.?', image: '🔥', options: ['Push', 'Pull (Выдернуть)', 'Point', 'Protect'], correct: 1, explanation: 'P.A.S.S. = Pull, Aim, Squeeze, Sweep.', titleEn: 'P.A.S.S. Technique', questionEn: 'What does "P" stand for in P.A.S.S.?', optionsEn: ['Push', 'Pull', 'Point', 'Protect'], explanationEn: 'P.A.S.S. = Pull, Aim, Squeeze, Sweep.', d: 2 },
        { title: 'Классы пожаров', question: 'К какому классу относится пожар горящего масла?', image: '🍳', options: ['Класс A', 'Класс B', 'Класс C', 'Класс F'], correct: 3, explanation: 'Класс F (K в США) — пищевые масла и жиры.', titleEn: 'Fire Classes', questionEn: 'What class is a cooking oil fire?', optionsEn: ['Class A', 'Class B', 'Class C', 'Class F'], explanationEn: 'Class F (K in US) — cooking oils and fats.', d: 2 },
        { title: 'Дистанция тушения', question: 'С какого расстояния начинать тушить?', image: '📏', options: ['0.5 м', '1-2 м', '2-3 м', '5+ м'], correct: 2, explanation: '2-3 метра — оптимальное расстояние.', titleEn: 'Extinguishing Distance', questionEn: 'From what distance to start extinguishing?', optionsEn: ['0.5 m', '1-2 m', '2-3 m', '5+ m'], explanationEn: '2-3 meters is optimal distance.', d: 2 },
        { title: 'Проверка двери', question: 'Как проверить дверь при пожаре?', image: '🚪', options: ['Резко открыть', 'Тыльной стороной руки', 'Пнуть ногой', 'Открыть медленно'], correct: 1, explanation: 'Тыльная сторона руки чувствительнее.', titleEn: 'Door Check', questionEn: 'How to check a door during a fire?', optionsEn: ['Open forcefully', 'Back of hand', 'Kick with foot', 'Open slowly'], explanationEn: 'Back of hand is more heat-sensitive.', d: 2 },
        { title: 'Точка сбора', question: 'Где должна быть точка сбора?', image: '🏃', options: ['У входа', 'На парковке', 'Минимум 15м от здания', 'Внутри соседнего здания'], correct: 2, explanation: 'Минимум 15 метров от здания.', titleEn: 'Assembly Point', questionEn: 'Where should the assembly point be?', optionsEn: ['At the entrance', 'In the parking lot', 'Minimum 15m from building', 'Inside adjacent building'], explanationEn: 'Minimum 15 meters from the building.', d: 2 },
        { title: 'Backdraft', question: 'Что такое Backdraft?', image: '💥', options: ['Слабый огонь', 'Взрыв при кислороде', 'Медленное тление', 'Тушение водой'], correct: 1, explanation: 'Backdraft — взрыв при поступлении воздуха. Крайне опасен!', titleEn: 'Backdraft', questionEn: 'What is a backdraft?', optionsEn: ['Weak fire', 'Explosion when oxygen enters', 'Slow smoldering', 'Water extinguishing'], explanationEn: 'Backdraft — explosion when air enters oxygen-starved fire. Extremely dangerous!', d: 3 },
        { title: 'Flashover', question: 'При какой температуре Flashover?', image: '🌡️', options: ['100°C', '300°C', '500-600°C', '1000°C'], correct: 2, explanation: 'Flashover — ~500-600°C.', titleEn: 'Flashover', questionEn: 'At what temperature does flashover occur?', optionsEn: ['100°C', '300°C', '500-600°C', '1000°C'], explanationEn: 'Flashover occurs at ~500-600°C.', d: 3 },
        { title: 'Класс D', question: 'Чем тушить горящий магний?', image: '🔩', options: ['Водой', 'CO₂', 'Специальным порошком', 'Пеной'], correct: 2, explanation: 'Металлы тушат ТОЛЬКО специальными порошками. Вода = взрыв!', titleEn: 'Class D', questionEn: 'How to extinguish burning magnesium?', optionsEn: ['Water', 'CO₂', 'Class D powder', 'Foam'], explanationEn: 'Metal fires require Class D powder ONLY. Water = explosion!', d: 3 },
        { title: 'Класс A', question: 'Что горит при пожаре класса A?', image: '📦', options: ['Жидкости', 'Газы', 'Твёрдые материалы', 'Металлы'], correct: 2, explanation: 'Класс A — твёрдые материалы: дерево, бумага, ткань.', titleEn: 'Class A', questionEn: 'What burns in a Class A fire?', optionsEn: ['Liquids', 'Gases', 'Solid materials', 'Metals'], explanationEn: 'Class A — solid combustibles: wood, paper, fabric.', d: 2 },
        { title: 'Огнетушитель проверка', question: 'Как часто проверять огнетушитель?', image: '🔍', options: ['Каждый день', 'Раз в месяц', 'Раз в год', 'Никогда'], correct: 2, explanation: 'Ежемесячный осмотр + ежегодное ТО.', titleEn: 'Extinguisher Inspection', questionEn: 'How often to inspect fire extinguisher?', optionsEn: ['Daily', 'Monthly', 'Yearly', 'Never'], explanationEn: 'Monthly visual inspection + annual maintenance.', d: 2 }
      ]
    },
    {
      id: 'firstaid',
      name: 'Первая помощь',
      nameEn: 'First Aid',
      icon: 'heart',
      color: 'from-red-500 to-pink-600',
      bgColor: 'bg-red-100',
      description: 'CPR, кровотечения, переломы по стандартам AHA/ERC',
      levels: [
        { title: 'Кровотечение', question: 'Первое действие при кровотечении?', image: '🩸', options: ['Жгут', 'Прямое давление', 'Поднять конечность', 'Промыть'], correct: 1, explanation: 'Прямое давление — первый метод.', titleEn: 'Bleeding', questionEn: 'First action for bleeding?', optionsEn: ['Tourniquet', 'Direct pressure', 'Elevate limb', 'Rinse'], explanationEn: 'Direct pressure — first-line method.', d: 1 },
        { title: 'Ожоги', question: 'Как охлаждать ожог?', image: '🔥', options: ['Льдом', 'Прохладной водой 10-20 мин', 'Маслом', 'Зубной пастой'], correct: 1, explanation: 'Прохладная вода 10-20 минут.', titleEn: 'Burns', questionEn: 'How to cool a burn?', optionsEn: ['Ice', 'Cool water 10-20 min', 'Oil', 'Toothpaste'], explanationEn: 'Cool running water 10-20 minutes.', d: 1 },
        { title: 'Recovery', question: 'Когда применять боковое положение?', image: '🛌', options: ['При переломе', 'Без сознания, но дышит', 'При сердечном', 'При кровотечении'], correct: 1, explanation: 'Recovery position — для без сознания, но дышащих.', titleEn: 'Recovery Position', questionEn: 'When to use recovery position?', optionsEn: ['For fracture', 'Unconscious but breathing', 'Cardiac arrest', 'Bleeding'], explanationEn: 'Recovery position — for unconscious but breathing victims.', d: 1 },
        { title: 'Перелом', question: 'Главное правило при переломе?', image: '🦴', options: ['Вправить', 'Иммобилизация', 'Массаж', 'Нагрузить'], correct: 1, explanation: 'Иммобилизация — обездвиживание.', titleEn: 'Fracture', questionEn: 'Main rule for a fracture?', optionsEn: ['Reduce it', 'Immobilization', 'Massage', 'Load it'], explanationEn: 'Immobilization — prevent movement of the injured part.', d: 1 },
        { title: 'CPR Компрессии', question: 'Глубина компрессий при СЛР взрослого?', image: '❤️', options: ['2-3 см', '5-6 см', '8-10 см', '1-2 см'], correct: 1, explanation: 'AHA/ERC 2020: 5-6 см, 100-120 в минуту.', titleEn: 'CPR Compressions', questionEn: 'Depth of compressions for adult CPR?', optionsEn: ['2-3 cm', '5-6 cm', '8-10 cm', '1-2 cm'], explanationEn: 'AHA/ERC 2020: 5-6 cm, 100-120 per minute.', d: 2 },
        { title: 'Соотношение CPR', question: 'Соотношение компрессий к вдохам?', image: '🫁', options: ['15:2', '30:2', '15:1', '10:2'], correct: 1, explanation: '30:2 — международный стандарт.', titleEn: 'CPR Ratio', questionEn: 'Compression-to-breath ratio?', optionsEn: ['15:2', '30:2', '15:1', '10:2'], explanationEn: '30:2 — international standard (AHA/ERC).', d: 2 },
        { title: 'Геймлих', question: 'Куда направлены толчки Геймлиха?', image: '😮', options: ['В спину', 'В грудь', 'Внутрь и вверх', 'Вниз'], correct: 2, explanation: 'Внутрь и вверх, под диафрагму.', titleEn: 'Heimlich', questionEn: 'In what direction are Heimlich thrusts?', optionsEn: ['To the back', 'To the chest', 'Inward and upward', 'Downward'], explanationEn: 'Inward and upward, below the diaphragm.', d: 2 },
        { title: 'FAST тест', question: 'Что проверяет "F" в тесте FAST?', image: '🧠', options: ['Fingers', 'Face', 'Feet', 'Focus'], correct: 1, explanation: 'FAST: Face, Arms, Speech, Time.', titleEn: 'FAST Test', questionEn: 'What does "F" check in FAST stroke test?', optionsEn: ['Fingers', 'Face', 'Feet', 'Focus'], explanationEn: 'FAST: Face, Arms, Speech, Time.', d: 2 },
        { title: 'ABC', question: 'Что означает ABC?', image: '🔤', options: ['Always Be Careful', 'Airway-Breathing-Circulation', 'Alert-Blood-Check', 'Assess-Bandage-Call'], correct: 1, explanation: 'Airway, Breathing, Circulation.', titleEn: 'ABC', questionEn: 'What does ABC stand for?', optionsEn: ['Always Be Careful', 'Airway-Breathing-Circulation', 'Alert-Blood-Check', 'Assess-Bandage-Call'], explanationEn: 'Airway, Breathing, Circulation.', d: 2 },
        { title: 'Шок', question: 'Позиция при шоке?', image: '😰', options: ['Сидя', 'Ноги выше головы', 'На животе', 'Стоя'], correct: 1, explanation: 'Ноги приподняты.', titleEn: 'Shock', questionEn: 'Position for shock?', optionsEn: ['Sitting', 'Legs elevated above heart', 'On stomach', 'Standing'], explanationEn: 'Legs elevated (unless contraindicated).', d: 2 },
        { title: 'AED', question: 'Можно ли AED на мокром человеке?', image: '⚡', options: ['Да', 'Нет', 'Сначала вытереть', 'Только в воде'], correct: 2, explanation: 'Вытереть грудь насухо!', titleEn: 'AED', questionEn: 'Can you use AED on a wet person?', optionsEn: ['Yes', 'No', 'Dry chest first', 'Only in water'], explanationEn: 'Dry the chest first!', d: 3 },
        { title: 'Анафилаксия', question: 'Куда вводят адреналин?', image: '💉', options: ['В вену', 'В бедро', 'В ягодицу', 'Под язык'], correct: 1, explanation: 'EpiPen — в бедро.', titleEn: 'Anaphylaxis', questionEn: 'Where to inject epinephrine?', optionsEn: ['Intravenously', 'Into thigh', 'Into buttock', 'Under tongue'], explanationEn: 'EpiPen — into the thigh.', d: 3 },
        { title: 'CPR детям', question: 'Глубина компрессий для ребёнка?', image: '👶', options: ['2 см', '4-5 см', '6-7 см', '1 см'], correct: 1, explanation: '4-5 см, 1/3 грудной клетки.', titleEn: 'CPR for Children', questionEn: 'Compression depth for child?', optionsEn: ['2 cm', '4-5 cm', '6-7 cm', '1 cm'], explanationEn: '4-5 cm, 1/3 of chest depth (AHA/ERC).', d: 3 },
        { title: 'Укус змеи', question: 'Что НЕЛЬЗЯ при укусе змеи?', image: '🐍', options: ['Обездвижить', 'Высасывать яд', 'Вызвать скорую', 'Снять украшения'], correct: 1, explanation: 'Никогда не высасывайте яд!', titleEn: 'Snake Bite', questionEn: 'What must you NOT do for snake bite?', optionsEn: ['Immobilize', 'Suck out venom', 'Call emergency', 'Remove jewelry'], explanationEn: 'Never suck out venom!', d: 3 },
        { title: 'Тепловой удар', question: 'Признак теплового удара?', image: '☀️', options: ['Потливость', 'Горячая СУХАЯ кожа', 'Озноб', 'Голод'], correct: 1, explanation: 'Кожа горячая и сухая!', titleEn: 'Heat Stroke', questionEn: 'Sign of heat stroke?', optionsEn: ['Sweating', 'Hot DRY skin', 'Chills', 'Hunger'], explanationEn: 'Skin is hot and dry!', d: 3 },
        { title: 'Отравление', question: 'При неизвестном отравлении?', image: '☠️', options: ['Вызвать рвоту', 'Молоко', 'НЕ рвоту, звонить 112', 'Уголь'], correct: 2, explanation: 'Не вызывать рвоту!', titleEn: 'Poisoning', questionEn: 'For unknown poisoning?', optionsEn: ['Induce vomiting', 'Give milk', 'Do NOT induce vomiting, call 112/911', 'Charcoal'], explanationEn: 'Do not induce vomiting! Call poison control.', d: 3 },
        { title: 'Нос', question: 'Как остановить носовое кровотечение?', image: '👃', options: ['Голову назад', 'Вперёд, зажать', 'Лечь', 'Вату глубоко'], correct: 1, explanation: 'Голова вперёд + зажать.', titleEn: 'Nosebleed', questionEn: 'How to stop a nosebleed?', optionsEn: ['Tilt head back', 'Lean forward, pinch', 'Lie down', 'Stuff cotton deep'], explanationEn: 'Lean forward + pinch nostrils.', d: 2 },
        { title: 'Гипогликемия', question: 'Что дать при низком сахаре?', image: '🍬', options: ['Инсулин', 'Сахар/сок', 'Солёную воду', 'Ничего'], correct: 1, explanation: 'Быстрые углеводы: сок, сахар.', titleEn: 'Hypoglycemia', questionEn: 'What to give for low blood sugar?', optionsEn: ['Insulin', 'Sugar/juice', 'Salt water', 'Nothing'], explanationEn: 'Fast-acting carbs: juice, sugar.', d: 2 }
      ]
    },
    {
      id: 'rescue',
      name: 'Спасательные операции',
      nameEn: 'Rescue Operations',
      icon: 'lifeBuoy',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-100',
      description: 'Водные спасения, эвакуация, транспортировка',
      levels: [
        { title: 'Утопление', question: 'Приоритет при спасении тонущего?', image: '🌊', options: ['Прыгнуть', 'Бросить предмет', 'Звать', 'Ждать'], correct: 1, explanation: 'REACH-THROW-ROW-GO.', titleEn: 'Drowning', questionEn: 'Priority when rescuing a drowning person?', optionsEn: ['Jump in', 'Throw flotation device', 'Yell', 'Wait'], explanationEn: 'REACH-THROW-ROW-GO.', d: 1 },
        { title: 'Recovery', question: 'Позиция для без сознания дышащего?', image: '🛌', options: ['На спине', 'На животе', 'Боковое стабильное', 'Сидя'], correct: 2, explanation: 'Recovery position.', titleEn: 'Recovery', questionEn: 'Position for unconscious breathing victim?', optionsEn: ['On back', 'On stomach', 'Lateral recovery', 'Sitting'], explanationEn: 'Recovery position.', d: 1 },
        { title: 'Позвоночник', question: 'При травме позвоночника?', image: '🦴', options: ['Эвакуировать', 'НЕ двигать', 'Посадить', 'Массаж'], correct: 1, explanation: 'Не двигать!', titleEn: 'Spine Injury', questionEn: 'For suspected spine injury?', optionsEn: ['Evacuate', 'Do NOT move', 'Sit them up', 'Massage'], explanationEn: 'Do not move!', d: 1 },
        { title: 'Firefighter', question: 'Как нести одному?', image: '🚶', options: ['На спине', 'Перед собой', 'Пожарный захват', 'За ноги'], correct: 2, explanation: 'Firefighter\'s carry.', titleEn: 'Firefighter Carry', questionEn: 'How to carry alone?', optionsEn: ['On back', 'In front', 'Firefighter carry', 'By legs'], explanationEn: 'Firefighter\'s carry.', d: 2 },
        { title: 'Гипотермия', question: 'Как согревать при гипотермии?', image: '🥶', options: ['Горячая ванна', 'Растирание', 'Постепенно от центра', 'Алкоголь'], correct: 2, explanation: 'Медленно от центра.', titleEn: 'Hypothermia', questionEn: 'How to rewarm in hypothermia?', optionsEn: ['Hot bath', 'Rubbing', 'Gradually from core', 'Alcohol'], explanationEn: 'Slowly from core outward.', d: 2 },
        { title: 'Log roll', question: 'Log roll при?', image: '🔄', options: ['Утоплении', 'Травме позвоночника', 'Ожогах', 'Переломе ноги'], correct: 1, explanation: 'Log roll при травме позвоночника.', titleEn: 'Log Roll', questionEn: 'When to use log roll?', optionsEn: ['Drowning', 'Spine injury', 'Burns', 'Leg fracture'], explanationEn: 'Log roll for suspected spine injury.', d: 2 },
        { title: 'Жгут', question: 'Жгут максимум на?', image: '🩹', options: ['10 мин', '30 мин', '1-2 часа', 'Без ограничений'], correct: 2, explanation: '1-2 часа максимум!', titleEn: 'Tourniquet', questionEn: 'Tourniquet maximum duration?', optionsEn: ['10 min', '30 min', '1-2 hours', 'No limit'], explanationEn: '1-2 hours maximum!', d: 2 },
        { title: 'Blanket drag', question: 'Когда перенос на одеяле?', image: '🛏️', options: ['Всегда', 'При травме спины', 'При пожаре', 'Никогда'], correct: 2, explanation: 'Быстрая эвакуация.', titleEn: 'Blanket Drag', questionEn: 'When to use blanket drag?', optionsEn: ['Always', 'Spine injury', 'Fire evacuation', 'Never'], explanationEn: 'Rapid evacuation from danger.', d: 2 },
        { title: 'Вторичное утопление', question: '"Вторичное утопление" это?', image: '💧', options: ['Утонуть дважды', 'Отёк через часы', 'Страх воды', 'Судороги'], correct: 1, explanation: 'Отёк лёгких через 1-24 часа.', titleEn: 'Secondary Drowning', questionEn: 'What is "secondary drowning"?', optionsEn: ['Drown twice', 'Pulmonary edema hours later', 'Fear of water', 'Seizures'], explanationEn: 'Pulmonary edema 1-24 hours after water aspiration.', d: 3 },
        { title: 'Confined space', question: 'Первое при спасении из замкнутого?', image: '🕳️', options: ['Войти', 'Проверить воздух', 'Кричать', 'Ждать'], correct: 1, explanation: 'Проверьте атмосферу!', titleEn: 'Confined Space', questionEn: 'First step when rescuing from confined space?', optionsEn: ['Enter', 'Check atmosphere', 'Yell', 'Wait'], explanationEn: 'Check atmosphere first!', d: 3 },
        { title: 'Верёвка', question: 'Минимальная прочность верёвки?', image: '🧵', options: ['500 кг', '1500 кг', '3000 кг', '100 кг'], correct: 2, explanation: '15 kN (~1500 кг).', titleEn: 'Rope', questionEn: 'Minimum rope strength for rescue?', optionsEn: ['500 kg', '1500 kg', '3000 kg', '100 kg'], explanationEn: '15 kN (~1500 kg) minimum.', d: 3 },
        { title: 'Электро', question: 'Как спасать от тока?', image: '⚡', options: ['Схватить', 'Отключить питание', 'Водой', 'Толкнуть'], correct: 1, explanation: 'СНАЧАЛА отключить!', titleEn: 'Electrocution', questionEn: 'How to rescue from electric shock?', optionsEn: ['Grab them', 'Cut power first', 'Water', 'Push them'], explanationEn: 'Cut power FIRST!', d: 3 },
        { title: 'Triage', question: 'Чёрный в START triage?', image: '🏷️', options: ['Лёгкие', 'Срочные', 'Отложенные', 'Погибшие'], correct: 3, explanation: 'Чёрный — погибшие.', titleEn: 'Triage', questionEn: 'What does black mean in START triage?', optionsEn: ['Minor', 'Immediate', 'Delayed', 'Deceased'], explanationEn: 'Black — deceased or expectant.', d: 3 },
        { title: 'Лёд', question: 'Как спасать из-подо льда?', image: '🧊', options: ['Идти', 'Ползти', 'Бежать', 'Прыгать'], correct: 1, explanation: 'Ползком, распределяя вес.', titleEn: 'Ice Rescue', questionEn: 'How to approach someone under ice?', optionsEn: ['Walk', 'Crawl', 'Run', 'Jump'], explanationEn: 'Crawl to distribute weight.', d: 3 },
        { title: 'Лавина', question: 'При накрытии лавиной?', image: '🏔️', options: ['Бежать', 'Плавать, закрыть лицо', 'Кричать', 'Лечь'], correct: 1, explanation: 'Плавательные движения + карман у лица.', titleEn: 'Avalanche', questionEn: 'When caught in avalanche?', optionsEn: ['Run', 'Swim, create air pocket at face', 'Scream', 'Lie still'], explanationEn: 'Swimming motions + create air pocket by face.', d: 3 }
      ]
    },
    {
      id: 'hazmat',
      name: 'Опасные вещества',
      nameEn: 'Hazmat Safety',
      icon: 'alertTriangle',
      color: 'from-yellow-500 to-amber-600',
      bgColor: 'bg-yellow-100',
      description: 'Химическая безопасность, маркировка, защита',
      levels: [
        { title: 'Газ', question: 'При утечке газа НЕЛЬЗЯ?', image: '💨', options: ['Открыть окна', 'Включать свет', 'Покинуть', 'Перекрыть'], correct: 1, explanation: 'Искра = взрыв!', titleEn: 'Gas Leak', questionEn: 'What must you NOT do during gas leak?', optionsEn: ['Open windows', 'Turn on/off lights', 'Leave', 'Shut off gas'], explanationEn: 'Any spark = explosion!', d: 1 },
        { title: 'Химожог', question: 'При ожоге кислотой?', image: '🧪', options: ['Нейтрализовать', 'Вода 20+ мин', 'Протереть', 'Маслом'], correct: 1, explanation: 'Только вода!', titleEn: 'Chemical Burn', questionEn: 'For acid burn?', optionsEn: ['Neutralize', 'Flush with water 20+ min', 'Wipe off', 'Apply oil'], explanationEn: 'Flush with water only!', d: 1 },
        { title: 'GHS Пламя', question: 'Пламя в GHS означает?', image: '🔥', options: ['Токсичность', 'Коррозия', 'Воспламеняемость', 'Взрыв'], correct: 2, explanation: 'Воспламеняемость.', titleEn: 'GHS Flame', questionEn: 'Flame symbol in GHS means?', optionsEn: ['Toxicity', 'Corrosion', 'Flammability', 'Explosive'], explanationEn: 'Flammability.', d: 2 },
        { title: 'CO', question: 'Признак отравления CO?', image: '🏭', options: ['Запах', 'Вишнёвая кожа', 'Судороги', 'Кашель'], correct: 1, explanation: 'CO без запаха! Вишнёвая кожа.', titleEn: 'Carbon Monoxide', questionEn: 'Sign of CO poisoning?', optionsEn: ['Smell', 'Cherry-red skin', 'Seizures', 'Cough'], explanationEn: 'CO is odorless! Cherry-red skin is a sign.', d: 2 },
        { title: 'Радиация', question: 'Три принципа защиты?', image: '☢️', options: ['Бег-укрытие-йод', 'Время-расстояние-экран', 'Вода-еда-воздух', 'Бежать'], correct: 1, explanation: 'Time-Distance-Shielding.', titleEn: 'Radiation', questionEn: 'Three principles of radiation protection?', optionsEn: ['Run-shelter-iodine', 'Time-Distance-Shielding', 'Water-food-air', 'Run'], explanationEn: 'Time-Distance-Shielding (ALARA).', d: 2 },
        { title: 'GHS Череп', question: 'Череп в GHS означает?', image: '☠️', options: ['Радиация', 'Острая токсичность', 'Коррозия', 'Окислитель'], correct: 1, explanation: 'Острая токсичность.', titleEn: 'GHS Skull', questionEn: 'Skull symbol in GHS means?', optionsEn: ['Radiation', 'Acute toxicity', 'Corrosion', 'Oxidizer'], explanationEn: 'Acute toxicity.', d: 2 },
        { title: 'Хлор', question: 'Какой запах у хлора?', image: '🧴', options: ['Без запаха', 'Резкий', 'Сладкий', 'Бензин'], correct: 1, explanation: 'Резкий характерный запах.', titleEn: 'Chlorine', questionEn: 'What does chlorine smell like?', optionsEn: ['Odorless', 'Pungent/bleach-like', 'Sweet', 'Gasoline'], explanationEn: 'Pungent bleach-like odor.', d: 2 },
        { title: 'NFPA 704', question: 'Синий в NFPA 704?', image: '🔷', options: ['Пожар', 'Здоровье', 'Реактивность', 'Радиация'], correct: 1, explanation: 'Синий = здоровье.', titleEn: 'NFPA 704', questionEn: 'Blue in NFPA 704 diamond means?', optionsEn: ['Fire hazard', 'Health hazard', 'Reactivity', 'Special/radiation'], explanationEn: 'Blue = health hazard.', d: 3 },
        { title: 'SDS', question: 'Сколько разделов в SDS?', image: '📋', options: ['8', '12', '16', '20'], correct: 2, explanation: '16 разделов по GHS.', titleEn: 'SDS', questionEn: 'How many sections in SDS?', optionsEn: ['8', '12', '16', '20'], explanationEn: '16 sections per GHS.', d: 3 },
        { title: 'Щёлочь', question: 'Что опаснее для кожи?', image: '⚗️', options: ['Кислота', 'Щёлочь', 'Одинаково', 'Ничего'], correct: 1, explanation: 'Щёлочь проникает глубже!', titleEn: 'Alkali', questionEn: 'What is more dangerous to skin?', optionsEn: ['Acid', 'Alkali', 'Equal', 'Neither'], explanationEn: 'Alkalis penetrate deeper into tissue!', d: 3 },
        { title: 'Бензол', question: 'Опасность бензола?', image: '🛢️', options: ['Ожоги', 'Рак крови', 'Слепота', 'Глухота'], correct: 1, explanation: 'Бензол — канцероген.', titleEn: 'Benzene', questionEn: 'Benzene hazard?', optionsEn: ['Burns', 'Blood cancer/leukemia', 'Blindness', 'Deafness'], explanationEn: 'Benzene is a carcinogen (leukemia).', d: 3 },
        { title: 'Ртуть', question: 'Как собирать ртуть?', image: '💧', options: ['Пылесосом', 'Веником', 'Спецнабором', 'Тряпкой'], correct: 2, explanation: 'Только специальными средствами!', titleEn: 'Mercury', questionEn: 'How to collect mercury spill?', optionsEn: ['Vacuum', 'Broom', 'Special spill kit', 'Cloth'], explanationEn: 'Use mercury spill kit only! Never vacuum.', d: 3 },
        { title: 'Асбест', question: 'Опасность асбеста?', image: '🏗️', options: ['Ожоги', 'Рак лёгких', 'Отравление', 'Облучение'], correct: 1, explanation: 'Рак лёгких при вдыхании.', titleEn: 'Asbestos', questionEn: 'Asbestos hazard?', optionsEn: ['Burns', 'Lung cancer', 'Poisoning', 'Radiation'], explanationEn: 'Lung cancer/mesothelioma from inhalation.', d: 3 },
        { title: 'LEL', question: 'Что такое LEL?', image: '📊', options: ['Освещение', 'Нижний предел взрываемости', 'Шум', 'Температура'], correct: 1, explanation: 'Lower Explosive Limit.', titleEn: 'LEL', questionEn: 'What is LEL?', optionsEn: ['Lighting', 'Lower Explosive Limit', 'Noise', 'Temperature'], explanationEn: 'Lower Explosive Limit — minimum concentration to ignite.', d: 3 },
        { title: 'Дезактивация', question: 'Порядок дезактивации?', image: '🚿', options: ['Одежда→душ→медпомощь', 'Душ→одежда→еда', 'Медпомощь', 'Ничего'], correct: 0, explanation: 'Одежда → душ → медпомощь.', titleEn: 'Decontamination', questionEn: 'Decontamination sequence?', optionsEn: ['Clothing removal→shower→medical', 'Shower→clothing→food', 'Medical care', 'Nothing'], explanationEn: 'Remove clothing → shower → medical evaluation.', d: 3 }
      ]
    },
    {
      id: 'security',
      name: 'Охранная деятельность',
      nameEn: 'Security Basics',
      icon: 'shield',
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-100',
      description: 'Патрулирование, наблюдение, реагирование',
      levels: [
        { title: 'Патрулирование', question: 'Почему маршрут непредсказуемый?', image: '🚶', options: ['Физнагрузка', 'Чтобы не заметили', 'Экономия', 'Правила'], correct: 1, explanation: 'Мешает злоумышленникам.', titleEn: 'Patrolling', questionEn: 'Why use unpredictable patrol routes?', optionsEn: ['Exercise', 'Deters intruders', 'Saves time', 'Rules'], explanationEn: 'Deters intruders from anticipating.', d: 1 },
        { title: 'Описание', question: 'Порядок описания подозреваемого?', image: '🕵️', options: ['Одежда→Лицо', 'Сверху вниз', 'Случайно', 'Снизу вверх'], correct: 1, explanation: 'Сверху вниз.', titleEn: 'Description', questionEn: 'Order for describing a suspect?', optionsEn: ['Clothing→Face', 'Top to bottom', 'Random', 'Bottom to top'], explanationEn: 'Top to bottom.', d: 1 },
        { title: 'Доклад', question: 'Что в докладе об инциденте?', image: '📝', options: ['Имя', 'Who-What-When-Where-How', 'Мнение', 'Фото'], correct: 1, explanation: '5W+H.', titleEn: 'Incident Report', questionEn: 'What to include in incident report?', optionsEn: ['Name only', 'Who-What-When-Where-How', 'Opinion', 'Photos only'], explanationEn: '5W+H format.', d: 1 },
        { title: 'SALUTE', question: '"S" в SALUTE?', image: '👁️', options: ['Speed', 'Size', 'Silence', 'Signal'], correct: 1, explanation: 'Size, Activity, Location, Unit, Time, Equipment.', titleEn: 'SALUTE', questionEn: 'What does "S" stand for in SALUTE?', optionsEn: ['Speed', 'Size', 'Silence', 'Signal'], explanationEn: 'Size, Activity, Location, Unit, Time, Equipment.', d: 2 },
        { title: 'Эскалация', question: 'Порядок эскалации?', image: '📢', options: ['Сила сразу', 'Присутствие→Слова→Действия', 'Игнорировать', 'Оружие'], correct: 1, explanation: 'Presence → Verbal → Physical.', titleEn: 'Use of Force', questionEn: 'Escalation order?', optionsEn: ['Force immediately', 'Presence→Verbal→Physical', 'Ignore', 'Weapon'], explanationEn: 'Presence → Verbal → Physical.', d: 2 },
        { title: 'Пропуск', question: 'Что проверять на пропуске?', image: '🎫', options: ['Фото', 'Документ+лицо+срок', 'Срок', 'Ничего'], correct: 1, explanation: 'Фото=лицо, срок, подлинность.', titleEn: 'Badge Check', questionEn: 'What to verify on an access badge?', optionsEn: ['Photo only', 'Document+face+validity', 'Expiry only', 'Nothing'], explanationEn: 'Photo matches face, validity, authenticity.', d: 2 },
        { title: 'Камера', question: 'Слепая зона камеры?', image: '📹', options: ['Темнота', 'Область вне обзора', 'Дождь', 'Ночь'], correct: 1, explanation: 'Blind spot.', titleEn: 'CCTV', questionEn: 'What is a camera blind spot?', optionsEn: ['Darkness', 'Area outside field of view', 'Rain', 'Night'], explanationEn: 'Blind spot — area not covered.', d: 2 },
        { title: 'De-escalation', question: 'Ключевой приём деэскалации?', image: '🗣️', options: ['Кричать', 'Активное слушание', 'Угрожать', 'Игнорировать'], correct: 1, explanation: 'Активное слушание.', titleEn: 'De-escalation', questionEn: 'Key de-escalation technique?', optionsEn: ['Yelling', 'Active listening', 'Threatening', 'Ignoring'], explanationEn: 'Active listening.', d: 2 },
        { title: 'CPTED', question: 'Что такое CPTED?', image: '🏢', options: ['Оружие', 'Дизайн против преступности', 'Камеры', 'Патруль'], correct: 1, explanation: 'Crime Prevention Through Environmental Design.', titleEn: 'CPTED', questionEn: 'What is CPTED?', optionsEn: ['Weapon', 'Crime Prevention Through Environmental Design', 'Cameras', 'Patrol'], explanationEn: 'Crime Prevention Through Environmental Design.', d: 3 },
        { title: 'Сила', question: 'Сколько уровней применения силы?', image: '💪', options: ['2', '4', '5-6', '10'], correct: 2, explanation: '5-6 уровней.', titleEn: 'Force Continuum', questionEn: 'How many use-of-force levels?', optionsEn: ['2', '4', '5-6', '10'], explanationEn: '5-6 levels typically.', d: 3 },
        { title: 'Задержание', question: 'Когда можно задержать?', image: '🚫', options: ['Всегда', 'Подозрение', 'При преступлении', 'Никогда'], correct: 2, explanation: 'Только при совершении преступления.', titleEn: 'Detention', questionEn: 'When can you detain someone?', optionsEn: ['Always', 'Suspicion', 'Upon commission of crime', 'Never'], explanationEn: 'Only upon commission of a crime (citizen\'s arrest).', d: 3 },
        { title: 'Access control', question: '3 фактора аутентификации?', image: '🔐', options: ['Имя-пароль-email', 'Знание-владение-биометрия', 'Ключ-карта-код', 'Логин-пароль-телефон'], correct: 1, explanation: 'KNOW, HAVE, ARE.', titleEn: 'Access Control', questionEn: 'Three factors of authentication?', optionsEn: ['Name-password-email', 'Knowledge-Possession-Inherence', 'Key-card-code', 'Login-password-phone'], explanationEn: 'KNOW, HAVE, ARE.', d: 3 },
        { title: 'Bomb threat', question: 'При угрозе взрыва?', image: '💣', options: ['Искать', 'Эвакуация', 'Игнорировать', 'Фото'], correct: 1, explanation: 'Эвакуация!', titleEn: 'Bomb Threat', questionEn: 'Upon bomb threat?', optionsEn: ['Search', 'Evacuate', 'Ignore', 'Take photos'], explanationEn: 'Evacuate immediately!', d: 3 },
        { title: 'Chain of custody', question: 'Chain of custody?', image: '⛓️', options: ['Наручники', 'Цепь доказательств', 'Охранная', 'Командная'], correct: 1, explanation: 'Документирование улик.', titleEn: 'Chain of Custody', questionEn: 'What is chain of custody?', optionsEn: ['Handcuffs', 'Documented evidence trail', 'Security chain', 'Command chain'], explanationEn: 'Documented custody of evidence.', d: 3 },
        { title: 'Duress code', question: 'Duress code?', image: '🆘', options: ['Код двери', 'Секретный сигнал опасности', 'Wi-Fi', 'Номер смены'], correct: 1, explanation: 'Тайный сигнал угрозы.', titleEn: 'Duress Code', questionEn: 'What is a duress code?', optionsEn: ['Door code', 'Secret distress signal', 'Wi-Fi password', 'Shift number'], explanationEn: 'Covert signal indicating threat or coercion.', d: 3 }
      ]
    },
    {
      id: 'emergency',
      name: 'Экстренные ситуации',
      nameEn: 'Emergency Response',
      icon: 'zap',
      color: 'from-red-600 to-rose-700',
      bgColor: 'bg-red-100',
      description: 'Реагирование на кризисы и катастрофы',
      levels: [
        { title: 'Землетрясение', question: 'При землетрясении внутри?', image: '🌍', options: ['Бежать', 'Под стол', 'У окна', 'Лифт'], correct: 1, explanation: 'DROP-COVER-HOLD.', titleEn: 'Earthquake', questionEn: 'During earthquake indoors?', optionsEn: ['Run outside', 'Drop-Cover-Hold under table', 'Stand by window', 'Use elevator'], explanationEn: 'DROP-COVER-HOLD — drop, take cover, hold on.', d: 1 },
        { title: 'Торнадо', question: 'Где укрыться от торнадо?', image: '🌪️', options: ['У окна', 'Подвал/внутренняя комната', 'Крыша', 'Машина'], correct: 1, explanation: 'Подвал, нижний этаж.', titleEn: 'Tornado', questionEn: 'Where to shelter from tornado?', optionsEn: ['By window', 'Basement/inner room', 'Roof', 'Car'], explanationEn: 'Basement or lowest floor, interior room.', d: 1 },
        { title: 'Pandemic', question: 'Главная защита от инфекций?', image: '🦠', options: ['Витамины', 'Гигиена рук', 'Антибиотики', 'Бег'], correct: 1, explanation: '20+ секунд мытья рук.', titleEn: 'Pandemic', questionEn: 'Primary protection from infections?', optionsEn: ['Vitamins', 'Hand hygiene', 'Antibiotics', 'Running'], explanationEn: '20+ seconds handwashing.', d: 1 },
        { title: 'Blackout', question: 'При отключении света?', image: '💡', options: ['Паника', 'Проверить автоматы', 'Кричать', 'Бежать'], correct: 1, explanation: 'Проверьте автоматы.', titleEn: 'Blackout', questionEn: 'During power outage?', optionsEn: ['Panic', 'Check circuit breakers', 'Scream', 'Run'], explanationEn: 'Check circuit breakers.', d: 1 },
        { title: 'Цунами', question: 'Признак цунами?', image: '🌊', options: ['Ветер', 'Море отступает', 'Дождь', 'Туман'], correct: 1, explanation: 'Море резко отступило!', titleEn: 'Tsunami', questionEn: 'Sign of impending tsunami?', optionsEn: ['Wind', 'Sea recedes', 'Rain', 'Fog'], explanationEn: 'Rapid sea withdrawal — move to high ground!', d: 2 },
        { title: 'Наводнение', question: 'Опасная глубина воды?', image: '💧', options: ['5 см', '15 см', '10 см', '50 см'], correct: 1, explanation: '15 см может сбить с ног.', titleEn: 'Flooding', questionEn: 'Dangerous depth of flood water?', optionsEn: ['5 cm', '15 cm', '10 cm', '50 cm'], explanationEn: '15 cm can knock you off your feet.', d: 2 },
        { title: 'Active shooter', question: 'При стрелке в здании?', image: '🔫', options: ['Атаковать', 'RUN-HIDE-FIGHT', 'Звонить', 'Кричать'], correct: 1, explanation: 'RUN → HIDE → FIGHT.', titleEn: 'Active Shooter', questionEn: 'During active shooter in building?', optionsEn: ['Attack', 'RUN-HIDE-FIGHT', 'Call only', 'Scream'], explanationEn: 'RUN → HIDE → FIGHT (last resort).', d: 2 },
        { title: 'Gas leak', question: 'При запахе газа?', image: '⛽', options: ['Позвонить', 'НЕ свет, покинуть', 'Открыть газ', 'Курить'], correct: 1, explanation: 'Не включать ничего!', titleEn: 'Gas Leak', questionEn: 'Upon smelling gas?', optionsEn: ['Call only', 'No switches — leave immediately', 'Open gas', 'Smoke'], explanationEn: 'Do not turn on/off anything — evacuate!', d: 2 },
        { title: 'ICS', question: 'Что такое ICS?', image: '📊', options: ['Интернет', 'Incident Command System', 'Камеры', 'Сирена'], correct: 1, explanation: 'Система управления инцидентами.', titleEn: 'ICS', questionEn: 'What is ICS?', optionsEn: ['Internet', 'Incident Command System', 'Cameras', 'Siren'], explanationEn: 'Incident Command System.', d: 3 },
        { title: 'Мародёрство', question: 'Защита после катастрофы?', image: '🏚️', options: ['Уйти', 'Периметр+свет+патруль', 'Ждать', 'Плакат'], correct: 1, explanation: 'Периметр, освещение, охрана.', titleEn: 'Looting', questionEn: 'Protection after disaster?', optionsEn: ['Leave', 'Perimeter+lighting+patrol', 'Wait', 'Signs'], explanationEn: 'Perimeter, lighting, security patrol.', d: 3 }
      ]
    },
    {
      id: 'traffic',
      name: 'Дорожная безопасность',
      nameEn: 'Traffic Safety',
      icon: 'target',
      color: 'from-green-500 to-teal-600',
      bgColor: 'bg-green-100',
      description: 'ПДД, ДТП, регулирование движения',
      levels: [
        { title: 'ДТП', question: 'Первое действие при ДТП?', image: '🚗', options: ['Фото', 'Безопасность', 'Друзьям', 'Уехать'], correct: 1, explanation: 'Безопасность!', titleEn: 'RTA', questionEn: 'First action at road traffic accident?', optionsEn: ['Take photos', 'Safety', 'Call friends', 'Leave'], explanationEn: 'Safety first!', d: 1 },
        { title: 'Пешеход', question: 'Безопасность пешехода ночью?', image: '🚶', options: ['Тёмная одежда', 'Светоотражатели', 'Наушники', 'Бежать'], correct: 1, explanation: 'Светоотражатели!', titleEn: 'Pedestrian', questionEn: 'Pedestrian safety at night?', optionsEn: ['Dark clothing', 'Reflectors', 'Headphones', 'Run'], explanationEn: 'Reflective gear!', d: 1 },
        { title: 'Велосипедист', question: 'Защита велосипедиста?', image: '🚴', options: ['Ничего', 'Шлем', 'Бронежилет', 'Очки'], correct: 1, explanation: 'Шлем снижает риск на 85%.', titleEn: 'Cyclist', questionEn: 'Cyclist head protection?', optionsEn: ['Nothing', 'Helmet', 'Vest', 'Goggles'], explanationEn: 'Helmet reduces head injury risk by ~85%.', d: 1 },
        { title: 'Дистанция', question: 'Правило 3-х секунд?', image: '📏', options: ['Реакция', 'Безопасная дистанция', 'Обгон', 'Остановка'], correct: 1, explanation: '3 секунды до машины впереди.', titleEn: 'Following Distance', questionEn: 'What is the 3-second rule?', optionsEn: ['Reaction time', 'Safe following distance', 'Passing', 'Stopping'], explanationEn: 'Maintain 3 seconds behind vehicle ahead.', d: 2 },
        { title: 'Знак', question: 'Знак на трассе на расстоянии?', image: '⚠️', options: ['10 м', '30 м', '100+ м', '5 м'], correct: 2, explanation: '100 метров минимум.', titleEn: 'Warning Sign', questionEn: 'Warning sign placement on highway?', optionsEn: ['10 m', '30 m', '100+ m', '5 m'], explanationEn: '100 meters minimum.', d: 2 },
        { title: 'Golden hour', question: '"Золотой час"?', image: '⏱️', options: ['Час пик', '60 мин госпитализации', 'Закат', 'Обед'], correct: 1, explanation: 'Критические 60 минут.', titleEn: 'Golden Hour', questionEn: 'What is "golden hour"?', optionsEn: ['Rush hour', '60 min to hospital for trauma', 'Sunset', 'Lunch'], explanationEn: 'Critical 60 minutes for trauma care.', d: 2 },
        { title: 'Горящий авто', question: 'При пожаре машины бежать?', image: '🔥', options: ['К машине', '45°, минимум 30м', 'В машину', 'Никуда'], correct: 1, explanation: 'Под углом 45°, минимум 30м.', titleEn: 'Burning Vehicle', questionEn: 'When car is on fire, run?', optionsEn: ['Toward car', '45° angle, min 30m', 'Into car', 'Nowhere'], explanationEn: '45° angle, minimum 30m away.', d: 2 },
        { title: 'Извлечение', question: 'Когда извлекать из машины?', image: '🚙', options: ['Всегда', 'При угрозе жизни', 'Никогда', 'Просьба'], correct: 1, explanation: 'Только при угрозе!', titleEn: 'Extrication', questionEn: 'When to extract from vehicle?', optionsEn: ['Always', 'Life-threatening situation', 'Never', 'On request'], explanationEn: 'Only when life is threatened!', d: 3 },
        { title: 'Регулировщик', question: 'Руки в стороны означают?', image: '👮', options: ['Все едут', 'Стоп для всех', 'Прямо', 'Поворот'], correct: 1, explanation: 'Стоп для грудь/спина.', titleEn: 'Traffic Controller', questionEn: 'Arms outstretched mean?', optionsEn: ['All go', 'Stop for all', 'Straight', 'Turn'], explanationEn: 'Stop for traffic facing chest/back.', d: 3 },
        { title: 'Мотоцикл', question: 'Почему мотоциклистов не видят?', image: '🏍️', options: ['Быстрые', 'Маленький профиль', 'Без фар', 'Без звука'], correct: 1, explanation: 'Узкий профиль + слепые зоны.', titleEn: 'Motorcycle', questionEn: 'Why are motorcyclists not seen?', optionsEn: ['Too fast', 'Small profile', 'No headlights', 'No sound'], explanationEn: 'Narrow profile + blind spots.', d: 3 }
      ]
    }
  ];

  const modulesData = [...professionalModules, ...generalModules];

  // Shuffled levels storage
  const [shuffledLevels, setShuffledLevels] = createSignal<any[]>([]);
  
  // Full random shuffle (Fisher-Yates)
  const shuffleArray = (arr: any[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const modules = modulesData;

  const currentModuleData = () => modules.find(m => m.id === currentModule());
  const currentLevelData = () => shuffledLevels()[currentLevel()];
  const totalLevels = () => shuffledLevels().length || 0;

  const handleAnswer = (index: number) => {
    if (showResult()) return;
    
    setSelectedAnswer(index);
    const isCorrect = index === currentLevelData()?.correct;
    
    if (isCorrect) {
      playSound('correct');
      setLastAnswer('correct');
      setScore(s => s + 100 + streak() * 10);
      setStreak(s => s + 1);
    } else {
      playSound('wrong');
      setLastAnswer('wrong');
      setStreak(0);
      setLives(l => Math.max(0, l - 1));
    }
    
    setShowResult(true);
  };

  const nextLevel = () => {
    if (currentLevel() < totalLevels() - 1) {
      setCurrentLevel(l => l + 1);
      setShowResult(false);
      setSelectedAnswer(null);
      setLastAnswer(null);
      playSound('click');
    } else {
      // Module complete
      playSound('levelup');
      setTotalProgress(p => p + 1);
      setCurrentModule(null);
      setCurrentLevel(0);
      setShowResult(false);
      setSelectedAnswer(null);
      setGameStarted(false);
    }
  };

  const startModule = (moduleId: string) => {
    playSound('click');
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      setShuffledLevels(shuffleArray(module.levels));
    }
    setCurrentModule(moduleId);
    setCurrentLevel(0);
    setLives(3);
    setStreak(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setGameStarted(true);
  };

  const exitGame = () => {
    playSound('click');
    setCurrentModule(null);
    setGameStarted(false);
  };

  // Main Menu
  const MainMenu = () => (
    <div class="space-y-4 animate-fade-in">
      {/* Stats Banner */}
      <div class="glass rounded-3xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-gray-500">{t('academy.progress')}</p>
            <p class="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {totalProgress()}/{modules.length}
            </p>
          </div>
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Icon name="trophy" class="text-white" size="lg" />
          </div>
        </div>
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
            style={`width: ${(totalProgress() / modules.length) * 100}%`}
          />
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-500">
          <span>{t('academy.points')}: {score()}</span>
          <span>{t('academy.completed')}: {totalProgress()}</span>
        </div>
      </div>

      {/* Sound Toggle */}
      <button 
        class="w-full glass rounded-2xl p-4 flex items-center justify-between touch-scale"
        onClick={() => { playSound('click'); setSoundEnabled(!soundEnabled()); }}
      >
        <div class="flex items-center gap-3">
          <Icon name={soundEnabled() ? 'volume2' : 'volumeX'} class="text-gray-600" size="sm" />
          <span class="font-medium text-gray-700">{t('academy.sound')}</span>
        </div>
        <div class={`w-12 h-7 rounded-full transition-all ${soundEnabled() ? 'bg-green-500' : 'bg-gray-300'}`}>
          <div class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all mt-1 ${soundEnabled() ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </button>

      {/* Professional Modules (by department) */}
      <div class="flex items-center gap-2 mb-1">
        <span class="text-lg">🎓</span>
        <p class="font-semibold text-gray-800">{t('academy.professional')}</p>
      </div>
      <p class="text-xs text-gray-500 mb-3">{t('academy.professionalDesc')}</p>
      <div class="space-y-2.5 mb-6">
        <For each={professionalModules}>
          {(module, i) => {
            const dept = () => getDepartment((module as any).dept);
            return (
              <button
                class="w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up overflow-hidden relative"
                style={`animation-delay: ${i() * 0.03}s`}
                onClick={() => startModule(module.id)}
              >
                <div class={`absolute inset-0 bg-gradient-to-r ${module.color} opacity-5`} />
                <div class="flex items-center gap-3 relative">
                  <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-md`}>
                    <span class="text-xl">{dept()?.icon || '📚'}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm truncate">{mName(module)}</p>
                    <p class="text-[10px] text-gray-400 truncate">{useRu() ? module.nameEn : module.name}</p>
                    <div class="flex items-center gap-1.5 mt-1">
                      <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">
                        {module.levels.length} {t('academy.levels')}
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                        ISO
                      </span>
                    </div>
                  </div>
                  <Icon name="chevronRight" class="text-gray-300" size="sm" />
                </div>
              </button>
            );
          }}
        </For>
      </div>

      {/* General Safety Modules */}
      <div class="flex items-center gap-2 mb-1">
        <span class="text-lg">🛡️</span>
        <p class="font-semibold text-gray-800">{t('academy.general')}</p>
      </div>
      <p class="text-xs text-gray-500 mb-3">{t('academy.generalDesc')}</p>
      <div class="space-y-2.5">
        <For each={generalModules}>
          {(module, i) => (
            <button
              class="w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up overflow-hidden relative"
              style={`animation-delay: ${i() * 0.03}s`}
              onClick={() => startModule(module.id)}
            >
              <div class={`absolute inset-0 bg-gradient-to-r ${module.color} opacity-5`} />
              <div class="flex items-center gap-3 relative">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-md`}>
                  <Icon name={module.icon as keyof typeof Icons} class="text-white" size="lg" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-gray-800 text-sm truncate">{mName(module)}</p>
                  <p class="text-[10px] text-gray-400 truncate">{useRu() ? module.nameEn : module.name}</p>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {module.levels.length} {t('academy.levels')}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                      ISO
                    </span>
                  </div>
                </div>
                <Icon name="chevronRight" class="text-gray-300" size="sm" />
              </div>
            </button>
          )}
        </For>
      </div>

      {/* Info Banner */}
      <div class="glass rounded-2xl p-4 border border-indigo-200 bg-indigo-50/30">
        <div class="flex items-start gap-3">
          <Icon name="globe" class="text-indigo-600" size="sm" />
          <div>
            <p class="font-medium text-indigo-800">{t('academy.standards')}</p>
            <p class="text-xs text-indigo-700 mt-1">
              {t('academy.standardsDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Game Screen
  // Helper: show Russian for Cyrillic-script langs, English for others
  const useRu = () => ['ru','uk','kk','ce','uz'].includes(currentLang());
  const qTitle = (l: any) => (!useRu() && l.titleEn) ? l.titleEn : l.title;
  const qQuestion = (l: any) => (!useRu() && l.questionEn) ? l.questionEn : l.question;
  const qOptions = (l: any) => (!useRu() && l.optionsEn) ? l.optionsEn : l.options;
  const qExplanation = (l: any) => (!useRu() && l.explanationEn) ? l.explanationEn : l.explanation;
  const mName = (m: any) => (!useRu() && m.nameEn) ? m.nameEn : m.name;

  const GameScreen = () => {
    const lv = () => currentLevelData();
    const md = () => currentModuleData();

    return (
      <div class="animate-fade-in">
        {/* Game Header */}
        <div class="glass rounded-3xl p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <button 
              class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center touch-scale"
              onClick={exitGame}
            >
              <Icon name="x" class="text-gray-600" size="sm" />
            </button>
            <div class="flex items-center gap-2">
              <For each={[...Array(3)]}>
                {(_, i) => (
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    i() < lives() ? 'bg-red-500 scale-100' : 'bg-gray-200 scale-75'
                  }`}>
                    <Icon name="heart" class={i() < lives() ? 'text-white' : 'text-gray-400'} size="xs" />
                  </div>
                )}
              </For>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">{t('academy.points')}</p>
              <p class="font-bold text-indigo-600">{score()}</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{currentLevel() + 1}/{totalLevels()}</span>
            <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class={`h-full bg-gradient-to-r ${md()?.color || ''} rounded-full transition-all duration-500`}
                style={`width: ${((currentLevel() + 1) / totalLevels()) * 100}%`}
              />
            </div>
            <Show when={streak() > 0}>
              <span class="text-xs font-bold text-amber-500 flex items-center gap-1">
                <Icon name="zap" size="xs" /> x{streak()}
              </span>
            </Show>
          </div>
        </div>

        {/* Question Card — reactive via lv()/md() */}
        <Show when={lv()}>
          <div class="glass rounded-3xl overflow-hidden mb-4">
            <div class={`bg-gradient-to-r ${md()?.color || ''} p-4`}>
              <p class="text-white/80 text-sm">{md() ? mName(md()) : ''}</p>
              <p class="text-white font-bold text-lg">{lv() ? qTitle(lv()) : ''}</p>
            </div>

            <div class="p-5">
              <div class="text-6xl text-center mb-4 animate-bounce-gentle">{lv()!.image}</div>
              <p class="text-gray-800 font-medium text-center text-lg mb-6">{qQuestion(lv())}</p>

              <div class="space-y-3">
                <For each={qOptions(lv())}>
                  {(option, i) => {
                    const isSelected = () => selectedAnswer() === i();
                    const isCorrectOpt = () => i() === lv()!.correct;
                    const revealed = () => showResult();
                    
                    const bgClass = () => {
                      if (revealed()) {
                        if (isCorrectOpt()) return 'bg-green-100 ring-2 ring-green-500';
                        if (isSelected()) return 'bg-red-100 ring-2 ring-red-500';
                      } else if (isSelected()) {
                        return 'bg-indigo-100 ring-2 ring-indigo-500';
                      }
                      return 'bg-gray-50 hover:bg-gray-100';
                    };

                    return (
                      <button
                        class={`w-full p-4 rounded-2xl text-left transition-all touch-scale ${bgClass()}`}
                        onClick={() => handleAnswer(i())}
                        disabled={showResult()}
                      >
                        <div class="flex items-center gap-3">
                          <div class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            revealed() && isCorrectOpt() ? 'bg-green-500 text-white' :
                            revealed() && isSelected() ? 'bg-red-500 text-white' :
                            isSelected() ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {revealed() && isCorrectOpt() ? '✓' : 
                             revealed() && isSelected() && !isCorrectOpt() ? '✗' : 
                             String.fromCharCode(65 + i())}
                          </div>
                          <span class={`flex-1 ${
                            revealed() && isCorrectOpt() ? 'text-green-700 font-medium' :
                            revealed() && isSelected() ? 'text-red-700' : 'text-gray-700'
                          }`}>
                            {option}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>

          {/* Result */}
          <Show when={showResult()}>
            <div class={`glass rounded-3xl p-5 animate-slide-up ${
              lastAnswer() === 'correct' ? 'border-2 border-green-400 bg-green-50/50' : 'border-2 border-red-400 bg-red-50/50'
            }`}>
              <div class="flex items-center gap-3 mb-3">
                <div class={`w-12 h-12 rounded-full flex items-center justify-center ${
                  lastAnswer() === 'correct' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  <Icon name={lastAnswer() === 'correct' ? 'check' : 'x'} class="text-white" size="sm" />
                </div>
                <div>
                  <p class={`font-bold text-lg ${lastAnswer() === 'correct' ? 'text-green-700' : 'text-red-700'}`}>
                    {lastAnswer() === 'correct' ? t('academy.correct') : t('academy.wrong')}
                  </p>
                  <Show when={lastAnswer() === 'correct' && streak() > 1}>
                    <p class="text-amber-600 text-sm font-medium">{t('academy.streak')}: {streak()} 🔥</p>
                  </Show>
                </div>
              </div>
              
              <div class="p-3 bg-white/50 rounded-xl mb-4">
                <p class="text-sm text-gray-700">
                  <span class="font-medium">{t('academy.explanation')}: </span>
                  {qExplanation(lv())}
                </p>
              </div>

              <button 
                class={`w-full py-4 rounded-2xl font-bold text-white shadow-lg touch-scale ${
                  currentLevel() < totalLevels() - 1 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600'
                }`}
                onClick={nextLevel}
              >
                {currentLevel() < totalLevels() - 1 ? t('academy.next') : t('academy.finish')}
              </button>
            </div>
          </Show>
        </Show>

        {/* Game Over */}
        <Show when={lives() === 0}>
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div class="glass rounded-3xl p-6 m-4 text-center animate-slide-up">
              <div class="text-6xl mb-4">😢</div>
              <p class="text-2xl font-bold text-gray-800 mb-2">Игра окончена</p>
              <p class="text-gray-600 mb-4">Ваш счёт: {score()}</p>
              <button 
                class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold touch-scale"
                onClick={() => { 
                  const m = currentModuleData();
                  if (m) setShuffledLevels(shuffleArray(m.levels));
                  setLives(3); setCurrentLevel(0); setScore(0); setShowResult(false); setSelectedAnswer(null); 
                }}
              >
                Попробовать снова
              </button>
              <button 
                class="w-full py-3 mt-2 glass rounded-2xl font-medium text-gray-700 touch-scale"
                onClick={exitGame}
              >
                Выйти в меню
              </button>
            </div>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div class="p-4 flex items-center gap-4">
        <button 
          class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
          onClick={gameStarted() ? exitGame : props.onBack}
        >
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-white">BOLH Academy</h1>
          <p class="text-white/60 text-sm">{t('academy.standards')}</p>
        </div>
      </div>

      <div class="px-4">
        <Show when={!gameStarted()}>
          <MainMenu />
        </Show>
        <Show when={gameStarted()}>
          <GameScreen />
        </Show>
      </div>
    </div>
  );
}

function LanguagePage(props: { onBack: () => void }) {
  const languages = getLanguages();
  const current = () => getCurrentLanguage();
  
  const handleSelect = (code: string) => {
    setLanguage(code as any);
  };

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="p-4 flex items-center gap-4">
        <button 
          class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
          onClick={props.onBack}
        >
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <h1 class="text-xl font-bold text-white">{t('profile.language')}</h1>
      </div>

      {/* Language Grid */}
      <div class="p-4 grid grid-cols-2 gap-3">
        <For each={languages}>
          {(lang, i) => {
            const isSelected = () => currentLang() === lang.code;
            return (
              <button
                class={`glass rounded-2xl p-4 text-left touch-scale animate-slide-up transition-all ${
                  isSelected() ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : ''
                }`}
                style={`animation-delay: ${i() * 0.03}s`}
                onClick={() => handleSelect(lang.code)}
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-2xl">{lang.flag}</span>
                  <Show when={isSelected()}>
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Icon name="check" class="text-white w-4 h-4" />
                    </div>
                  </Show>
                </div>
                <p class={`font-semibold ${isSelected() ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {lang.name}
                </p>
                <Show when={lang.rtl}>
                  <span class="text-xs text-gray-400 mt-1 inline-block">RTL</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Info */}
      <div class="p-4">
        <div class="glass rounded-2xl p-4 flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Icon name="globe" class="text-indigo-600" size="xs" />
          </div>
          <div>
            <p class="text-sm text-gray-600">
              <b>20</b> {t('profile.languageDesc')}
            </p>
            <p class="text-xs text-gray-400 mt-1">
              {t('profile.language')}: {current().name} {current().flag}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============== Rating Page ==============
function RatingPage(props: { onBack: () => void }) {
  const [stars, setStars] = createSignal(0);
  const [hoverStar, setHoverStar] = createSignal(0);
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [reviewText, setReviewText] = createSignal('');
  const [submitted, setSubmitted] = createSignal(false);
  const [tapping, setTapping] = createSignal(false);

  const profession = getDepartment('plumbing');
  const worker = { name: 'Алексей К.', rating: 4.8, avatar: '👨‍✈️', profession };
  const workerTitle = () => profession ? (getCurrentLanguage().code === 'en' ? profession.workerTitleEn : profession.workerTitle) : 'Professional';

  const ratingLabels: Record<number, string> = {
    1: t('rating.terrible'),
    2: t('rating.bad'),
    3: t('rating.ok'),
    4: t('rating.good'),
    5: t('rating.excellent'),
  };

  const positiveTags = [
    { id: 'punctual', key: 'rating.tags.punctual' },
    { id: 'professional', key: 'rating.tags.professional' },
    { id: 'clean', key: 'rating.tags.clean' },
    { id: 'price', key: 'rating.tags.price' },
    { id: 'recommend', key: 'rating.tags.recommend' },
  ];
  const negativeTags = [
    { id: 'late', key: 'rating.tags.late' },
    { id: 'rude', key: 'rating.tags.rude' },
    { id: 'poor', key: 'rating.tags.poor' },
  ];

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const displayStars = () => hoverStar() || stars();
  const label = () => ratingLabels[displayStars() as keyof typeof ratingLabels] || '';

  return (
    <div class="min-h-screen animate-fade-in">
      <Show when={!submitted()} fallback={
        <div class="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-indigo-600/20 to-transparent">
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-6 animate-scale-in shadow-2xl">
            <Icon name="check" class="text-white w-12 h-12" />
          </div>
          <h2 class="text-2xl font-bold text-white mb-2">{t('rating.thanks')}</h2>
          <p class="text-white/70 text-center mb-8">Your review helps our community</p>
          <button
            onClick={props.onBack}
            class="px-8 py-3 rounded-2xl bg-white/10 text-white font-medium touch-scale"
          >
            {t('nav.orders')}
          </button>
        </div>
      }>
        {/* Header with gradient and worker */}
        <div class={`relative overflow-hidden rounded-b-3xl pb-8 pt-4 px-4 ${isDark() ? 'bg-gray-900' : ''}`}>
          <div class="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 opacity-90" />
          <div class="absolute inset-0 bg-black/20" />
          <div class="relative flex items-center gap-4">
            <button onClick={props.onBack} class="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center touch-scale">
              <Icon name="chevronLeft" class="text-white" size="sm" />
            </button>
            <h1 class="text-xl font-bold text-white">{t('rating.title')}</h1>
          </div>
          <div class="relative mt-6 flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-white/30 backdrop-blur flex items-center justify-center text-3xl shadow-lg">
              {worker.avatar}
            </div>
            <div>
              <p class="font-bold text-white text-lg">{worker.name}</p>
              <p class="text-white/90 text-sm">{workerTitle()}</p>
              <p class="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                <Icon name="star" class="text-amber-300 w-4 h-4" />
                {worker.rating}
              </p>
            </div>
          </div>
        </div>

        <div class="px-4 -mt-4">
          <div class="glass rounded-3xl p-6 shadow-xl">
            <p class="text-gray-700 font-medium mb-4">{t('rating.howWas')}</p>
            <div class="flex justify-center gap-2 mb-4">
              <For each={[1, 2, 3, 4, 5]}>
                {(n) => (
                  <button
                    type="button"
                    class={`p-1 transition-transform duration-150 touch-scale ${tapping() ? 'scale-110' : ''}`}
                    onMouseDown={() => setTapping(true)}
                    onMouseUp={() => setTapping(false)}
                    onTouchStart={() => setTapping(true)}
                    onTouchEnd={() => setTapping(false)}
                    onClick={() => setStars(n)}
                    onMouseEnter={() => setHoverStar(n)}
                    onMouseLeave={() => setHoverStar(0)}
                  >
                    <Icon
                      name="star"
                      class={n <= displayStars() ? 'text-amber-400' : 'text-gray-300'}
                      size="lg"
                    />
                  </button>
                )}
              </For>
            </div>
            <p class="text-center text-sm font-medium text-amber-600 min-h-[1.5rem]">{label()}</p>

            <p class="text-sm text-gray-500 mt-5 mb-2">Quick feedback</p>
            <div class="flex flex-wrap gap-2 mb-2">
              <For each={positiveTags}>
                {(tag) => (
                  <button
                    type="button"
                    class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all touch-scale border-2 ${
                      selectedTags().includes(tag.id)
                        ? 'bg-green-100 border-green-500 text-green-700'
                        : 'bg-gray-100 border-transparent text-gray-600'
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {t(tag.key)}
                  </button>
                )}
              </For>
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={negativeTags}>
                {(tag) => (
                  <button
                    type="button"
                    class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all touch-scale border-2 ${
                      selectedTags().includes(tag.id)
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : 'bg-gray-100 border-transparent text-gray-600'
                    }`}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {t(tag.key)}
                  </button>
                )}
              </For>
            </div>

            <textarea
              placeholder={t('rating.writeReview')}
              class="w-full mt-4 p-4 rounded-2xl border border-gray-200 bg-gray-50 min-h-[100px] text-gray-800 placeholder-gray-400 resize-none focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
              value={reviewText()}
              onInput={(e) => setReviewText(e.currentTarget.value)}
            />
            <button
              type="button"
              class="w-full mt-3 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 flex items-center justify-center gap-2 touch-scale"
            >
              <Icon name="camera" class="text-gray-400" size="sm" />
              <span class="text-sm">Add photo</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              class="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-bold text-lg shadow-lg touch-scale flex items-center justify-center gap-2"
            >
              {t('rating.submit')}
            </button>
          </div>
        </div>
        </Show>
    </div>
  );
}

// ============== Auth Page ==============
const COUNTRY_CODES = [
  { code: 'KZ', flag: '🇰🇿', dial: '+7' },
  { code: 'RU', flag: '🇷🇺', dial: '+7' },
  { code: 'FR', flag: '🇫🇷', dial: '+33' },
  { code: 'US', flag: '🇺🇸', dial: '+1' },
  { code: 'DE', flag: '🇩🇪', dial: '+49' },
  { code: 'GB', flag: '🇬🇧', dial: '+44' },
  { code: 'CN', flag: '🇨🇳', dial: '+86' },
  { code: 'TR', flag: '🇹🇷', dial: '+90' },
];

function AuthPage(props: { onComplete: () => void }) {
  const [step, setStep] = createSignal<1 | 2 | 3>(1);
  const [country, setCountry] = createSignal(COUNTRY_CODES[0]);
  const [phone, setPhone] = createSignal('');
  const [code, setCode] = createSignal<string[]>(['', '', '', '']);
  const [name, setName] = createSignal('');
  const [isWorker, setIsWorker] = createSignal(false);
  const [resendTimer, setResendTimer] = createSignal(30);
  const [showCountryPicker, setShowCountryPicker] = createSignal(false);

  createEffect(() => {
    if (step() !== 2) return;
    const id = setInterval(() => {
      setResendTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  });

  const setCodeDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setCode(prev => {
      const next = [...prev];
      next[index] = digit;
      if (next.every(d => d)) setTimeout(() => setStep(3), 300);
      return next;
    });
    if (digit && index < 3) {
      const nextInput = document.querySelector(`input[name="code-${index + 1}"]`) as HTMLInputElement;
      nextInput?.focus();
    }
  };

  return (
    <div class="min-h-screen flex flex-col animate-fade-in">
      <Switch>
        <Match when={step() === 1}>
          <div class="flex-1 flex flex-col p-6 pt-12">
            <div class="text-center mb-10">
              <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                BOLH
              </h1>
              <p class="text-xs text-white/40 mt-1 tracking-widest">BUILD ONLINE LINK HUB</p>
              <p class="text-xl text-white mt-4">{t('auth.welcome')}</p>
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-white/80 mb-2">{t('auth.phone')}</label>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(true)}
                  class="flex items-center gap-2 px-4 py-4 rounded-2xl glass min-w-[100px] touch-scale"
                >
                  <span class="text-xl">{country().flag}</span>
                  <span class="text-gray-800 font-medium">{country().dial}</span>
                  <Icon name="chevronRight" class="text-gray-500 w-4 h-4" />
                </button>
                <input
                  type="tel"
                  placeholder="700 123 4567"
                  class="flex-1 px-4 py-4 rounded-2xl glass text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  value={phone()}
                  onInput={(e) => setPhone(e.currentTarget.value.replace(/\D/g, '').slice(0, 12))}
                />
              </div>
            </div>
            <button
              onClick={() => { setResendTimer(30); setStep(2); }}
              class="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-lg touch-scale"
            >
              {t('auth.continue')}
            </button>
            <p class="text-center text-xs text-white/50 mt-6">{t('auth.terms')}</p>
          </div>
          <Show when={showCountryPicker()}>
            <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowCountryPicker(false)}>
              <div class="w-full max-w-md glass rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <p class="font-semibold text-gray-800 mb-4">Select country</p>
                <For each={COUNTRY_CODES}>
                  {(c) => (
                    <button
                      type="button"
                      class="w-full flex items-center gap-3 py-3 rounded-xl touch-scale hover:bg-gray-100"
                      onClick={() => { setCountry(c); setShowCountryPicker(false); }}
                    >
                      <span class="text-2xl">{c.flag}</span>
                      <span class="text-gray-800">{c.code}</span>
                      <span class="text-gray-500">{c.dial}</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </Match>

        <Match when={step() === 2}>
          <div class="flex-1 flex flex-col p-6 pt-12">
            <button onClick={() => setStep(1)} class="self-start w-10 h-10 rounded-full glass flex items-center justify-center touch-scale mb-6">
              <Icon name="chevronLeft" class="text-gray-700" size="sm" />
            </button>
            <h2 class="text-2xl font-bold text-white mb-2">{t('auth.enterCode')}</h2>
            <p class="text-white/70 mb-8">We sent a code to {country().dial} {phone()}</p>
            <div class="flex justify-center gap-3 mb-6">
              <For each={[0, 1, 2, 3]}>
                {(i) => (
                  <input
                    name={`code-${i}`}
                    type="text"
                    inputmode="numeric"
                    maxlength={1}
                    class="w-14 h-14 rounded-2xl glass text-center text-xl font-bold text-gray-800"
                    value={code()[i]}
                    onInput={(e) => setCodeDigit(i, e.currentTarget.value)}
                  />
                )}
              </For>
            </div>
            <p class="text-center text-white/70 text-sm">
              {resendTimer() > 0 ? `Resend in 0:${String(resendTimer()).padStart(2, '0')}` : (
                <button type="button" class="text-indigo-400 font-medium" onClick={() => setResendTimer(30)}>
                  {t('auth.resend')}
                </button>
              )}
            </p>
          </div>
        </Match>

        <Match when={step() === 3}>
          <div class="flex-1 flex flex-col p-6 pt-12">
            <h2 class="text-2xl font-bold text-white mb-2">{t('auth.yourName')}</h2>
            <input
              type="text"
              placeholder="Alex"
              class="w-full px-4 py-4 rounded-2xl glass text-gray-800 placeholder-gray-400 mb-6 outline-none focus:ring-2 focus:ring-indigo-500"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <p class="text-sm font-medium text-white/80 mb-3">{t('auth.iAm')}</p>
            <div class="flex gap-3 mb-8">
              <button
                type="button"
                class={`flex-1 py-4 rounded-2xl font-medium touch-scale transition-all ${!isWorker() ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'glass text-gray-600'}`}
                onClick={() => setIsWorker(false)}
              >
                {t('auth.client')}
              </button>
              <button
                type="button"
                class={`flex-1 py-4 rounded-2xl font-medium touch-scale transition-all ${isWorker() ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg' : 'glass text-gray-600'}`}
                onClick={() => setIsWorker(true)}
              >
                {t('auth.worker')}
              </button>
            </div>
            <button
              onClick={() => props.onComplete()}
              class="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-lg touch-scale mt-auto"
            >
              {t('auth.getStarted')}
            </button>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

function ProfilePage(props: { onNavigate: (page: string) => void }) {
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
    { icon: 'book', label: t('profile.academy'), desc: t('profile.academyDesc'), action: 'academy', highlight: true },
    { icon: 'folder', label: t('profile.documents'), desc: t('profile.documentsDesc'), action: 'documents', highlight: true },
    { icon: 'userCheck', label: t('profile.verification'), desc: '33% • ' + t('profile.verificationDesc'), action: 'verification', highlight: true },
    { icon: 'globe', label: t('profile.language'), desc: getCurrentLanguage().name + ' ' + getCurrentLanguage().flag, action: 'language' },
    { icon: isDark() ? 'moon' : 'sun', label: t('profile.theme'), desc: themeLabel(), action: 'theme' },
    { icon: 'wallet', label: t('nav.wallet'), desc: 'BOLH Coin + Blockchain', action: 'wallet', highlight: true },
    { icon: 'award', label: t('achievements.title'), desc: t('achievements.subtitle'), action: 'achievements' },
    { icon: 'activity', label: t('analytics.title'), desc: t('analytics.subtitle'), action: 'analytics' },
    { icon: 'target', label: t('marketplace.title'), desc: t('marketplace.subtitle'), action: 'marketplace' },
    { icon: 'shield', label: t('profile.security'), desc: t('profile.securityDesc'), action: 'security', highlight: true },
    { icon: 'settings', label: t('settings.title'), desc: t('settings.subtitle'), action: 'settings' },
  ];

  return (
    <div class="p-4 animate-fade-in">
      {/* Профиль + статус */}
      <div class="glass rounded-3xl p-6 mb-4 text-center animate-slide-up">
        <div class="relative inline-block mb-4">
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl text-white font-bold shadow-xl">
            AM
          </div>
          <div class={`absolute bottom-0 right-0 w-8 h-8 ${statusColor()} rounded-full border-4 border-white flex items-center justify-center`}>
            <Icon name="check" class="text-white w-4 h-4" />
          </div>
        </div>
        <h1 class="text-xl font-bold text-gray-800">AMIR MURTAZOV</h1>
        <p class="text-gray-500">+7 (777) 123-45-67</p>

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
            <p class="text-2xl font-bold text-indigo-600">15</p>
            <p class="text-xs text-gray-500">{t('profile.orders')}</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-amber-500">4.8</p>
            <p class="text-xs text-gray-500">{t('profile.rating')}</p>
          </div>
          <div class="text-center">
            <p class="text-2xl font-bold text-green-500">2</p>
            <p class="text-xs text-gray-500">{t('profile.years')}</p>
          </div>
        </div>
      </div>

      {/* Мои профессии / Мне нужно — с переключателем */}
      <div class="glass rounded-3xl p-4 mb-4 animate-slide-up" style="animation-delay: 0.05s">
        {/* Toggle: Я мастер ↔ Мне нужно */}
        <div class="flex items-center mb-3 gap-2">
          <div class="flex-1 flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1">
            <button
              type="button"
              class={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                profileMode() === 'worker'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                  : isDark() ? 'text-gray-400' : 'text-gray-500'
              }`}
              onClick={() => setProfileMode('worker')}
            >
              {currentLang() === 'en' ? '🛠 I Work' : '🛠 Я мастер'}
            </button>
            <button
              type="button"
              class={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                profileMode() === 'client'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : isDark() ? 'text-gray-400' : 'text-gray-500'
              }`}
              onClick={() => setProfileMode('client')}
            >
              {currentLang() === 'en' ? '🔍 I Need' : '🔍 Мне нужно'}
            </button>
          </div>
        </div>
        <p class={`text-xs mb-2 ${isDark() ? 'text-gray-400' : 'text-gray-500'}`}>
          {profileMode() === 'worker'
            ? (totalActiveSkills() + ' ' + (currentLang() === 'en' ? 'skills' : 'навыков') + ' • ' + activeDeptCount() + ' ' + (currentLang() === 'en' ? 'departments' : 'отделов'))
            : (clientNeeds().length + ' ' + (currentLang() === 'en' ? 'services selected' : 'услуг выбрано'))
          }
        </p>
        <div class="grid grid-cols-3 gap-2.5">
          <For each={departments}>
            {(dept) => {
              // Worker mode: uses workerSkills. Client mode: uses clientNeeds.
              const isWorkerMode = () => profileMode() === 'worker';
              const active = () => isWorkerMode() ? isDeptActive(dept.id) : dept.skills.some(s => clientNeeds().includes(s.id));
              const count = () => isWorkerMode() ? deptSkillCount(dept.id) : dept.skills.filter(s => clientNeeds().includes(s.id)).length;
              const dName = () => currentLang() === 'en' ? dept.nameEn : dept.name;
              const hasLockedSkills = () => isWorkerMode() && dept.skills.some(s => s.requiresDiploma && !verifiedDiplomas().includes(s.id));
              return (
                <div
                  class={`relative rounded-2xl p-2.5 touch-scale flex flex-col items-center text-center transition-all cursor-pointer ${
                    active() ? 'shadow-md' : 'opacity-50'
                  }`}
                  style={active()
                    ? `background: linear-gradient(135deg, ${dept.colorFrom}12, ${dept.colorTo}08); border: 2px solid ${dept.colorFrom}30`
                    : isDark() ? 'background: rgba(255,255,255,0.04); border: 2px solid transparent' : 'background: rgba(0,0,0,0.03); border: 2px solid transparent'
                  }
                  onClick={() => {
                    if (isWorkerMode()) {
                      setActiveDepartment(dept.id); props.onNavigate('skilldetail');
                    } else {
                      // Client mode: toggle all services in dept
                      const deptSkillIds = dept.skills.map(s => s.id);
                      const cur = clientNeeds();
                      const hasSome = deptSkillIds.some(id => cur.includes(id));
                      if (hasSome) {
                        setClientNeeds(cur.filter(id => !deptSkillIds.includes(id)));
                      } else {
                        setClientNeeds([...cur, ...deptSkillIds]);
                      }
                    }
                  }}
                >
                  {/* Кружок вкл/выкл в правом верхнем углу */}
                  <button
                    type="button"
                    class="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center touch-scale z-10 border-2 border-white shadow"
                    style={active()
                      ? (isWorkerMode() ? 'background: linear-gradient(135deg, #22c55e, #16a34a)' : 'background: linear-gradient(135deg, #f59e0b, #ea580c)')
                      : (isDark() ? 'background: #4b5563' : 'background: #e5e7eb')
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isWorkerMode()) { toggleDept(dept.id); }
                      else {
                        const deptSkillIds = dept.skills.map(s => s.id);
                        const cur = clientNeeds();
                        const hasSome = deptSkillIds.some(id => cur.includes(id));
                        if (hasSome) { setClientNeeds(cur.filter(id => !deptSkillIds.includes(id))); }
                        else { setClientNeeds([...cur, ...deptSkillIds]); }
                      }
                    }}
                  >
                    <Show when={active()}>
                      <Icon name="check" class="text-white w-3 h-3" />
                    </Show>
                  </button>
                  <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${dept.color} flex items-center justify-center mb-1.5 shadow ${active() ? '' : 'grayscale opacity-40'}`}>
                    <span class="text-xl">{dept.icon}</span>
                  </div>
                  <p class={`font-medium text-[10px] leading-tight ${active() ? (isDark() ? 'text-gray-200' : 'text-gray-800') : (isDark() ? 'text-gray-500' : 'text-gray-400')}`}>{dName()}</p>
                  <Show when={count() > 0}>
                    <span
                      class="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow"
                      style={`background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo})`}
                    >
                      {count()}
                    </span>
                  </Show>
                  <Show when={hasLockedSkills() && active()}>
                    <span class="absolute bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[9px] shadow">🔒</span>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>

      </div>

      {/* Модальное окно подтверждения диплома */}
      <Show when={showDiplomaPrompt()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-6" onClick={() => setShowDiplomaPrompt(null)}>
          <div class={`glass rounded-3xl p-6 max-w-sm w-full animate-slide-up ${isDark() ? 'bg-gray-800' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-5">
              <div class="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-3">
                <span class="text-3xl">🎓</span>
              </div>
              <h3 class={`text-lg font-bold ${isDark() ? 'text-gray-100' : 'text-gray-800'}`}>{t('skills.diplomaRequired')}</h3>
              <p class={`text-sm mt-2 ${isDark() ? 'text-gray-400' : 'text-gray-500'}`}>{t('skills.diplomaUpload')}</p>
            </div>
            <button
              type="button"
              class="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-semibold mb-3 touch-scale flex items-center justify-center gap-2"
              onClick={() => showDiplomaPrompt() && confirmDiploma(showDiplomaPrompt()!)}
            >
              <Icon name="uploadCloud" class="text-white" size="sm" />
              {t('skills.uploadDiploma')}
            </button>
            <button
              type="button"
              class="w-full py-3 glass rounded-2xl text-gray-600 dark:text-gray-300 font-medium touch-scale"
              onClick={() => setShowDiplomaPrompt(null)}
            >
              {t('skills.later')}
            </button>
          </div>
        </div>
      </Show>

      {/* Меню */}
      <div class="glass rounded-3xl overflow-hidden animate-slide-up" style="animation-delay: 0.1s">
        <For each={menuItems()}>
          {(item) => {
            const getIconStyle = () => {
              switch (item.icon) {
                case 'settings': return { bg: 'from-violet-500 to-purple-600', text: 'text-white' };
                case 'book': return { bg: 'from-amber-400 to-orange-500', text: 'text-white' };
                case 'folder': return { bg: 'from-blue-400 to-cyan-500', text: 'text-white' };
                case 'userCheck': return { bg: 'from-green-400 to-emerald-500', text: 'text-white' };
                case 'shield': return { bg: 'from-red-500 to-rose-600', text: 'text-white' };
                case 'globe': return { bg: 'from-indigo-100 to-purple-100', text: 'text-indigo-600' };
                case 'sun': return { bg: 'from-amber-100 to-orange-100', text: 'text-amber-600' };
                case 'moon': return { bg: 'from-indigo-100 to-purple-100', text: 'text-indigo-600' };
                default: return { bg: 'from-gray-100 to-gray-200', text: 'text-gray-600' };
              }
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
                <Icon name={isSpecial ? 'play' : 'chevronRight'} class={isSpecial ? 'text-amber-500' : 'text-gray-400'} size="sm" />
              </button>
            );
          }}
        </For>
      </div>

      <button class="w-full mt-6 glass rounded-3xl p-4 flex items-center justify-center gap-3 touch-scale animate-slide-up" style="animation-delay: 0.2s">
        <Icon name="logout" class="text-red-500" />
        <span class="font-medium text-red-500">{t('profile.logout')}</span>
      </button>
    </div>
  );
}

// ============== Security Center Page ==============
function SecurityCenterPage(props: { onBack: () => void }) {
  const [securityScore] = createSignal(72);
  const [pinEnabled, setPinEnabled] = createSignal(false);
  const [biometricEnabled, setBiometricEnabled] = createSignal(false);
  const [twoFAEnabled, setTwoFAEnabled] = createSignal(true);
  const [autoLockMin, setAutoLockMin] = createSignal(5);
  const [showPinSetup, setShowPinSetup] = createSignal(false);
  const [pinDigits, setPinDigits] = createSignal<number[]>([]);
  const [pinStep, setPinStep] = createSignal<'set' | 'confirm'>('set');
  const [firstPin, setFirstPin] = createSignal('');
  const [pinSuccess, setPinSuccess] = createSignal(false);
  const [locationSharing, setLocationSharing] = createSignal(true);
  const [profileVisibility, setProfileVisibility] = createSignal(true);
  const [onlineStatus, setOnlineStatus] = createSignal(true);
  const [readReceipts, setReadReceipts] = createSignal(true);
  const [activityStatus, setActivityStatus] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  const scoreColor = () => {
    const s = securityScore();
    if (s < 40) return { stroke: '#ef4444', gradient: 'from-red-500 to-rose-600' };
    if (s < 70) return { stroke: '#f59e0b', gradient: 'from-amber-500 to-orange-500' };
    return { stroke: '#22c55e', gradient: 'from-emerald-500 to-green-600' };
  };
  const circumference = 2 * Math.PI * 44;
  const strokeDashOffset = () => circumference - (securityScore() / 100) * circumference;
  const [ringOffset, setRingOffset] = createSignal(circumference);
  onMount(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setRingOffset(strokeDashOffset())));
    return () => cancelAnimationFrame(t);
  });

  const quickActions = () => [
    { id: 'pin', label: 'PIN Lock', icon: 'lock' as const, enabled: pinEnabled(), toggle: () => { if (!pinEnabled()) setShowPinSetup(true); else setPinEnabled(false); }, value: pinEnabled() ? 'ON' : 'OFF' },
    { id: 'bio', label: 'Biometric', icon: 'fingerprint' as const, enabled: biometricEnabled(), toggle: () => setBiometricEnabled(!biometricEnabled()), value: biometricEnabled() ? 'ON' : 'OFF' },
    { id: '2fa', label: '2FA', icon: 'shield' as const, enabled: twoFAEnabled(), toggle: () => setTwoFAEnabled(!twoFAEnabled()), value: twoFAEnabled() ? 'ON' : 'OFF' },
    { id: 'autolock', label: 'Auto-Lock', icon: 'clock' as const, enabled: true, toggle: () => setAutoLockMin(autoLockMin() === 5 ? 15 : autoLockMin() === 15 ? 30 : 5), value: `${autoLockMin()} min` },
  ];

  const addPinDigit = (d: number) => {
    if (pinDigits().length >= 4) return;
    const next = [...pinDigits(), d];
    setPinDigits(next);
    if (pinStep() === 'set' && next.length === 4) {
      setFirstPin(next.join(''));
      setPinDigits([]);
      setPinStep('confirm');
    } else if (pinStep() === 'confirm' && next.length === 4) {
      if (next.join('') === firstPin()) {
        setPinSuccess(true);
        setPinEnabled(true);
        setTimeout(() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); setPinSuccess(false); }, 1200);
      } else {
        setPinDigits([]);
      }
    }
  };
  const backspacePin = () => setPinDigits(pinDigits().slice(0, -1));

  const privacyToggles = () => [
    { label: 'Share live location during active orders', key: 'location', value: locationSharing(), set: setLocationSharing },
    { label: 'Show profile to non-clients', key: 'profile', value: profileVisibility(), set: setProfileVisibility },
    { label: "Show when I'm online", key: 'online', value: onlineStatus(), set: setOnlineStatus },
    { label: "Show when I've read messages", key: 'read', value: readReceipts(), set: setReadReceipts },
    { label: 'Show last active time', key: 'activity', value: activityStatus(), set: setActivityStatus },
  ];

  const sessions = () => [
    { id: '1', device: 'Samsung Galaxy A54', current: true, lastActive: null },
    { id: '2', device: 'iPhone 14 Pro', current: false, lastActive: '2h ago' },
    { id: '3', device: 'Chrome Windows', current: false, lastActive: '5h ago' },
  ];

  const activityLog = () => [
    { id: '1', icon: 'globe' as const, title: 'Login from new device', time: '2 hours ago', meta: 'Samsung A54', alert: false },
    { id: '2', icon: 'lock' as const, title: 'Password changed', time: '3 days ago', meta: '', alert: false },
    { id: '3', icon: 'lock' as const, title: 'PIN code updated', time: '1 week ago', meta: '', alert: false },
    { id: '4', icon: 'map' as const, title: 'New session', time: '2 weeks ago', meta: 'Moscow, Russia', alert: false },
    { id: '5', icon: 'alertCircle' as const, title: 'Suspicious login attempt blocked', time: '3 weeks ago', meta: '', alert: true },
  ];

  const emergencyContacts = () => [
    { id: '1', name: 'Maria Ivanova', phone: '+7 777 111-22-33', relationship: 'Spouse' },
    { id: '2', name: 'Emergency Service', phone: '112', relationship: 'Emergency' },
  ];

  const dataCards = () => [
    { id: 'e2e', icon: 'shield' as const, title: 'End-to-end encryption', desc: 'All messages are encrypted', color: 'from-emerald-500 to-green-600' },
    { id: 'docs', icon: 'lock' as const, title: 'Secure document storage', desc: 'Documents encrypted with AES-256', color: 'from-blue-500 to-cyan-500' },
    { id: 'pay', icon: 'creditCard' as const, title: 'Payment protection', desc: 'All payments processed securely', color: 'from-violet-500 to-purple-600' },
    { id: 'backup', icon: 'settings' as const, title: 'Data backup', desc: 'Encrypted cloud backup enabled', color: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div class="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div class="p-4">
        <div class="flex items-center gap-4 mb-2">
          <button class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale" onClick={props.onBack}>
            <Icon name="chevronLeft" class={isDark() ? 'text-gray-300' : 'text-gray-700'} size="sm" />
          </button>
          <h1 class="text-xl font-bold text-gray-800 flex-1">{t('profile.security')}</h1>
        </div>
      </div>

      <Show when={!showPinSetup()}>
        {/* Section 1: Security Score */}
        <div class="px-4 mb-4 animate-slide-up">
          <div class="glass rounded-3xl p-6 overflow-hidden">
            <div class="bg-gradient-to-br from-red-500/10 via-rose-500/10 to-amber-500/10 -m-6 p-6 rounded-3xl">
              <div class="flex flex-col items-center">
                <div class="relative w-32 h-32" style="animation: none">
                  <svg class="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" stroke={isDark() ? 'rgba(71,85,105,0.5)' : 'rgba(0,0,0,0.06)'} stroke-width="10" fill="none" />
                    <circle cx="50" cy="50" r="44" stroke={scoreColor().stroke} stroke-width="10" fill="none" stroke-linecap="round"
                      stroke-dasharray={`${circumference}`}
                      stroke-dashoffset={ringOffset()}
                      style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                    />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-3xl font-bold text-gray-800">{securityScore()}</span>
                    <span class="text-sm text-gray-500">/100</span>
                  </div>
                </div>
                <p class="text-sm font-medium text-gray-600 mt-3">Your security score</p>
                <p class="text-xs text-gray-500">Improve your security</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Quick Security Actions */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.05s">
          <div class="glass rounded-3xl p-4">
            <p class="text-sm font-semibold text-gray-800 mb-3 px-1">Quick security actions</p>
            <div class="flex gap-3 overflow-x-auto pb-1 -mx-1 scrollbar-hide">
              <For each={quickActions()}>
                {(action, i) => (
                  <button
                    type="button"
                    onClick={() => action.toggle()}
                    class="flex-shrink-0 w-28 glass rounded-2xl p-4 touch-scale flex flex-col items-center gap-2 animate-slide-up relative"
                    style={`animation-delay: ${0.08 + i() * 0.03}s`}
                  >
                    <div class={`w-12 h-12 rounded-xl flex items-center justify-center ${action.enabled ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gray-200'}`}>
                      <Icon name={action.icon} class="text-white" size="sm" />
                    </div>
                    <span class="text-xs font-medium text-gray-800">{action.label}</span>
                    <span class="text-[10px] text-gray-500">{action.value}</span>
                    <Show when={action.enabled && (action.id === 'pin' || action.id === 'bio' || action.id === '2fa')}>
                      <Icon name="checkCircle" class="text-green-500 w-4 h-4 absolute top-2 right-2" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 3 is PIN Setup - shown in Show when showPinSetup */}

        {/* Section 4: Privacy Controls */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.1s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Privacy controls</p>
            </div>
            <div class="divide-y divide-gray-100">
              <For each={privacyToggles()}>
                {(item, i) => (
                  <div class="flex items-center justify-between px-4 py-3 animate-slide-up" style={`animation-delay: ${0.12 + i() * 0.02}s`}>
                    <span class="text-sm text-gray-800 pr-4">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.value}
                      onClick={() => item.set(!item.value)}
                      class={`relative w-12 h-7 rounded-full transition-colors ${item.value ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span class={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${item.value ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 5: Active Sessions */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.15s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Active sessions</p>
            </div>
            <div class="p-4 space-y-3">
              <For each={sessions()}>
                {(s) => (
                  <div class="flex items-center justify-between glass rounded-2xl p-3">
                    <div class="flex items-center gap-3">
                      <span class={`w-2.5 h-2.5 rounded-full ${s.current ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <p class="text-sm font-medium text-gray-800">{s.device}</p>
                        <p class="text-xs text-gray-500">{s.current ? 'Current device' : `Last active ${s.lastActive}`}</p>
                      </div>
                    </div>
                    <Show when={!s.current}>
                      <button type="button" class="text-red-500 text-sm font-medium touch-scale">Sign out</button>
                    </Show>
                  </div>
                )}
              </For>
              <button type="button" class="w-full py-2.5 text-center text-red-500 text-sm font-medium touch-scale rounded-xl border border-red-200">
                Sign out all other devices
              </button>
            </div>
          </div>
        </div>

        {/* Section 6: Activity Log */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.18s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Activity log</p>
            </div>
            <div class="p-4 space-y-2">
              <For each={activityLog()}>
                {(e, i) => (
                  <div class={`flex items-center gap-3 p-3 rounded-xl animate-slide-up ${e.alert ? 'bg-red-50 border border-red-100' : ''}`} style={`animation-delay: ${0.2 + i() * 0.02}s`}>
                    <div class={`w-9 h-9 rounded-lg flex items-center justify-center ${e.alert ? 'bg-red-100' : 'bg-gray-100'}`}>
                      <Icon name={e.icon} class={e.alert ? 'text-red-600' : 'text-gray-600'} size="sm" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class={`text-sm font-medium ${e.alert ? 'text-red-700' : 'text-gray-800'}`}>{e.title}</p>
                      <p class="text-xs text-gray-500">{e.time}{e.meta ? ` • ${e.meta}` : ''}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 7: Emergency Contacts */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.21s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Emergency contacts</p>
            </div>
            <p class="px-4 pt-2 text-xs text-gray-500">These contacts will be notified in emergency</p>
            <div class="p-4 space-y-2">
              <For each={emergencyContacts()}>
                {(c) => (
                  <div class="flex items-center justify-between glass rounded-2xl p-3">
                    <div>
                      <p class="text-sm font-medium text-gray-800">{c.name}</p>
                      <p class="text-xs text-gray-500">{c.phone} • {c.relationship}</p>
                    </div>
                    <button type="button" class="text-red-500 p-1 touch-scale"><Icon name="trash" size="xs" /></button>
                  </div>
                )}
              </For>
              <button type="button" class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium touch-scale flex items-center justify-center gap-2">
                <Icon name="plus" size="sm" /> Add contact
              </button>
            </div>
          </div>
        </div>

        {/* Section 8: Data & Encryption */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.24s">
          <div class="glass rounded-3xl overflow-hidden">
            <div class="bg-gradient-to-r from-rose-500/20 to-red-500/20 px-4 py-3">
              <p class="text-sm font-semibold text-gray-800">Data & encryption</p>
            </div>
            <div class="p-4 grid gap-3">
              <For each={dataCards()}>
                {(card, i) => (
                  <div class={`flex items-center gap-4 glass rounded-2xl p-4 animate-slide-up`} style={`animation-delay: ${0.26 + i() * 0.02}s`}>
                    <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon name={card.icon} class="text-white" size="sm" />
                    </div>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-800">{card.title}</p>
                      <p class="text-xs text-gray-500">{card.desc}</p>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Section 9: Danger Zone */}
        <div class="px-4 mb-4 animate-slide-up" style="animation-delay: 0.28s">
          <div class="glass rounded-3xl overflow-hidden border-2 border-red-200/50 bg-red-50/30">
            <div class="bg-gradient-to-r from-red-500/30 to-rose-600/30 px-4 py-3">
              <p class="text-sm font-semibold text-red-800">Danger zone</p>
            </div>
            <div class="p-4 space-y-2">
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale">
                <span>Delete all data</span>
                <span class="text-xs opacity-80">Erases local data</span>
              </button>
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale" onClick={() => setShowDeleteConfirm(true)}>
                <span>Deactivate account</span>
                <span class="text-xs opacity-80">With confirmation</span>
              </button>
              <button type="button" class="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-white/80 text-red-600 text-sm font-medium touch-scale">
                <span>Export my data</span>
                <span class="text-xs opacity-80">GDPR compliance</span>
              </button>
            </div>
          </div>
        </div>
        <Show when={showDeleteConfirm()}>
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
            <div class="glass rounded-3xl p-6 max-w-sm w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <p class="text-lg font-semibold text-gray-800 mb-2">Deactivate account?</p>
              <p class="text-sm text-gray-500 mb-4">This will disable your account. You can reactivate later by logging in.</p>
              <div class="flex gap-3">
                <button type="button" class="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-800 font-medium touch-scale" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button type="button" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium touch-scale" onClick={() => { setShowDeleteConfirm(false); }}>Deactivate</button>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      {/* PIN Setup overlay */}
      <Show when={showPinSetup()}>
        <div class="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-rose-600 via-red-500 to-rose-700 animate-fade-in">
          <div class="p-4 flex items-center gap-4">
            <button type="button" class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center touch-scale" onClick={() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); }}>
              <Icon name="chevronLeft" class="text-white" size="sm" />
            </button>
            <h2 class="text-lg font-semibold text-white flex-1">Set your PIN code</h2>
          </div>
          <div class="flex-1 flex flex-col items-center justify-center px-6">
            <Show when={!pinSuccess()}>
              <p class="text-white/90 text-sm mb-6">{pinStep() === 'set' ? 'Enter 4 digits' : 'Confirm your PIN'}</p>
              <div class="flex gap-3 mb-10">
                <For each={[0, 1, 2, 3]}>
                  {(i) => (
                    <div class={`w-4 h-4 rounded-full border-2 transition-colors ${pinDigits().length > i ? 'bg-white border-white' : 'border-white/60'}`} />
                  )}
                </For>
              </div>
              <div class="grid grid-cols-3 gap-4 w-64">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                  <button type="button" class="w-14 h-14 rounded-2xl bg-white/20 text-white text-xl font-medium touch-scale flex items-center justify-center" onClick={() => addPinDigit(n)}>
                    {n}
                  </button>
                ))}
                <button type="button" class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center touch-scale" onClick={backspacePin}>
                  <Icon name="chevronLeft" class="text-white rotate-180 w-6 h-6" />
                </button>
                <button type="button" class="w-14 h-14 rounded-2xl bg-white/30 flex items-center justify-center touch-scale col-span-2" onClick={() => pinStep() === 'confirm' && pinDigits().length === 4 && (pinDigits().join('') === firstPin() ? (setPinSuccess(true), setPinEnabled(true), setTimeout(() => { setShowPinSetup(false); setPinStep('set'); setPinDigits([]); setFirstPin(''); setPinSuccess(false); }, 1200)) : setPinDigits([]))}>
                  <Icon name="check" class="text-white w-6 h-6" />
                </button>
              </div>
            </Show>
            <Show when={pinSuccess()}>
              <div class="flex flex-col items-center gap-4">
                <div class="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center animate-scale-in">
                  <Icon name="checkCircle" class="text-white w-12 h-12" />
                </div>
                <p class="text-white text-lg font-semibold">PIN set successfully</p>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============== Chat Page ==============
const MOCK_MESSAGES: { id: number; from: 'me' | 'worker'; text: string; time: string; dateKey?: string; read: boolean }[] = [
  { id: 1, from: 'worker', text: 'Здравствуйте! Я принял ваш заказ', time: '10:30', dateKey: 'today', read: true },
  { id: 2, from: 'me', text: 'Отлично! Когда будете?', time: '10:31', read: true },
  { id: 3, from: 'worker', text: 'Через 15 минут буду на месте', time: '10:32', read: true },
  { id: 4, from: 'me', text: 'Хорошо, жду', time: '10:33', read: true },
  { id: 5, from: 'worker', text: 'Я на месте, открывайте', time: '10:45', read: false },
  { id: 6, from: 'me', text: 'Спасибо, всё прошло отлично', time: '11:02', read: true },
  { id: 7, from: 'worker', text: 'Рад был помочь. Оставьте отзыв, если удобно', time: '11:05', read: false },
];

function ChatPage(props: { onBack: () => void }) {
  const [messageList] = createSignal(MOCK_MESSAGES);
  const [inputText, setInputText] = createSignal('');
  const [showTyping, setShowTyping] = createSignal(false);

  const dateSeparators = (): Record<number, string> => {
    const out: Record<number, string> = {};
    messageList().forEach((m, i) => {
      if (m.dateKey === 'today') out[i] = t('chat.today');
      if (m.dateKey === 'yesterday') out[i] = t('notifications.yesterday');
    });
    return out;
  };

  return (
    <div class="h-screen flex flex-col animate-fade-in bg-gradient-to-b from-slate-900/20 to-transparent">
      {/* Header */}
      <div class={`flex items-center gap-3 p-4 safe-area-top ${isDark() ? 'bg-gray-900/80' : 'bg-white/80'} backdrop-blur-xl border-b border-gray-200/50 shadow-sm`}>
        <button onClick={props.onBack} class="w-10 h-10 rounded-full flex items-center justify-center touch-scale active:opacity-70">
          <Icon name="chevronLeft" class={isDark() ? 'text-white' : 'text-gray-700'} size="sm" />
        </button>
        <div class="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
          АК
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 truncate">Алексей К.</p>
          <p class="text-xs text-green-600 font-medium flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {t('chat.online')}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-3">
        <For each={messageList()}>
          {(msg, i) => (
            <>
              <Show when={dateSeparators()[i()]}>
                <p class="text-center text-xs text-gray-500 font-medium py-2">{dateSeparators()[i()]}</p>
              </Show>
              <div class={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div
                  class={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-md ${
                    msg.from === 'me'
                      ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                      : isDark()
                        ? 'rounded-bl-md bg-white/10 text-gray-100 border border-white/10'
                        : 'rounded-bl-md glass text-gray-800'
                  }`}
                >
                  <p class="text-sm leading-relaxed">{msg.text}</p>
                  <div class="flex items-center justify-end gap-1 mt-1">
                    <span class="text-[10px] opacity-80">{msg.time}</span>
                    <Show when={msg.from === 'me'}>
                      <span class="ml-1">
                        {msg.read ? (
                          <Icon name="checkDouble" class="w-3.5 h-3.5 text-white/90" />
                        ) : (
                          <Icon name="check" class="w-3.5 h-3.5 text-white/70" />
                        )}
                      </span>
                    </Show>
                  </div>
                </div>
              </div>
            </>
          )}
        </For>
        <Show when={showTyping()}>
          <div class="flex justify-start">
            <div class="rounded-2xl rounded-bl-md px-4 py-2.5 glass text-gray-500 text-sm flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 0ms" />
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 150ms" />
              <span class="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style="animation-delay: 300ms" />
              <span class="text-xs ml-1">{t('chat.typing')}</span>
            </div>
          </div>
        </Show>
      </div>

      {/* Input bar */}
      <div class={`p-3 safe-area-bottom ${isDark() ? 'bg-gray-900/90' : 'bg-white/90'} backdrop-blur-xl border-t border-gray-200/50`}>
        <div class="flex items-center gap-2 glass rounded-2xl pl-4 pr-2 py-2">
          <input
            type="text"
            value={inputText()}
            onInput={(e) => setInputText(e.currentTarget.value)}
            placeholder={t('chat.typeMessage')}
            class="flex-1 bg-transparent text-gray-800 placeholder-gray-400 text-sm outline-none py-2"
          />
          <button class="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 touch-scale">
            <Icon name="image" class="w-5 h-5" />
          </button>
          <button
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg touch-scale disabled:opacity-50"
            disabled={!inputText().trim()}
          >
            <Icon name="send" class="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== Notifications Page ==============
type NotifType = 'accepted' | 'info' | 'warning' | 'urgent';
const MOCK_NOTIFICATIONS: { id: number; type: NotifType; icon: keyof typeof Icons; title: string; desc: string; timeAgo: string; timeUnit: 'min' | 'hour' | 'day'; unread: boolean }[] = [
  { id: 1, type: 'accepted', icon: 'checkCircle', title: 'Order accepted', desc: 'Worker Alexey K. accepted your order', timeAgo: '5', timeUnit: 'min', unread: true },
  { id: 2, type: 'info', icon: 'location', title: 'Worker on the way', desc: 'Arriving in ~10 min', timeAgo: '12', timeUnit: 'min', unread: true },
  { id: 3, type: 'accepted', icon: 'checkCircle', title: 'Work completed', desc: 'Please rate the service', timeAgo: '1', timeUnit: 'hour', unread: false },
  { id: 4, type: 'info', icon: 'dollarSign', title: 'New offer', desc: 'You have a new price offer', timeAgo: '2', timeUnit: 'hour', unread: true },
  { id: 5, type: 'accepted', icon: 'creditCard', title: 'Payment processed', desc: '15,000 ₸ charged', timeAgo: '3', timeUnit: 'hour', unread: false },
  { id: 6, type: 'accepted', icon: 'userCheck', title: 'Diploma verified', desc: 'Your certificate has been approved', timeAgo: '1', timeUnit: 'day', unread: false },
  { id: 7, type: 'accepted', icon: 'award', title: 'Academy achievement', desc: 'You completed Fire Safety module!', timeAgo: '1', timeUnit: 'day', unread: false },
  { id: 8, type: 'info', icon: 'alertCircle', title: 'System update', desc: 'New features available', timeAgo: '2', timeUnit: 'day', unread: false },
];

function NotificationsPage(props: { onBack: () => void }) {
  const [notifs] = createSignal(MOCK_NOTIFICATIONS);
  const typeColor = (type: NotifType) => {
    if (type === 'accepted') return 'bg-green-500/20 text-green-600';
    if (type === 'info') return 'bg-blue-500/20 text-blue-600';
    if (type === 'warning') return 'bg-amber-500/20 text-amber-600';
    return 'bg-red-500/20 text-red-600';
  };
  const formatTime = (n: string, unit: 'min' | 'hour' | 'day') => {
    if (unit === 'min') return `${n} ${t('notifications.minAgo')}`;
    if (unit === 'hour') return `${n} ${t('notifications.hourAgo')}`;
    return t('notifications.yesterday');
  };

  return (
    <div class="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div class={`flex items-center justify-between p-4 safe-area-top ${isDark() ? 'bg-gray-900/90' : 'bg-white/90'} backdrop-blur-xl border-b border-gray-200/50`}>
        <div class="flex items-center gap-3">
          <button onClick={props.onBack} class="w-10 h-10 rounded-full flex items-center justify-center touch-scale">
            <Icon name="chevronLeft" class={isDark() ? 'text-white' : 'text-gray-700'} size="sm" />
          </button>
          <h1 class={`text-xl font-bold ${isDark() ? 'text-white' : 'text-gray-800'}`}>{t('notifications.title')}</h1>
        </div>
        <button class="text-sm font-medium text-indigo-600 touch-scale">{t('notifications.markRead')}</button>
      </div>

      <div class="p-4 space-y-3">
        <Show when={notifs().length > 0} fallback={<p class="text-center text-gray-500 py-8">{t('notifications.empty')}</p>}>
          <For each={notifs()}>
            {(n) => (
              <div
                class={`glass rounded-2xl p-4 flex gap-3 touch-scale border-l-4 ${
                  n.unread ? 'border-indigo-500' : 'border-transparent'
                } ${isDark() ? 'bg-white/5' : ''}`}
              >
                <div class={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColor(n.type)}`}>
                  <Icon name={n.icon} class="w-5 h-5" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-semibold text-gray-800">{n.title}</p>
                    <Show when={n.unread}>
                      <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
                    </Show>
                  </div>
                  <p class={`text-sm mt-0.5 ${isDark() ? 'text-gray-400' : 'text-gray-500'}`}>{n.desc}</p>
                  <p class="text-xs text-gray-400 mt-2">{formatTime(n.timeAgo, n.timeUnit)}</p>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

// ============== Skill Detail Page ==============
function SkillDetailPage(props: { onBack: () => void }) {
  const dept = () => activeDepartment() ? getDepartment(activeDepartment()!) : null;
  const dName = () => dept() ? (currentLang() === 'en' ? dept()!.nameEn : dept()!.name) : '';
  const activeCount = () => dept()?.skills.filter(s => workerSkills().includes(s.id)).length || 0;
  const totalSkills = () => dept()?.skills.length || 0;

  const [localDiplomaPrompt, setLocalDiplomaPrompt] = createSignal<string | null>(null);

  const localToggleSkill = (skillId: string, requiresDiploma: boolean) => {
    if (requiresDiploma && !verifiedDiplomas().includes(skillId)) {
      setLocalDiplomaPrompt(skillId);
      return;
    }
    const current = workerSkills();
    if (current.includes(skillId)) {
      setWorkerSkills(current.filter(s => s !== skillId));
    } else {
      setWorkerSkills([...current, skillId]);
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
          <button type="button" class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center touch-press backdrop-blur-sm"
            onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
            <Icon name="chevronLeft" class="text-white" size="sm" />
          </button>
          <div class="flex-1">
            <p class="text-white/70 text-xs font-medium">{t('profile.myProfessions')}</p>
            <h1 class="text-white font-bold text-lg">{dName()}</h1>
          </div>
          <div class="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <span class="text-3xl">{dept()?.icon}</span>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex-1 h-2 rounded-full bg-white/20 overflow-hidden">
            <div class="h-full rounded-full bg-white/80 transition-all duration-500" style={`width: ${totalSkills() > 0 ? (activeCount() / totalSkills() * 100) : 0}%`} />
          </div>
          <span class="text-white font-bold text-sm">{activeCount()}/{totalSkills()}</span>
        </div>
      </div>

      {/* Список навыков */}
      <div class="px-4 pt-3 pb-28">
        <For each={dept()?.skills || []}>
          {(skill, idx) => {
            const active = () => workerSkills().includes(skill.id);
            const needsDiploma = skill.requiresDiploma;
            const hasDiploma = () => verifiedDiplomas().includes(skill.id);
            const isLocked = needsDiploma && !hasDiploma();

            return (
              <button
                type="button"
                class={`w-full flex items-center gap-3 p-4 rounded-2xl mb-2 transition-all text-left touch-scale animate-slide-up ${
                  isLocked ? 'opacity-60' : ''
                }`}
                style={`animation-delay: ${idx() * 0.03}s; ${
                  active()
                    ? `background: linear-gradient(135deg, ${dept()?.colorFrom}18, ${dept()?.colorTo}12); border: 1.5px solid ${dept()?.colorFrom}25`
                    : isDark()
                    ? 'background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.08)'
                    : 'background: white; border: 1.5px solid rgba(0,0,0,0.06); box-shadow: 0 1px 3px rgba(0,0,0,0.04)'
                }`}
                onClick={() => { playGlobalSound('toggle'); haptic('light'); localToggleSkill(skill.id, skill.requiresDiploma); }}
              >
                <div class={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  active()
                    ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow-lg'
                    : isLocked
                    ? (isDark() ? 'bg-gray-700' : 'bg-gray-200')
                    : (isDark() ? 'bg-gray-800' : 'bg-gray-100')
                }`}>
                  <Show when={isLocked} fallback={<span class="text-xl">{skill.icon}</span>}>
                    <span class="text-xl">🔒</span>
                  </Show>
                </div>
                <div class="flex-1 min-w-0">
                  <p class={`text-sm font-semibold ${active() ? (isDark() ? 'text-gray-100' : 'text-gray-800') : isLocked ? (isDark() ? 'text-gray-500' : 'text-gray-400') : (isDark() ? 'text-gray-300' : 'text-gray-600')}`}>
                    {currentLang() === 'en' ? skill.nameEn : skill.name}
                  </p>
                  <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Show when={skill.isExpert}>
                      <span class="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded-full">{t('skills.expert')}</span>
                    </Show>
                    <Show when={needsDiploma}>
                      <span class={`px-2 py-0.5 text-[9px] font-bold rounded-full ${hasDiploma() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {hasDiploma() ? '✅ ' + t('skills.verified') : '🎓 ' + t('skills.diplomaRequired')}
                      </span>
                    </Show>
                    <Show when={skill.urgent}>
                      <span class="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full">⚡ {t('skills.urgent')}</span>
                    </Show>
                  </div>
                </div>
                <div class={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  active()
                    ? 'bg-gradient-to-br ' + (dept()?.color || 'from-indigo-500 to-purple-600') + ' shadow'
                    : isLocked
                    ? (isDark() ? 'bg-gray-700' : 'bg-gray-200')
                    : (isDark() ? 'border-2 border-gray-600' : 'border-2 border-gray-300')
                }`}>
                  <Show when={active()}>
                    <Icon name="check" class="text-white w-4 h-4" />
                  </Show>
                  <Show when={isLocked && !active()}>
                    <span class="text-[10px]">🔒</span>
                  </Show>
                </div>
              </button>
            );
          }}
        </For>
      </div>

      {/* Диплом модалка */}
      <Show when={localDiplomaPrompt()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-6" onClick={() => setLocalDiplomaPrompt(null)}>
          <div class={`glass rounded-3xl p-6 max-w-sm w-full animate-slide-up ${isDark() ? 'bg-gray-800' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-5">
              <div class="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <span class="text-3xl">🎓</span>
              </div>
              <h3 class={`text-lg font-bold ${isDark() ? 'text-gray-100' : 'text-gray-800'}`}>{t('skills.diplomaRequired')}</h3>
              <p class={`text-sm mt-2 ${isDark() ? 'text-gray-400' : 'text-gray-500'}`}>{t('skills.diplomaUpload')}</p>
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

// ============== Settings Page ==============
function SettingsPage(props: { onBack: () => void }) {
  const [showResetConfirm, setShowResetConfirm] = createSignal(false);

  const volPercent = () => Math.round(globalVolume() * 100);

  const settingSections = () => [
    {
      title: t('settings.soundHaptics'),
      icon: '🔊',
      items: [
        {
          id: 'sounds',
          icon: 'volume2' as const,
          label: t('settings.sounds'),
          desc: t('settings.soundsDesc'),
          type: 'toggle' as const,
          value: globalSoundEnabled(),
          onChange: () => { playGlobalSound('toggle'); setGlobalSoundEnabled(!globalSoundEnabled()); }
        },
        {
          id: 'haptics',
          icon: 'activity' as const,
          label: t('settings.haptics'),
          desc: t('settings.hapticsDesc'),
          type: 'toggle' as const,
          value: globalHapticEnabled(),
          onChange: () => { haptic('medium'); setGlobalHapticEnabled(!globalHapticEnabled()); }
        },
        {
          id: 'notifSound',
          icon: 'bell' as const,
          label: t('settings.notifSound'),
          desc: t('settings.notifSoundDesc'),
          type: 'toggle' as const,
          value: globalNotifSound(),
          onChange: () => { playGlobalSound('notify'); setGlobalNotifSound(!globalNotifSound()); }
        },
        {
          id: 'volume',
          icon: 'volume2' as const,
          label: t('settings.volume'),
          desc: volPercent() + '%',
          type: 'slider' as const,
          value: globalVolume(),
          onChange: (v: number) => { setGlobalVolume(v); }
        },
      ]
    },
    {
      title: t('settings.display'),
      icon: '🎨',
      items: [
        {
          id: 'theme',
          icon: isDark() ? 'moon' : 'sun',
          label: t('settings.themeMode'),
          desc: isDark() ? t('settings.dark') : t('settings.light'),
          type: 'action' as const,
          action: () => { playGlobalSound('toggle'); setTheme(isDark() ? 'light' : 'dark'); }
        },
        {
          id: 'language',
          icon: 'globe' as const,
          label: t('settings.language'),
          desc: getCurrentLanguage().name + ' ' + getCurrentLanguage().flag,
          type: 'action' as const,
          action: () => props.onBack()
        },
      ]
    },
    {
      title: t('settings.notifications'),
      icon: '🔔',
      items: [
        {
          id: 'pushNotif',
          icon: 'bell' as const,
          label: t('settings.pushNotif'),
          desc: t('settings.pushNotifDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'orderAlerts',
          icon: 'zap' as const,
          label: t('settings.orderAlerts'),
          desc: t('settings.orderAlertsDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'chatNotif',
          icon: 'message' as const,
          label: t('settings.chatNotif'),
          desc: t('settings.chatNotifDesc'),
          type: 'toggle' as const,
          value: true,
          onChange: () => { playGlobalSound('toggle'); }
        },
      ]
    },
    {
      title: t('settings.dataStorage'),
      icon: '💾',
      items: [
        {
          id: 'autoDownload',
          icon: 'download' as const,
          label: t('settings.autoDownload'),
          desc: t('settings.autoDownloadDesc'),
          type: 'toggle' as const,
          value: false,
          onChange: () => { playGlobalSound('toggle'); }
        },
        {
          id: 'cache',
          icon: 'trash' as const,
          label: t('settings.clearCache'),
          desc: '24.3 MB',
          type: 'action' as const,
          action: () => { playGlobalSound('delete'); }
        },
      ]
    }
  ];

  return (
    <div class="min-h-screen animate-fade-in">
      {/* Header */}
      <div class="glass sticky top-0 z-50 px-4 py-3 flex items-center gap-3">
        <button class="w-10 h-10 rounded-2xl glass flex items-center justify-center touch-press"
          onClick={() => { playGlobalSound('swoosh'); props.onBack(); }}>
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <div class="flex-1">
          <h1 class="text-lg font-bold text-gray-800">{t('settings.title')}</h1>
          <p class="text-xs text-gray-500">{t('settings.subtitle')}</p>
        </div>
        <button class="w-10 h-10 rounded-2xl glass flex items-center justify-center touch-press"
          onClick={() => { playGlobalSound('tap'); setShowResetConfirm(true); }}>
          <Icon name="repeat" class="text-gray-500" size="sm" />
        </button>
      </div>

      <div class="p-4 space-y-4">
        {/* Sound preview card */}
        <div class="glass rounded-3xl p-5 animate-slide-up">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span class="text-2xl">🎵</span>
            </div>
            <div class="flex-1">
              <p class="font-bold text-gray-800">{t('settings.soundPreview')}</p>
              <p class="text-xs text-gray-500">{t('settings.soundPreviewDesc')}</p>
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2">
            {(['tap', 'success', 'error', 'notify'] as const).map(snd => (
              <button
                class="py-3 rounded-2xl glass text-center touch-press"
                onClick={() => { playGlobalSound(snd); haptic('light'); }}
              >
                <span class="text-xl block mb-1">
                  {snd === 'tap' ? '👆' : snd === 'success' ? '✅' : snd === 'error' ? '❌' : '🔔'}
                </span>
                <span class="text-[10px] font-medium text-gray-600 capitalize">{snd}</span>
              </button>
            ))}
          </div>
          <div class="grid grid-cols-4 gap-2 mt-2">
            {(['send', 'receive', 'delete', 'levelup'] as const).map(snd => (
              <button
                class="py-3 rounded-2xl glass text-center touch-press"
                onClick={() => { playGlobalSound(snd); haptic('light'); }}
              >
                <span class="text-xl block mb-1">
                  {snd === 'send' ? '📤' : snd === 'receive' ? '📥' : snd === 'delete' ? '🗑️' : '🎉'}
                </span>
                <span class="text-[10px] font-medium text-gray-600 capitalize">{snd}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Setting sections */}
        <For each={settingSections()}>
          {(section, idx) => (
            <div class="glass rounded-3xl overflow-hidden animate-slide-up" style={`animation-delay: ${0.05 * (idx() + 1)}s`}>
              <div class="px-5 py-3 flex items-center gap-2">
                <span class="text-lg">{section.icon}</span>
                <p class="font-bold text-gray-800 text-sm">{section.title}</p>
              </div>
              <For each={section.items}>
                {(item) => (
                  <button
                    class="w-full flex items-center gap-3 px-5 py-4 border-t border-gray-100/50 touch-scale"
                    onClick={() => {
                      if (item.type === 'toggle' && item.onChange) (item.onChange as () => void)();
                      if (item.type === 'action' && (item as any).action) (item as any).action();
                    }}
                  >
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                      <Icon name={item.icon as any} class="text-gray-600" size="sm" />
                    </div>
                    <div class="flex-1 text-left">
                      <p class="text-sm font-medium text-gray-800">{item.label}</p>
                      <p class="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <Show when={item.type === 'toggle'}>
                      <div class={`w-12 h-7 rounded-full transition-all duration-300 flex items-center px-0.5 ${
                        (item as any).value ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-300'
                      }`}>
                        <div class={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                          (item as any).value ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </Show>
                    <Show when={item.type === 'slider'}>
                      <div class="w-24 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="range"
                          min="0" max="1" step="0.05"
                          value={(item as any).value as number}
                          onInput={(e) => {
                            const v = parseFloat(e.currentTarget.value);
                            ((item as any).onChange as (v: number) => void)(v);
                          }}
                          class="w-full accent-indigo-500 h-1.5"
                        />
                      </div>
                    </Show>
                    <Show when={item.type === 'action'}>
                      <Icon name="chevronRight" class="text-gray-400" size="sm" />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          )}
        </For>

        {/* App info */}
        <div class="glass rounded-3xl p-5 text-center animate-slide-up" style="animation-delay: 0.25s">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span class="text-white text-2xl font-black">B</span>
          </div>
          <p class="font-bold text-gray-800">BOLH</p>
          <p class="text-xs text-gray-500 mb-1">Build Online Link Hub</p>
          <p class="text-xs text-gray-400">v2.1.0</p>
        </div>

        <div class="h-8" />
      </div>

      {/* Reset confirm */}
      <Show when={showResetConfirm()}>
        <div class="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4" onClick={() => setShowResetConfirm(false)}>
          <div class="glass rounded-3xl p-6 max-w-sm w-full animate-slide-up mb-8" onClick={(e) => e.stopPropagation()}>
            <div class="text-center mb-4">
              <div class="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <span class="text-2xl">⚠️</span>
              </div>
              <h3 class="font-bold text-gray-800">{t('settings.resetTitle')}</h3>
              <p class="text-sm text-gray-500 mt-1">{t('settings.resetDesc')}</p>
            </div>
            <button
              class="w-full py-3 bg-red-500 text-white rounded-2xl font-semibold mb-2 touch-press"
              onClick={() => {
                playGlobalSound('delete');
                setGlobalSoundEnabled(true);
                setGlobalHapticEnabled(true);
                setGlobalNotifSound(true);
                setGlobalVolume(0.7);
                setShowResetConfirm(false);
              }}
            >
              {t('settings.resetConfirm')}
            </button>
            <button class="w-full py-3 glass rounded-2xl text-gray-600 font-medium touch-scale" onClick={() => setShowResetConfirm(false)}>
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============== Main App ==============

// Static nav items - labels are computed reactively in render
const navItems: { id: string; icon: keyof typeof Icons; labelKey: string }[] = [
  { id: 'home', icon: 'home', labelKey: 'nav.home' },
  { id: 'map', icon: 'map', labelKey: 'nav.map' },
  { id: 'contracts', icon: 'fileText', labelKey: 'nav.orders' },
  { id: 'wallet', icon: 'creditCard', labelKey: 'nav.wallet' },
  { id: 'profile', icon: 'user', labelKey: 'nav.profile' },
];

export default function App() {
  const [currentPage, setCurrentPage] = createSignal('home');

  const showNav = () => !['urgent', 'language', 'theme', 'newcontract', 'documents', 'verification', 'academy', 'department', 'chat', 'notifications', 'rating', 'auth', 'security', 'settings', 'skilldetail', 'payments', 'achievements', 'analytics', 'marketplace', 'incident', 'createorder', 'workerdetail', 'blockchain', 'tracking', 'referral'].includes(currentPage());
  
  // Set initial RTL direction
  onMount(() => {
    document.documentElement.dir = isRTL() ? 'rtl' : 'ltr';
  });

  return (
    <div class="min-h-screen safe-area-top">
      <main class={['tracking', 'map'].includes(currentPage()) ? 'h-screen' : showNav() ? 'pb-24' : 'pb-4'}>
        <Switch>
          <Match when={currentPage() === 'home'}>
            <HomePage onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'urgent'}>
            <SwipeBack onBack={() => setCurrentPage('home')}>
              <UrgentOrderPage onBack={() => setCurrentPage('home')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'department'}>
            <SwipeBack onBack={() => { setActiveDepartment(null); setCurrentPage('home'); }}>
              <DepartmentViewPage onNavigate={setCurrentPage} onBack={() => { setActiveDepartment(null); setCurrentPage('home'); }} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'discover'}>
            <DiscoverPage />
          </Match>
          <Match when={currentPage() === 'map'}>
            <MapPage />
          </Match>
          <Match when={currentPage() === 'tracking'}>
            <SwipeBack onBack={() => setCurrentPage('contracts')}>
              <TrackingPage />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'orders'}>
            <OrdersPage />
          </Match>
          <Match when={currentPage() === 'wallet'}>
            <WalletPage onBack={() => setCurrentPage('home')} onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'blockchain'}>
            <SwipeBack onBack={() => setCurrentPage('wallet')}>
              <BlockchainScreen onBack={() => setCurrentPage('wallet')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'referral'}>
            <SwipeBack onBack={() => setCurrentPage('wallet')}>
              <ReferralPage onBack={() => setCurrentPage('wallet')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'profile'}>
            <ProfilePage onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'language'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <LanguagePage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'theme'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <ThemePage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'contracts'}>
            <ContractsPage onNavigate={setCurrentPage} />
          </Match>
          <Match when={currentPage() === 'newcontract'}>
            <SwipeBack onBack={() => setCurrentPage('contracts')}>
              <NewContractPage onBack={() => setCurrentPage('contracts')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'documents'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <DocumentVaultPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'verification'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <VerificationPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'academy'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <AcademyGamePage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'security'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <SecurityCenterPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'chat'}>
            <SwipeBack onBack={() => setCurrentPage('contracts')}>
              <ChatPage onBack={() => setCurrentPage('contracts')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'notifications'}>
            <SwipeBack onBack={() => setCurrentPage('home')}>
              <NotificationsPage onBack={() => setCurrentPage('home')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'rating'}>
            <SwipeBack onBack={() => setCurrentPage('contracts')}>
              <RatingPage onBack={() => setCurrentPage('contracts')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'auth'}>
            <AuthPage onComplete={() => setCurrentPage('home')} />
          </Match>
          <Match when={currentPage() === 'settings'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <SettingsPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'skilldetail'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <SkillDetailPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'payments'}>
            <SwipeBack onBack={() => setCurrentPage('wallet')}>
              <PaymentsPage onBack={() => setCurrentPage('wallet')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'achievements'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <AchievementsPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'analytics'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <AnalyticsPage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'marketplace'}>
            <SwipeBack onBack={() => setCurrentPage('profile')}>
              <MarketplacePage onBack={() => setCurrentPage('profile')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'incident'}>
            <SwipeBack onBack={() => setCurrentPage('contracts')}>
              <IncidentReportPage onBack={() => setCurrentPage('contracts')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'createorder'}>
            <SwipeBack onBack={() => setCurrentPage('home')}>
              <CreateOrderPage onBack={() => setCurrentPage('home')} />
            </SwipeBack>
          </Match>
          <Match when={currentPage() === 'workerdetail'}>
            <SwipeBack onBack={() => setCurrentPage('discover')}>
              <WorkerDetailPage onBack={() => setCurrentPage('discover')} onNavigate={setCurrentPage} />
            </SwipeBack>
          </Match>
        </Switch>
        </main>

        <Show when={showNav()}>
        <nav class="fixed bottom-0 left-0 right-0 glass safe-area-bottom" style="z-index: 100">
          <div class="flex items-center justify-around h-20">
            <For each={navItems}>
              {(item) => {
                const isActive = () => currentPage() === item.id;
                return (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(item.id)}
                    class={`flex flex-col items-center justify-center px-4 py-2 rounded-xl transition-all duration-300 touch-scale ${
                      isActive() 
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg' 
                        : ''
                    }`}
                  >
                    <Icon 
                      name={item.icon} 
                      class={isActive() ? 'text-white' : 'text-gray-500'} 
                      size="sm"
                    />
                    <span class={`text-xs mt-1 font-medium ${
                      isActive() ? 'text-white' : 'text-gray-500'
                    }`}>
                      {t(item.labelKey)}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </nav>
        </Show>
    </div>
  );
}

function WalletPage(props: { onBack: () => void; onNavigate?: (page: string) => void }) {
  const [balance, setBalance] = createSignal<{ balance: number; locked: number } | null>(null);
  const [ledger, setLedger] = createSignal<any[]>([]);
  const [stats, setStats] = createSignal<{ supply_total: number; supply_circulating: number; rate_usd: string } | null>(null);
  const [loading, setLoading] = createSignal(true);
  const base = 'http://localhost:8080/api/v1/loyalty';
  const load = async () => {
    try {
      const b = await fetch(`${base}/balance`).then(r => r.json());
      setBalance({ balance: b.balance ?? 0, locked: b.locked ?? 0 });
      const l = await fetch(`${base}/ledger?limit=50`).then(r => r.json());
      setLedger(l.items ?? []);
      const s = await fetch(`${base}/stats`).then(r => r.json());
      setStats({ supply_total: s.supply_total, supply_circulating: s.supply_circulating, rate_usd: s.rate_usd });
    } catch {}
    setLoading(false);
  };
  onMount(load);
  const earn = async (amount: number) => {
    setLoading(true);
    try {
      await fetch(`${base}/earn`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, source: 'ad' }) }).then(r => r.json());
    } catch {}
    await load();
  };
  const redeem = async (amount: number) => {
    setLoading(true);
    try {
      await fetch(`${base}/redeem`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, kind: 'service' }) }).then(r => r.json());
    } catch {}
    await load();
  };
  const [activeTab, setActiveTab] = createSignal<'balance' | 'blockchain'>('balance');

  return (
    <div class="px-4 py-4 animate-fade-in">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold">{t('nav.wallet')}</h2>
        <button class="p-2 rounded-xl bg-gray-100 touch-scale" onClick={() => props.onNavigate?.('payments')}>
          <Icon name="creditCard" size="sm" />
        </button>
      </div>

      {/* Tab switcher */}
      <div class="flex bg-gray-100 rounded-2xl p-1 mb-5">
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'balance' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('balance')}
        >
          {t('payment.balance')}
        </button>
        <button
          class={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab() === 'blockchain' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('blockchain')}
        >
          BOLH Chain
        </button>
      </div>

      <Show when={!loading()} fallback={<div class="flex items-center justify-center py-12"><div class="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
        {/* Balance Tab */}
        <Show when={activeTab() === 'balance'}>
          {/* Main balance card */}
          <div class="relative rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)">
            <div class="absolute inset-0 opacity-10">
              <div class="absolute -top-8 -right-8 w-32 h-32 rounded-full border-2 border-white" />
              <div class="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-2 border-white" />
            </div>
            <div class="p-5 relative">
              <div class="text-white/70 text-sm mb-1">{t('payment.balance')}</div>
              <div class="text-4xl font-bold text-white mb-3">{(balance()?.balance ?? 0).toLocaleString()} <span class="text-lg font-normal text-white/80">BOLH</span></div>
              <div class="flex items-center gap-4">
                <div>
                  <div class="text-white/60 text-xs">Locked</div>
                  <div class="text-white font-semibold">{balance()?.locked ?? 0}</div>
                </div>
                <Show when={stats()}>
                  <div>
                    <div class="text-white/60 text-xs">USD</div>
                    <div class="text-white font-semibold">${(Number(stats()!.rate_usd) * (balance()?.balance ?? 0)).toFixed(2)}</div>
                  </div>
                </Show>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div class="grid grid-cols-3 gap-3 mb-5">
            <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => earn(10)}>
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Icon name="plus" size="sm" class="text-green-600" />
              </div>
              <span class="text-xs text-gray-600 font-medium">Пополнить</span>
            </button>
            <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => redeem(5)}>
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Icon name="arrowRight" size="sm" class="text-blue-600" />
              </div>
              <span class="text-xs text-gray-600 font-medium">Перевод</span>
            </button>
            <button class="flex flex-col items-center gap-1.5 p-3 rounded-2xl glass touch-scale" onClick={() => props.onNavigate?.('payments')}>
              <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Icon name="creditCard" size="sm" class="text-purple-600" />
              </div>
              <span class="text-xs text-gray-600 font-medium">Карты</span>
            </button>
          </div>

          {/* Transaction history */}
          <div class="rounded-2xl glass overflow-hidden">
            <div class="px-4 py-3 flex items-center justify-between">
              <span class="text-gray-600 font-semibold text-sm">{t('profile.history')}</span>
              <span class="text-xs text-indigo-500 font-medium">Все</span>
            </div>
            <For each={ledger()}>
              {(it: any) => (
                <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class={`w-8 h-8 rounded-full flex items-center justify-center ${it.direction === 'credit' ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Icon name={it.direction === 'credit' ? 'plus' : 'minus'} size="xs" class={it.direction === 'credit' ? 'text-green-600' : 'text-red-600'} />
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-800">{it.source}</div>
                      <div class="text-xs text-gray-400">{it.created_at ? new Date(it.created_at).toLocaleDateString() : ''}</div>
                    </div>
                  </div>
                  <div class={`font-bold ${it.direction === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {it.direction === 'credit' ? '+' : '-'}{it.amount} BOLH
                  </div>
                </div>
              )}
            </For>
            <Show when={ledger().length === 0}>
              <div class="px-4 py-8 text-center text-gray-400 text-sm">Нет транзакций</div>
            </Show>
          </div>
        </Show>

        {/* Blockchain Tab */}
        <Show when={activeTab() === 'blockchain'}>
          {/* Token info */}
          <div class="rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #0f172a, #1e293b)">
            <div class="p-5">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span class="text-white font-bold text-lg">B</span>
                </div>
                <div>
                  <div class="text-white font-bold text-lg">BOLH Token</div>
                  <div class="text-gray-400 text-sm">ERC-20 compatible</div>
                </div>
              </div>
              <Show when={stats()}>
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-gray-400 text-xs">Курс</div>
                    <div class="text-white font-bold text-lg">${stats()!.rate_usd}</div>
                  </div>
                  <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-gray-400 text-xs">Баланс</div>
                    <div class="text-white font-bold text-lg">{balance()?.balance ?? 0} BOLH</div>
                  </div>
                  <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-gray-400 text-xs">Эмиссия</div>
                    <div class="text-white font-bold">{stats()!.supply_total?.toLocaleString()}</div>
                  </div>
                  <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-gray-400 text-xs">В обороте</div>
                    <div class="text-white font-bold">{stats()!.supply_circulating?.toLocaleString()}</div>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          {/* Blockchain features */}
          <div class="space-y-3">
            <button class="w-full glass rounded-2xl p-4 flex items-center gap-4 touch-scale text-left" onClick={() => props.onNavigate?.('referral')}>
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Icon name="users" size="md" class="text-indigo-600" />
              </div>
              <div class="flex-1">
                <div class="font-semibold text-gray-800">Реферальная программа</div>
                <div class="text-sm text-gray-500">Пригласи друга — оба получите BOLH</div>
              </div>
              <div class="flex items-center gap-1">
                <span class="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-xs font-bold">NEW</span>
                <Icon name="chevronRight" size="sm" class="text-gray-400" />
              </div>
            </button>

            <button class="w-full glass rounded-2xl p-4 flex items-center gap-4 touch-scale text-left" onClick={() => props.onNavigate?.('blockchain')}>
              <div class="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center">
                <Icon name="shield" size="md" class="text-indigo-600" />
              </div>
              <div class="flex-1">
                <div class="font-semibold text-gray-800">Smart Contracts</div>
                <div class="text-sm text-gray-500">Escrow, Bounty, Insurance</div>
              </div>
              <Icon name="chevronRight" size="sm" class="text-gray-400" />
            </button>

            <button class="w-full glass rounded-2xl p-4 flex items-center gap-4 touch-scale text-left" onClick={() => props.onNavigate?.('blockchain')}>
              <div class="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                <Icon name="lock" size="md" class="text-green-600" />
              </div>
              <div class="flex-1">
                <div class="font-semibold text-gray-800">Безопасность</div>
                <div class="text-sm text-gray-500">Антифрод, rate-limit, защита</div>
              </div>
              <Icon name="chevronRight" size="sm" class="text-gray-400" />
            </button>

            <button class="w-full glass rounded-2xl p-4 flex items-center gap-4 touch-scale text-left" onClick={() => props.onNavigate?.('blockchain')}>
              <div class="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Icon name="globe" size="md" class="text-blue-600" />
              </div>
              <div class="flex-1">
                <div class="font-semibold text-gray-800">Explorer</div>
                <div class="text-sm text-gray-500">История транзакций в блокчейне</div>
              </div>
              <Icon name="chevronRight" size="sm" class="text-gray-400" />
            </button>
          </div>
        </Show>
      </Show>
    </div>
  );
}

// ============== Referral Page ==============
function ReferralPage(props: { onBack: () => void }) {
  const [copied, setCopied] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'overview' | 'friends' | 'tiers'>('overview');

  const mockCode = 'BOLH-A3F8C1D2';
  const mockStats = { totalInvited: 7, totalEarned: 70000, rank: 142, currentTier: 1 };
  const mockFriends = [
    { id: '1', name: 'Иван К.', date: '2026-02-12', reward: 10000, status: 'confirmed' },
    { id: '2', name: 'Мария С.', date: '2026-02-11', reward: 10000, status: 'confirmed' },
    { id: '3', name: 'Алексей Р.', date: '2026-02-10', reward: 10000, status: 'confirmed' },
    { id: '4', name: 'Елена Б.', date: '2026-02-09', reward: 10000, status: 'confirmed' },
    { id: '5', name: 'Дмитрий В.', date: '2026-02-08', reward: 10000, status: 'confirmed' },
    { id: '6', name: 'Анна Л.', date: '2026-02-07', reward: 10000, status: 'pending' },
    { id: '7', name: 'Сергей Т.', date: '2026-02-06', reward: 10000, status: 'pending' },
  ];
  const tiersList = [
    { id: 1, label: 'Tier 1', range: '0 — 1 000', reward: '10 000', color: 'from-yellow-400 to-amber-500', emoji: '\u{1F947}' },
    { id: 2, label: 'Tier 2', range: '1 001 — 10 000', reward: '2 500', color: 'from-gray-300 to-gray-400', emoji: '\u{1F948}' },
    { id: 3, label: 'Tier 3', range: '10 001 — 100 000', reward: '1 000', color: 'from-amber-600 to-amber-700', emoji: '\u{1F949}' },
    { id: 4, label: 'Tier 4', range: '100 001+', reward: '500', color: 'from-indigo-400 to-indigo-500', emoji: '\u{1F3AF}' },
  ];
  const poolTotal = 2_000_000_000;
  const poolUsed = 245_000_000;
  const poolPercent = ((poolUsed / poolTotal) * 100).toFixed(1);
  const totalUsers = 847;

  const copyCode = () => {
    navigator.clipboard?.writeText(mockCode);
    setCopied(true);
    haptic('medium');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    const url = `https://bolh.app/join/${mockCode}`;
    if (navigator.share) {
      navigator.share({ title: 'BOLH', text: `Регистрируйся и получи 10 000 BOLH!`, url });
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    haptic('medium');
  };

  return (
    <div class="px-4 py-4 animate-fade-in pb-24">
      {/* Header */}
      <div class="flex items-center gap-3 mb-5">
        <button class="p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}>
          <Icon name="chevronLeft" />
        </button>
        <h2 class="text-xl font-bold">Реферальная программа</h2>
      </div>

      {/* Hero card */}
      <div class="relative rounded-3xl overflow-hidden mb-5" style="background: linear-gradient(135deg, #6366f1, #8b5cf6, #c084fc)">
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full border-2 border-white/10" />
          <div class="absolute -bottom-8 -left-8 w-32 h-32 rounded-full border-2 border-white/10" />
        </div>
        <div class="p-5 relative">
          <div class="text-white/70 text-sm mb-1">Твой реферальный код</div>
          <div class="flex items-center gap-2 mb-3">
            <div class="text-2xl font-bold text-white tracking-wider font-mono">{mockCode}</div>
            <button
              class={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${copied() ? 'bg-green-500 text-white' : 'bg-white/20 text-white'}`}
              onClick={copyCode}
            >
              {copied() ? '\u2713' : 'Copy'}
            </button>
          </div>
          <div class="text-white/80 text-sm mb-4">
            Пригласи друга — вы <span class="font-bold text-white">оба</span> получите <span class="font-bold text-white text-lg">10 000 BOLH</span>
          </div>
          <button
            class="w-full py-3 rounded-2xl bg-white text-indigo-600 font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg touch-scale"
            onClick={shareLink}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Поделиться ссылкой
          </button>
        </div>
      </div>

      {/* Stats */}
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="glass rounded-2xl p-3 text-center">
          <div class="text-xl font-bold text-indigo-600">{mockStats.totalInvited}</div>
          <div class="text-xs text-gray-500 mt-0.5">Приглашено</div>
        </div>
        <div class="glass rounded-2xl p-3 text-center">
          <div class="text-xl font-bold text-green-600">{mockStats.totalEarned.toLocaleString()}</div>
          <div class="text-xs text-gray-500 mt-0.5">BOLH</div>
        </div>
        <div class="glass rounded-2xl p-3 text-center">
          <div class="text-xl font-bold text-amber-600">#{mockStats.rank}</div>
          <div class="text-xs text-gray-500 mt-0.5">Рейтинг</div>
        </div>
      </div>

      {/* Tabs */}
      <div class="flex bg-gray-100 rounded-2xl p-1 mb-5">
        <button class={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${activeTab() === 'overview' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`} onClick={() => setActiveTab('overview')}>Обзор</button>
        <button class={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${activeTab() === 'friends' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`} onClick={() => setActiveTab('friends')}>Друзья ({mockStats.totalInvited})</button>
        <button class={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${activeTab() === 'tiers' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`} onClick={() => setActiveTab('tiers')}>Тиры</button>
      </div>

      {/* Overview */}
      <Show when={activeTab() === 'overview'}>
        {/* How it works */}
        <div class="glass rounded-2xl p-5 mb-4">
          <h3 class="font-bold text-gray-900 mb-4">Как это работает</h3>
          <div class="space-y-4">
            <div class="flex gap-3">
              <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0"><span class="text-indigo-600 font-bold text-sm">1</span></div>
              <div><div class="font-semibold text-gray-800 text-sm">Поделись кодом</div><div class="text-gray-500 text-xs">Отправь код или ссылку другу</div></div>
            </div>
            <div class="flex gap-3">
              <div class="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><span class="text-green-600 font-bold text-sm">2</span></div>
              <div><div class="font-semibold text-gray-800 text-sm">Друг регистрируется</div><div class="text-gray-500 text-xs">Вводит код при регистрации</div></div>
            </div>
            <div class="flex gap-3">
              <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0"><span class="text-amber-600 font-bold text-sm">3</span></div>
              <div><div class="font-semibold text-gray-800 text-sm">Оба получают награду</div><div class="text-gray-500 text-xs">Одинаковая сумма — честно!</div></div>
            </div>
          </div>
        </div>

        {/* Fair badge */}
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 mb-4 flex items-center gap-3 border border-green-200/50">
          <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <div class="font-bold text-green-800 text-sm">100% честная программа</div>
            <div class="text-green-600 text-xs">Без скрытых комиссий. Равная награда.</div>
          </div>
        </div>

        {/* Pool */}
        <div class="glass rounded-2xl p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-gray-900 text-sm">Реферальный пул</h3>
            <span class="text-xs text-gray-500">{poolPercent}%</span>
          </div>
          <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" style={`width: ${poolPercent}%`} />
          </div>
          <div class="grid grid-cols-2 gap-3 text-center">
            <div>
              <div class="text-base font-bold text-gray-900">{(poolTotal - poolUsed).toLocaleString()}</div>
              <div class="text-xs text-gray-500">Осталось BOLH</div>
            </div>
            <div>
              <div class="text-base font-bold text-gray-900">12 540</div>
              <div class="text-xs text-gray-500">Рефералов</div>
            </div>
          </div>
        </div>

        {/* Current tier */}
        <div class="glass rounded-2xl p-5">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-gray-900 text-sm">Текущий тир</h3>
            <span class="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">{'\u{1F947}'} Tier 1</span>
          </div>
          <div class="text-gray-500 text-xs mb-3">Награда: <span class="font-bold text-indigo-600">10 000 BOLH</span> каждому</div>
          <div class="flex items-center gap-2">
            <div class="text-xs text-gray-400">{totalUsers}</div>
            <div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500" style={`width: ${(totalUsers / 1000 * 100)}%`} />
            </div>
            <div class="text-xs text-gray-400">1 000</div>
          </div>
          <div class="text-xs text-gray-400 text-center mt-1">Ещё {(1000 - totalUsers).toLocaleString()} до Tier 2</div>
        </div>
      </Show>

      {/* Friends */}
      <Show when={activeTab() === 'friends'}>
        <div class="glass rounded-2xl overflow-hidden">
          <div class="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            <span class="text-gray-800 font-semibold text-sm">Приглашённые друзья</span>
            <span class="text-xs text-gray-500">{mockFriends.length}</span>
          </div>
          <For each={mockFriends}>
            {(f) => (
              <div class="px-4 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span class="text-white font-bold text-xs">{f.name.split(' ').map((n: string) => n[0]).join('')}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 truncate">{f.name}</div>
                  <div class="text-xs text-gray-400">{new Date(f.date).toLocaleDateString('ru-RU')}</div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="text-sm font-bold text-green-600">+{f.reward.toLocaleString()}</div>
                  <div class={`text-xs ${f.status === 'confirmed' ? 'text-green-500' : 'text-amber-500'}`}>
                    {f.status === 'confirmed' ? '\u2713 Начислено' : '\u23F3 Ожидание'}
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
        <button class="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg touch-scale" onClick={shareLink}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          Пригласить ещё
        </button>
      </Show>

      {/* Tiers */}
      <Show when={activeTab() === 'tiers'}>
        <div class="space-y-3">
          <For each={tiersList}>
            {(tier) => (
              <div class={`rounded-2xl overflow-hidden shadow-sm ${tier.id === mockStats.currentTier ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}>
                <div class={`bg-gradient-to-r ${tier.color} p-4`}>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">{tier.emoji}</span>
                      <div>
                        <div class="text-white font-bold text-lg">{tier.label}</div>
                        <div class="text-white/80 text-xs">{tier.range}</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-white font-bold text-xl">{tier.reward}</div>
                      <div class="text-white/70 text-xs">BOLH каждому</div>
                    </div>
                  </div>
                  <Show when={tier.id === mockStats.currentTier}>
                    <div class="mt-3 bg-white/20 rounded-xl px-3 py-1.5 text-center">
                      <span class="text-white text-xs font-bold">{'\u{1F4CD}'} Ваш текущий тир</span>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>

        {/* Rules */}
        <div class="glass rounded-2xl p-5 mt-4">
          <h3 class="font-bold text-gray-900 mb-3 text-sm">Правила</h3>
          <div class="space-y-2">
            {[
              'Оба получают одинаковую награду',
              'Без скрытых комиссий',
              'Один аккаунт = одно приглашение',
              'Макс. 50 приглашений в день',
              'Пул: 2 млрд BOLH',
              'Ранние участники получают больше',
            ].map((rule) => (
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg class="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span class="text-xs text-gray-600">{rule}</span>
              </div>
            ))}
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============== Payments Page ==============
function PaymentsPage(props: { onBack: () => void }) {
  const plans = [
    { id: 'free', name: 'Free', price: 0, features: ['basic_discovery', 'orders_5', 'standard_support'], current: true },
    { id: 'basic', name: 'Basic', price: 4990, features: ['unlimited_discovery', 'orders_20', 'priority_support', 'order_history'] },
    { id: 'premium', name: 'Premium', price: 9990, features: ['all_basic', 'unlimited_orders', 'preferred_workers', 'realtime_tracking', 'support_24_7'], recommended: true },
  ];
  const cards = [
    { id: '1', last4: '4242', brand: 'Visa', isDefault: true },
    { id: '2', last4: '5555', brand: 'Mastercard', isDefault: false },
  ];
  const payHistory = [
    { id: '1', date: '2026-02-01', desc: 'Order #12345', amount: 16000 },
    { id: '2', date: '2026-01-28', desc: 'Order #12344', amount: 48000 },
    { id: '3', date: '2026-01-25', desc: 'Subscription', amount: 4990 },
  ];
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center mb-5">
        <button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button>
        <h2 class="text-xl font-bold">{t('payments.title')}</h2>
      </div>
      <p class="text-xs text-gray-500 uppercase font-semibold mb-3">{t('payments.plans')}</p>
      <div class="space-y-3 mb-6">
        <For each={plans}>{(plan) => (
          <div class={`glass rounded-2xl p-4 relative ${plan.recommended ? 'border-2 border-indigo-500 shadow-lg' : ''}`}>
            <Show when={plan.recommended}><span class="absolute -top-2.5 right-4 px-3 py-0.5 bg-indigo-500 text-white text-xs font-bold rounded-full">{t('payments.recommended')}</span></Show>
            <div class="flex items-center justify-between mb-2">
              <div><h3 class="font-bold text-gray-800">{plan.name}</h3><p class="text-xl font-bold text-indigo-600">{plan.price > 0 ? `${plan.price.toLocaleString()} ₸` : t('payments.free')}<span class="text-sm text-gray-500 font-normal">/{t('payments.month')}</span></p></div>
              <Show when={plan.current} fallback={<button class="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium touch-scale" onClick={() => { haptic('medium'); playGlobalSound('success'); }}>{t('payments.select')}</button>}>
                <span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">{t('payments.current')}</span>
              </Show>
            </div>
            <div class="space-y-1"><For each={plan.features}>{(f) => (<div class="flex items-center gap-2 text-sm text-gray-600"><Icon name="check" size="xs" class="text-green-500" /><span>{t('payments.feat.' + f)}</span></div>)}</For></div>
          </div>
        )}</For>
      </div>
      <p class="text-xs text-gray-500 uppercase font-semibold mb-3">{t('payments.cards')}</p>
      <div class="glass rounded-2xl overflow-hidden mb-6">
        <For each={cards}>{(card) => (<div class="flex items-center p-4 border-b border-gray-100 last:border-0"><Icon name="creditCard" class="text-gray-400 mr-3" /><div class="flex-1"><p class="font-medium text-gray-800">{card.brand} •••• {card.last4}</p></div><Show when={card.isDefault}><span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{t('payments.default')}</span></Show></div>)}</For>
        <button class="w-full p-4 text-indigo-500 font-medium text-sm flex items-center justify-center gap-2 touch-scale"><Icon name="plus" size="sm" class="text-indigo-500" />{t('payments.addCard')}</button>
      </div>
      <p class="text-xs text-gray-500 uppercase font-semibold mb-3">{t('payments.payHistory')}</p>
      <div class="glass rounded-2xl overflow-hidden">
        <For each={payHistory}>{(h) => (<div class="flex items-center justify-between p-4 border-b border-gray-100 last:border-0"><div><p class="font-medium text-gray-800">{h.desc}</p><p class="text-xs text-gray-500">{h.date}</p></div><span class="font-semibold text-gray-800">{h.amount.toLocaleString()} ₸</span></div>)}</For>
      </div>
    </div>
  );
}

// ============== Achievements Page ==============
function AchievementsPage(props: { onBack: () => void }) {
  const achs = [
    { id: '1', titleKey: 'ach.firstOrder', descKey: 'ach.firstOrderDesc', icon: 'shield' as const, pts: 100, progress: 1, max: 1, unlocked: true, rarity: 'common' },
    { id: '2', titleKey: 'ach.regular', descKey: 'ach.regularDesc', icon: 'repeat' as const, pts: 500, progress: 7, max: 10, unlocked: false, rarity: 'rare' },
    { id: '3', titleKey: 'ach.nightOwl', descKey: 'ach.nightOwlDesc', icon: 'moon' as const, pts: 200, progress: 1, max: 1, unlocked: true, rarity: 'rare' },
    { id: '4', titleKey: 'ach.safetyFirst', descKey: 'ach.safetyFirstDesc', icon: 'alertCircle' as const, pts: 50, progress: 0, max: 1, unlocked: false, rarity: 'common' },
    { id: '5', titleKey: 'ach.vipClient', descKey: 'ach.vipClientDesc', icon: 'award' as const, pts: 1000, progress: 234, max: 500, unlocked: false, rarity: 'epic' },
    { id: '6', titleKey: 'ach.legend', descKey: 'ach.legendDesc', icon: 'trophy' as const, pts: 5000, progress: 12, max: 100, unlocked: false, rarity: 'legendary' },
  ];
  const totalPts = achs.filter(a => a.unlocked).reduce((s, a) => s + a.pts, 0);
  const level = Math.floor(totalPts / 500) + 1;
  const pct = ((totalPts % 500) / 500) * 100;
  const rc: Record<string,string> = { common: 'from-gray-400 to-gray-500', rare: 'from-blue-400 to-blue-600', epic: 'from-purple-500 to-pink-500', legendary: 'from-amber-400 to-orange-500' };
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('achievements.title')}</h2></div>
      <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white text-center mb-5 shadow-xl">
        <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><span class="text-3xl font-bold">{level}</span></div>
        <h3 class="text-xl font-bold">{t('achievements.level')} {level}</h3>
        <p class="text-sm opacity-80">{totalPts} {t('achievements.points')}</p>
        <div class="mt-4"><div class="flex justify-between text-xs mb-1"><span>{totalPts % 500} / 500</span></div><div class="h-2 bg-white/20 rounded-full overflow-hidden"><div class="h-full bg-white rounded-full transition-all" style={`width:${pct}%`} /></div></div>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-indigo-600">{achs.filter(a=>a.unlocked).length}</p><p class="text-xs text-gray-500">{t('achievements.unlocked')}</p></div>
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-gray-600">{achs.length - achs.filter(a=>a.unlocked).length}</p><p class="text-xs text-gray-500">{t('achievements.locked')}</p></div>
        <div class="glass rounded-2xl p-3 text-center"><p class="text-2xl font-bold text-purple-600">{totalPts}</p><p class="text-xs text-gray-500">{t('achievements.points')}</p></div>
      </div>
      <div class="space-y-3"><For each={achs}>{(a) => (
        <div class={`glass rounded-2xl p-4 flex items-center gap-4 ${a.unlocked ? '' : 'opacity-60'}`}>
          <div class={`w-14 h-14 rounded-xl bg-gradient-to-br ${rc[a.rarity]} flex items-center justify-center shadow-lg`}><Icon name={a.icon} size="lg" class="text-white" /></div>
          <div class="flex-1">
            <div class="flex items-center gap-2"><p class="font-semibold text-gray-800">{t(a.titleKey)}</p><Show when={a.unlocked}><Icon name="check" size="xs" class="text-green-500" /></Show></div>
            <p class="text-sm text-gray-500">{t(a.descKey)}</p>
            <Show when={!a.unlocked && a.progress > 0}><div class="mt-2"><div class="h-1.5 bg-gray-200 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style={`width:${(a.progress/a.max)*100}%`} /></div><p class="text-xs text-gray-400 mt-1">{a.progress}/{a.max}</p></div></Show>
          </div>
          <div class="text-right"><span class={`px-2 py-0.5 text-xs font-semibold rounded-full ${a.unlocked?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>+{a.pts}</span><p class="text-[10px] text-gray-400 mt-1 capitalize">{a.rarity}</p></div>
        </div>
      )}</For></div>
    </div>
  );
}

// ============== Analytics Page ==============
function AnalyticsPage(props: { onBack: () => void }) {
  const stats = { totalEarnings: 450000, thisMonth: 125000, completed: 45, rating: 4.8, reviews: 127, completionRate: 98, onTimeRate: 97 };
  const weekly = [{day:'Mon',amt:16000},{day:'Tue',amt:24000},{day:'Wed',amt:8000},{day:'Thu',amt:32000},{day:'Fri',amt:28000},{day:'Sat',amt:12000},{day:'Sun',amt:5000}];
  const maxE = Math.max(...weekly.map(d=>d.amt));
  const recent = [{svc:'Bodyguard',earn:16000,date:'2026-02-06',r:5},{svc:'Event Security',earn:48000,date:'2026-02-05',r:5},{svc:'Patrol',earn:9000,date:'2026-02-04',r:4}];
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('analytics.title')}</h2></div>
      <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 text-white text-center mb-5 shadow-xl">
        <p class="text-sm opacity-80">{t('analytics.totalEarnings')}</p><p class="text-3xl font-bold">{stats.totalEarnings.toLocaleString()} ₸</p><p class="text-sm opacity-80 mt-1">+{stats.thisMonth.toLocaleString()} ₸ {t('analytics.thisMonth')}</p>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="glass rounded-2xl p-4 text-center"><Icon name="shield" class="text-blue-500 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.completed}</p><p class="text-xs text-gray-500">{t('analytics.completedOrders')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="star" class="text-amber-500 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.rating}</p><p class="text-xs text-gray-500">{stats.reviews} {t('analytics.reviews')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="check" class="text-green-500 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.completionRate}%</p><p class="text-xs text-gray-500">{t('analytics.completionRate')}</p></div>
        <div class="glass rounded-2xl p-4 text-center"><Icon name="clock" class="text-purple-500 mx-auto mb-2" /><p class="text-2xl font-bold">{stats.onTimeRate}%</p><p class="text-xs text-gray-500">{t('analytics.onTimeRate')}</p></div>
      </div>
      <div class="glass rounded-2xl p-4 mb-5">
        <p class="font-semibold text-gray-800 mb-3">{t('analytics.thisWeek')}</p>
        <div class="flex items-end justify-between h-28 gap-2"><For each={weekly}>{(d)=>(<div class="flex-1 flex flex-col items-center"><div class="w-full bg-gradient-to-t from-indigo-500 to-purple-500 rounded-t" style={`height:${(d.amt/maxE)*100}%;min-height:4px`}/><p class="text-[10px] text-gray-500 mt-1.5">{d.day}</p></div>)}</For></div>
        <p class="text-center text-sm text-gray-500 mt-3">{t('analytics.weeklyTotal')}: {weekly.reduce((s,d)=>s+d.amt,0).toLocaleString()} ₸</p>
      </div>
      <div class="glass rounded-2xl overflow-hidden">
        <p class="px-4 py-3 font-semibold text-gray-800">{t('analytics.recentOrders')}</p>
        <For each={recent}>{(o)=>(<div class="flex items-center justify-between px-4 py-3 border-t border-gray-100"><div><p class="font-medium text-gray-800">{o.svc}</p><p class="text-xs text-gray-500">{o.date}</p></div><div class="text-right"><p class="font-semibold text-green-600">+{o.earn.toLocaleString()} ₸</p><div class="flex items-center gap-1 justify-end"><Icon name="star" size="xs" class="text-amber-400"/><span class="text-xs text-gray-500">{o.r}</span></div></div></div>)}</For>
      </div>
    </div>
  );
}

// ============== Marketplace Page ==============
function MarketplacePage(props: { onBack: () => void }) {
  const cats = ['all','equipment','uniforms','training','safety'];
  const [activeCat, setActiveCat] = createSignal('all');
  const [cartCount, setCartCount] = createSignal(0);
  const products = [
    {id:1,name:'Professional Body Armor',desc:'Level IIIA protection',price:150000,oldPrice:180000,cat:'safety',rating:4.8,reviews:45,inStock:true},
    {id:2,name:'Security Radio Set',desc:'Long-range (pair)',price:35000,cat:'equipment',rating:4.5,reviews:89,inStock:true},
    {id:3,name:'Guard Uniform Set',desc:'Professional black',price:25000,cat:'uniforms',rating:4.7,reviews:156,inStock:true},
    {id:4,name:'First Aid Kit Pro',desc:'Complete emergency kit',price:15000,cat:'safety',rating:4.9,reviews:234,inStock:false},
    {id:5,name:'Online Training Course',desc:'Certification',price:50000,cat:'training',rating:4.6,reviews:67,inStock:true},
    {id:6,name:'Tactical Flashlight',desc:'High-power LED',price:8000,cat:'equipment',rating:4.4,reviews:112,inStock:true},
  ];
  const filtered = () => activeCat()==='all' ? products : products.filter(p=>p.cat===activeCat());
  return (
    <div class="p-4 animate-fade-in pb-8">
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('marketplace.title')}</h2></div>
        <div class="relative"><button class="p-2 touch-scale"><Icon name="wallet" /></button><Show when={cartCount()>0}><span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{cartCount()}</span></Show></div>
      </div>
      <div class="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 mb-4"><For each={cats}>{(c)=>(<button onClick={()=>setActiveCat(c)} class={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-scale ${activeCat()===c?'bg-indigo-500 text-white':'glass text-gray-600'}`}>{t('marketplace.cat.'+c)}</button>)}</For></div>
      <div class="grid grid-cols-2 gap-3"><For each={filtered()}>{(p)=>(
        <div class="glass rounded-2xl overflow-hidden">
          <div class="h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center"><Icon name="camera" size="xl" class="text-gray-300" /></div>
          <div class="p-3">
            <p class="font-medium text-sm text-gray-800 line-clamp-2">{p.name}</p>
            <div class="flex items-center gap-1 my-1"><Icon name="star" size="xs" class="text-amber-400"/><span class="text-xs text-gray-500">{p.rating} ({p.reviews})</span></div>
            <div class="flex items-center gap-2"><span class="font-bold text-indigo-600">{p.price.toLocaleString()} ₸</span><Show when={p.oldPrice}><span class="text-xs text-gray-400 line-through">{p.oldPrice?.toLocaleString()}</span></Show></div>
            <button class={`w-full mt-2 py-2 rounded-xl text-sm font-medium touch-scale ${p.inStock?'bg-indigo-500 text-white':'bg-gray-200 text-gray-400'}`} disabled={!p.inStock} onClick={()=>{if(p.inStock){setCartCount(cartCount()+1);haptic('light');playGlobalSound('success');}}}>{p.inStock?t('marketplace.addToCart'):t('marketplace.outOfStock')}</button>
          </div>
        </div>
      )}</For></div>
    </div>
  );
}

// ============== Incident Report Page ==============
function IncidentReportPage(props: { onBack: () => void }) {
  const types = [{id:'suspicious',label:'incident.suspicious',icon:'search' as const},{id:'unauthorized',label:'incident.unauthorized',icon:'shield' as const},{id:'hazard',label:'incident.hazard',icon:'alertTriangle' as const},{id:'medical',label:'incident.medical',icon:'heart' as const},{id:'damage',label:'incident.damage',icon:'home' as const},{id:'other',label:'incident.other',icon:'message' as const}];
  const sevs = [{id:'low',label:'incident.low',color:'bg-gray-400'},{id:'medium',label:'incident.medium',color:'bg-amber-500'},{id:'high',label:'incident.high',color:'bg-orange-500'},{id:'critical',label:'incident.critical',color:'bg-red-500'}];
  const [selType, setSelType] = createSignal('');
  const [sev, setSev] = createSignal('medium');
  const [desc, setDesc] = createSignal('');
  const [photos, setPhotos] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const submit = () => {setSubmitting(true);playGlobalSound('send');setTimeout(()=>{setSubmitting(false);playGlobalSound('success');haptic('heavy');props.onBack();},1500);};
  return (
    <div class="p-4 animate-fade-in pb-24">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('incident.title')}</h2></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.type')}</p>
      <div class="grid grid-cols-2 gap-3 mb-5"><For each={types}>{(tp)=>(<button onClick={()=>{setSelType(tp.id);haptic('light');}} class={`p-4 rounded-2xl text-left touch-scale ${selType()===tp.id?'glass border-2 border-red-400 shadow-md':'glass'}`}><Icon name={tp.icon} class={selType()===tp.id?'text-red-500':'text-gray-400'}/><p class="font-medium text-sm text-gray-800 mt-2">{t(tp.label)}</p></button>)}</For></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.severity')}</p>
      <div class="flex gap-2 mb-5"><For each={sevs}>{(s)=>(<button onClick={()=>{setSev(s.id);haptic('light');}} class={`flex-1 py-3 rounded-xl text-center touch-scale ${sev()===s.id?'bg-gray-900 text-white':'glass text-gray-600'}`}><div class={`w-3 h-3 ${s.color} rounded-full mx-auto mb-1`}/><span class="text-xs">{t(s.label)}</span></button>)}</For></div>
      <p class="text-sm font-medium text-gray-700 mb-2">{t('incident.description')}</p>
      <textarea value={desc()} onInput={(e)=>setDesc(e.currentTarget.value)} placeholder={t('incident.descPlaceholder')} rows={4} class="w-full px-4 py-3 glass rounded-2xl text-sm outline-none resize-none mb-5"/>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('incident.photos')}</p>
      <div class="flex gap-3 mb-6"><button onClick={()=>{setPhotos(photos()+1);haptic('light');}} class="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center touch-scale"><Icon name="camera" class="text-gray-400"/></button><For each={Array(photos())}>{(_,i)=>(<div class="w-20 h-20 bg-gray-200 rounded-xl flex items-center justify-center"><span class="text-sm text-gray-500">#{i()+1}</span></div>)}</For></div>
      <div class="fixed bottom-0 left-0 right-0 p-4 safe-area-bottom bg-white/80 backdrop-blur-lg" style="z-index:50">
        <button class="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-2xl font-bold text-lg touch-scale disabled:opacity-50 flex items-center justify-center gap-2" disabled={!selType()||!desc()||submitting()} onClick={submit}>
          <Show when={submitting()} fallback={<><Icon name="send" class="text-white" size="sm"/>{t('incident.submit')}</>}><div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/></Show>
        </button>
      </div>
    </div>
  );
}

// ============== Create Order Page ==============
function CreateOrderPage(props: { onBack: () => void }) {
  const services = [{id:'bodyguard',label:'order.bodyguard',icon:'shield' as const,price:5000},{id:'patrol',label:'order.patrol',icon:'location' as const,price:3000},{id:'event',label:'order.event',icon:'star' as const,price:4000},{id:'escort',label:'order.escort',icon:'arrowRight' as const,price:6000}];
  const [sel, setSel] = createSignal('');
  const [addr, setAddr] = createSignal('');
  const [dur, setDur] = createSignal(1);
  const [loading, setLoading] = createSignal(false);
  const selData = () => services.find(s=>s.id===sel());
  const total = () => (selData()?.price??0)*dur();
  const submit = () => {setLoading(true);playGlobalSound('send');haptic('medium');setTimeout(()=>{setLoading(false);playGlobalSound('success');props.onBack();},1500);};
  return (
    <div class="p-4 animate-fade-in pb-24">
      <div class="flex items-center mb-5"><button class="mr-3 p-2 rounded-xl bg-gray-100 touch-scale" onClick={props.onBack}><Icon name="chevronLeft" /></button><h2 class="text-xl font-bold">{t('order.newOrder')}</h2></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('order.selectService')}</p>
      <div class="grid grid-cols-2 gap-3 mb-5"><For each={services}>{(s)=>(<button onClick={()=>{setSel(s.id);haptic('light');playGlobalSound('tap');}} class={`p-4 rounded-2xl text-left touch-scale ${sel()===s.id?'glass border-2 border-indigo-400 shadow-md':'glass'}`}><Icon name={s.icon} class={sel()===s.id?'text-indigo-500':'text-gray-400'} size="lg"/><p class="font-medium text-gray-800 mt-2">{t(s.label)}</p><p class="text-sm text-indigo-600">{s.price.toLocaleString()} ₸/{t('order.hour')}</p></button>)}</For></div>
      <p class="text-sm font-medium text-gray-700 mb-2">{t('order.location')}</p>
      <div class="glass rounded-2xl flex items-center px-4 mb-5"><Icon name="location" class="text-gray-400 mr-3" size="sm"/><input type="text" value={addr()} onInput={(e)=>setAddr(e.currentTarget.value)} placeholder={t('order.enterAddress')} class="flex-1 bg-transparent py-3 outline-none text-sm"/></div>
      <p class="text-sm font-medium text-gray-700 mb-3">{t('order.duration')}</p>
      <div class="flex items-center gap-4 mb-5"><button onClick={()=>setDur(Math.max(1,dur()-1))} class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"><Icon name="minus" size="sm"/></button><span class="text-3xl font-bold w-12 text-center">{dur()}</span><button onClick={()=>setDur(dur()+1)} class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"><Icon name="plus" size="sm"/></button><span class="text-gray-500 text-sm">{t('order.hours')}</span></div>
      <div class="glass rounded-2xl p-4 mb-6">
        <div class="flex justify-between mb-2"><span class="text-gray-600">{t('order.service')}</span><span class="font-medium">{selData()?t(selData()!.label):'-'}</span></div>
        <div class="flex justify-between mb-2"><span class="text-gray-600">{t('order.duration')}</span><span class="font-medium">{dur()} {t('order.hours')}</span></div>
        <div class="border-t border-gray-200 my-3"/>
        <div class="flex justify-between"><span class="font-bold text-gray-900">{t('order.total')}</span><span class="text-xl font-bold text-indigo-600">{total().toLocaleString()} ₸</span></div>
      </div>
      <div class="fixed bottom-0 left-0 right-0 p-4 safe-area-bottom bg-white/80 backdrop-blur-lg" style="z-index:50">
        <button class="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg touch-scale disabled:opacity-50 flex items-center justify-center gap-2" disabled={!sel()||!addr()||loading()} onClick={submit}>
          <Show when={loading()} fallback={<>{t('order.findWorker')}</>}><div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/></Show>
        </button>
      </div>
    </div>
  );
}

// ============== Worker Detail Page ==============
function WorkerDetailPage(props: { onBack: () => void; onNavigate: (page: string) => void }) {
  const w = {name:'Александр Иванов',rating:4.9,reviews:127,level:4,rate:8000,available:true,years:8,orders:245,bio:'Профессиональный специалист с 8-летним опытом работы. Сертифицированный мастер с высшим разрядом.',specs:['VIP Protection','Bodyguard','Event Security'],rvs:[{author:'Марат К.',r:5,text:'Отличный профессионал!',date:'2026-02-01'},{author:'Айгерим Б.',r:5,text:'Пунктуальный и ответственный',date:'2026-01-28'},{author:'Дмитрий С.',r:4,text:'Хорошо справился',date:'2026-01-20'}]};
  const lvl = () => w.level>=4?'Elite':w.level>=3?'Premium':w.level>=2?'Verified':'Basic';
  return (
    <div class="animate-fade-in pb-24">
      <div class="bg-gradient-to-br from-indigo-500 to-purple-600 px-4 pt-4 pb-20"><button onClick={props.onBack} class="flex items-center gap-2 text-white/80 touch-scale mb-2"><Icon name="chevronLeft" class="text-white" size="sm"/><span class="text-sm">{t('nav.back')}</span></button></div>
      <div class="glass rounded-3xl -mt-16 mx-4 p-5 text-center relative">
        <div class="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-3xl text-white font-bold shadow-xl mx-auto -mt-14 border-4 border-white">А</div>
        <h2 class="text-xl font-bold text-gray-800 mt-3">{w.name}</h2>
        <div class="flex items-center justify-center gap-2 mt-2"><span class="px-3 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">{lvl()}</span><Show when={w.available}><span class="px-3 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{t('worker.available')}</span></Show></div>
        <div class="flex items-center justify-center gap-1 mt-2"><Icon name="star" size="xs" class="text-amber-400"/><span class="font-medium text-gray-700">{w.rating}</span><span class="text-gray-400 text-sm">({w.reviews})</span></div>
        <div class="flex border-t border-gray-100 divide-x divide-gray-100 mt-4">
          <div class="flex-1 py-3 text-center"><p class="text-lg font-bold text-gray-800">{w.years}</p><p class="text-xs text-gray-500">{t('worker.yearsExp')}</p></div>
          <div class="flex-1 py-3 text-center"><p class="text-lg font-bold text-gray-800">{w.orders}</p><p class="text-xs text-gray-500">{t('worker.orders')}</p></div>
          <div class="flex-1 py-3 text-center"><p class="text-lg font-bold text-indigo-600">{w.rate.toLocaleString()} ₸</p><p class="text-xs text-gray-500">{t('worker.perHour')}</p></div>
        </div>
      </div>
      <div class="mx-4 mt-4 glass rounded-2xl p-4"><p class="font-semibold text-gray-800 mb-2">{t('worker.about')}</p><p class="text-gray-600 text-sm">{w.bio}</p><div class="flex flex-wrap gap-2 mt-3"><For each={w.specs}>{(s)=>(<span class="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">{s}</span>)}</For></div></div>
      <div class="mx-4 mt-4 glass rounded-2xl p-4"><p class="font-semibold text-gray-800 mb-3">{t('worker.reviews')}</p><For each={w.rvs}>{(r)=>(<div class="py-3 border-b border-gray-100 last:border-0"><div class="flex justify-between"><p class="font-medium text-gray-800">{r.author}</p><div class="flex items-center gap-1"><Icon name="star" size="xs" class="text-amber-400"/><span class="text-sm">{r.r}</span></div></div><p class="text-sm text-gray-600 mt-1">{r.text}</p><p class="text-xs text-gray-400 mt-1">{r.date}</p></div>)}</For></div>
      <div class="fixed bottom-0 left-0 right-0 p-4 safe-area-bottom bg-white/80 backdrop-blur-lg" style="z-index:50">
        <div class="flex gap-3">
          <button class="flex-1 py-3 glass rounded-2xl font-medium text-gray-700 flex items-center justify-center gap-2 touch-scale" onClick={()=>props.onNavigate('chat')}><Icon name="message" size="sm"/>{t('worker.message')}</button>
          <button class="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 touch-scale" onClick={()=>props.onNavigate('createorder')}><Icon name="zap" size="sm" class="text-white"/>{t('worker.bookNow')}</button>
        </div>
      </div>
    </div>
  );
}
