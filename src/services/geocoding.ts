/**
 * OpenStreetMap Nominatim Geocoding Service
 * Provides cached, structured address lookup adhering to Nominatim API usage policies.
 */

import type { NominatimResult, NominatimAddress } from '@/types/osm';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_PREFIX = 'browsm_geo_cache_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

/**
 * Cache entry structure stored in browser.storage.local.
 */
interface CachedGeocodeEntry {
  timestamp: number;
  results: NominatimResult[];
}

/**
 * Generates a consistent, safe cache key from query parameters.
 */
export function generateCacheKey(queryOrParams: string | Record<string, string | undefined>): string {
  if (typeof queryOrParams === 'string') {
    return `${CACHE_PREFIX}${queryOrParams.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
  }

  const parts = Object.entries(queryOrParams)
    .filter(([_, v]) => Boolean(v && v.trim()))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v?.toLowerCase().trim()}`);

  return `${CACHE_PREFIX}${parts.join('_').replace(/[^a-z0-9:_]/g, '_')}`;
}

/**
 * Retrieves a cached geocoding result from browser storage if still within TTL.
 */
export async function getCachedGeocode(cacheKey: string): Promise<NominatimResult[] | null> {
  try {
    const storage = await browser.storage.local.get(cacheKey);
    const entry = storage?.[cacheKey] as CachedGeocodeEntry | undefined;

    if (entry && typeof entry.timestamp === 'number' && Array.isArray(entry.results)) {
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.results;
      }
      // Expired entry - delete it asynchronously
      browser.storage.local.remove(cacheKey).catch(() => {});
    }
  } catch {
    // If storage lookup fails, fall through to live query
  }
  return null;
}

/**
 * Stores geocoding results in browser local storage with current timestamp.
 */
export async function setCachedGeocode(cacheKey: string, results: NominatimResult[]): Promise<void> {
  try {
    const entry: CachedGeocodeEntry = {
      timestamp: Date.now(),
      results,
    };
    await browser.storage.local.set({ [cacheKey]: entry });
  } catch {
    // Non-fatal if storage write fails
  }
}

/**
 * Options for Nominatim geocoding requests.
 */
export interface GeocodeOptions {
  limit?: number;
  addressDetails?: boolean;
  extraTags?: boolean;
  viewbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  bounded?: boolean;
}

/**
 * Executes a free-form or structured Nominatim query with local caching and User-Agent compliance.
 */
export async function geocodeQuery(
  query: string,
  options: GeocodeOptions = {}
): Promise<NominatimResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const cacheKey = generateCacheKey(cleanQuery);
  const cached = await getCachedGeocode(cacheKey);
  if (cached) {
    return cached;
  }

  const limit = options.limit ?? 5;
  const addressDetails = options.addressDetails ?? true;
  const extraTags = options.extraTags ?? true;

  const params = new URLSearchParams({
    q: cleanQuery,
    format: 'json',
    limit: String(limit),
    addressdetails: addressDetails ? '1' : '0',
    extratags: extraTags ? '1' : '0',
  });

  if (options.viewbox) {
    params.set('viewbox', options.viewbox.join(','));
    if (options.bounded) {
      params.set('bounded', '1');
    }
  }

  const requestUrl = `${NOMINATIM_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'User-Agent': 'Browsm/0.1.0 (OpenStreetMap POI Editor Extension)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim query failed with HTTP status ${response.status}`);
    }

    const results: NominatimResult[] = await response.json();
    if (Array.isArray(results) && results.length > 0) {
      await setCachedGeocode(cacheKey, results);
    }
    return results;
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}

/**
 * Executes a structured Nominatim search using discrete address fields.
 */
export async function geocodeStructured(
  structuredParams: {
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    postalcode?: string;
  },
  options: GeocodeOptions = {}
): Promise<NominatimResult[]> {
  const cacheKey = generateCacheKey(structuredParams);
  const cached = await getCachedGeocode(cacheKey);
  if (cached) {
    return cached;
  }

  const limit = options.limit ?? 5;
  const params = new URLSearchParams({
    format: 'json',
    limit: String(limit),
    addressdetails: options.addressDetails !== false ? '1' : '0',
    extratags: options.extraTags !== false ? '1' : '0',
  });

  if (structuredParams.street) params.set('street', structuredParams.street.trim());
  if (structuredParams.city) params.set('city', structuredParams.city.trim());
  if (structuredParams.county) params.set('county', structuredParams.county.trim());
  if (structuredParams.state) params.set('state', structuredParams.state.trim());
  if (structuredParams.country) params.set('country', structuredParams.country.trim());
  if (structuredParams.postalcode) params.set('postalcode', structuredParams.postalcode.trim());

  const requestUrl = `${NOMINATIM_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(requestUrl, {
      headers: {
        'User-Agent': 'Browsm/0.1.0 (OpenStreetMap POI Editor Extension)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Structured Nominatim query failed with status ${response.status}`);
    }

    const results: NominatimResult[] = await response.json();
    if (Array.isArray(results) && results.length > 0) {
      await setCachedGeocode(cacheKey, results);
    }
    return results;
  } catch (error) {
    console.error('Structured geocoding error:', error);
    return [];
  }
}

/**
 * Clears all cached geocoding entries from local storage.
 */
export async function clearGeocodingCache(): Promise<void> {
  try {
    const allItems = await browser.storage.local.get();
    const cacheKeys = Object.keys(allItems).filter((k) => k.startsWith(CACHE_PREFIX));
    for (const key of cacheKeys) {
      await browser.storage.local.remove(key);
    }
  } catch {
    // Non-fatal
  }
}
