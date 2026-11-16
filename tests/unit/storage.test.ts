import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Storage Synchronization', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorage = {};
    // @ts-ignore
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
        },
      },
    };
  });

  it('saves and retrieves searching lookup state', async () => {
    const searchingState = {
      state: 'searching',
      timestamp: 1700000000000,
    };

    await browser.storage.local.set({ lookupState: searchingState });
    const result = (await browser.storage.local.get('lookupState')) as {
      lookupState: { state: string; timestamp: number };
    };

    expect(result.lookupState).toEqual(searchingState);
    expect(result.lookupState.state).toBe('searching');
  });

  it('saves and retrieves response lookup state with OSM details', async () => {
    const responseState = {
      state: 'response',
      lat: 41.4901,
      lon: -71.3128,
      display_name: 'The Ocean Cafe, Newport, RI',
      osm_id: '1234567',
      full_response: {
        place_id: 12345,
        lat: '41.4901',
        lon: '-71.3128',
      },
      timestamp: 1700000001000,
    };

    await browser.storage.local.set({ lookupState: responseState });
    const result = (await browser.storage.local.get('lookupState')) as {
      lookupState: {
        state: string;
        lat: number;
        lon: number;
        display_name: string;
        osm_id: string;
        full_response: Record<string, unknown>;
        timestamp: number;
      };
    };

    expect(result.lookupState.state).toBe('response');
    expect(result.lookupState.lat).toBe(41.4901);
    expect(result.lookupState.display_name).toContain('The Ocean Cafe');
    expect(result.lookupState.osm_id).toBe('1234567');
  });
});
