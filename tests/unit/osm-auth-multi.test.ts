import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAuthStorageKey,
  getStoredAuthState,
  saveStoredAuthState,
  clearStoredAuthState,
  getAllStoredAuthStates,
  loginWithOsm,
  logoutOsm,
  AUTH_STORAGE_KEY_PREFIX,
  LEGACY_AUTH_STORAGE_KEY,
} from '@/services/osm-auth';
import type { OsmAuthState } from '@/types/auth';

describe('Multi-Target OAuth Service & Token Isolation', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock browser.storage.local
    // @ts-expect-error mock global browser
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[] | null) => {
            if (keys === null) {
              return { ...mockStorage };
            }
            if (Array.isArray(keys)) {
              const res: Record<string, unknown> = {};
              for (const k of keys) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            if (typeof keys === 'string') {
              return { [keys]: mockStorage[keys] };
            }
            return {};
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              delete mockStorage[k];
            }
          }),
        },
      },
      identity: {
        launchWebAuthFlow: vi.fn(),
        getRedirectURL: vi.fn((path?: string) => `https://fake-extension.chromiumapp.org/${path || ''}`),
      },
    };
  });

  it('generates consistent namespaced storage keys per endpoint', () => {
    expect(getAuthStorageKey('osm-prod')).toBe('browsm_auth_osm-prod');
    expect(getAuthStorageKey('osm-dev')).toBe('browsm_auth_osm-dev');
    expect(getAuthStorageKey('openhistoricalmap')).toBe('browsm_auth_openhistoricalmap');
    expect(getAuthStorageKey('custom')).toBe('browsm_auth_custom');
    expect(getAuthStorageKey()).toBe('browsm_auth_osm-prod');
  });

  it('isolates authentication states across multiple endpoints independently', async () => {
    const prodState: OsmAuthState = {
      isAuthenticated: true,
      user: { id: 1, username: 'prod_user', accountCreated: '2020-01-01' },
      token: { accessToken: 'prod-token', tokenType: 'Bearer', scope: 'write_api', createdAt: 100 },
      isLoading: false,
    };

    const devState: OsmAuthState = {
      isAuthenticated: true,
      user: { id: 2, username: 'dev_user', accountCreated: '2022-01-01' },
      token: { accessToken: 'dev-token', tokenType: 'Bearer', scope: 'write_api', createdAt: 200 },
      isLoading: false,
    };

    // Save states for different endpoints
    await saveStoredAuthState(prodState, 'osm-prod');
    await saveStoredAuthState(devState, 'osm-dev');

    // Verify isolated retrieval
    const retrievedProd = await getStoredAuthState('osm-prod');
    const retrievedDev = await getStoredAuthState('osm-dev');
    const retrievedOhm = await getStoredAuthState('openhistoricalmap');

    expect(retrievedProd.isAuthenticated).toBe(true);
    expect(retrievedProd.user?.username).toBe('prod_user');

    expect(retrievedDev.isAuthenticated).toBe(true);
    expect(retrievedDev.user?.username).toBe('dev_user');

    expect(retrievedOhm.isAuthenticated).toBe(false);

    // Logging out of dev server does not log out production
    await logoutOsm('osm-dev');

    const devAfterLogout = await getStoredAuthState('osm-dev');
    const prodAfterLogout = await getStoredAuthState('osm-prod');

    expect(devAfterLogout.isAuthenticated).toBe(false);
    expect(prodAfterLogout.isAuthenticated).toBe(true);
    expect(prodAfterLogout.user?.username).toBe('prod_user');
  });

  it('transparently migrates legacy un-namespaced auth state to osm-prod', async () => {
    const legacyState: OsmAuthState = {
      isAuthenticated: true,
      user: { id: 99, username: 'legacy_mapper', accountCreated: '2019-01-01' },
      token: { accessToken: 'legacy-token', tokenType: 'Bearer', scope: 'write_api', createdAt: 50 },
      isLoading: false,
    };

    // Store under legacy key
    mockStorage[LEGACY_AUTH_STORAGE_KEY] = legacyState;

    const loaded = await getStoredAuthState('osm-prod');
    expect(loaded.isAuthenticated).toBe(true);
    expect(loaded.user?.username).toBe('legacy_mapper');

    // Verify it was migrated to namespaced key
    expect(mockStorage['browsm_auth_osm-prod']).toEqual(legacyState);
  });

  it('retrieves all stored authentication states across all configured endpoints', async () => {
    mockStorage['browsm_auth_osm-prod'] = {
      isAuthenticated: true,
      user: { id: 1, username: 'user1', accountCreated: '2020-01-01' },
      token: { accessToken: 'token-1', tokenType: 'Bearer', scope: 'write_api', createdAt: 1 },
      isLoading: false,
    };

    mockStorage['browsm_auth_openhistoricalmap'] = {
      isAuthenticated: true,
      user: { id: 2, username: 'ohm_user', accountCreated: '2021-01-01' },
      token: { accessToken: 'token-2', tokenType: 'Bearer', scope: 'write_api', createdAt: 2 },
      isLoading: false,
    };

    const all = await getAllStoredAuthStates();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['osm-prod'].user?.username).toBe('user1');
    expect(all['openhistoricalmap'].user?.username).toBe('ohm_user');
  });

  it('executes login flow and stores token under target endpoint ID', async () => {
    const mockLaunchWebAuthFlow = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
      const parsedAuthUrl = new URL(url);
      const state = parsedAuthUrl.searchParams.get('state');
      return `https://fake-extension.chromiumapp.org/osm-auth?code=ohm-auth-code&state=${state}`;
    });
    // @ts-expect-error mock launchWebAuthFlow
    globalThis.browser.identity.launchWebAuthFlow = mockLaunchWebAuthFlow;

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/oauth2/token')) {
        return {
          ok: true,
          json: async () => ({
            access_token: 'ohm-bearer-token',
            token_type: 'Bearer',
            scope: 'read_prefs write_api',
            created_at: 1700000000,
          }),
        };
      }
      if (url.includes('/user/details')) {
        return {
          ok: true,
          text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="555" display_name="ohm_contributor" account_created="2021-01-01T00:00:00Z">
    <changesets count="15"/>
  </user>
</osm>`,
        };
      }
      return { ok: false, status: 404, text: async () => 'Not found' };
    });

    // Mock state generation to match expected-state
    const authState = await loginWithOsm(
      {
        apiBaseUrl: 'https://www.openhistoricalmap.org/api/0.6',
        authUrl: 'https://www.openhistoricalmap.org/oauth2/authorize',
        tokenUrl: 'https://www.openhistoricalmap.org/oauth2/token',
      },
      mockFetch as unknown as typeof fetch,
      'openhistoricalmap'
    );

    expect(authState.isAuthenticated).toBe(true);
    expect(authState.user?.username).toBe('ohm_contributor');
    expect(mockStorage['browsm_auth_openhistoricalmap']).toBeDefined();
    expect(
      (mockStorage['browsm_auth_openhistoricalmap'] as OsmAuthState).token?.accessToken
    ).toBe('ohm-bearer-token');
  });
});
