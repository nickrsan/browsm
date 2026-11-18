import { describe, it, expect, vi, beforeEach } from 'vitest';
import { settingsStore } from '@/stores/settings.svelte';
import { SETTINGS_STORAGE_KEY } from '@/services/endpoint-resolver';
import { type EndpointConfig } from '@/types/settings';

describe('SettingsStore (Svelte 5 Runes)', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(async () => {
    mockStorage = {};

    // @ts-expect-error mock global browser
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[] | null) => {
            if (keys === null) return { ...mockStorage };
            if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
            return {};
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
        },
      },
    };

    await settingsStore.resetToDefaults();
  });

  it('initializes with default settings', async () => {
    await settingsStore.init();

    expect(settingsStore.activeEndpointId).toBe('osm-prod');
    expect(settingsStore.devModeRouting).toBe('disabled');
    expect(settingsStore.isDevMode).toBe(false);
    expect(settingsStore.preferredEditor).toBe('id');
    expect(settingsStore.messagePollIntervalMinutes).toBe(10);
    expect(settingsStore.nearbySearchRadius).toBe(50);
    expect(settingsStore.activeEndpointConfig.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
  });

  it('updates nearby search radius with clamping and persists to storage', async () => {
    await settingsStore.setNearbySearchRadius(120);
    expect(settingsStore.nearbySearchRadius).toBe(120);

    const saved = mockStorage[SETTINGS_STORAGE_KEY] as Record<string, unknown>;
    expect(saved?.nearbySearchRadius).toBe(120);

    // Clamps minimum to 10
    await settingsStore.setNearbySearchRadius(2);
    expect(settingsStore.nearbySearchRadius).toBe(10);

    // Clamps maximum to 500
    await settingsStore.setNearbySearchRadius(1000);
    expect(settingsStore.nearbySearchRadius).toBe(500);
  });

  it('updates message polling interval and persists to storage', async () => {
    await settingsStore.setMessagePollInterval(15);
    expect(settingsStore.messagePollIntervalMinutes).toBe(15);

    // Verify persistence
    const saved = mockStorage[SETTINGS_STORAGE_KEY] as Record<string, unknown>;
    expect(saved?.messagePollIntervalMinutes).toBe(15);

    // Can set to 0 (disabled)
    await settingsStore.setMessagePollInterval(0);
    expect(settingsStore.messagePollIntervalMinutes).toBe(0);
  });

  it('updates active endpoint and derives correct config', async () => {
    await settingsStore.setActiveEndpoint('openhistoricalmap');

    expect(settingsStore.activeEndpointId).toBe('openhistoricalmap');
    expect(settingsStore.activeEndpointConfig.apiBaseUrl).toBe('https://www.openhistoricalmap.org/api/0.6');
    expect(settingsStore.badgeInfo.text).toBe('OHM');
    expect(settingsStore.isDevMode).toBe(false);
  });

  it('updates developer mode routing and derives correct badge and flags', async () => {
    await settingsStore.setDevModeRouting('writes_only');

    expect(settingsStore.devModeRouting).toBe('writes_only');
    expect(settingsStore.isDevMode).toBe(true);
    expect(settingsStore.badgeInfo.text).toBe('DEV: WRITES ONLY');
    expect(settingsStore.badgeInfo.variant).toBe('warning');

    await settingsStore.setDevModeRouting('reads_and_writes');
    expect(settingsStore.devModeRouting).toBe('reads_and_writes');
    expect(settingsStore.isDevMode).toBe(true);
    expect(settingsStore.badgeInfo.text).toBe('DEV: FULL');
    expect(settingsStore.badgeInfo.variant).toBe('danger');
  });

  it('supports custom endpoint configuration', async () => {
    const customConfig: EndpointConfig = {
      id: 'custom',
      name: 'Regional Dev Server',
      description: 'Regional OSM deployment',
      apiBaseUrl: 'https://osm.example.org/api/0.6',
      authUrl: 'https://osm.example.org/oauth2/authorize',
      tokenUrl: 'https://osm.example.org/oauth2/token',
      webUrl: 'https://osm.example.org',
      clientId: 'custom-app',
      scopes: ['read_prefs', 'write_api'],
    };

    await settingsStore.setCustomEndpoint(customConfig, true);

    expect(settingsStore.activeEndpointId).toBe('custom');
    expect(settingsStore.customEndpoint?.name).toBe('Regional Dev Server');
    expect(settingsStore.activeEndpointConfig.apiBaseUrl).toBe('https://osm.example.org/api/0.6');
    expect(settingsStore.badgeInfo.text).toBe('CUSTOM');
  });

  it('resets settings to default values', async () => {
    await settingsStore.setActiveEndpoint('openhistoricalmap');
    await settingsStore.setDevModeRouting('writes_only');
    await settingsStore.setPreferredEditor('josm');

    await settingsStore.resetToDefaults();

    expect(settingsStore.activeEndpointId).toBe('osm-prod');
    expect(settingsStore.devModeRouting).toBe('disabled');
    expect(settingsStore.preferredEditor).toBe('id');
  });
});
