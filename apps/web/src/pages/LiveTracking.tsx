import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { Avatar, Badge, Button, Icon } from '@bolh/ui';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom guard icon (blue pulsing dot)
const guardIcon = L.divIcon({
  className: 'guard-marker',
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.3;animation:pulse 2s infinite;"></div>
      <div style="position:absolute;inset:4px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Custom client icon (green dot)
const clientIcon = L.divIcon({
  className: 'client-marker',
  html: `
    <div style="width:14px;height:14px;background:#10b981;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Mock guard data
const guard = {
  id: 1,
  name: 'Александр Иванов',
  phone: '+7 707 123 4567',
  rating: 4.9,
  avatarUrl: undefined,
};

// Update interval in milliseconds (5 seconds)
const UPDATE_INTERVAL_MS = 5000;

export default function LiveTrackingPage() {
  const params = useParams();
  const navigate = useNavigate();

  const [guardLocation, setGuardLocation] = createSignal({ lat: 43.238, lng: 76.945 });
  const [clientLocation] = createSignal({ lat: 43.243, lng: 76.950 });
  const [eta, setEta] = createSignal('5 мин');
  const [distance, setDistance] = createSignal('1.2 км');
  const [status, setStatus] = createSignal<'arriving' | 'arrived' | 'in_progress'>('arriving');
  const [lastUpdate, setLastUpdate] = createSignal(new Date());

  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | null = null;
  let guardMarker: L.Marker | null = null;
  let routeLine: L.Polyline | null = null;
  let wsConnection: WebSocket | null = null;
  let updateInterval: ReturnType<typeof setInterval> | null = null;

  const closeConnection = () => {
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
  };

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

  const updateMap = (guardLat: number, guardLng: number) => {
    if (!map) return;

    // Update guard marker position with smooth transition
    if (guardMarker) {
      guardMarker.setLatLng([guardLat, guardLng]);
    }

    // Update route line
    const client = clientLocation();
    if (routeLine) {
      routeLine.setLatLngs([
        [guardLat, guardLng],
        [client.lat, client.lng],
      ]);
    }

    // Fit bounds to show both markers
    const bounds = L.latLngBounds(
      [guardLat, guardLng],
      [client.lat, client.lng]
    );
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    // Update distance and ETA
    const dist = calcDistance(guardLat, guardLng, client.lat, client.lng);
    if (dist < 0.1) {
      setDistance('< 100 м');
      setEta('< 1 мин');
      if (status() === 'arriving') setStatus('arrived');
    } else {
      setDistance(dist < 1 ? `${Math.round(dist * 1000)} м` : `${dist.toFixed(1)} км`);
      // Rough ETA: assume 30 km/h average speed
      const etaMin = Math.max(1, Math.round((dist / 30) * 60));
      setEta(`${etaMin} мин`);
    }

    setLastUpdate(new Date());
  };

  const initMap = () => {
    if (!mapContainer) return;

    const client = clientLocation();
    const guardLoc = guardLocation();

    map = L.map(mapContainer, {
      center: [guardLoc.lat, guardLoc.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark-styled tiles for a modern look
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Route line (dashed)
    routeLine = L.polyline(
      [
        [guardLoc.lat, guardLoc.lng],
        [client.lat, client.lng],
      ],
      {
        color: '#3b82f6',
        weight: 3,
        dashArray: '8, 12',
        opacity: 0.7,
      }
    ).addTo(map);

    // Client marker
    L.marker([client.lat, client.lng], { icon: clientIcon })
      .addTo(map)
      .bindPopup('Вы здесь');

    // Guard marker
    guardMarker = L.marker([guardLoc.lat, guardLoc.lng], { icon: guardIcon })
      .addTo(map)
      .bindPopup(guard.name);

    // Fit to show both
    const bounds = L.latLngBounds(
      [guardLoc.lat, guardLoc.lng],
      [client.lat, client.lng]
    );
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  };

  const connectWebSocket = () => {
    // TODO: Connect to actual WebSocket server
    // wsConnection = new WebSocket('wss://api.guardio.app/ws');
    // wsConnection.onmessage = (event) => {
    //   const data = JSON.parse(event.data);
    //   if (data.type === 'guard:location') {
    //     const newLoc = { lat: data.latitude, lng: data.longitude };
    //     setGuardLocation(newLoc);
    //     updateMap(newLoc.lat, newLoc.lng);
    //   }
    // };
  };

  onMount(() => {
    // Initialize map
    initMap();

    // Connect WebSocket
    connectWebSocket();

    // Simulate guard movement every 5 seconds
    updateInterval = setInterval(() => {
      const client = clientLocation();
      setGuardLocation((prev) => {
        // Move guard towards client
        const dlat = (client.lat - prev.lat) * 0.05 + (Math.random() - 0.5) * 0.0005;
        const dlng = (client.lng - prev.lng) * 0.05 + (Math.random() - 0.5) * 0.0005;
        const newLoc = {
          lat: prev.lat + dlat,
          lng: prev.lng + dlng,
        };
        updateMap(newLoc.lat, newLoc.lng);
        return newLoc;
      });
    }, UPDATE_INTERVAL_MS);
  });

  onCleanup(() => {
    if (updateInterval) clearInterval(updateInterval);
    closeConnection();
    if (map) {
      map.remove();
      map = null;
    }
  });

  const handleCall = () => {
    window.location.href = `tel:${guard.phone}`;
  };

  const handleMessage = () => {
    navigate(`/chat/${params.orderId}`);
  };

  const handleSOS = () => {
    alert('SOS сигнал отправлен экстренным контактам!');
  };

  const statusText = () => {
    switch (status()) {
      case 'arriving': return 'Охранник в пути';
      case 'arrived': return 'Охранник прибыл';
      case 'in_progress': return 'Работа выполняется';
    }
  };

  const statusColor = () => {
    switch (status()) {
      case 'arriving': return 'primary';
      case 'arrived': return 'success';
      case 'in_progress': return 'success';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div class="h-screen flex flex-col bg-gray-900">
      {/* Map - takes most of the screen */}
      <div class="flex-1 relative">
        <div ref={mapContainer} class="absolute inset-0 z-0" />

        {/* Top overlay - status bar */}
        <div class="absolute top-4 left-4 right-4 z-[1000]">
          <div class="bg-gray-800/90 backdrop-blur-md rounded-xl shadow-lg p-3 flex items-center justify-between border border-gray-700/50">
            <div class="flex items-center gap-3">
              <button onClick={() => navigate(-1)} class="text-gray-300 hover:text-white transition-colors">
                <Icon name="arrowLeft" size="md" />
              </button>
              <div>
                <Badge variant={statusColor() as any}>{statusText()}</Badge>
                <p class="text-xs text-gray-400 mt-1">Заказ #{params.orderId}</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-2xl font-bold text-blue-400">{eta()}</p>
              <p class="text-xs text-gray-400">{distance()}</p>
            </div>
          </div>
        </div>

        {/* SOS button */}
        <button
          onClick={handleSOS}
          class="absolute top-24 right-4 z-[1000] w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
        >
          <Icon name="sos" size="sm" class="text-white" />
        </button>

        {/* Update indicator */}
        <div class="absolute bottom-4 left-4 z-[1000]">
          <div class="bg-gray-800/80 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2 border border-gray-700/50">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span class="text-xs text-gray-400">Обновлено: {formatTime(lastUpdate())}</span>
          </div>
        </div>
      </div>

      {/* Bottom panel - guard info + actions */}
      <div class="bg-gray-800 rounded-t-3xl shadow-2xl relative z-10 border-t border-gray-700/50">
        {/* Drag handle */}
        <div class="w-12 h-1 bg-gray-600 rounded-full mx-auto mt-3 mb-3" />

        <div class="px-4 pb-6">
          {/* Guard info row */}
          <div class="flex items-center gap-3 mb-4">
            <Avatar
              src={guard.avatarUrl}
              name={guard.name}
              size="lg"
              status="online"
            />
            <div class="flex-1">
              <h3 class="font-semibold text-white">{guard.name}</h3>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                  <Icon name="star" size="sm" class="text-yellow-400" />
                  <span class="text-sm text-gray-300">{guard.rating}</span>
                </div>
                <span class="text-gray-600">•</span>
                <span class="text-sm text-gray-400">{guard.phone}</span>
              </div>
            </div>
          </div>

          {/* Timeline - compact */}
          <div class="flex items-center gap-2 mb-4 bg-gray-700/50 rounded-xl p-3">
            <div class="flex items-center gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span class="text-xs text-gray-300">Принят</span>
            </div>
            <div class="flex-1 h-0.5 bg-gray-600 rounded">
              <div
                class="h-full bg-blue-500 rounded transition-all duration-500"
                style={{
                  width: status() === 'arriving' ? '50%' : status() === 'arrived' ? '80%' : '100%',
                }}
              />
            </div>
            <div class="flex items-center gap-1.5">
              <div class={`w-2.5 h-2.5 rounded-full ${status() !== 'arriving' ? 'bg-green-500' : 'bg-gray-500'}`} />
              <span class={`text-xs ${status() !== 'arriving' ? 'text-green-400' : 'text-gray-500'}`}>Прибыл</span>
            </div>
            <div class="flex-1 h-0.5 bg-gray-600 rounded">
              <div
                class="h-full bg-blue-500 rounded transition-all duration-500"
                style={{ width: status() === 'in_progress' ? '100%' : '0%' }}
              />
            </div>
            <div class="flex items-center gap-1.5">
              <div class={`w-2.5 h-2.5 rounded-full ${status() === 'in_progress' ? 'bg-blue-500 animate-pulse' : 'bg-gray-500'}`} />
              <span class={`text-xs ${status() === 'in_progress' ? 'text-blue-400' : 'text-gray-500'}`}>Работает</span>
            </div>
          </div>

          {/* Action buttons */}
          <div class="flex gap-3">
            <Button
              variant="outline"
              class="flex-1 !border-gray-600 !text-gray-300 hover:!bg-gray-700"
              leftIcon={<Icon name="phone" size="sm" />}
              onClick={handleCall}
            >
              Позвонить
            </Button>
            <Button
              variant="primary"
              class="flex-1"
              leftIcon={<Icon name="chat" size="sm" />}
              onClick={handleMessage}
            >
              Написать
            </Button>
          </div>
        </div>
      </div>

      {/* Pulse animation for guard marker */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 0.3; }
        }
        .leaflet-container {
          background: #1e293b !important;
        }
      `}</style>
    </div>
  );
}
