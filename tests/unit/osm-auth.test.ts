import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  bufferToBase64Url,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  getStoredAuthState,
  saveStoredAuthState,
  clearStoredAuthState,
  loginWithOsm,
  logoutOsm,
} from '@/services/osm-auth';
import type { OsmAuthConfig } from '@/types/auth';

describe('OpenStreetMap OAuth 2.0 PKCE Service (osm-auth)', () => {
  const mockConfig: OsmAuthConfig = {
    clientId: 'test-client-id',
    redirectUri: 'https://test-extension/osm-auth',
    authUrl: 'https://www.openstreetmap.org/oauth2/authorize',
    tokenUrl: 'https://www.openstreetmap.org/oauth2/token',
    apiBaseUrl: 'https://api.openstreetmap.org/api/0.6',
    scopes: ['read_prefs', 'write_api', 'write_notes'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PKCE Code Verifier & Challenge Generation', () => {
    it('generates random code verifiers with valid RFC 7636 charset', () => {
      const verifier1 = generateCodeVerifier(64);
      const verifier2 = generateCodeVerifier(64);

      expect(verifier1).toHaveLength(64);
      expect(verifier2).toHaveLength(64);
      expect(verifier1).not.toBe(verifier2);
      expect(verifier1).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('correctly converts binary buffers to Base64URL string without padding', () => {
      const buffer = new Uint8Array([251, 255, 254]).buffer;
      const base64url = bufferToBase64Url(buffer);

      expect(base64url).not.toContain('+');
      expect(base64url).not.toContain('/');
      expect(base64url).not.toContain('=');
    });

    it('computes code challenge using SHA-256', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await generateCodeChallenge(verifier);

      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(20);
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('constructs authorization URL with required PKCE and OAuth2 query parameters', () => {
      const challenge = 'test-challenge-abc';
      const state = 'test-state-123';

      const authUrl = buildAuthorizationUrl(mockConfig, challenge, state);
      const url = new URL(authUrl);

      expect(url.origin + url.pathname).toBe('https://www.openstreetmap.org/oauth2/authorize');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://test-extension/osm-auth');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('read_prefs write_api write_notes');
      expect(url.searchParams.get('code_challenge')).toBe('test-challenge-abc');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('state')).toBe('test-state-123');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('sends POST request to tokenUrl and parses access token payload', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'osm_bearer_token_xyz',
          token_type: 'Bearer',
          scope: 'read_prefs write_api write_notes',
          created_at: 1700000000,
          expires_in: 3600,
        }),
      });

      const token = await exchangeCodeForToken(mockConfig, 'test-auth-code', 'test-code-verifier', mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        mockConfig.tokenUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );

      expect(token.accessToken).toBe('osm_bearer_token_xyz');
      expect(token.tokenType).toBe('Bearer');
      expect(token.expiresIn).toBe(3600);
    });

    it('throws descriptive error on failed token exchange', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant: code expired',
      });

      await expect(
        exchangeCodeForToken(mockConfig, 'bad-code', 'test-verifier', mockFetch)
      ).rejects.toThrow('OAuth token exchange failed (HTTP 400): invalid_grant: code expired');
    });
  });

  describe('Storage & Auth State Lifecycle', () => {
    it('saves and reads stored auth state', async () => {
      const testState = {
        isAuthenticated: true,
        user: {
          id: 12345,
          username: 'mapper_alice',
          accountCreated: '2021-01-01',
        },
        token: {
          accessToken: 'stored_token',
          tokenType: 'Bearer',
          scope: 'write_api',
          createdAt: 1700000000,
        },
        isLoading: false,
      };

      await saveStoredAuthState(testState);
      const readState = await getStoredAuthState();

      expect(readState.isAuthenticated).toBe(true);
      expect(readState.user?.username).toBe('mapper_alice');
      expect(readState.token?.accessToken).toBe('stored_token');

      await clearStoredAuthState();
      const emptyState = await getStoredAuthState();
      expect(emptyState.isAuthenticated).toBe(false);
    });

    it('clears state on logoutOsm', async () => {
      await saveStoredAuthState({
        isAuthenticated: true,
        isLoading: false,
      });

      await logoutOsm();
      const state = await getStoredAuthState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('loginWithOsm Orchestration', () => {
    it('throws error when browser.identity API is unavailable', async () => {
      const originalIdentity = browser.identity;
      // @ts-ignore
      browser.identity = undefined;

      try {
        await expect(loginWithOsm(mockConfig)).rejects.toThrow('WebExtension identity API');
      } finally {
        // @ts-ignore
        browser.identity = originalIdentity;
      }
    });

    it('orchestrates launchWebAuthFlow, exchanges token, and fetches user details', async () => {
      // Mock identity.launchWebAuthFlow
      const mockLaunchWebAuthFlow = vi.fn().mockImplementation(async ({ url }: { url: string }) => {
        const parsedAuthUrl = new URL(url);
        const state = parsedAuthUrl.searchParams.get('state');
        return `https://test-extension/osm-auth?code=mock_code_123&state=${state}`;
      });

      // @ts-ignore
      browser.identity = {
        launchWebAuthFlow: mockLaunchWebAuthFlow,
        getRedirectURL: vi.fn().mockReturnValue('https://test-extension/osm-auth'),
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/oauth2/token')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'auth_token_999',
              token_type: 'Bearer',
              scope: 'read_prefs write_api write_notes',
            }),
          };
        }
        if (url.includes('/user/details')) {
          const userXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="555" display_name="mapper_bob" account_created="2022-03-15T10:00:00Z">
    <changesets count="150"/>
  </user>
</osm>`;
          return {
            ok: true,
            text: async () => userXml,
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      });

      const authState = await loginWithOsm(mockConfig, mockFetch);

      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user?.username).toBe('mapper_bob');
      expect(authState.user?.changesetCount).toBe(150);
      expect(authState.token?.accessToken).toBe('auth_token_999');
    });

    it('rejects flow if state parameter mismatch occurs', async () => {
      // @ts-ignore
      browser.identity = {
        launchWebAuthFlow: vi.fn().mockResolvedValue('https://test-extension/osm-auth?code=mock_code&state=wrong_state'),
        getRedirectURL: vi.fn().mockReturnValue('https://test-extension/osm-auth'),
      };

      await expect(loginWithOsm(mockConfig)).rejects.toThrow('potential CSRF detected');
    });
  });
});
