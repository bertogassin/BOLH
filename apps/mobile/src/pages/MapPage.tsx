import { createSignal, onMount, onCleanup } from 'solid-js';
import { isDark } from '../theme';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ALMATY = { lat: 43.238949, lng: 76.945465 };

export default function MapPage() {
  let mapContainer: HTMLDivElement | undefined;
  let map: L.Map | undefined;

  const [userPos, setUserPos] = createSignal<{ lat: number; lng: number } | null>(null);

  onMount(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserPos(ALMATY),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });

  onMount(() => {
    if (!mapContainer) return;
    const c = userPos() || ALMATY;
    map = L.map(mapContainer, { zoomControl: false }).setView([c.lat, c.lng], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const url = isDark()
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(url, { attribution: '&copy; OSM', maxZoom: 19 }).addTo(map);
    setTimeout(() => map?.invalidateSize(), 200);
  });

  onCleanup(() => {
    if (map) { map.off(); map.remove(); map = undefined; }
  });

  return (
    <div style="position: relative; height: 100vh; overflow: hidden;">
      <div ref={mapContainer} style="position: absolute; inset: 0;" />
    </div>
  );
}
