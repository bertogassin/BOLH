import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Button, Icon, Badge, Avatar } from '@bolh/ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Update interval: 15 seconds
const UPDATE_INTERVAL_MS = 15000;
// Default radius in km
const DEFAULT_RADIUS_KM = 5;

// Profession types with colors
const professionColors: Record<string, string> = {
  bodyguard: '#3b82f6',     // blue
  patrol: '#10b981',        // green
  event: '#8b5cf6',         // purple
  escort: '#f59e0b',        // amber
  detective: '#ef4444',     // red
  cyber: '#06b6d4',         // cyan
};

const professionLabels: Record<string, string> = {
  bodyguard: 'Телохранитель',
  patrol: 'Патруль',
  event: 'Охрана мероприятий',
  escort: 'Сопровождение',
  detective: 'Детектив',
  cyber: 'Кибербезопасность',
};

// Visibility mode type
type VisibilityMode = 'on_map' | 'online_hidden' | 'offline';

interface Professional {
  id: number;
  name: string;
  profession: string;
  rating: number;
  totalReviews: number;
  hourlyRate: number;
  lat: number;
  lng: number;
  isOnline: boolean;
  visibility: VisibilityMode;
  distanceKm?: number;
  avatarUrl?: string;
}

// Mock professionals data — only those with visibility 'on_map' will appear
const allProfessionals: Professional[] = [
  { id: 1, name: 'Александр Иванов', profession: 'bodyguard', rating: 4.9, totalReviews: 127, hourlyRate: 8000, lat: 43.240, lng: 76.948, isOnline: true, visibility: 'on_map' },
  { id: 2, name: 'Сергей Петров', profession: 'event', rating: 4.7, totalReviews: 89, hourlyRate: 6000, lat: 43.235, lng: 76.940, isOnline: true, visibility: 'on_map' },
  { id: 3, name: 'Дмитрий Козлов', profession: 'patrol', rating: 4.5, totalReviews: 45, hourlyRate: 5000, lat: 43.242, lng: 76.955, isOnline: true, visibility: 'on_map' },
  { id: 4, name: 'Елена Смирнова', profession: 'detective', rating: 4.8, totalReviews: 62, hourlyRate: 10000, lat: 43.237, lng: 76.935, isOnline: true, visibility: 'on_map' },
  { id: 5, name: 'Максим Волков', profession: 'escort', rating: 4.6, totalReviews: 34, hourlyRate: 7000, lat: 43.245, lng: 76.952, isOnline: true, visibility: 'on_map' },
  { id: 6, name: 'Анна Кузнецова', profession: 'cyber', rating: 4.9, totalReviews: 98, hourlyRate: 12000, lat: 43.233, lng: 76.942, isOnline: true, visibility: 'on_map' },
  { id: 7, name: 'Игорь Новиков', profession: 'bodyguard', rating: 4.3, totalReviews: 23, hourlyRate: 4500, lat: 43.248, lng: 76.960, isOnline: true, visibility: 'on_map' },
  { id: 8, name: 'Ольга Морозова', profession: 'patrol', rating: 4.4, totalReviews: 41, hourlyRate: 4000, lat: 43.230, lng: 76.930, isOnline: true, visibility: 'on_map' },
  // These are online but hidden — won't show on map
  { id: 9, name: 'Виктор Лебедев', profession: 'bodyguard', rating: 4.7, totalReviews: 55, hourlyRate: 7500, lat: 43.239, lng: 76.945, isOnline: true, visibility: 'online_hidden' },
  { id: 10, name: 'Мария Попова', profession: 'event', rating: 4.2, totalReviews: 18, hourlyRate: 5500, lat: 43.241, lng: 76.949, isOnline: true, visibility: 'online_hidden' },
];

// Calculate distance between two points (Haversine)
const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapPage() {
  const navigate = useNavigate();

  // User location (Almaty center)
  const [userLocation] = createSignal({ lat: 43.238, lng: 76.945 });
  const [radius, setRadius] = createSignal(DEFAULT_RADIUS_KM);
  const [selectedProfession, setSelectedProfession] = createSignal<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = createSignal<Professional | null>(null);
  const [visibleProfessionals, setVisibleProfessionals] = createSignal<Professional[]>([]);
  const [lastUpdate, setLastUpdate] = createSignal(new Date());
  const [isLoading, setIsLoading] = createSignal(false);
  const [loadingBatch, setLoadingBatch] = createSignal(0);

  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | null = null;
  let markers: L.Marker[] = [];
  let radiusCircle: L.Circle | null = null;
  let userMarker: L.Marker | null = null;
  let updateInterval: ReturnType<typeof setInterval> | null = null;

  // Create marker icon for a profession
  const createProfIcon = (profession: string) => {
    const color = professionColors[profession] || '#6b7280';
    return L.divIcon({
      className: 'prof-marker',
      html: `
        <div style="position:relative;width:32px;height:32px;">
          <div style="position:absolute;inset:0;background:${color};border-radius:50%;opacity:0.2;"></div>
          <div style="position:absolute;inset:4px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
            <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  // Cluster icon
  const createClusterIcon = (count: number) => {
    return L.divIcon({
      className: 'cluster-marker',
      html: `
        <div style="width:40px;height:40px;background:rgba(99,102,241,0.9);border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.3);color:white;font-weight:bold;font-size:14px;">
          ${count}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Filter professionals by radius and visibility
  const filterProfessionals = () => {
    const user = userLocation();
    const r = radius();
    const profFilter = selectedProfession();

    return allProfessionals.filter((p) => {
      // Only show those with 'on_map' visibility
      if (p.visibility !== 'on_map') return false;
      if (!p.isOnline) return false;

      // Filter by distance
      const dist = calcDistance(user.lat, user.lng, p.lat, p.lng);
      if (dist > r) return false;

      // Filter by profession
      if (profFilter && p.profession !== profFilter) return false;

      // Add distance to object
      p.distanceKm = dist;
      return true;
    });
  };

  // Load professionals in batches (to simulate gradual loading)
  const loadProfessionalsInBatches = async () => {
    setIsLoading(true);
    const filtered = filterProfessionals();
    const batchSize = 5;
    const batches = Math.ceil(filtered.length / batchSize);

    // Clear existing markers
    clearMarkers();

    for (let i = 0; i < batches; i++) {
      setLoadingBatch(i + 1);
      const batch = filtered.slice(i * batchSize, (i + 1) * batchSize);

      // Add markers for this batch
      batch.forEach((prof) => {
        addMarker(prof);
      });

      // Small delay between batches (simulates server response)
      if (i < batches - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    setVisibleProfessionals(filtered);
    setLastUpdate(new Date());
    setIsLoading(false);
    setLoadingBatch(0);
  };

  const clearMarkers = () => {
    markers.forEach((m) => m.remove());
    markers = [];
  };

  const addMarker = (prof: Professional) => {
    if (!map) return;

    const marker = L.marker([prof.lat, prof.lng], {
      icon: createProfIcon(prof.profession),
    }).addTo(map);

    marker.on('click', () => {
      setSelectedProfessional(prof);
    });

    // Tooltip on hover
    marker.bindTooltip(
      `<strong>${prof.name}</strong><br/>${professionLabels[prof.profession]}<br/>★ ${prof.rating}`,
      { direction: 'top', offset: [0, -16] }
    );

    markers.push(marker);
  };

  const updateRadiusCircle = () => {
    if (!map) return;
    const user = userLocation();

    if (radiusCircle) {
      radiusCircle.setLatLng([user.lat, user.lng]);
      radiusCircle.setRadius(radius() * 1000);
    }
  };

  const initMap = () => {
    if (!mapContainer) return;

    const user = userLocation();

    map = L.map(mapContainer, {
      center: [user.lat, user.lng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Radius circle
    radiusCircle = L.circle([user.lat, user.lng], {
      radius: radius() * 1000,
      color: '#6366f1',
      fillColor: '#6366f1',
      fillOpacity: 0.05,
      weight: 1,
      dashArray: '6, 8',
    }).addTo(map);

    // User marker
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: `
        <div style="position:relative;width:20px;height:20px;">
          <div style="position:absolute;inset:0;background:#6366f1;border-radius:50%;opacity:0.3;animation:userPulse 2s infinite;"></div>
          <div style="position:absolute;inset:3px;background:#6366f1;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    userMarker = L.marker([user.lat, user.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup('Вы здесь');

    // Map click closes selected professional panel
    map.on('click', () => {
      setSelectedProfessional(null);
    });
  };

  onMount(() => {
    initMap();

    // Initial load
    loadProfessionalsInBatches();

    // Update every 15 seconds
    updateInterval = setInterval(() => {
      // Simulate small position changes
      allProfessionals.forEach((p) => {
        if (p.isOnline && p.visibility === 'on_map') {
          p.lat += (Math.random() - 0.5) * 0.0003;
          p.lng += (Math.random() - 0.5) * 0.0003;
        }
      });
      loadProfessionalsInBatches();
    }, UPDATE_INTERVAL_MS);
  });

  onCleanup(() => {
    if (updateInterval) clearInterval(updateInterval);
    if (map) {
      map.remove();
      map = null;
    }
  });

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    updateRadiusCircle();
    loadProfessionalsInBatches();
  };

  const handleProfessionFilter = (prof: string | null) => {
    setSelectedProfession(prof === selectedProfession() ? null : prof);
    loadProfessionalsInBatches();
  };

  const handleOrder = (prof: Professional) => {
    navigate(`/guards/${prof.id}`);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const onlineHiddenCount = () => allProfessionals.filter((p) => p.isOnline && p.visibility === 'online_hidden').length;

  return (
    <div class="h-[calc(100vh-8rem)] flex flex-col bg-gray-900 relative">
      {/* Map */}
      <div class="flex-1 relative">
        <div ref={mapContainer} class="absolute inset-0 z-0" />

        {/* Top controls overlay */}
        <div class="absolute top-3 left-3 right-3 z-[1000]">
          {/* Stats bar */}
          <div class="bg-gray-800/90 backdrop-blur-md rounded-xl p-3 border border-gray-700/50 mb-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span class="text-sm text-gray-300">
                  <strong class="text-white">{visibleProfessionals().length}</strong> на карте
                </span>
                <Show when={onlineHiddenCount() > 0}>
                  <span class="text-xs text-gray-500">
                    +{onlineHiddenCount()} скрыто
                  </span>
                </Show>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">Обновлено: {formatTime(lastUpdate())}</span>
                <Show when={isLoading()}>
                  <div class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </Show>
              </div>
            </div>
          </div>

          {/* Profession filters */}
          <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => handleProfessionFilter(null)}
              class={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedProfession() === null
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-gray-800/80 text-gray-400 border border-gray-700/50'
              }`}
            >
              Все
            </button>
            <For each={Object.entries(professionLabels)}>
              {([key, label]) => (
                <button
                  onClick={() => handleProfessionFilter(key)}
                  class={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedProfession() === key
                      ? 'text-white shadow-lg'
                      : 'bg-gray-800/80 text-gray-400 border border-gray-700/50'
                  }`}
                  style={selectedProfession() === key ? { background: professionColors[key], 'box-shadow': `0 4px 15px ${professionColors[key]}40` } : {}}
                >
                  <div
                    class="w-2 h-2 rounded-full"
                    style={{ background: professionColors[key] }}
                  />
                  {label}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Radius control — bottom left */}
        <div class="absolute bottom-3 left-3 z-[1000]">
          <div class="bg-gray-800/90 backdrop-blur-md rounded-xl p-3 border border-gray-700/50">
            <p class="text-xs text-gray-400 mb-2">Радиус: <strong class="text-white">{radius()} км</strong></p>
            <div class="flex gap-1.5">
              {[2, 5, 10, 20].map((r) => (
                <button
                  onClick={() => handleRadiusChange(r)}
                  class={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    radius() === r
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {r} км
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search button — bottom right */}
        <div class="absolute bottom-3 right-3 z-[1000]">
          <button
            onClick={() => navigate('/discover')}
            class="bg-gray-800/90 backdrop-blur-md rounded-xl p-3 border border-gray-700/50 text-gray-300 hover:text-white transition-colors"
          >
            <Icon name="search" size="md" />
          </button>
        </div>
      </div>

      {/* Selected professional panel */}
      <Show when={selectedProfessional()}>
        {(prof) => (
          <div class="absolute bottom-0 left-0 right-0 z-[1001] animate-slide-up">
            <div class="bg-gray-800 rounded-t-2xl border-t border-gray-700/50 shadow-2xl p-4 mx-2 mb-0">
              {/* Close button */}
              <button
                onClick={() => setSelectedProfessional(null)}
                class="absolute top-3 right-3 text-gray-500 hover:text-white"
              >
                <Icon name="close" size="sm" />
              </button>

              <div class="flex items-center gap-3 mb-3">
                <Avatar
                  name={prof().name}
                  size="lg"
                  status="online"
                />
                <div class="flex-1">
                  <h3 class="font-semibold text-white">{prof().name}</h3>
                  <div class="flex items-center gap-2">
                    <Badge
                      variant="primary"
                      size="sm"
                      style={{ background: professionColors[prof().profession] }}
                    >
                      {professionLabels[prof().profession]}
                    </Badge>
                    <div class="flex items-center gap-1">
                      <Icon name="star" size="sm" class="text-yellow-400" />
                      <span class="text-sm text-gray-300">{prof().rating}</span>
                      <span class="text-xs text-gray-500">({prof().totalReviews})</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between mb-3 bg-gray-700/50 rounded-xl p-3">
                <div>
                  <p class="text-xs text-gray-400">Расстояние</p>
                  <p class="text-sm font-semibold text-white">
                    {prof().distanceKm! < 1
                      ? `${Math.round(prof().distanceKm! * 1000)} м`
                      : `${prof().distanceKm!.toFixed(1)} км`}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Ставка</p>
                  <p class="text-sm font-semibold text-white">{prof().hourlyRate.toLocaleString()} ₸/ч</p>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Отзывы</p>
                  <p class="text-sm font-semibold text-white">{prof().totalReviews}</p>
                </div>
              </div>

              <div class="flex gap-2">
                <Button
                  variant="outline"
                  class="flex-1 !border-gray-600 !text-gray-300"
                  leftIcon={<Icon name="chat" size="sm" />}
                  onClick={() => navigate(`/chat/${prof().id}`)}
                >
                  Написать
                </Button>
                <Button
                  variant="primary"
                  class="flex-1"
                  leftIcon={<Icon name="shield" size="sm" />}
                  onClick={() => handleOrder(prof())}
                >
                  Заказать
                </Button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Animations */}
      <style>{`
        @keyframes userPulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(1); opacity: 0.3; }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .leaflet-container {
          background: #1e293b !important;
        }
        .leaflet-tooltip {
          background: #1e293b !important;
          border: 1px solid #374151 !important;
          color: #e5e7eb !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
          font-size: 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
        .leaflet-tooltip-top:before {
          border-top-color: #374151 !important;
        }
      `}</style>
    </div>
  );
}
