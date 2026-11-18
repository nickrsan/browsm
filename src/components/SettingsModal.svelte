<!--
  Quick Settings Modal / Drawer Component (Svelte 5 Runes)
  Allows instant environment switching and developer mode toggling without leaving the active mapping task.
-->
<script lang="ts">
  import { settingsStore } from '@/stores/settings.svelte';
  import { authStore } from '@/stores/auth.svelte';
  import {
    ENDPOINT_PRESETS,
    type EndpointPreset,
    type DevModeRouting,
  } from '@/types/settings';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
  }

  let { isOpen, onClose }: Props = $props();
  let activeAuth = $derived(authStore.currentAuthState);

  function openFullSettings() {
    if (typeof browser !== 'undefined' && browser.runtime?.openOptionsPage) {
      browser.runtime.openOptionsPage();
    } else if (typeof browser !== 'undefined' && browser.runtime?.getURL) {
      // @ts-ignore
      window.open(browser.runtime.getURL('/options.html'), '_blank');
    }
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={onClose} data-testid="settings-modal-backdrop">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="modal-dialog"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onclick={(e) => e.stopPropagation()}
      data-testid="settings-modal"
    >
      <header class="modal-header">
        <div class="header-title-row">
          <span class="header-icon">⚙️</span>
          <h2 id="settings-modal-title" class="modal-title">Quick Settings</h2>
        </div>
        <button
          type="button"
          class="close-btn"
          onclick={onClose}
          aria-label="Close settings"
          data-testid="close-settings-modal-btn"
        >
          ✕
        </button>
      </header>

      <div class="modal-body">
        <!-- Developer Mode Routing Selector -->
        <div class="setting-group">
          <label class="setting-label" for="dev-mode-select">Developer Mode Routing</label>
          <div class="radio-stack" role="radiogroup" aria-label="Developer Mode Routing">
            <label class="radio-card" class:active={settingsStore.devModeRouting === 'disabled'}>
              <input
                type="radio"
                name="quickDevMode"
                value="disabled"
                checked={settingsStore.devModeRouting === 'disabled'}
                onchange={() => settingsStore.setDevModeRouting('disabled')}
                data-testid="quick-devmode-disabled"
              />
              <div class="radio-text">
                <div class="radio-title">🟢 Live Production</div>
                <div class="radio-desc">Edits write directly to live OpenStreetMap.</div>
              </div>
            </label>

            <label class="radio-card" class:active={settingsStore.devModeRouting === 'writes_only'}>
              <input
                type="radio"
                name="quickDevMode"
                value="writes_only"
                checked={settingsStore.devModeRouting === 'writes_only'}
                onchange={() => settingsStore.setDevModeRouting('writes_only')}
                data-testid="quick-devmode-writes-only"
              />
              <div class="radio-text">
                <div class="radio-title">🟠 Writes Only (Sandbox Edits)</div>
                <div class="radio-desc">Read live OSM data; send test edits safely to Dev server.</div>
              </div>
            </label>

            <label class="radio-card" class:active={settingsStore.devModeRouting === 'reads_and_writes'}>
              <input
                type="radio"
                name="quickDevMode"
                value="reads_and_writes"
                checked={settingsStore.devModeRouting === 'reads_and_writes'}
                onchange={() => settingsStore.setDevModeRouting('reads_and_writes')}
                data-testid="quick-devmode-full"
              />
              <div class="radio-text">
                <div class="radio-title">🔴 Full Dev Sandbox</div>
                <div class="radio-desc">Read and write exclusively from OSM Dev sandbox.</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Target Backend Environment Preset -->
        <div class="setting-group">
          <label class="setting-label" for="quick-endpoint-select">API Target Endpoint</label>
          <select
            id="quick-endpoint-select"
            class="endpoint-select"
            value={settingsStore.activeEndpointId}
            onchange={(e) => settingsStore.setActiveEndpoint((e.target as HTMLSelectElement).value as EndpointPreset)}
            data-testid="quick-endpoint-select"
          >
            <option value="osm-prod">OpenStreetMap (Live Production)</option>
            <option value="osm-dev">OSM Dev Server (Sandbox)</option>
            <option value="openhistoricalmap">OpenHistoricalMap (OHM)</option>
            {#if settingsStore.customEndpoint}
              <option value="custom">Custom: {settingsStore.customEndpoint.name}</option>
            {/if}
          </select>
        </div>

        <!-- OSM Message Polling Interval -->
        <div class="setting-group">
          <label class="setting-label" for="quick-msg-poll-select">OSM Message Polling Interval</label>
          <select
            id="quick-msg-poll-select"
            class="endpoint-select"
            value={settingsStore.messagePollIntervalMinutes}
            onchange={(e) => settingsStore.setMessagePollInterval(Number((e.target as HTMLSelectElement).value))}
            data-testid="quick-msg-poll-select"
          >
            <option value={0}>Disabled (Manual only)</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes (Default)</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
        </div>

        <!-- Nearby Places Search Radius -->
        <div class="setting-group">
          <label class="setting-label" for="quick-radius-input">
            Nearby Places Search Radius: <strong>{settingsStore.nearbySearchRadius}m</strong>
          </label>
          <div class="range-control-row">
            <input
              id="quick-radius-input"
              type="range"
              min="10"
              max="500"
              step="10"
              value={settingsStore.nearbySearchRadius}
              oninput={(e) => settingsStore.setNearbySearchRadius(Number((e.target as HTMLInputElement).value))}
              class="radius-slider"
              data-testid="quick-radius-slider"
            />
            <span class="range-value-label">{settingsStore.nearbySearchRadius}m</span>
          </div>
          <p class="setting-helper">Max distance (10m - 500m, default 50m) for nearby OSM candidates.</p>
        </div>

        <!-- Current Target Auth Status -->
        <div class="auth-status-box" data-testid="quick-auth-status">
          <div class="auth-status-title">Target Environment Auth:</div>
          {#if activeAuth.isAuthenticated && activeAuth.user}
            <div class="auth-user-row">
              <span class="auth-status-indicator online">●</span>
              <span class="auth-username">{activeAuth.user.username}</span>
              <span class="auth-endpoint-tag">({authStore.activeTargetId})</span>
            </div>
          {:else}
            <div class="auth-user-row">
              <span class="auth-status-indicator offline">●</span>
              <span class="auth-unauth">Not signed in ({authStore.activeTargetId})</span>
            </div>
          {/if}
        </div>
      </div>

      <footer class="modal-footer">
        <button
          type="button"
          class="btn btn-link"
          onclick={openFullSettings}
          data-testid="open-full-options-btn"
        >
          Open Full Settings Dashboard ↗
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={onClose}
          data-testid="done-quick-settings-btn"
        >
          Done
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.45);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 16px;
    box-sizing: border-box;
  }

  .modal-dialog {
    background: #ffffff;
    border-radius: 8px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #fdfdfd;
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    font-size: 16px;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #212121;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: #757575;
    padding: 4px;
    border-radius: 4px;
  }

  .close-btn:hover {
    color: #212121;
    background: #eeeeee;
  }

  .modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .setting-label {
    font-size: 12px;
    font-weight: 600;
    color: #424242;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .radio-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .radio-card:hover {
    background: #f5f5f5;
  }

  .radio-card.active {
    background: #f1f8e9;
    border-color: #81c784;
    box-shadow: 0 0 0 1px #81c784;
  }

  .radio-card input {
    margin-top: 2px;
  }

  .radio-text {
    flex: 1;
  }

  .radio-title {
    font-size: 13px;
    font-weight: 600;
    color: #212121;
  }

  .radio-desc {
    font-size: 11px;
    color: #616161;
    margin-top: 2px;
    line-height: 1.3;
  }

  .endpoint-select {
    padding: 8px 10px;
    border: 1px solid #cccccc;
    border-radius: 6px;
    font-size: 13px;
    background: #ffffff;
    cursor: pointer;
  }

  .range-control-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .radius-slider {
    flex: 1;
    accent-color: #2e7d32;
    cursor: pointer;
  }

  .range-value-label {
    font-size: 13px;
    font-weight: 600;
    color: #2e7d32;
    min-width: 44px;
    text-align: right;
  }

  .setting-helper {
    font-size: 11px;
    color: #616161;
    margin: 4px 0 0 0;
    line-height: 1.3;
  }

  .auth-status-box {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 12px;
  }

  .auth-status-title {
    font-weight: 600;
    color: #616161;
    margin-bottom: 4px;
  }

  .auth-user-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .auth-status-indicator {
    font-size: 12px;
  }

  .auth-status-indicator.online {
    color: #2e7d32;
  }

  .auth-status-indicator.offline {
    color: #9e9e9e;
  }

  .auth-username {
    font-weight: 600;
    color: #212121;
  }

  .auth-endpoint-tag {
    color: #757575;
    font-size: 11px;
  }

  .auth-unauth {
    color: #757575;
    font-style: italic;
  }

  .modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid #e0e0e0;
    background: #fafafa;
  }

  .btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background-color 0.15s ease;
  }

  .btn-link {
    background: none;
    color: #1b5e20;
    padding: 0;
    text-decoration: underline;
    font-size: 12px;
  }

  .btn-link:hover {
    color: #2e7d32;
  }

  .btn-secondary {
    background: #e0e0e0;
    color: #212121;
  }

  .btn-secondary:hover {
    background: #d5d5d5;
  }
</style>
