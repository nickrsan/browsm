import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authStore } from '@/stores/auth.svelte';
import { settingsStore } from '@/stores/settings.svelte';
import { getUserDetails, checkUserMessages } from '@/services/osm-api';
import { saveStoredAuthState, getStoredAuthState } from '@/services/osm-auth';
import type { OsmAuthState } from '@/types/auth';

describe('OSM User Messages & Periodic Polling Service', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockStorage = {};

    // @ts-expect-error mock global browser
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn(async (keys: string | string[] | null) => {
            if (keys === null) return { ...mockStorage };
            if (Array.isArray(keys)) {
              const res: Record<string, unknown> = {};
              for (const k of keys) {
                if (k in mockStorage) res[k] = mockStorage[k];
              }
              return res;
            }
            if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
            return {};
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys];
            for (const k of list) delete mockStorage[k];
          }),
        },
      },
      tabs: {
        create: vi.fn(),
      },
      identity: {
        launchWebAuthFlow: vi.fn(),
        getRedirectURL: vi.fn().mockReturnValue('https://extension/osm-auth'),
      },
    };

    await settingsStore.resetToDefaults();
    await authStore.logout();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refreshUserDetails fetches latest messages count and updates reactive state and storage', async () => {
    // Seed initial logged in state with 0 unread messages
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 555,
        username: 'polling_tester',
        accountCreated: '2022-01-01T00:00:00Z',
        changesetCount: 10,
        unreadMessagesCount: 0,
        totalMessagesCount: 4,
      },
      token: {
        accessToken: 'poll_token_abc',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api write_notes',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.user?.unreadMessagesCount).toBe(0);

    // Mock API response returning 3 new unread messages and updated changesets
    const updatedUserXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="555" display_name="polling_tester" account_created="2022-01-01T00:00:00Z">
    <changesets count="12"/>
    <messages>
      <received count="7" unread="3"/>
      <sent count="2"/>
    </messages>
  </user>
</osm>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => updatedUserXml,
    });

    const updatedUser = await authStore.refreshUserDetails('osm-prod', mockFetch);

    expect(updatedUser).toBeDefined();
    expect(updatedUser?.unreadMessagesCount).toBe(3);
    expect(updatedUser?.totalMessagesCount).toBe(7);
    expect(updatedUser?.changesetCount).toBe(12);

    // Verify authStore reactive state
    expect(authStore.user?.unreadMessagesCount).toBe(3);
    expect(authStore.user?.changesetCount).toBe(12);

    // Verify persistence in local storage
    const savedState = await getStoredAuthState('osm-prod');
    expect(savedState.user?.unreadMessagesCount).toBe(3);
    expect(savedState.user?.changesetCount).toBe(12);
  });

  it('refreshUserDetails gracefully handles network failure without clearing user', async () => {
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 777,
        username: 'stable_user',
        accountCreated: '2023-01-01T00:00:00Z',
        unreadMessagesCount: 1,
      },
      token: {
        accessToken: 'stable_token',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    const mockFetchFail = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await authStore.refreshUserDetails('osm-prod', mockFetchFail);

    // Should return existing user and not crash or wipe state
    expect(result?.username).toBe('stable_user');
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.user?.unreadMessagesCount).toBe(1);
  });

  it('returns undefined when refreshing for an unauthenticated user', async () => {
    const result = await authStore.refreshUserDetails('osm-prod');
    expect(result).toBeUndefined();
  });

  it('correctly configures polling intervals across presets', async () => {
    expect(settingsStore.messagePollIntervalMinutes).toBe(10);

    await settingsStore.setMessagePollInterval(5);
    expect(settingsStore.messagePollIntervalMinutes).toBe(5);

    await settingsStore.setMessagePollInterval(30);
    expect(settingsStore.messagePollIntervalMinutes).toBe(30);

    await settingsStore.setMessagePollInterval(0);
    expect(settingsStore.messagePollIntervalMinutes).toBe(0);
  });

  it('saveStoredAuthState safely saves Proxy objects to storage without DataCloneError', async () => {
    // Construct a reactive Proxy object structure (matching Svelte 5 $state behavior)
    const rawState: OsmAuthState = {
      isAuthenticated: true,
      isLoading: false,
      token: {
        accessToken: 'proxy_token',
        tokenType: 'Bearer',
        scope: 'read_prefs',
        createdAt: 1700000000,
      },
      user: {
        id: 999,
        username: 'proxy_user',
        accountCreated: '2024-01-01T00:00:00Z',
        unreadMessagesCount: 4,
      },
    };

    // Deep proxy wrapper simulating Svelte runes
    const proxiedState = new Proxy(rawState, {
      get(target, prop) {
        const val = Reflect.get(target, prop);
        if (typeof val === 'object' && val !== null) {
          return new Proxy(val, {});
        }
        return val;
      },
    });

    // Mock browser.storage.local.set to simulate Firefox DataCloneError if passed a Proxy
    let receivedItem: unknown = null;
    (globalThis as any).browser.storage.local.set = vi.fn(async (items: Record<string, unknown>) => {
      for (const val of Object.values(items)) {
        // In Firefox XPCOM, Object.prototype.toString or structuredClone fails on Proxy
        // We verify that the saved item is a plain POJO
        receivedItem = val;
      }
      Object.assign(mockStorage, items);
    });

    await saveStoredAuthState(proxiedState, 'osm-dev');

    const saved = (await getStoredAuthState('osm-dev')) as OsmAuthState;
    expect(saved).toBeDefined();
    expect(saved.isAuthenticated).toBe(true);
    expect(saved.user?.username).toBe('proxy_user');
    expect(saved.user?.unreadMessagesCount).toBe(4);
    expect(saved.token?.accessToken).toBe('proxy_token');

    // Confirm that the persisted object in storage is a clean POJO without Proxy trapping
    expect(receivedItem).toEqual(rawState);
  });

  it('refreshUserDetails throttles calls within cooldown period to prevent API spamming', async () => {
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 101,
        username: 'rate_limit_tester',
        accountCreated: '2023-01-01T00:00:00Z',
        unreadMessagesCount: 0,
      },
      token: {
        accessToken: 'rate_token',
        tokenType: 'Bearer',
        scope: 'read_prefs',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="101" display_name="rate_limit_tester" account_created="2023-01-01T00:00:00Z">
    <messages>
      <received count="5" unread="1"/>
    </messages>
  </user>
</osm>`;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => sampleXml,
    });

    // 1st call: fresh fetch
    const user1 = await authStore.refreshUserDetails('osm-prod', mockFetch, true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(user1?.unreadMessagesCount).toBe(1);

    // 2nd call immediately after without force: should use cooldown and skip API call
    const user2 = await authStore.refreshUserDetails('osm-prod', mockFetch, false);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1, did not hit API
    expect(user2?.unreadMessagesCount).toBe(1);

    // Advance timer past cooldown (35 seconds)
    vi.advanceTimersByTime(35 * 1000);

    // 3rd call after cooldown: should execute new API call
    const user3 = await authStore.refreshUserDetails('osm-prod', mockFetch, false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(user3?.unreadMessagesCount).toBe(1);
  });

  it('refreshUserDetails deduplicates concurrent in-flight requests', async () => {
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 202,
        username: 'concurrent_tester',
        accountCreated: '2023-01-01T00:00:00Z',
        unreadMessagesCount: 0,
      },
      token: {
        accessToken: 'concurrent_token',
        tokenType: 'Bearer',
        scope: 'read_prefs',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="202" display_name="concurrent_tester" account_created="2023-01-01T00:00:00Z">
    <messages>
      <received count="3" unread="2"/>
    </messages>
  </user>
</osm>`;

    let resolveFetch: (value: any) => void;
    const pendingFetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const mockSlowFetch = vi.fn().mockImplementation(() => pendingFetchPromise);

    // Trigger multiple simultaneous calls
    const call1 = authStore.refreshUserDetails('osm-prod', mockSlowFetch as any, true);
    const call2 = authStore.refreshUserDetails('osm-prod', mockSlowFetch as any, true);
    const call3 = authStore.refreshUserDetails('osm-prod', mockSlowFetch as any, true);

    expect(mockSlowFetch).toHaveBeenCalledTimes(1);

    resolveFetch!({
      ok: true,
      text: async () => sampleXml,
    });

    const [res1, res2, res3] = await Promise.all([call1, call2, call3]);
    expect(res1?.unreadMessagesCount).toBe(2);
    expect(res2?.unreadMessagesCount).toBe(2);
    expect(res3?.unreadMessagesCount).toBe(2);
    expect(mockSlowFetch).toHaveBeenCalledTimes(1);
  });

  it('refreshUserDetails applies exponential error backoff on repeated failures', async () => {
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 303,
        username: 'backoff_tester',
        accountCreated: '2023-01-01T00:00:00Z',
        unreadMessagesCount: 0,
      },
      token: {
        accessToken: 'backoff_token',
        tokenType: 'Bearer',
        scope: 'read_prefs',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    const mockFailingFetch = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

    // 1st attempt (fails)
    await authStore.refreshUserDetails('osm-prod', mockFailingFetch, true);
    expect(mockFailingFetch).toHaveBeenCalledTimes(1);

    // Call after 30s (within 60s backoff window): should be blocked
    vi.advanceTimersByTime(30 * 1000);
    await authStore.refreshUserDetails('osm-prod', mockFailingFetch, false);
    expect(mockFailingFetch).toHaveBeenCalledTimes(1); // Blocked by 60s error backoff

    // Advance past 60s error backoff
    vi.advanceTimersByTime(35 * 1000); // Total 65s
    await authStore.refreshUserDetails('osm-prod', mockFailingFetch, false);
    expect(mockFailingFetch).toHaveBeenCalledTimes(2); // Attempted and failed again (now 2 consecutive errors -> 120s backoff)

    // Call after another 60s (should be blocked by 120s backoff)
    vi.advanceTimersByTime(60 * 1000);
    await authStore.refreshUserDetails('osm-prod', mockFailingFetch, false);
    expect(mockFailingFetch).toHaveBeenCalledTimes(2);

    // Advance past 120s backoff
    vi.advanceTimersByTime(65 * 1000);
    await authStore.refreshUserDetails('osm-prod', mockFailingFetch, false);
    expect(mockFailingFetch).toHaveBeenCalledTimes(3);
  });

  it('refreshUserDetails handles HTTP 429 rate limit error with 5-minute backoff', async () => {
    const initialAuth: OsmAuthState = {
      isAuthenticated: true,
      user: {
        id: 404,
        username: 'rate_limited_user',
        accountCreated: '2023-01-01T00:00:00Z',
        unreadMessagesCount: 0,
      },
      token: {
        accessToken: 'rate_limited_token',
        tokenType: 'Bearer',
        scope: 'read_prefs',
        createdAt: 1700000000,
      },
      isLoading: false,
    };

    await saveStoredAuthState(initialAuth, 'osm-prod');
    await authStore.init();

    const mock429Fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded: please slow down.',
    });

    // 1st attempt returns 429
    await authStore.refreshUserDetails('osm-prod', mock429Fetch, true);
    expect(mock429Fetch).toHaveBeenCalledTimes(1);

    // Call after 2 minutes: should still be blocked under 5-minute rate limit backoff
    vi.advanceTimersByTime(120 * 1000);
    await authStore.refreshUserDetails('osm-prod', mock429Fetch, false);
    expect(mock429Fetch).toHaveBeenCalledTimes(1);

    // Advance past 4 minutes (total 240s): still in backoff
    vi.advanceTimersByTime(120 * 1000);
    await authStore.refreshUserDetails('osm-prod', mock429Fetch, false);
    expect(mock429Fetch).toHaveBeenCalledTimes(1);
  });
});
