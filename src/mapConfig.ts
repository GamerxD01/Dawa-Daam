/**
 * Map & Kendra Location Configuration.
 * Pulls OpenStreetMap and external provider keys/endpoints from Vite environment variables (.env).
 */

export const MAP_CONFIG = {
  /**
   * Resolved Tile Layer URL.
   * If VITE_OSM_TILE_URL is set, uses it.
   * If VITE_OSM_API_KEY is supplied, replaces {key}, {apiKey}, or appends it.
   * Defaults to public OpenStreetMap tiles.
   */
  get tileUrl(): string {
    const rawUrl = (import.meta.env.VITE_OSM_TILE_URL as string) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const apiKey = import.meta.env.VITE_OSM_API_KEY as string | undefined;

    if (apiKey) {
      if (rawUrl.includes('{key}')) return rawUrl.replace('{key}', apiKey);
      if (rawUrl.includes('{apiKey}')) return rawUrl.replace('{apiKey}', apiKey);
      if (rawUrl.includes('{accessToken}')) return rawUrl.replace('{accessToken}', apiKey);
      // Append query parameter if not present in template
      const delimiter = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${delimiter}api_key=${apiKey}`;
    }
    return rawUrl;
  },

  /**
   * Map Attribution
   */
  get attribution(): string {
    return (
      (import.meta.env.VITE_OSM_ATTRIBUTION as string) ||
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    );
  },

  /**
   * Overpass API endpoints for querying Kendra nodes.
   * Allows setting a custom/private Overpass server via VITE_OVERPASS_API_URL.
   */
  get overpassEndpoints(): string[] {
    const custom = import.meta.env.VITE_OVERPASS_API_URL as string | undefined;
    if (custom) return [custom];
    return [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
  },

  /**
   * Geocoding endpoints and API keys
   */
  geocodingApiUrl: import.meta.env.VITE_GEOCODING_API_URL as string | undefined,
  geocodingApiKey: import.meta.env.VITE_GEOCODING_API_KEY as string | undefined,

  /**
   * Google Maps API Key (optional fallback / external links)
   */
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined,
};
