import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCacheKey,
  getCachedGeocode,
  setCachedGeocode,
  geocodeQuery,
  geocodeStructured,
  clearGeocodingCache,
} from '@/services/geocoding';
import type { NominatimResult } from '@/types/osm';

describe('Geocoding Service', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    vi.restoreAllMocks();
  });

  describe('Cache key generation', () => {
    it('creates normalized cache keys for query strings', () => {
      const key1 = generateCacheKey('120 Ocean Ave, Newport, RI');
      const key2 = generateCacheKey('  120 Ocean Ave, Newport, RI  ');
      expect(key1).toBe('browsm_geo_cache_120_ocean_ave__newport__ri');
      expect(key1).toBe(key2);
    });

    it('creates deterministic cache keys for structured objects', () => {
      const key1 = generateCacheKey({ street: '120 Ocean Ave', city: 'Newport' });
      const key2 = generateCacheKey({ city: 'Newport', street: '120 Ocean Ave' });
      expect(key1).toBe(key2);
    });
  });

  describe('Caching storage layer', () => {
    it('stores and retrieves cached geocoding results within TTL', async () => {
      const mockResults: NominatimResult[] = [
        {
          place_id: 12345,
          licence: 'ODbL',
          osm_type: 'node',
          osm_id: 998877,
          lat: '41.4901',
          lon: '-71.3128',
          class: 'amenity',
          type: 'restaurant',
          place_rank: 30,
          importance: 0.5,
          display_name: 'Test Place, Newport, RI',
        },
      ];

      const cacheKey = 'browsm_geo_cache_test_place';
      await setCachedGeocode(cacheKey, mockResults);

      const cached = await getCachedGeocode(cacheKey);
      expect(cached).toEqual(mockResults);
    });

    it('returns null and cleans up expired cache entries', async () => {
      const cacheKey = 'browsm_geo_cache_expired';
      const expiredEntry = {
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago (>24h TTL)
        results: [{ place_id: 1 }],
      };
      await browser.storage.local.set({ [cacheKey]: expiredEntry });

      const cached = await getCachedGeocode(cacheKey);
      expect(cached).toBeNull();
    });

    it('clears all geocoding cache keys without touching other storage', async () => {
      await browser.storage.local.set({
        browsm_geo_cache_item1: { timestamp: Date.now(), results: [] },
        browsm_geo_cache_item2: { timestamp: Date.now(), results: [] },
        other_user_setting: 'keep_me',
      });

      await clearGeocodingCache();

      const remaining = await browser.storage.local.get();
      expect(remaining.browsm_geo_cache_item1).toBeUndefined();
      expect(remaining.browsm_geo_cache_item2).toBeUndefined();
      expect(remaining.other_user_setting).toBe('keep_me');
    });
  });

  describe('Nominatim Query Execution', () => {
    it('executes geocodeQuery with proper User-Agent and headers', async () => {
      const mockResponse: NominatimResult[] = [
        {
          place_id: 100,
          licence: 'Data © OpenStreetMap contributors',
          osm_type: 'node',
          osm_id: 555,
          lat: '41.4901',
          lon: '-71.3128',
          class: 'amenity',
          type: 'restaurant',
          place_rank: 30,
          importance: 0.6,
          name: 'Newport Harbor',
          display_name: 'Newport Harbor, Newport, RI',
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await geocodeQuery('Newport Harbor');
      expect(results).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const requestUrl = fetchSpy.mock.calls[0][0] as string;
      expect(requestUrl).toContain('https://nominatim.openstreetmap.org/search');
      expect(requestUrl).toContain('q=Newport+Harbor');

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['User-Agent']).toContain('Browsm');
    });

    it('executes geocodeStructured with discrete query parameters', async () => {
      const mockResponse: NominatimResult[] = [
        {
          place_id: 200,
          licence: 'ODbL',
          osm_type: 'way',
          osm_id: 888,
          lat: '41.4800',
          lon: '-71.3100',
          class: 'building',
          type: 'yes',
          place_rank: 30,
          importance: 0.4,
          display_name: '120 Ocean Ave, Newport',
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await geocodeStructured({
        street: '120 Ocean Ave',
        city: 'Newport',
        state: 'RI',
      });

      expect(results).toEqual(mockResponse);
      const requestUrl = fetchSpy.mock.calls[0][0] as string;
      expect(requestUrl).toContain('street=120+Ocean+Ave');
      expect(requestUrl).toContain('city=Newport');
      expect(requestUrl).toContain('state=RI');
    });
  });
});
