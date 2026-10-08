import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TILE_URL, MAX_ZOOM, sampleRgb } from './dem.js';

maplibregl.setWorkerUrl(new URL(
  import.meta.env.DEV ? '/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs' : `${import.meta.env.BASE_URL}vendor/maplibre-gl-worker.mjs`,
  document.baseURI,
).href);

export const HOME = { lng: 138.7274, lat: 35.3606, zoom: 13.4, pitch: 58, bearing: -28 };

const demSource = (attribution) => ({
  type: 'raster-dem',
  tiles: [TILE_URL],
  tileSize: 512,
  maxzoom: MAX_ZOOM,
  encoding: 'terrarium',
  ...(attribution && { attribution }),
});

const style = {
  version: 8,
  sources: {
    dem: demSource('<a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">© Mapterhorn</a>'),
    'dem-3d': demSource(),
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b0e13' } },
    {
      id: 'relief',
      type: 'color-relief',
      source: 'dem',
      paint: {
        'color-relief-color': [
          'interpolate', ['linear'], ['elevation'],
          0, '#17232c', 800, '#1d2c36', 1800, '#2b3942', 2800, '#434b52', 3500, '#6c7378', 3776, '#cfd6de',
        ],
      },
    },
    {
      id: 'hill',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-exaggeration': 0.75,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#9fb3c8',
        'hillshade-accent-color': '#2a3644',
      },
    },
  ],
  terrain: { source: 'dem-3d', exaggeration: 1.15 },
};

export function initMap({ el, onSample }) {
  const map = new maplibregl.Map({
    container: el,
    style,
    center: [HOME.lng, HOME.lat],
    zoom: HOME.zoom,
    pitch: HOME.pitch,
    bearing: HOME.bearing,
    maxPitch: 80,
    maxZoom: MAX_ZOOM,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  const pin = document.createElement('div');
  pin.className = 'pin';
  const marker = new maplibregl.Marker({ element: pin, draggable: true }).setLngLat([HOME.lng, HOME.lat]).addTo(map);

  const sample = (ll) => onSample(ll.lng, ll.lat, map.getZoom());
  marker.on('dragend', () => sample(marker.getLngLat()));
  map.on('click', (e) => {
    marker.setLngLat(e.lngLat);
    sample(e.lngLat);
  });
  map.on('error', (e) => console.warn('map', e?.error?.message ?? e));

  return {
    map,
    home() {
      marker.setLngLat([HOME.lng, HOME.lat]);
      map.flyTo({ center: [HOME.lng, HOME.lat], zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing, duration: 900 });
      return { lng: HOME.lng, lat: HOME.lat, zoom: HOME.zoom };
    },
    setTerrain(on) {
      map.setTerrain(on ? style.terrain : null);
      if (!on) map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
      else map.easeTo({ pitch: HOME.pitch, duration: 400 });
    },
  };
}

export { sampleRgb };
