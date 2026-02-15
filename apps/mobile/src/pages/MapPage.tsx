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
import { api, isBackendAvailable, type Guard } from '../api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

export default function MapPage() {
  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | undefined;
  let tileLayer: L.TileLayer | undefined;
  let userMarker: L.Marker | undefined;
  const workerMarkers: L.Marker[] = [];
  const isEn = () => currentLang() === 'en';

  const [mapRef, setMapRef] = createSignal<L.Map | null>(null);
  const [userPos, setUserPos] = createSignal<{ lat: number; lng: number } | null>(null);
  const [workers, setWorkers] = createSignal<ReturnType<typeof generateNearbyWorkers>>([]);
  const [departmentFilter, setDepartmentFilter] = createSignal<string | null>(null);
  const [selectedWorker, setSelectedWorker] = createSignal<ReturnType<typeof generateNearbyWorkers>[0] | null>(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = createSignal(false);

  const filteredWorkers = () => {
    let list = workers();
    const df = departmentFilter();
    if (df) list = list.filter(w => w.departmentId === df);
    if (showOnlyAvailable()) list = list.filter(w => w.status === 'available');
    return list;
  };

  const center = () => userPos() || ALMATY;

  // Convert API Guard to local worker format
  const guardToWorker = (g: Guard, center: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((g.latitude - center.lat) * Math.PI) / 180;
    const dLng = ((g.longitude - center.lng) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(center.lat*Math.PI/180)*Math.cos(g.latitude*Math.PI/180)*Math.sin(dLng/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return {
      id: `g-${g.id}`,
      name: g.name,
      profession: g.specializations?.[0] || 'Professional',
      departmentId: g.specializations?.[0] || 'security',
      rating: g.rating,
      reviews: g.totalReviews,
      distance: Math.round(dist * 10) / 10,
      lat: g.latitude,
      lng: g.longitude,
      status: (g.isAvailable ? 'available' : 'busy') as 'available' | 'busy',
    };
  };

  // Try to fetch nearby guards from API, fallback to mock data
  const fetchNearbyWorkers = async (coords: { lat: number; lng: number }) => {
    try {
      const backendUp = await isBackendAvailable();
      if (backendUp) {
        const guards = await api.guards.nearby({ latitude: coords.lat, longitude: coords.lng, radiusKm: 5, limit: 20 });
        if (guards && Array.isArray(guards) && guards.length > 0) {
          const mapped = guards.map(g => guardToWorker(g, coords));
          setWorkers(mapped.sort((a, b) => a.distance - b.distance));
          return;
        }
      }
    } catch (e) {
      console.warn('API guards/nearby failed, using mock data:', e);
    }
    // Fallback to generated mock data
    setWorkers(generateNearbyWorkers(coords, 15 + Math.floor(Math.random() * 6)));
  };

  onMount(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(coords);
        fetchNearbyWorkers(coords);
        // Also update user location on backend
        api.users.updateLocation(coords.lat, coords.lng).catch(() => {});
      },
      () => {
        setUserPos(ALMATY);
        fetchNearbyWorkers(ALMATY);
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
    tileLayer = L.tileLayer(url, { attribution: '&copy; OSM', maxZoom: 19 }).addTo(map);
    setMapRef(map);
    setTimeout(() => map?.invalidateSize(), 100);
    setTimeout(() => map?.invalidateSize(), 500);
    // Close selected worker when clicking on map
    map.on('click', () => setSelectedWorker(null));
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
      html: '<div class="map-user-pulse"><span class="map-user-dot"></span></div>',
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
      const borderColor = w.status === 'available' ? '#22c55e' : '#f59e0b';
      const icon = L.divIcon({
        className: 'map-worker-marker',
        html: `<div class="map-worker-circle" style="background: linear-gradient(135deg, ${colorFrom}, ${colorTo}); box-shadow: 0 4px 20px ${colorFrom}50; border-color: ${borderColor};"><span class="map-worker-emoji">${emoji}</span></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([w.lat, w.lng], { icon }).addTo(m);
      marker.on('click', (e: any) => {
        e.originalEvent?.stopPropagation?.();
        setSelectedWorker(w);
        m.setView([w.lat, w.lng], m.getZoom(), { animate: true });
      });
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
    tileLayer = L.tileLayer(url, { attribution: '&copy; OSM', maxZoom: 19 }).addTo(m);
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
    workerMarkers.forEach(mk => { mk.off(); mk.remove(); });
    workerMarkers.length = 0;
    userMarker?.remove();
    userMarker = undefined;
    if (map) {
      map.off(); // Remove ALL event listeners
      tileLayer?.remove();
      map.remove();
      map = undefined as any;
    }
    setMapRef(undefined as any);
  });

  return (
    <div style="position: relative; height: 100vh; overflow: hidden;">
      <div ref={mapContainer} style="position: absolute; inset: 0; z-index: 1;" />

      {/* Top bar — search + department filter */}
      <div style="position: absolute; top: 12px; left: 12px; right: 12px; z-index: 10;">
        <div style="padding: 10px 14px; border-radius: 18px; background: rgba(10,10,20,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 16px; opacity: 0.5;">🔍</span>
          <input
            type="text"
            placeholder={isEn() ? 'Search on map...' : 'Поиск на карте...'}
            style="flex: 1; background: none; border: none; outline: none; color: #fff; font-size: 14px; font-weight: 500;"
          />
          {/* Workers count badge */}
          <span style="padding: 3px 10px; border-radius: 10px; background: rgba(99,102,241,0.2); color: #a78bfa; font-size: 11px; font-weight: 700; white-space: nowrap;">
            {filteredWorkers().length} {isEn() ? 'pros' : 'мастеров'}
          </span>
        </div>

        {/* Department chips */}
        <div style="display: flex; gap: 6px; overflow-x: auto; margin-top: 8px; padding-bottom: 4px; -webkit-overflow-scrolling: touch;">
          <button
            onClick={() => setDepartmentFilter(null)}
            style={`padding: 8px 14px; border-radius: 14px; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; flex-shrink: 0; border: none; ${!departmentFilter() ? 'background: rgba(99,102,241,0.9); color: #fff; box-shadow: 0 2px 10px rgba(99,102,241,0.4);' : 'background: rgba(10,10,20,0.75); color: rgba(255,255,255,0.6); backdrop-filter: blur(10px);'}`}
          >
            {isEn() ? 'All' : 'Все'}
          </button>
          <button
            onClick={() => setShowOnlyAvailable(!showOnlyAvailable())}
            style={`padding: 8px 14px; border-radius: 14px; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; flex-shrink: 0; border: none; display: flex; align-items: center; gap: 5px; ${showOnlyAvailable() ? 'background: rgba(34,197,94,0.9); color: #fff;' : 'background: rgba(10,10,20,0.75); color: rgba(255,255,255,0.6); backdrop-filter: blur(10px);'}`}
          >
            🟢 {isEn() ? 'Online' : 'Онлайн'}
          </button>
          <For each={departments}>
            {(dept) => (
              <button
                onClick={() => setDepartmentFilter(departmentFilter() === dept.id ? null : dept.id)}
                style={`width: 40px; height: 36px; border-radius: 14px; font-size: 18px; cursor: pointer; flex-shrink: 0; border: none; display: flex; align-items: center; justify-content: center; transition: all 0.2s; ${departmentFilter() === dept.id ? `background: linear-gradient(135deg, ${dept.colorFrom}, ${dept.colorTo}); color: #fff; box-shadow: 0 2px 12px ${dept.colorFrom}50;` : 'background: rgba(10,10,20,0.75); color: rgba(255,255,255,0.6); backdrop-filter: blur(10px);'}`}
              >
                {dept.icon}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* My Location + Refresh buttons */}
      <div style="position: absolute; bottom: 200px; right: 12px; z-index: 10; display: flex; flex-direction: column; gap: 8px;">
        <button
          onClick={goToMyLocation}
          style="width: 48px; height: 48px; border-radius: 16px; background: rgba(10,10,20,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); color: #a78bfa; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3);"
        >
          📍
        </button>
        <button
          onClick={() => {
            const pos = userPos() || ALMATY;
            setSelectedWorker(null);
            fetchNearbyWorkers(pos);
          }}
          style="width: 48px; height: 48px; border-radius: 16px; background: rgba(10,10,20,0.85); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.3);"
        >
          🔄
        </button>
      </div>

      {/* Selected worker detail card */}
      <Show when={selectedWorker()}>
        {(() => {
          const w = () => selectedWorker()!;
          const dept = () => getDepartment(w().departmentId);
          return (
            <div style="position: absolute; bottom: 100px; left: 12px; right: 12px; z-index: 15; padding: 16px; border-radius: 20px; background: rgba(10,10,20,0.92); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
              {/* Close button */}
              <button onClick={() => setSelectedWorker(null)} style="position: absolute; top: 10px; right: 12px; background: none; border: none; color: rgba(255,255,255,0.4); font-size: 18px; cursor: pointer; padding: 4px;">✕</button>

              <div style="display: flex; gap: 14px; align-items: flex-start;">
                {/* Avatar */}
                <div style={`width: 56px; height: 56px; border-radius: 18px; background: linear-gradient(135deg, ${dept()?.colorFrom ?? '#6366f1'}, ${dept()?.colorTo ?? '#9333ea'}); display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; box-shadow: 0 6px 20px ${dept()?.colorFrom ?? '#6366f1'}40;`}>
                  {dept()?.icon ?? '👤'}
                </div>

                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                    <span style="color: #fff; font-size: 16px; font-weight: 800;">{w().name}</span>
                    <span style={`width: 8px; height: 8px; border-radius: 50%; background: ${w().status === 'available' ? '#22c55e' : '#f59e0b'};`} />
                  </div>
                  <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 6px 0;">
                    {isEn() ? dept()?.nameEn : dept()?.name} • {w().profession}
                  </p>
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="color: #fbbf24; font-size: 13px; font-weight: 700;">⭐ {w().rating} <span style="color: rgba(255,255,255,0.3); font-weight: 400; font-size: 11px;">({w().reviews})</span></span>
                    <span style="color: rgba(255,255,255,0.4); font-size: 12px;">📍 {w().distance} {isEn() ? 'km' : 'км'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style="display: flex; gap: 8px; margin-top: 14px;">
                <button style={`flex: 1; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, ${dept()?.colorFrom ?? '#6366f1'}, ${dept()?.colorTo ?? '#9333ea'}); color: #fff; font-size: 13px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 15px ${dept()?.colorFrom ?? '#6366f1'}40; display: flex; align-items: center; justify-content: center; gap: 6px;`}>
                  ⚡ {isEn() ? 'Book Now' : 'Заказать'}
                </button>
                <button style="padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  💬
                </button>
                <button style="padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; cursor: pointer;">
                  👤
                </button>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* Bottom swipeable cards — nearest workers */}
      <Show when={!selectedWorker()}>
        <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; padding: 0 8px 8px 8px;">
          <div style="border-radius: 20px 20px 0 0; overflow: hidden; background: rgba(10,10,20,0.88); backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; box-shadow: 0 -10px 40px rgba(0,0,0,0.3);">
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 8px;">
              <p style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 700; margin: 0;">
                {isEn() ? 'Nearby Professionals' : 'Мастера рядом'}
              </p>
              <span style="color: rgba(255,255,255,0.3); font-size: 11px;">{filteredWorkers().length} {isEn() ? 'found' : 'найдено'}</span>
            </div>
            <div style="display: flex; gap: 10px; overflow-x: auto; padding: 4px 16px 14px; -webkit-overflow-scrolling: touch;">
              <For each={filteredWorkers().slice(0, 10)}>
                {(worker) => {
                  const dept = () => getDepartment(worker.departmentId);
                  return (
                    <div
                      onClick={() => {
                        setSelectedWorker(worker);
                        const m = mapRef();
                        if (m) m.setView([worker.lat, worker.lng], 15, { animate: true });
                      }}
                      style={`flex-shrink: 0; width: 150px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s;`}
                    >
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div style={`width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, ${dept()?.colorFrom ?? '#6366f1'}, ${dept()?.colorTo ?? '#9333ea'}); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;`}>
                          {dept()?.icon ?? '👤'}
                        </div>
                        <div style="min-width: 0; flex: 1;">
                          <p style="color: #fff; font-size: 12px; font-weight: 700; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{worker.name}</p>
                          <p style="color: rgba(255,255,255,0.4); font-size: 10px; margin: 1px 0 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{worker.profession}</p>
                        </div>
                      </div>
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #fbbf24; font-size: 11px; font-weight: 600;">⭐ {worker.rating}</span>
                        <span style="color: rgba(255,255,255,0.3); font-size: 10px;">{worker.distance} {isEn() ? 'km' : 'км'}</span>
                      </div>
                      <div style={`margin-top: 6px; padding: 2px 8px; border-radius: 6px; text-align: center; font-size: 10px; font-weight: 600; ${worker.status === 'available' ? 'background: rgba(34,197,94,0.15); color: #4ade80;' : 'background: rgba(245,158,11,0.15); color: #fbbf24;'}`}>
                        {worker.status === 'available' ? (isEn() ? 'Available' : 'Доступен') : (isEn() ? 'Busy' : 'Занят')}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </Show>

      <style>{`
        /* Reset Leaflet default icon styles */
        .map-user-marker,
        .map-worker-marker {
          background: none !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
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
        .map-worker-circle {
          width: 44px; height: 44px;
          border-radius: 50%;
          border: 3px solid #22c55e;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s ease;
          cursor: pointer;
          box-sizing: border-box;
        }
        .map-worker-circle:hover { transform: scale(1.15); }
        .map-worker-emoji {
          font-size: 20px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          text-align: center;
          margin: 0;
          padding: 0;
        }
        /* Fix Leaflet popup/tooltip z-index conflicts */
        .leaflet-marker-icon { overflow: visible !important; }
      `}</style>
    </div>
  );
}
