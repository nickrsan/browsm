import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import AuthHeader from '@/components/AuthHeader.svelte';
import { authStore } from '@/stores/auth.svelte';
import { settingsStore } from '@/stores/settings.svelte';

describe('AuthHeader.svelte Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      identity: {
        launchWebAuthFlow: vi.fn(),
        getRedirectURL: vi.fn().mockReturnValue('https://extension/osm-auth'),
      },
    };
    await settingsStore.resetToDefaults();
    await authStore.logout();
  });

  it('renders login prompt and login button when user is logged out', async () => {
    render(AuthHeader);

    await waitFor(() => {
      expect(screen.getByTestId('auth-login-card')).toBeInTheDocument();
      expect(screen.getByTestId('auth-login-btn')).toHaveTextContent('Log in with OpenStreetMap');
    });
  });

  it('reflects active target endpoint when developer mode is active', async () => {
    await settingsStore.setDevModeRouting('writes_only');
    render(AuthHeader);

    await waitFor(() => {
      expect(screen.getByTestId('auth-login-btn')).toHaveTextContent('Log in with OSM Dev Server');
      expect(screen.getByText(/Sandbox mode active/i)).toBeInTheDocument();
    });
  });

  it('renders user details, avatar placeholder, and logout button when logged in', async () => {
    // Save auth state to storage so store initializes as logged in
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      'browsm_auth_osm-prod': {
        isAuthenticated: true,
        user: {
          id: 42,
          username: 'rhody_mapper',
          accountCreated: '2021-05-10',
          changesetCount: 312,
        },
        token: {
          accessToken: 'valid_token',
          tokenType: 'Bearer',
          scope: 'read_prefs write_api write_notes',
          createdAt: 1700000000,
        },
        isLoading: false,
      },
    });

    await authStore.init();

    render(AuthHeader);

    await waitFor(() => {
      expect(screen.getByTestId('auth-user-card')).toBeInTheDocument();
      expect(screen.getByTestId('auth-username')).toHaveTextContent('rhody_mapper');
      expect(screen.getByText('312 changesets')).toBeInTheDocument();
      expect(screen.getByTestId('auth-logout-btn')).toHaveTextContent('Log out');
    });

    // Test clicking logout button
    const logoutBtn = screen.getByTestId('auth-logout-btn');
    await fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-login-card')).toBeInTheDocument();
    });
  });
});
