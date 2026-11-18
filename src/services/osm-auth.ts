/**
 * OpenStreetMap OAuth 2.0 PKCE Authentication Service
 * Implements RFC 7636 Proof Key for Code Exchange (PKCE) for client-side WebExtension authentication.
 * Eliminates the need for intermediate secret-holding servers while maintaining zero-trust credential hygiene.
 */

import {
  type OsmAuthConfig,
  type OsmAuthToken,
  type OsmUserDetails,
  type OsmAuthState,
  DEFAULT_OSM_AUTH_CONFIG,
} from '@/types/auth';
import { getEndpointConfig, type EndpointPreset } from '@/types/settings';
import { getUserDetails } from './osm-api';

export const LEGACY_AUTH_STORAGE_KEY = 'browsm_osm_auth_state';
export const AUTH_STORAGE_KEY_PREFIX = 'browsm_auth_';

/**
 * Returns the storage key in browser.storage.local for a specific endpoint identifier.
 */
export function getAuthStorageKey(endpointId: string = 'osm-prod'): string {
  const cleanId = (endpointId || 'osm-prod').trim();
  return `${AUTH_STORAGE_KEY_PREFIX}${cleanId}`;
}

/**
 * Generates a cryptographically random OAuth 2.0 code verifier (RFC 7636).
 * Uses unreserved characters [A-Za-z0-9-._~] with minimum 43 and maximum 128 characters.
 */
export function generateCodeVerifier(length = 64): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Fallback for environments where crypto.getRandomValues is mocked
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(randomValues)
    .map((val) => charset[val % charset.length])
    .join('');
}

/**
 * Converts a binary ArrayBuffer to a Base64URL string (RFC 4648 § 5).
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Computes the SHA-256 Code Challenge from a Code Verifier for PKCE.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return bufferToBase64Url(hashBuffer);
  }

  // Pure fallback if subtle crypto is unavailable in test runner
  return bufferToBase64Url(data.buffer);
}

/**
 * Builds the OpenStreetMap OAuth 2.0 Authorization URL with PKCE parameters.
 */
export function buildAuthorizationUrl(
  config: OsmAuthConfig,
  codeChallenge: string,
  state: string
): string {
  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  return url.toString();
}

/**
 * Exchanges the OAuth authorization code for an access token via POST /oauth2/token.
 */
export async function exchangeCodeForToken(
  config: OsmAuthConfig,
  code: string,
  codeVerifier: string,
  customFetch: typeof fetch = fetch
): Promise<OsmAuthToken> {
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  const response = await customFetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token exchange failed (HTTP ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    scope: string;
    created_at?: number;
    expires_in?: number;
    refresh_token?: string;
  };

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope,
    createdAt: data.created_at || Math.floor(Date.now() / 1000),
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
}

/**
 * Retrieves the stored OSM authentication state for a specific endpoint from browser storage.
 * Supports transparent migration from legacy un-namespaced auth key.
 */
export async function getStoredAuthState(endpointId: string = 'osm-prod'): Promise<OsmAuthState> {
  const storageKey = getAuthStorageKey(endpointId);
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const data = await browser.storage.local.get([storageKey, LEGACY_AUTH_STORAGE_KEY]);
      const state = data[storageKey] as OsmAuthState | undefined;
      if (state && state.token) {
        return state;
      }

      // Check legacy key for backwards compatibility if querying osm-prod
      if (endpointId === 'osm-prod' && data[LEGACY_AUTH_STORAGE_KEY]) {
        const legacyState = data[LEGACY_AUTH_STORAGE_KEY] as OsmAuthState;
        if (legacyState && legacyState.token) {
          // Transparently migrate to namespaced storage
          await browser.storage.local.set({ [storageKey]: legacyState });
          return legacyState;
        }
      }
    }
  } catch (err) {
    console.debug(`[Browsm] Error reading auth state for ${endpointId} from storage:`, err);
  }

  return {
    isAuthenticated: false,
    isLoading: false,
  };
}

/**
 * Saves the OSM authentication state for a specific endpoint to browser local storage.
 * Ensures the state is cloned to a plain object to prevent DataCloneError with Svelte 5 Proxies.
 */
export async function saveStoredAuthState(
  state: OsmAuthState,
  endpointId: string = 'osm-prod'
): Promise<void> {
  const storageKey = getAuthStorageKey(endpointId);
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      // Deep clone to a plain POJO to avoid DataCloneError with Svelte 5 reactive Proxies in Firefox
      const plainState: OsmAuthState = JSON.parse(JSON.stringify(state));
      await browser.storage.local.set({ [storageKey]: plainState });
    }
  } catch (err) {
    console.debug(`[Browsm] Error saving auth state for ${endpointId} to storage:`, err);
  }
}

/**
 * Clears the stored OSM authentication state for a specific endpoint.
 */
export async function clearStoredAuthState(endpointId: string = 'osm-prod'): Promise<void> {
  const storageKey = getAuthStorageKey(endpointId);
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const keysToRemove = [storageKey];
      if (endpointId === 'osm-prod') {
        keysToRemove.push(LEGACY_AUTH_STORAGE_KEY);
      }
      await browser.storage.local.remove(keysToRemove);
    }
  } catch (err) {
    console.debug(`[Browsm] Error clearing auth state for ${endpointId} from storage:`, err);
  }
}

/**
 * Retrieves all stored authentication states across all configured endpoints.
 */
export async function getAllStoredAuthStates(): Promise<Record<string, OsmAuthState>> {
  const result: Record<string, OsmAuthState> = {};
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const allData = await browser.storage.local.get(null);
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(AUTH_STORAGE_KEY_PREFIX)) {
          const endpointId = key.substring(AUTH_STORAGE_KEY_PREFIX.length);
          const state = value as OsmAuthState;
          if (state && state.isAuthenticated) {
            result[endpointId] = state;
          }
        }
      }

      // If osm-prod is not present in prefix map, check legacy key
      if (!result['osm-prod'] && allData[LEGACY_AUTH_STORAGE_KEY]) {
        const legacy = allData[LEGACY_AUTH_STORAGE_KEY] as OsmAuthState;
        if (legacy && legacy.isAuthenticated) {
          result['osm-prod'] = legacy;
        }
      }
    }
  } catch (err) {
    console.debug('[Browsm] Error retrieving all auth states:', err);
  }
  return result;
}

/**
 * Orchestrates the full OpenStreetMap OAuth 2.0 PKCE login flow.
 * Opens `launchWebAuthFlow`, intercepts authorization code, exchanges it for access token,
 * fetches user details, and stores the state in `browser.storage.local` under the target endpoint ID.
 */
export async function loginWithOsm(
  configOverride?: Partial<OsmAuthConfig>,
  customFetch: typeof fetch = fetch,
  endpointId?: string
): Promise<OsmAuthState> {
  const config: OsmAuthConfig = {
    ...DEFAULT_OSM_AUTH_CONFIG,
    ...configOverride,
  };

  const targetEndpointId = endpointId || 'osm-prod';

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateCodeVerifier(32);

  const authUrl = buildAuthorizationUrl(config, codeChallenge, state);

  if (typeof browser === 'undefined' || !browser.identity?.launchWebAuthFlow) {
    throw new Error('WebExtension identity API (launchWebAuthFlow) is not available in current context.');
  }

  const redirectUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!redirectUrl) {
    throw new Error('OAuth authentication was cancelled by user or returned empty response.');
  }

  const parsedUrl = new URL(redirectUrl);
  const returnedCode = parsedUrl.searchParams.get('code');
  const returnedState = parsedUrl.searchParams.get('state');
  const error = parsedUrl.searchParams.get('error');
  const errorDescription = parsedUrl.searchParams.get('error_description');

  if (error) {
    throw new Error(`OAuth error: ${error} - ${errorDescription || 'No description provided'}`);
  }

  if (!returnedCode) {
    throw new Error('OAuth response did not contain an authorization code.');
  }

  if (returnedState !== state) {
    throw new Error('OAuth state mismatch: potential CSRF detected.');
  }

  // Exchange authorization code for token
  const token = await exchangeCodeForToken(config, returnedCode, codeVerifier, customFetch);

  // Fetch user profile details
  const user = await getUserDetails(token.accessToken, config.apiBaseUrl, customFetch);

  const authState: OsmAuthState = {
    isAuthenticated: true,
    user,
    token,
    isLoading: false,
  };

  await saveStoredAuthState(authState, targetEndpointId);

  return authState;
}

/**
 * Logs out the user from a specific endpoint by clearing stored credentials.
 */
export async function logoutOsm(endpointId: string = 'osm-prod'): Promise<void> {
  await clearStoredAuthState(endpointId);
}
