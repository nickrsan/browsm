/**
 * Reactive Settings Store (Svelte 5 Runes)
 * Manages active endpoint selection, developer mode routing, custom endpoint parameters,
 * and user preferences backed by persistent browser.storage.local.
 */

import {
  DEFAULT_SETTINGS_STATE,
  getEndpointConfig,
  type SettingsState,
  type EndpointPreset,
  type DevModeRouting,
  type PreferredEditor,
  type EndpointConfig,
} from '@/types/settings';
import {
  SETTINGS_STORAGE_KEY,
  loadStoredSettings,
  getEndpointBadgeInfo,
  type EndpointBadgeInfo,
} from '@/services/endpoint-resolver';

class SettingsStore {
  private _state = $state<SettingsState>({ ...DEFAULT_SETTINGS_STATE });
  private _isLoading = $state<boolean>(true);

  constructor() {
    this.init();
    this.setupStorageListener();
  }

  get state(): SettingsState {
    return this._state;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  get activeEndpointId(): EndpointPreset | string {
    return this._state.activeEndpointId;
  }

  get devModeRouting(): DevModeRouting {
    return this._state.devModeRouting;
  }

  get customEndpoint(): EndpointConfig | undefined {
    return this._state.customEndpoint;
  }

  get defaultChangesetCommentPrefix(): string | undefined {
    return this._state.defaultChangesetCommentPrefix;
  }

  get preferredEditor(): PreferredEditor {
    return this._state.preferredEditor;
  }

  get messagePollIntervalMinutes(): number {
    return this._state.messagePollIntervalMinutes ?? 10;
  }

  get nearbySearchRadius(): number {
    return this._state.nearbySearchRadius ?? 50;
  }

  get activeEndpointConfig(): EndpointConfig {
    return getEndpointConfig(this._state.activeEndpointId, this._state.customEndpoint);
  }

  get badgeInfo(): EndpointBadgeInfo {
    return getEndpointBadgeInfo(this._state);
  }

  get isDevMode(): boolean {
    return this.badgeInfo.isDev;
  }

  /**
   * Initializes settings from browser local storage.
   */
  async init(): Promise<void> {
    try {
      this._isLoading = true;
      const loaded = await loadStoredSettings();
      this._state.activeEndpointId = loaded.activeEndpointId;
      this._state.devModeRouting = loaded.devModeRouting;
      this._state.customEndpoint = loaded.customEndpoint;
      this._state.defaultChangesetCommentPrefix = loaded.defaultChangesetCommentPrefix;
      this._state.preferredEditor = loaded.preferredEditor;
      this._state.messagePollIntervalMinutes = loaded.messagePollIntervalMinutes ?? 10;
      this._state.nearbySearchRadius = loaded.nearbySearchRadius ?? 50;
    } catch (err) {
      console.debug('[Browsm] Failed to initialize settings store:', err);
    } finally {
      this._isLoading = false;
    }
  }

  /**
   * Listens for changes from other extension contexts (e.g., Options page to Sidebar).
   */
  private setupStorageListener(): void {
    if (typeof browser !== 'undefined' && browser.storage?.onChanged) {
      browser.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[SETTINGS_STORAGE_KEY]) {
          const newValue = changes[SETTINGS_STORAGE_KEY].newValue as SettingsState | undefined;
          if (newValue) {
            this._state.activeEndpointId = newValue.activeEndpointId;
            this._state.devModeRouting = newValue.devModeRouting;
            this._state.customEndpoint = newValue.customEndpoint;
            this._state.defaultChangesetCommentPrefix = newValue.defaultChangesetCommentPrefix;
            this._state.preferredEditor = newValue.preferredEditor;
            this._state.messagePollIntervalMinutes = newValue.messagePollIntervalMinutes;
            this._state.nearbySearchRadius = newValue.nearbySearchRadius ?? 50;
          }
        }
      });
    }
  }

  /**
   * Persists current settings to browser storage.
   * Serializes to plain JSON object to prevent DataCloneError with Svelte 5 Proxies in Firefox.
   */
  private async persist(): Promise<void> {
    try {
      if (typeof browser !== 'undefined' && browser.storage?.local) {
        const plainSettings = JSON.parse(
          JSON.stringify({
            activeEndpointId: this._state.activeEndpointId,
            devModeRouting: this._state.devModeRouting,
            customEndpoint: this._state.customEndpoint,
            defaultChangesetCommentPrefix: this._state.defaultChangesetCommentPrefix,
            preferredEditor: this._state.preferredEditor,
            messagePollIntervalMinutes: this._state.messagePollIntervalMinutes,
            nearbySearchRadius: this._state.nearbySearchRadius,
          })
        );
        await browser.storage.local.set({
          [SETTINGS_STORAGE_KEY]: plainSettings,
        });
      }
    } catch (err) {
      console.debug('[Browsm] Failed to save settings to storage:', err);
    }
  }

  /**
   * Sets the active API endpoint preset or custom ID.
   */
  async setActiveEndpoint(id: EndpointPreset | string): Promise<void> {
    this._state.activeEndpointId = id;
    await this.persist();
  }

  /**
   * Sets the Developer Mode routing mode.
   */
  async setDevModeRouting(routing: DevModeRouting): Promise<void> {
    this._state.devModeRouting = routing;
    await this.persist();
  }

  /**
   * Saves custom endpoint configuration and selects it if desired.
   */
  async setCustomEndpoint(config: EndpointConfig, selectAsActive = false): Promise<void> {
    this._state.customEndpoint = config;
    if (selectAsActive) {
      this._state.activeEndpointId = 'custom';
    }
    await this.persist();
  }

  /**
   * Sets the preferred external editor.
   */
  async setPreferredEditor(editor: PreferredEditor): Promise<void> {
    this._state.preferredEditor = editor;
    await this.persist();
  }

  /**
   * Sets the default changeset comment prefix.
   */
  async setDefaultChangesetCommentPrefix(prefix: string): Promise<void> {
    this._state.defaultChangesetCommentPrefix = prefix;
    await this.persist();
  }

  /**
   * Sets the periodic OSM message polling interval in minutes (0 disables polling).
   */
  async setMessagePollInterval(minutes: number): Promise<void> {
    this._state.messagePollIntervalMinutes = minutes;
    await this.persist();
  }

  /**
   * Sets the nearby POI search radius in meters (clamped between 10m and 500m).
   */
  async setNearbySearchRadius(radiusMeters: number): Promise<void> {
    const num = Math.round(Number(radiusMeters)) || 50;
    this._state.nearbySearchRadius = Math.max(10, Math.min(500, num));
    await this.persist();
  }

  /**
   * Resets all settings to default values.
   */
  async resetToDefaults(): Promise<void> {
    this._state.activeEndpointId = DEFAULT_SETTINGS_STATE.activeEndpointId;
    this._state.devModeRouting = DEFAULT_SETTINGS_STATE.devModeRouting;
    this._state.customEndpoint = undefined;
    this._state.defaultChangesetCommentPrefix = DEFAULT_SETTINGS_STATE.defaultChangesetCommentPrefix;
    this._state.preferredEditor = DEFAULT_SETTINGS_STATE.preferredEditor;
    this._state.messagePollIntervalMinutes = DEFAULT_SETTINGS_STATE.messagePollIntervalMinutes;
    this._state.nearbySearchRadius = DEFAULT_SETTINGS_STATE.nearbySearchRadius;
    await this.persist();
  }
}

export const settingsStore = new SettingsStore();
