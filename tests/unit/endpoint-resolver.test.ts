import { describe, it, expect } from 'vitest';
import {
  resolveEndpointSync,
  getEndpointBadgeInfo,
  SETTINGS_STORAGE_KEY,
} from '@/services/endpoint-resolver';
import {
  ENDPOINT_PRESETS,
  DEFAULT_SETTINGS_STATE,
  type SettingsState,
  type EndpointConfig,
} from '@/types/settings';
import type { OsmAuthState } from '@/types/auth';

describe('Endpoint Resolver & Granular Developer Mode Routing', () => {
  const mockAuthMap: Record<string, OsmAuthState> = {
    'osm-prod': {
      isAuthenticated: true,
      token: {
        accessToken: 'prod-token-123',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api',
        createdAt: 1700000000,
      },
      user: {
        id: 111,
        username: 'prod_mapper',
        accountCreated: '2020-01-01T00:00:00Z',
      },
      isLoading: false,
    },
    'osm-dev': {
      isAuthenticated: true,
      token: {
        accessToken: 'sandbox-token-456',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api write_notes',
        createdAt: 1700001000,
      },
      user: {
        id: 222,
        username: 'dev_tester',
        accountCreated: '2022-01-01T00:00:00Z',
      },
      isLoading: false,
    },
    'openhistoricalmap': {
      isAuthenticated: true,
      token: {
        accessToken: 'ohm-token-789',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api',
        createdAt: 1700002000,
      },
      user: {
        id: 333,
        username: 'history_mapper',
        accountCreated: '2021-06-01T00:00:00Z',
      },
      isLoading: false,
    },
  };

  describe('Dev Mode Disabled (Live Production)', () => {
    const settings: SettingsState = {
      activeEndpointId: 'osm-prod',
      devModeRouting: 'disabled',
      preferredEditor: 'id',
    };

    it('routes reads and writes to OpenStreetMap live production', () => {
      const readResolved = resolveEndpointSync('read', settings, mockAuthMap);
      expect(readResolved.config.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
      expect(readResolved.token?.accessToken).toBe('prod-token-123');
      expect(readResolved.isDevMode).toBe(false);
      expect(readResolved.routingMode).toBe('disabled');

      const writeResolved = resolveEndpointSync('write', settings, mockAuthMap);
      expect(writeResolved.config.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
      expect(writeResolved.token?.accessToken).toBe('prod-token-123');
      expect(writeResolved.isDevMode).toBe(false);
      expect(writeResolved.routingMode).toBe('disabled');
    });

    it('generates default production badge info', () => {
      const badge = getEndpointBadgeInfo(settings);
      expect(badge.text).toBe('');
      expect(badge.variant).toBe('default');
      expect(badge.isDev).toBe(false);
      expect(badge.tooltip).toContain('Live Production');
    });
  });

  describe('Dev Mode: Writes Only (Safe Sandbox Edits with Live POI Reads)', () => {
    const settings: SettingsState = {
      activeEndpointId: 'osm-prod',
      devModeRouting: 'writes_only',
      preferredEditor: 'id',
    };

    it('routes reads to live OSM production and writes to OSM Dev API sandbox', () => {
      // 1. Reads query live production
      const readResolved = resolveEndpointSync('read', settings, mockAuthMap);
      expect(readResolved.config.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
      expect(readResolved.token?.accessToken).toBe('prod-token-123');
      expect(readResolved.isDevMode).toBe(true);
      expect(readResolved.routingMode).toBe('writes_only');

      // 2. Writes query dev server sandbox with dev sandbox token
      const writeResolved = resolveEndpointSync('write', settings, mockAuthMap);
      expect(writeResolved.config.apiBaseUrl).toBe('https://master.apis.dev.openstreetmap.org/api/0.6');
      expect(writeResolved.token?.accessToken).toBe('sandbox-token-456');
      expect(writeResolved.isDevMode).toBe(true);
      expect(writeResolved.routingMode).toBe('writes_only');
    });

    it('generates high-visibility orange warning badge info', () => {
      const badge = getEndpointBadgeInfo(settings);
      expect(badge.text).toBe('DEV: WRITES ONLY');
      expect(badge.variant).toBe('warning');
      expect(badge.isDev).toBe(true);
      expect(badge.tooltip).toContain('Reads live OSM data');
      expect(badge.tooltip).toContain('sandbox');
    });
  });

  describe('Dev Mode: Reads & Writes (Full Isolated Sandbox)', () => {
    const settings: SettingsState = {
      activeEndpointId: 'osm-prod',
      devModeRouting: 'reads_and_writes',
      preferredEditor: 'id',
    };

    it('routes both reads and writes exclusively to OSM Dev API sandbox', () => {
      const readResolved = resolveEndpointSync('read', settings, mockAuthMap);
      expect(readResolved.config.apiBaseUrl).toBe('https://master.apis.dev.openstreetmap.org/api/0.6');
      expect(readResolved.token?.accessToken).toBe('sandbox-token-456');
      expect(readResolved.isDevMode).toBe(true);
      expect(readResolved.routingMode).toBe('reads_and_writes');

      const writeResolved = resolveEndpointSync('write', settings, mockAuthMap);
      expect(writeResolved.config.apiBaseUrl).toBe('https://master.apis.dev.openstreetmap.org/api/0.6');
      expect(writeResolved.token?.accessToken).toBe('sandbox-token-456');
      expect(writeResolved.isDevMode).toBe(true);
      expect(writeResolved.routingMode).toBe('reads_and_writes');
    });

    it('generates high-visibility red danger badge info', () => {
      const badge = getEndpointBadgeInfo(settings);
      expect(badge.text).toBe('DEV: FULL');
      expect(badge.variant).toBe('danger');
      expect(badge.isDev).toBe(true);
      expect(badge.tooltip).toContain('Full Developer Sandbox');
    });
  });

  describe('OpenHistoricalMap Endpoint', () => {
    const settings: SettingsState = {
      activeEndpointId: 'openhistoricalmap',
      devModeRouting: 'disabled',
      preferredEditor: 'id',
    };

    it('routes reads and writes to OpenHistoricalMap API and OHM token', () => {
      const readResolved = resolveEndpointSync('read', settings, mockAuthMap);
      expect(readResolved.config.apiBaseUrl).toBe('https://www.openhistoricalmap.org/api/0.6');
      expect(readResolved.token?.accessToken).toBe('ohm-token-789');
      expect(readResolved.isDevMode).toBe(false);

      const writeResolved = resolveEndpointSync('write', settings, mockAuthMap);
      expect(writeResolved.config.apiBaseUrl).toBe('https://www.openhistoricalmap.org/api/0.6');
      expect(writeResolved.token?.accessToken).toBe('ohm-token-789');
      expect(writeResolved.isDevMode).toBe(false);
    });

    it('generates distinct purple OHM badge info', () => {
      const badge = getEndpointBadgeInfo(settings);
      expect(badge.text).toBe('OHM');
      expect(badge.variant).toBe('purple');
      expect(badge.isDev).toBe(false);
      expect(badge.tooltip).toContain('OpenHistoricalMap');
    });
  });

  describe('Custom Instance Endpoint', () => {
    const customConfig: EndpointConfig = {
      id: 'custom',
      name: 'Local Rails Port',
      description: 'Localhost port 3000',
      apiBaseUrl: 'http://127.0.0.1:3000/api/0.6',
      authUrl: 'http://127.0.0.1:3000/oauth2/authorize',
      tokenUrl: 'http://127.0.0.1:3000/oauth2/token',
      webUrl: 'http://127.0.0.1:3000',
      clientId: 'local-app',
      scopes: ['read_prefs', 'write_api'],
    };

    const settings: SettingsState = {
      activeEndpointId: 'custom',
      devModeRouting: 'disabled',
      customEndpoint: customConfig,
      preferredEditor: 'josm',
    };

    it('routes reads and writes to user-configured custom server URLs', () => {
      const resolved = resolveEndpointSync('read', settings, mockAuthMap);
      expect(resolved.config.apiBaseUrl).toBe('http://127.0.0.1:3000/api/0.6');
      expect(resolved.config.name).toBe('Local Rails Port');
      expect(resolved.isDevMode).toBe(false);
    });

    it('generates teal custom badge info with custom name in tooltip', () => {
      const badge = getEndpointBadgeInfo(settings);
      expect(badge.text).toBe('CUSTOM');
      expect(badge.variant).toBe('teal');
      expect(badge.tooltip).toContain('Local Rails Port');
    });
  });
});
