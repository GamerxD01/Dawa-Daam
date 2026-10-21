/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Custom OpenStreetMap tile URL template (e.g. https://tile.openstreetmap.org/{z}/{x}/{y}.png) */
  readonly VITE_OSM_TILE_URL?: string;
  /** API key for tile services or OpenStreetMap providers (e.g. Stadia, Thunderforest, Mapbox, Geoapify, LocationIQ) */
  readonly VITE_OSM_API_KEY?: string;
  /** Custom attribution HTML string */
  readonly VITE_OSM_ATTRIBUTION?: string;
  /** Custom Overpass API interpreter URL for querying Kendras */
  readonly VITE_OVERPASS_API_URL?: string;
  /** Reverse geocoding / Nominatim endpoint URL */
  readonly VITE_GEOCODING_API_URL?: string;
  /** API key for geocoding services (LocationIQ, Geoapify, OpenCage) */
  readonly VITE_GEOCODING_API_KEY?: string;
  /** Google Maps API Key (optional) */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Gemma Vision Bridge URL for prescription scanning */
  readonly VITE_GEMMA_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
