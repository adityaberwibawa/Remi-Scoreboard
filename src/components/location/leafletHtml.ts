/**
 * Membangun HTML Leaflet yang dipakai baik oleh WebView native maupun iframe web.
 * Semua nilai dinamis di-escape sebelum masuk ke HTML.
 */
import type { GeoPoint } from '../../location/geo';

export interface MapMarkerConfig {
  point: GeoPoint;
  label?: string | null;
  tone?: 'arena' | 'user' | 'session';
}

export interface MapFenceConfig {
  point: GeoPoint;
  radiusM: number;
}

export interface MapHtmlConfig {
  center: GeoPoint;
  marker?: MapMarkerConfig;
  user?: GeoPoint;
  fence?: MapFenceConfig;
  interactive?: boolean;
  zoom?: number;
}

const TONE_COLOR = {
  arena: '#34D399',
  user: '#60A5FA',
  session: '#F5C842',
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean ? escapeHtml(clean).slice(0, 120) : null;
}

export function buildLeafletHtml(config: MapHtmlConfig): string {
  const interactive = config.interactive !== false;
  const data = {
    center: [config.center.latitude, config.center.longitude],
    zoom: config.zoom ?? 16,
    interactive,
    marker: config.marker
      ? {
          coords: [config.marker.point.latitude, config.marker.point.longitude],
          label: cleanLabel(config.marker.label),
          color: TONE_COLOR[config.marker.tone ?? 'arena'],
        }
      : null,
    user: config.user
      ? [config.user.latitude, config.user.longitude]
      : null,
    accuracy:
      config.user && Number.isFinite(config.user.accuracy)
        ? Math.max(0, Math.min(2000, config.user.accuracy ?? 0))
        : null,
    fence: config.fence
      ? {
          coords: [config.fence.point.latitude, config.fence.point.longitude],
          radius: Math.max(1, config.fence.radiusM),
        }
      : null,
  };

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #101415; }
  .leaflet-container { background: #101415; }
  .leaflet-control-attribution {
    background: rgba(16, 20, 21, 0.82) !important;
    color: #9AA5AD !important;
    font-size: 9px !important;
    padding: 1px 4px !important;
  }
  .leaflet-control-attribution a { color: #34D399 !important; }
  #fallback {
    display: none; position: absolute; inset: 0; z-index: 1000;
    align-items: center; justify-content: center; text-align: center;
    padding: 18px; background: #101415; color: #9AA5AD;
    font: 12px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  #fallback strong { color: #F2F4F3; display: block; margin-bottom: 4px; font-size: 13px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="fallback">
  <div>
    <strong>Peta tidak bisa dimuat</strong>
    Pratinjau peta membutuhkan internet. Koordinat tetap tersimpan dan bisa dibuka di aplikasi peta.
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
(function () {
  var data = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  var fallback = document.getElementById('fallback');
  var ready = false;
  function showFallback() { fallback.style.display = 'flex'; }
  if (!window.L) { showFallback(); return; }
  try {
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
      dragging: data.interactive,
      scrollWheelZoom: data.interactive,
      doubleClickZoom: data.interactive,
      touchZoom: data.interactive,
      boxZoom: false,
      keyboard: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    var bounds = [];
    if (data.fence) {
      var circle = L.circle(data.fence.coords, {
        radius: data.fence.radius,
        color: '#34D399',
        weight: 2,
        fillColor: '#34D399',
        fillOpacity: 0.1,
        dashArray: '6 4'
      }).addTo(map);
      bounds.push(circle.getBounds());
    }
    if (data.user) {
      if (data.accuracy) {
        L.circle(data.user, {
          radius: data.accuracy,
          color: '#60A5FA',
          weight: 1,
          fillColor: '#60A5FA',
          fillOpacity: 0.08
        }).addTo(map);
      }
      L.circleMarker(data.user, {
        radius: 7,
        color: '#0B1220',
        weight: 2,
        fillColor: '#60A5FA',
        fillOpacity: 1
      }).addTo(map).bindPopup('Posisi Anda');
      bounds.push(L.latLng(data.user[0], data.user[1]).toBounds(90));
    }
    if (data.marker) {
      var marker = L.circleMarker(data.marker.coords, {
        radius: 8,
        color: '#101415',
        weight: 2,
        fillColor: data.marker.color,
        fillOpacity: 1
      }).addTo(map);
      if (data.marker.label) marker.bindPopup(data.marker.label);
      bounds.push(L.latLng(data.marker.coords[0], data.marker.coords[1]).toBounds(90));
    }

    if (bounds.length > 1) {
      var combined = bounds[0];
      for (var i = 1; i < bounds.length; i++) combined.extend(bounds[i]);
      map.fitBounds(combined, { padding: [30, 30], maxZoom: 17 });
    } else {
      map.setView(data.center, data.zoom);
    }
    ready = true;
    window.__mapReady = true;
  } catch (error) {
    showFallback();
  }
  setTimeout(function () { if (!ready) showFallback(); }, 5000);
})();
</script>
</body>
</html>`;
}
