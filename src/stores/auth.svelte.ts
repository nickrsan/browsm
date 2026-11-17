/**
 * OpenStreetMap Reactive Multi-Target Authentication Store (Svelte 5 Runes)
 * Provides centralized reactive authentication state, login, logout, and token restoration
 * across multiple endpoints (OSM Production, OSM Dev Sandbox, OpenHistoricalMap, Custom).
 */

import {
  type OsmAuthState,
  type OsmUserDetails,
  type OsmAuthToken,
  type OsmAuthConfig,
} from '@/types/auth';
import { getEndpointConfig, type EndpointConfig } from '@/types/settings';
import {
  getStoredAuthState,
  getAllStoredAuthStates,
  saveStoredAuthState,
  loginWithOsm,
  logoutOsm as logoutService,
  AUTH_STORAGE_KEY_PREFIX,
  LEGACY_AUTH_STORAGE_KEY,
} from '@/services/osm-auth';
import { getUserDetails } from '@/services/osm-api';
import { settingsStore } from './settings.svelte';

class AuthStore {
  private _authStates = $state<Record<string, OsmAuthState>>({});
  private _isLoading = $state<boolean>(true);
  private _error = $state<string | undefined>(undefined);

  constructor() {
    this.init();
    this.setupStorageListener();
  }

  /**
   * The effective target endpoint ID for write and authentication operations.
   * In developer mode (writes_only or reads_and_writes), this targets 'osm-dev'.
   */
  get activeTargetId(): string {
    const routing = settingsStore.devModeRouting;
    if (routing === 'writes_only' || routing === 'reads_and_writes') {
      return 'osm-dev';
    }
    return settingsStore.activeEndpointId || 'osm-prod';
  }

  /**
   * Active authentication state for the effective target endpoint.
   */
  get currentAuthState(): OsmAuthState {
    return this.getAuthStateFor(this.activeTargetId);
  }

  get isAuthenticated(): boolean {
    return this.currentAuthState.isAuthenticated;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get user(): OsmUserDetails | undefined {
    return this.currentAuthState.user;
  }

  get token(): OsmAuthToken | undefined {
    return this.currentAuthState.token;
  }

  get error(): string | undefined {
    return this._error;
  }

  get allStates(): Record<string, OsmAuthState> {
    return this._authStates;
  }

  /**
   * Returns the stored authentication state for any specified endpoint ID.
   */
  getAuthStateFor(endpointId: string): OsmAuthState {
    const cleanId = (endpointId || 'osm-prod').trim();
    return this._authStates[cleanId] || { isAuthenticated: false, isLoading: false };
  }

  /**
   * Initializes authentication states from browser local storage across all endpoints.
   */
  async init(): Promise<void> {
    try {
      this._isLoading = true;
      const allStates = await getAllStoredAuthStates();
      this._authStates = allStates;
      this._error = undefined;
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      console.debug('[Browsm] Failed to initialize auth store:', err);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Listens for storage changes from other contexts to synchronize login state.
   */
  private setupStorageListener(): void {
    if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          let shouldRefresh = false;
          for (const key of Object.keys(changes)) {
            if (key.startsWith(AUTH_STORAGE_KEY_PREFIX) || key === LEGACY_AUTH_STORAGE_KEY) {
              shouldRefresh = true;
              break;
            }
          }
          if (shouldRefresh) {
            this.init();
          }
        }
      });
    }
  }

  /**
   * Triggers the OAuth 2.0 PKCE login flow for a target endpoint.
   */
  async login(endpointId?: string, configOverride?: Partial<OsmAuthConfig>): Promise<void> {
    const targetId = endpointId || this.activeTargetId;
    const endpointConfig = getEndpointConfig(targetId, settingsStore.customEndpoint);

    const mergedConfig: Partial<OsmAuthConfig> = {
      apiBaseUrl: endpointConfig.apiBaseUrl,
      authUrl: endpointConfig.authUrl,
      tokenUrl: endpointConfig.tokenUrl,
      clientId: endpointConfig.clientId,
      scopes: endpointConfig.scopes,
      ...configOverride,
    };

    try {
      this._isLoading = true;
      this._error = undefined;
      const authResult = await loginWithOsm(mergedConfig, fetch, targetId);
      this._authStates = {
        ...this._authStates,
        [targetId]: authResult,
      };
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Refreshes user profile details (including changeset count and unread messages count)
   * from the OSM API for the active or specified endpoint and updates persistent state.
   */
  async refreshUserDetails(endpointId?: string, customFetch: typeof fetch = fetch): Promise<OsmUserDetails | undefined> {
    const targetId = endpointId || this.activeTargetId;
    const currentState = this.getAuthStateFor(targetId);
    if (!currentState.isAuthenticated || !currentState.token?.accessToken) {
      return undefined;
    }

    const endpointConfig = getEndpointConfig(targetId, settingsStore.customEndpoint);
    try {
      const updatedUser = await getUserDetails(currentState.token.accessToken, endpointConfig.apiBaseUrl, customFetch);
      const updatedState: OsmAuthState = {
        ...currentState,
        user: updatedUser,
      };
      this._authStates = {
        ...this._authStates,
        [targetId]: updatedState,
      };
      await saveStoredAuthState(updatedState, targetId);
      return updatedUser;
    } catch (err) {
      console.debug(`[Browsm] Failed to refresh user details for ${targetId}:`, err);
      return currentState.user;
    }
  }

  /**
   * Logs out the user and clears stored credentials for a specific endpoint.
   */
  async logout(endpointId?: string): Promise<void> {
    const targetId = endpointId || this.activeTargetId;
    try {
      this._isLoading = true;
      await logoutService(targetId);
      this._authStates = {
        ...this._authStates,
        [targetId]: { isAuthenticated: false, isLoading: false },
      };
      this._error = undefined;
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      this._isLoading = false;
    }
  }
}

export const authStore = new AuthStore();
