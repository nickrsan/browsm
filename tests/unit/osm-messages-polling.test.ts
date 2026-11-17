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
});
