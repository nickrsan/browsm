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

  // In-flight promise tracking per endpoint to avoid duplicate concurrent API calls
  private _inFlightRefresh = new Map<string, Promise<OsmUserDetails | undefined>>();
  // Timestamp of last fetch attempt per endpoint for rate limiting
  private _lastFetchTime = new Map<string, number>();
  // Timestamp until which API requests are blocked due to HTTP 429 rate limits
  private _rateLimitResetTime = new Map<string, number>();
  // Consecutive error counter per endpoint for exponential backoff
  private _consecutiveErrors = new Map<string, number>();

  // Cooldown and rate-limiting constants
  private readonly MIN_REFRESH_INTERVAL_MS = 30 * 1000; // 30s minimum interval between successful polls
  private readonly BASE_ERROR_BACKOFF_MS = 60 * 1000; // 1m base backoff on errors
  private readonly MAX_ERROR_BACKOFF_MS = 15 * 60 * 1000; // 15m maximum backoff
  private readonly RATE_LIMIT_429_BACKOFF_MS = 5 * 60 * 1000; // 5m backoff on HTTP 429

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
      // Only assign if states differ to prevent unnecessary Svelte reactive cascades
      if (JSON.stringify(this._authStates) !== JSON.stringify(allStates)) {
        this._authStates = allStates;
      }
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
      // Reset rate-limiting trackers on successful login
      this._consecutiveErrors.set(targetId, 0);
      this._lastFetchTime.set(targetId, Date.now());
      this._rateLimitResetTime.delete(targetId);
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
   * Features in-flight deduplication, cooldown throttling, and exponential error backoff.
   */
  async refreshUserDetails(
    endpointId?: string,
    customFetch: typeof fetch = fetch,
    force: boolean = false
  ): Promise<OsmUserDetails | undefined> {
    const targetId = endpointId || this.activeTargetId;
    const currentState = this.getAuthStateFor(targetId);
    if (!currentState.isAuthenticated || !currentState.token?.accessToken) {
      return undefined;
    }

    // 1. In-flight request deduplication: reuse running promise if already pending
    const inFlight = this._inFlightRefresh.get(targetId);
    if (inFlight) {
      return inFlight;
    }

    // 2. Cooldown and exponential error backoff rate limiting
    const now = Date.now();
    const lastFetch = this._lastFetchTime.get(targetId) || 0;
    const rateLimitUntil = this._rateLimitResetTime.get(targetId) || 0;
    const errors = this._consecutiveErrors.get(targetId) || 0;

    // Check if under HTTP 429 rate limit backoff
    if (!force && now < rateLimitUntil) {
      return currentState.user;
    }

    let requiredCooldown = this.MIN_REFRESH_INTERVAL_MS;
    if (errors > 0) {
      // Exponential backoff: 1m, 2m, 4m, 8m, up to 15m max
      requiredCooldown = Math.min(
        this.BASE_ERROR_BACKOFF_MS * Math.pow(2, errors - 1),
        this.MAX_ERROR_BACKOFF_MS
      );
    }

    if (!force && now - lastFetch < requiredCooldown) {
      // Within cooldown period: return cached user data to prevent API abuse
      return currentState.user;
    }

    const endpointConfig = getEndpointConfig(targetId, settingsStore.customEndpoint);
    const accessToken = currentState.token.accessToken;

    const refreshPromise = (async () => {
      try {
        const updatedUser = await getUserDetails(
          accessToken,
          endpointConfig.apiBaseUrl,
          customFetch
        );

        // Reset error counters on successful fetch
        this._consecutiveErrors.set(targetId, 0);
        this._lastFetchTime.set(targetId, Date.now());

        // Check if user details have changed before triggering reactivity and storage write
        const prevUser = currentState.user;
        const hasChanged =
          !prevUser ||
          prevUser.unreadMessagesCount !== updatedUser.unreadMessagesCount ||
          prevUser.totalMessagesCount !== updatedUser.totalMessagesCount ||
          prevUser.changesetCount !== updatedUser.changesetCount ||
          prevUser.username !== updatedUser.username ||
          prevUser.description !== updatedUser.description ||
          prevUser.img !== updatedUser.img;

        if (hasChanged) {
          const updatedState: OsmAuthState = {
            ...currentState,
            user: updatedUser,
          };
          this._authStates = {
            ...this._authStates,
            [targetId]: updatedState,
          };
          await saveStoredAuthState(updatedState, targetId);
        }

        return updatedUser;
      } catch (err: any) {
        const errorCount = (this._consecutiveErrors.get(targetId) || 0) + 1;
        this._consecutiveErrors.set(targetId, errorCount);
        this._lastFetchTime.set(targetId, Date.now());

        if (err?.status === 429 || (typeof err?.message === 'string' && err.message.includes('429'))) {
          console.warn(`[Browsm] OSM API rate limit encountered for ${targetId}. Backing off for 5 minutes.`);
          this._rateLimitResetTime.set(targetId, Date.now() + this.RATE_LIMIT_429_BACKOFF_MS);
          this._consecutiveErrors.set(targetId, Math.max(errorCount, 3));
        } else if (err?.status === 401 || (typeof err?.message === 'string' && err.message.includes('401'))) {
          console.warn(`[Browsm] Authentication token for ${targetId} appears invalid or expired.`);
        } else {
          console.debug(`[Browsm] Failed to refresh user details for ${targetId} (attempt ${errorCount}):`, err);
        }

        return currentState.user;
      } finally {
        this._inFlightRefresh.delete(targetId);
      }
    })();

    this._inFlightRefresh.set(targetId, refreshPromise);
    return refreshPromise;
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
      this._inFlightRefresh.delete(targetId);
      this._consecutiveErrors.delete(targetId);
      this._lastFetchTime.delete(targetId);
      this._rateLimitResetTime.delete(targetId);
      this._error = undefined;
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      this._isLoading = false;
    }
  }
}

export const authStore = new AuthStore();
