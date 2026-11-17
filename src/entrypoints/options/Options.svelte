<!--
  Browsm Options & Settings Dashboard (Svelte 5 Runes)
  Comprehensive management for API endpoints, Granular Developer Mode routing,
  per-endpoint OAuth credentials, and mapper preferences.
-->
<script lang="ts">
  import { settingsStore } from '@/stores/settings.svelte';
  import { authStore } from '@/stores/auth.svelte';
  import {
    ENDPOINT_PRESETS,
    validateEndpointConfig,
    type EndpointPreset,
    type DevModeRouting,
    type PreferredEditor,
    type EndpointConfig,
  } from '@/types/settings';

  // Custom endpoint form state
  let customName = $state(settingsStore.customEndpoint?.name || 'Local Rails Port');
  let customApiBaseUrl = $state(settingsStore.customEndpoint?.apiBaseUrl || 'http://127.0.0.1:3000/api/0.6');
  let customAuthUrl = $state(settingsStore.customEndpoint?.authUrl || 'http://127.0.0.1:3000/oauth2/authorize');
  let customTokenUrl = $state(settingsStore.customEndpoint?.tokenUrl || 'http://127.0.0.1:3000/oauth2/token');
  let customWebUrl = $state(settingsStore.customEndpoint?.webUrl || 'http://127.0.0.1:3000');
  let customClientId = $state(settingsStore.customEndpoint?.clientId || 'browsm-web-extension');

  let customErrors = $state<string[]>([]);
  let customSuccessMessage = $state<string | undefined>(undefined);
  let feedbackMessage = $state<string | undefined>(undefined);

  let prodAuth = $derived(authStore.getAuthStateFor('osm-prod'));
  let devAuth = $derived(authStore.getAuthStateFor('osm-dev'));
  let ohmAuth = $derived(authStore.getAuthStateFor('openhistoricalmap'));

  // Sync custom form if settingsStore updates
  $effect(() => {
    if (settingsStore.customEndpoint) {
      customName = settingsStore.customEndpoint.name;
      customApiBaseUrl = settingsStore.customEndpoint.apiBaseUrl;
      customAuthUrl = settingsStore.customEndpoint.authUrl;
      customTokenUrl = settingsStore.customEndpoint.tokenUrl;
      customWebUrl = settingsStore.customEndpoint.webUrl;
      customClientId = settingsStore.customEndpoint.clientId;
    }
  });

  function showFeedback(msg: string) {
    feedbackMessage = msg;
    setTimeout(() => {
      feedbackMessage = undefined;
    }, 3000);
  }

  async function handleSelectEndpoint(endpointId: EndpointPreset | string) {
    await settingsStore.setActiveEndpoint(endpointId);
    showFeedback(`Active endpoint switched to ${settingsStore.activeEndpointConfig.name}`);
  }

  async function handleSelectDevMode(routing: DevModeRouting) {
    await settingsStore.setDevModeRouting(routing);
    showFeedback(`Developer Mode routing updated to ${routing}`);
  }

  async function handleSaveCustomEndpoint() {
    customErrors = [];
    customSuccessMessage = undefined;

    const configToValidate: EndpointConfig = {
      id: 'custom',
      name: customName,
      description: 'User-configured custom instance',
      apiBaseUrl: customApiBaseUrl,
      authUrl: customAuthUrl,
      tokenUrl: customTokenUrl,
      webUrl: customWebUrl,
      clientId: customClientId,
      scopes: ['read_prefs', 'write_api', 'write_notes'],
    };

    const validation = validateEndpointConfig(configToValidate);
    if (!validation.isValid) {
      customErrors = validation.errors;
      return;
    }

    await settingsStore.setCustomEndpoint(configToValidate, true);
    customSuccessMessage = 'Custom endpoint configuration saved successfully!';
    showFeedback('Custom endpoint saved and activated.');
    setTimeout(() => {
      customSuccessMessage = undefined;
    }, 3000);
  }

  async function handleLogin(endpointId: string) {
    try {
      await authStore.login(endpointId);
      showFeedback(`Successfully signed in to ${endpointId}`);
    } catch (err) {
      console.error('Login error:', err);
    }
  }

  async function handleLogout(endpointId: string) {
    try {
      await authStore.logout(endpointId);
      showFeedback(`Signed out of ${endpointId}`);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  async function handleResetDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await settingsStore.resetToDefaults();
      showFeedback('All settings restored to default values.');
    }
  }
</script>

<div class="options-container" data-testid="options-page">
  <!-- Header -->
  <header class="options-header">
    <div class="header-brand">
      <img src="/icons/browsm_48.png" alt="Browsm Logo" class="brand-logo" onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')} />
      <div class="brand-titles">
        <h1 class="brand-name">Browsm Settings</h1>
        <p class="brand-subtitle">Multi-Endpoint Configuration & Developer Mode Routing</p>
      </div>
    </div>
    {#if settingsStore.badgeInfo.text}
      <div class="active-badge badge-{settingsStore.badgeInfo.variant}" data-testid="options-header-badge">
        {settingsStore.badgeInfo.text}
      </div>
    {/if}
  </header>

  <!-- Feedback Banner -->
  {#if feedbackMessage}
    <div class="feedback-banner" role="status" data-testid="feedback-toast">
      ✓ {feedbackMessage}
    </div>
  {/if}

  <main class="options-main">
    <!-- Section 1: Developer Mode & Sandbox Routing -->
    <section class="settings-card">
      <div class="card-header">
        <h2 class="card-title">1. Developer Mode & Safe Sandbox Routing</h2>
        <p class="card-desc">
          Safely test mapping workflows, note submissions, and changeset uploads without risking modifications to the live OpenStreetMap database.
        </p>
      </div>

      <div class="devmode-grid" role="radiogroup" aria-label="Developer Mode Routing">
        <!-- Disabled (Live) -->
        <label
          class="devmode-option"
          class:selected={settingsStore.devModeRouting === 'disabled'}
        >
          <input
            type="radio"
            name="devModeRouting"
            value="disabled"
            checked={settingsStore.devModeRouting === 'disabled'}
            onchange={() => handleSelectDevMode('disabled')}
            data-testid="devmode-disabled-radio"
          />
          <div class="option-content">
            <div class="option-header">
              <span class="status-dot dot-green"></span>
              <span class="option-name">Disabled (Live Production)</span>
            </div>
            <p class="option-desc">
              All reads and edits target the live OpenStreetMap database. Changesets directly update live map features.
            </p>
          </div>
        </label>

        <!-- Writes Only (Split Routing) -->
        <label
          class="devmode-option"
          class:selected={settingsStore.devModeRouting === 'writes_only'}
        >
          <input
            type="radio"
            name="devModeRouting"
            value="writes_only"
            checked={settingsStore.devModeRouting === 'writes_only'}
            onchange={() => handleSelectDevMode('writes_only')}
            data-testid="devmode-writes-only-radio"
          />
          <div class="option-content">
            <div class="option-header">
              <span class="status-dot dot-orange"></span>
              <span class="option-name">Writes Only (Safe Sandbox Edits)</span>
              <span class="tag-chip chip-recommended">Recommended for Testing</span>
            </div>
            <p class="option-desc">
              <strong>Reads:</strong> Queries live OSM production for real-world POIs and existing tags.<br />
              <strong>Writes:</strong> Routes all test changesets, node creations, and notes safely to the OSM Dev API sandbox.
            </p>
          </div>
        </label>

        <!-- Reads & Writes (Full Sandbox) -->
        <label
          class="devmode-option"
          class:selected={settingsStore.devModeRouting === 'reads_and_writes'}
        >
          <input
            type="radio"
            name="devModeRouting"
            value="reads_and_writes"
            checked={settingsStore.devModeRouting === 'reads_and_writes'}
            onchange={() => handleSelectDevMode('reads_and_writes')}
            data-testid="devmode-full-radio"
          />
          <div class="option-content">
            <div class="option-header">
              <span class="status-dot dot-red"></span>
              <span class="option-name">Full Dev Sandbox (Reads & Writes)</span>
            </div>
            <p class="option-desc">
              Both reads and writes target the OSM Dev API sandbox exclusively (<code>master.apis.dev.openstreetmap.org</code>).
            </p>
          </div>
        </label>
      </div>
    </section>

    <!-- Section 2: API Target & Backend Environment -->
    <section class="settings-card">
      <div class="card-header">
        <h2 class="card-title">2. Target Backend Environment</h2>
        <p class="card-desc">
          Choose the OpenStreetMap-compatible platform to target when developer mode is disabled.
        </p>
      </div>

      <div class="preset-grid" role="radiogroup" aria-label="API Endpoint Presets">
        <!-- OSM Production -->
        <label
          class="preset-card"
          class:selected={settingsStore.activeEndpointId === 'osm-prod'}
        >
          <input
            type="radio"
            name="activeEndpoint"
            value="osm-prod"
            checked={settingsStore.activeEndpointId === 'osm-prod'}
            onchange={() => handleSelectEndpoint('osm-prod')}
            data-testid="preset-osm-prod-radio"
          />
          <div class="preset-info">
            <div class="preset-title">OpenStreetMap (Live)</div>
            <div class="preset-url">https://api.openstreetmap.org/api/0.6</div>
            <div class="preset-desc">The primary global crowdsourced map database.</div>
          </div>
        </label>

        <!-- OSM Dev Server -->
        <label
          class="preset-card"
          class:selected={settingsStore.activeEndpointId === 'osm-dev'}
        >
          <input
            type="radio"
            name="activeEndpoint"
            value="osm-dev"
            checked={settingsStore.activeEndpointId === 'osm-dev'}
            onchange={() => handleSelectEndpoint('osm-dev')}
            data-testid="preset-osm-dev-radio"
          />
          <div class="preset-info">
            <div class="preset-title">OSM Dev Server (Sandbox)</div>
            <div class="preset-url">https://master.apis.dev.openstreetmap.org/api/0.6</div>
            <div class="preset-desc">Official sandbox environment for testing tools and scripts.</div>
          </div>
        </label>

        <!-- OpenHistoricalMap -->
        <label
          class="preset-card"
          class:selected={settingsStore.activeEndpointId === 'openhistoricalmap'}
        >
          <input
            type="radio"
            name="activeEndpoint"
            value="openhistoricalmap"
            checked={settingsStore.activeEndpointId === 'openhistoricalmap'}
            onchange={() => handleSelectEndpoint('openhistoricalmap')}
            data-testid="preset-ohm-radio"
          />
          <div class="preset-info">
            <div class="preset-title">OpenHistoricalMap</div>
            <div class="preset-url">https://www.openhistoricalmap.org/api/0.6</div>
            <div class="preset-desc">Historical geography and temporal mapping platform.</div>
          </div>
        </label>

        <!-- Custom Instance -->
        <label
          class="preset-card"
          class:selected={settingsStore.activeEndpointId === 'custom'}
        >
          <input
            type="radio"
            name="activeEndpoint"
            value="custom"
            checked={settingsStore.activeEndpointId === 'custom'}
            onchange={() => handleSelectEndpoint('custom')}
            data-testid="preset-custom-radio"
          />
          <div class="preset-info">
            <div class="preset-title">Custom Instance</div>
            <div class="preset-url">{customApiBaseUrl || 'User Defined Server'}</div>
            <div class="preset-desc">Local development server or private regional OSM deployment.</div>
          </div>
        </label>
      </div>

      <!-- Custom Configuration Form -->
      {#if settingsStore.activeEndpointId === 'custom'}
        <div class="custom-form-container" data-testid="custom-endpoint-form">
          <h3 class="custom-form-title">Custom Server Parameters</h3>

          {#if customErrors.length > 0}
            <div class="error-banner" data-testid="custom-form-errors">
              {#each customErrors as err}
                <div>• {err}</div>
              {/each}
            </div>
          {/if}

          {#if customSuccessMessage}
            <div class="success-banner">{customSuccessMessage}</div>
          {/if}

          <div class="form-grid">
            <div class="form-group">
              <label for="custom-name">Server Name</label>
              <input
                id="custom-name"
                type="text"
                bind:value={customName}
                placeholder="Local Rails Port"
              />
            </div>

            <div class="form-group">
              <label for="custom-api">API 0.6 Base URL</label>
              <input
                id="custom-api"
                type="url"
                bind:value={customApiBaseUrl}
                placeholder="http://127.0.0.1:3000/api/0.6"
              />
            </div>

            <div class="form-group">
              <label for="custom-auth">OAuth Authorize URL</label>
              <input
                id="custom-auth"
                type="url"
                bind:value={customAuthUrl}
                placeholder="http://127.0.0.1:3000/oauth2/authorize"
              />
            </div>

            <div class="form-group">
              <label for="custom-token">OAuth Token URL</label>
              <input
                id="custom-token"
                type="url"
                bind:value={customTokenUrl}
                placeholder="http://127.0.0.1:3000/oauth2/token"
              />
            </div>

            <div class="form-group">
              <label for="custom-web">Web / Portal URL</label>
              <input
                id="custom-web"
                type="url"
                bind:value={customWebUrl}
                placeholder="http://127.0.0.1:3000"
              />
            </div>

            <div class="form-group">
              <label for="custom-client">OAuth Client ID</label>
              <input
                id="custom-client"
                type="text"
                bind:value={customClientId}
                placeholder="browsm-web-extension"
              />
            </div>
          </div>

          <div class="custom-form-actions">
            <button
              type="button"
              class="btn btn-primary"
              onclick={handleSaveCustomEndpoint}
              data-testid="save-custom-btn"
            >
              Save & Apply Custom Configuration
            </button>
          </div>
        </div>
      {/if}
    </section>

    <!-- Section 3: Accounts & Authentication Manager (Per Endpoint) -->
    <section class="settings-card">
      <div class="card-header">
        <h2 class="card-title">3. Account & Authentication Manager</h2>
        <p class="card-desc">
          Manage OAuth 2.0 PKCE logins for each environment independently. You can stay logged into production, sandbox, and historical mapping platforms simultaneously.
        </p>
      </div>

      <div class="accounts-grid" data-testid="accounts-manager">
        <!-- OSM Production Account -->
        <div class="account-card" data-testid="account-card-osm-prod">
          <div class="account-info">
            <div class="account-badge-title">OpenStreetMap (Live)</div>
            {#if prodAuth.isAuthenticated && prodAuth.user}
              <div class="user-profile">
                {#if prodAuth.user.img}
                  <img src={prodAuth.user.img} alt="Avatar" class="user-avatar" />
                {:else}
                  <div class="avatar-placeholder">{prodAuth.user.username.charAt(0).toUpperCase()}</div>
                {/if}
                <div class="user-meta">
                  <div class="username">{prodAuth.user.username}</div>
                  <div class="user-extra">
                    {#if prodAuth.user.changesetCount !== undefined}
                      {prodAuth.user.changesetCount} changesets
                    {/if}
                  </div>
                </div>
              </div>
            {:else}
              <div class="unauthenticated-text">Not signed in</div>
            {/if}
          </div>
          <div class="account-actions">
            {#if prodAuth.isAuthenticated}
              <button
                type="button"
                class="btn btn-outline"
                onclick={() => handleLogout('osm-prod')}
                data-testid="logout-osm-prod-btn"
              >
                Log Out
              </button>
            {:else}
              <button
                type="button"
                class="btn btn-primary"
                onclick={() => handleLogin('osm-prod')}
                data-testid="login-osm-prod-btn"
              >
                Sign In with OSM
              </button>
            {/if}
          </div>
        </div>

        <!-- OSM Dev Server Account -->
        <div class="account-card" data-testid="account-card-osm-dev">
          <div class="account-info">
            <div class="account-badge-title">OSM Dev Server (Sandbox)</div>
            {#if devAuth.isAuthenticated && devAuth.user}
              <div class="user-profile">
                {#if devAuth.user.img}
                  <img src={devAuth.user.img} alt="Avatar" class="user-avatar" />
                {:else}
                  <div class="avatar-placeholder">{devAuth.user.username.charAt(0).toUpperCase()}</div>
                {/if}
                <div class="user-meta">
                  <div class="username">{devAuth.user.username}</div>
                  <div class="user-extra">Dev Sandbox Account</div>
                </div>
              </div>
            {:else}
              <div class="unauthenticated-text">Not signed in</div>
            {/if}
          </div>
          <div class="account-actions">
            {#if devAuth.isAuthenticated}
              <button
                type="button"
                class="btn btn-outline"
                onclick={() => handleLogout('osm-dev')}
                data-testid="logout-osm-dev-btn"
              >
                Log Out
              </button>
            {:else}
              <button
                type="button"
                class="btn btn-primary"
                onclick={() => handleLogin('osm-dev')}
                data-testid="login-osm-dev-btn"
              >
                Sign In with Dev API
              </button>
            {/if}
          </div>
        </div>

        <!-- OpenHistoricalMap Account -->
        <div class="account-card" data-testid="account-card-openhistoricalmap">
          <div class="account-info">
            <div class="account-badge-title">OpenHistoricalMap</div>
            {#if ohmAuth.isAuthenticated && ohmAuth.user}
              <div class="user-profile">
                {#if ohmAuth.user.img}
                  <img src={ohmAuth.user.img} alt="Avatar" class="user-avatar" />
                {:else}
                  <div class="avatar-placeholder">{ohmAuth.user.username.charAt(0).toUpperCase()}</div>
                {/if}
                <div class="user-meta">
                  <div class="username">{ohmAuth.user.username}</div>
                  <div class="user-extra">Historical Mapper</div>
                </div>
              </div>
            {:else}
              <div class="unauthenticated-text">Not signed in</div>
            {/if}
          </div>
          <div class="account-actions">
            {#if ohmAuth.isAuthenticated}
              <button
                type="button"
                class="btn btn-outline"
                onclick={() => handleLogout('openhistoricalmap')}
                data-testid="logout-ohm-btn"
              >
                Log Out
              </button>
            {:else}
              <button
                type="button"
                class="btn btn-primary"
                onclick={() => handleLogin('openhistoricalmap')}
                data-testid="login-ohm-btn"
              >
                Sign In with OHM
              </button>
            {/if}
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: General Preferences -->
    <section class="settings-card">
      <div class="card-header">
        <h2 class="card-title">4. Mapping Preferences</h2>
      </div>

      <div class="pref-form">
        <div class="form-group">
          <label for="comment-prefix">Default Changeset Comment Prefix</label>
          <input
            id="comment-prefix"
            type="text"
            value={settingsStore.defaultChangesetCommentPrefix || 'Surveyed via Browsm'}
            onchange={(e) => settingsStore.setDefaultChangesetCommentPrefix((e.target as HTMLInputElement).value)}
            data-testid="changeset-prefix-input"
          />
          <small class="field-hint">Automatically added to the beginning of changeset descriptions.</small>
        </div>

        <div class="form-group">
          <label for="preferred-editor">Preferred External Editor</label>
          <select
            id="preferred-editor"
            value={settingsStore.preferredEditor}
            onchange={(e) => settingsStore.setPreferredEditor((e.target as HTMLSelectElement).value as PreferredEditor)}
            data-testid="preferred-editor-select"
          >
            <option value="id">iD Web Editor (openstreetmap.org/edit)</option>
            <option value="rapid">Rapid Editor (rapideditor.org)</option>
            <option value="josm">JOSM via Remote Control (localhost:8111)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="msg-poll-interval">OSM Message Polling Interval</label>
          <select
            id="msg-poll-interval"
            value={settingsStore.messagePollIntervalMinutes}
            onchange={(e) => settingsStore.setMessagePollInterval(Number((e.target as HTMLSelectElement).value))}
            data-testid="msg-poll-interval-select"
          >
            <option value={0}>Disabled (Manual only)</option>
            <option value={5}>Every 5 minutes</option>
            <option value={10}>Every 10 minutes (Default)</option>
            <option value={15}>Every 15 minutes</option>
            <option value={30}>Every 30 minutes</option>
            <option value={60}>Every 60 minutes</option>
          </select>
          <small class="field-hint">
            Periodically checks for new direct messages and changeset discussions while the sidebar is open.
          </small>
        </div>
      </div>

      <div class="card-footer">
        <button
          type="button"
          class="btn btn-danger"
          onclick={handleResetDefaults}
          data-testid="reset-defaults-btn"
        >
          Reset All Settings to Defaults
        </button>
      </div>
    </section>
  </main>
</div>

<style>
  .options-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px 16px 64px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #212121;
  }

  .options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .brand-logo {
    width: 48px;
    height: 48px;
    border-radius: 8px;
  }

  .brand-name {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #1b5e20;
  }

  .brand-subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: #616161;
  }

  .active-badge {
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .badge-warning {
    background-color: #fff3e0;
    color: #e65100;
    border: 1px solid #ffe082;
  }

  .badge-danger {
    background-color: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
  }

  .badge-purple {
    background-color: #f3e5f5;
    color: #6a1b9a;
    border: 1px solid #e1bee7;
  }

  .badge-teal {
    background-color: #e0f2f1;
    color: #00695c;
    border: 1px solid #b2dfdb;
  }

  .badge-default {
    background-color: #e8f5e9;
    color: #2e7d32;
  }

  .feedback-banner {
    background-color: #e8f5e9;
    color: #1b5e20;
    border: 1px solid #a5d6a7;
    border-radius: 6px;
    padding: 10px 16px;
    margin-bottom: 20px;
    font-weight: 500;
    font-size: 14px;
  }

  .options-main {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .settings-card {
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .card-header {
    margin-bottom: 16px;
  }

  .card-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333333;
  }

  .card-desc {
    margin: 4px 0 0;
    font-size: 13px;
    color: #666666;
    line-height: 1.4;
  }

  /* DevMode Routing Grid */
  .devmode-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .devmode-option {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .devmode-option:hover {
    background: #f5f5f5;
    border-color: #bdbdbd;
  }

  .devmode-option.selected {
    background: #f1f8e9;
    border-color: #81c784;
    box-shadow: 0 0 0 1px #81c784;
  }

  .devmode-option input[type="radio"] {
    margin-top: 3px;
  }

  .option-content {
    flex: 1;
  }

  .option-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .option-name {
    font-weight: 600;
    font-size: 14px;
    color: #212121;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot-green { background-color: #4caf50; }
  .dot-orange { background-color: #ff9800; }
  .dot-red { background-color: #f44336; }

  .tag-chip {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .chip-recommended {
    background-color: #fff3e0;
    color: #e65100;
  }

  .option-desc {
    margin: 0;
    font-size: 13px;
    color: #555555;
    line-height: 1.4;
  }

  /* Presets Grid */
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .preset-card {
    display: flex;
    flex-direction: column;
    padding: 14px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fafafa;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preset-card:hover {
    background: #f5f5f5;
    border-color: #bdbdbd;
  }

  .preset-card.selected {
    background: #e8f5e9;
    border-color: #4caf50;
    box-shadow: 0 0 0 1px #4caf50;
  }

  .preset-card input[type="radio"] {
    margin-bottom: 8px;
    align-self: flex-start;
  }

  .preset-title {
    font-weight: 600;
    font-size: 14px;
    color: #212121;
  }

  .preset-url {
    font-size: 11px;
    color: #757575;
    word-break: break-all;
    margin: 2px 0 6px;
    font-family: monospace;
  }

  .preset-desc {
    font-size: 12px;
    color: #616161;
    line-height: 1.3;
  }

  /* Custom Form */
  .custom-form-container {
    margin-top: 16px;
    padding: 16px;
    background: #f9f9f9;
    border: 1px dashed #bdbdbd;
    border-radius: 6px;
  }

  .custom-form-title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: #424242;
  }

  .form-group input,
  .form-group select {
    padding: 8px 10px;
    border: 1px solid #cccccc;
    border-radius: 4px;
    font-size: 13px;
  }

  .field-hint {
    font-size: 11px;
    color: #757575;
  }

  .custom-form-actions {
    margin-top: 14px;
  }

  .error-banner {
    background-color: #ffebee;
    color: #c62828;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 12px;
  }

  .success-banner {
    background-color: #e8f5e9;
    color: #2e7d32;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    margin-bottom: 12px;
  }

  /* Accounts Grid */
  .accounts-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .account-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fafafa;
  }

  .account-badge-title {
    font-weight: 600;
    font-size: 13px;
    color: #424242;
    margin-bottom: 6px;
  }

  .user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }

  .avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: #388e3c;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
  }

  .username {
    font-weight: 600;
    font-size: 14px;
    color: #212121;
  }

  .user-extra {
    font-size: 12px;
    color: #757575;
  }

  .unauthenticated-text {
    font-size: 13px;
    color: #9e9e9e;
    font-style: italic;
  }

  /* Buttons */
  .btn {
    padding: 8px 14px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s ease;
  }

  .btn-primary {
    background-color: #2e7d32;
    color: #ffffff;
  }

  .btn-primary:hover {
    background-color: #1b5e20;
  }

  .btn-outline {
    background-color: transparent;
    border: 1px solid #bdbdbd;
    color: #424242;
  }

  .btn-outline:hover {
    background-color: #eeeeee;
  }

  .btn-danger {
    background-color: #ffebee;
    color: #c62828;
    border: 1px solid #ffcdd2;
  }

  .btn-danger:hover {
    background-color: #ffcdd2;
  }

  .card-footer {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid #eeeeee;
    display: flex;
    justify-content: flex-end;
  }
</style>
