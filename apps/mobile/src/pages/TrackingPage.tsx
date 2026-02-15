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

export default function TrackingPage() {
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

    // Fix blank map in dynamic containers
    setTimeout(() => map?.invalidateSize(), 100);
    setTimeout(() => map?.invalidateSize(), 500);

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
    <div class="h-screen relative animate-fade-in">
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

