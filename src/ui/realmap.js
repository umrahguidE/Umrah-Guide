// A real, live world map for when the pilgrim is too far from Masjid
// al-Haram for the offline Haram diagram (map.js) to mean anything — while
// testing at home, for instance. Backed by Leaflet + OpenStreetMap tiles,
// loaded from a CDN only the first time this is actually shown, so the rest
// of the app stays fully offline. Needs internet to load map tiles; nothing
// here is cached for offline use, unlike every other part of the app.
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';

let loadPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('offline'));
    document.head.appendChild(script);
  }).catch((err) => {
    loadPromise = null; // let a later retry try again once back online
    throw err;
  });
  return loadPromise;
}

let map = null;
let marker = null;
let accuracyCircle = null;
let mountedIn = null;

/** Creates the live map in `container` if not already mounted there. Returns false if it could not load (e.g. offline). */
export async function ensureRealMap(container, { attribution } = {}) {
  if (map && mountedIn === container) return true;
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    return false;
  }
  // The container may have been re-created since we last mounted into a
  // same-id element (a full page re-render) — always mount fresh in that case.
  if (map) destroyRealMap();
  if (!container.isConnected) return false;
  map = L.map(container, { attributionControl: true, zoomControl: true }).setView([21.4225, 39.8262], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: attribution ?? '© OpenStreetMap contributors',
  }).addTo(map);
  mountedIn = container;
  return true;
}

/** Moves the existing marker (creating it on first fix) without touching the rest of the map. */
export function setRealMapPosition(lat, lng, accuracyM) {
  if (!map || !window.L) return;
  const L = window.L;
  const latlng = [lat, lng];
  if (!marker) {
    marker = L.circleMarker(latlng, { radius: 9, color: '#fff', weight: 2, fillColor: '#a9812f', fillOpacity: 1 }).addTo(map);
    map.setView(latlng, 16);
  } else {
    marker.setLatLng(latlng);
  }
  if (Number.isFinite(accuracyM)) {
    if (!accuracyCircle) accuracyCircle = L.circle(latlng, { radius: accuracyM, color: '#2f6fed', weight: 1, fillOpacity: 0.08 }).addTo(map);
    else {
      accuracyCircle.setLatLng(latlng);
      accuracyCircle.setRadius(accuracyM);
    }
  }
}

export function destroyRealMap() {
  if (map) map.remove();
  map = null;
  marker = null;
  accuracyCircle = null;
  mountedIn = null;
}

export const isRealMapMounted = (container) => map != null && mountedIn === container;
