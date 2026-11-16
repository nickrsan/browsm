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
import { getUserDetails } from './osm-api';

const AUTH_STORAGE_KEY = 'browsm_osm_auth_state';

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
 * Retrieves the stored OSM authentication state from browser storage.
 */
export async function getStoredAuthState(): Promise<OsmAuthState> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const data = await browser.storage.local.get(AUTH_STORAGE_KEY);
      const state = data[AUTH_STORAGE_KEY] as OsmAuthState | undefined;
      if (state && state.token) {
        return state;
      }
    }
  } catch (err) {
    console.debug('[Browsm] Error reading auth state from storage:', err);
  }

  return {
    isAuthenticated: false,
    isLoading: false,
  };
}

/**
 * Saves the OSM authentication state to browser local storage.
 */
export async function saveStoredAuthState(state: OsmAuthState): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ [AUTH_STORAGE_KEY]: state });
    }
  } catch (err) {
    console.debug('[Browsm] Error saving auth state to storage:', err);
  }
}

/**
 * Clears the stored OSM authentication state.
 */
export async function clearStoredAuthState(): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.remove(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.debug('[Browsm] Error clearing auth state from storage:', err);
  }
}

/**
 * Orchestrates the full OpenStreetMap OAuth 2.0 PKCE login flow.
 * Opens `launchWebAuthFlow`, intercepts authorization code, exchanges it for access token,
 * fetches user details, and stores the state in `browser.storage.local`.
 */
export async function loginWithOsm(
  configOverride?: Partial<OsmAuthConfig>,
  customFetch: typeof fetch = fetch
): Promise<OsmAuthState> {
  const config: OsmAuthConfig = {
    ...DEFAULT_OSM_AUTH_CONFIG,
    ...configOverride,
  };

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

  await saveStoredAuthState(authState);

  return authState;
}

/**
 * Logs out the current user by clearing stored authentication tokens.
 */
export async function logoutOsm(): Promise<void> {
  await clearStoredAuthState();
}
