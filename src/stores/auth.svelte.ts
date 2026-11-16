/**
 * OpenStreetMap Reactive Authentication Store (Svelte 5 Runes)
 * Provides centralized reactive authentication state, login, logout, and token restoration.
 */

import {
  type OsmAuthState,
  type OsmUserDetails,
  type OsmAuthToken,
} from '@/types/auth';
import {
  getStoredAuthState,
  loginWithOsm,
  logoutOsm as logoutService,
} from '@/services/osm-auth';

class AuthStore {
  private _state = $state<OsmAuthState>({
    isAuthenticated: false,
    isLoading: true,
  });

  constructor() {
    this.init();
  }

  get isAuthenticated(): boolean {
    return this._state.isAuthenticated;
  }

  get isLoading(): boolean {
    return this._state.isLoading;
  }

  get user(): OsmUserDetails | undefined {
    return this._state.user;
  }

  get token(): OsmAuthToken | undefined {
    return this._state.token;
  }

  get error(): string | undefined {
    return this._state.error;
  }

  /**
   * Initializes authentication state from browser local storage.
   */
  async init(): Promise<void> {
    try {
      this._state.isLoading = true;
      const stored = await getStoredAuthState();
      this._state.isAuthenticated = stored.isAuthenticated;
      this._state.user = stored.user;
      this._state.token = stored.token;
      this._state.error = undefined;
    } catch (err) {
      this._state.error = err instanceof Error ? err.message : String(err);
    } finally {
      this._state.isLoading = false;
    }
  }

  /**
   * Triggers the OpenStreetMap OAuth 2.0 PKCE login flow.
   */
  async login(): Promise<void> {
    try {
      this._state.isLoading = true;
      this._state.error = undefined;
      const authResult = await loginWithOsm();
      this._state.isAuthenticated = authResult.isAuthenticated;
      this._state.user = authResult.user;
      this._state.token = authResult.token;
    } catch (err) {
      this._state.error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this._state.isLoading = false;
    }
  }

  /**
   * Logs out the user and clears stored credentials.
   */
  async logout(): Promise<void> {
    try {
      this._state.isLoading = true;
      await logoutService();
      this._state.isAuthenticated = false;
      this._state.user = undefined;
      this._state.token = undefined;
      this._state.error = undefined;
    } catch (err) {
      this._state.error = err instanceof Error ? err.message : String(err);
    } finally {
      this._state.isLoading = false;
    }
  }
}

export const authStore = new AuthStore();
