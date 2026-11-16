<script lang="ts">
  import { authStore } from '@/stores/auth.svelte';
  import { settingsStore } from '@/stores/settings.svelte';

  let isLoggingIn = $state(false);
  let loginErrorMessage = $state<string | undefined>(undefined);

  let targetEndpointName = $derived.by(() => {
    const targetId = authStore.activeTargetId;
    if (targetId === 'osm-dev') return 'OSM Dev Server';
    if (targetId === 'openhistoricalmap') return 'OpenHistoricalMap';
    if (targetId === 'custom') return settingsStore.customEndpoint?.name || 'Custom Server';
    return 'OpenStreetMap';
  });

  async function handleLogin() {
    isLoggingIn = true;
    loginErrorMessage = undefined;
    try {
      await authStore.login();
    } catch (err) {
      loginErrorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      isLoggingIn = false;
    }
  }

  async function handleLogout() {
    await authStore.logout();
  }
</script>

<div class="auth-header" data-testid="auth-header">
  {#if authStore.isLoading}
    <div class="auth-status-loading">
      <span class="auth-spinner"></span>
      <span>Checking {targetEndpointName} login status...</span>
    </div>
  {:else if authStore.isAuthenticated && authStore.user}
    <div class="auth-user-card" data-testid="auth-user-card">
      <div class="auth-user-info">
        {#if authStore.user.img}
          <img src={authStore.user.img} alt={authStore.user.username} class="auth-avatar" />
        {:else}
          <div class="auth-avatar-placeholder">{authStore.user.username.charAt(0).toUpperCase()}</div>
        {/if}
        <div class="auth-user-details">
          <div class="auth-user-name-row">
            <span class="auth-username" data-testid="auth-username">{authStore.user.username}</span>
            {#if settingsStore.badgeInfo.text}
              <span class="auth-target-badge badge-{settingsStore.badgeInfo.variant}" data-testid="auth-target-badge">
                {settingsStore.badgeInfo.text}
              </span>
            {/if}
          </div>
          <div class="auth-meta-row">
            {#if authStore.user.changesetCount !== undefined}
              <span class="auth-changeset-count">{authStore.user.changesetCount} changesets</span>
            {:else}
              <span class="auth-changeset-count">{targetEndpointName}</span>
            {/if}
          </div>
        </div>
      </div>
      <button class="auth-logout-btn" onclick={handleLogout} data-testid="auth-logout-btn">
        Log out
      </button>
    </div>
  {:else}
    <div class="auth-login-card" data-testid="auth-login-card">
      <div class="auth-login-prompt">
        <span>Log in to edit POIs or upload changesets to <strong>{targetEndpointName}</strong>.</span>
        {#if settingsStore.isDevMode}
          <span class="dev-mode-hint">(Sandbox mode active — edits will not affect live map data)</span>
        {/if}
      </div>
      <button
        class="auth-login-btn"
        onclick={handleLogin}
        disabled={isLoggingIn}
        data-testid="auth-login-btn"
      >
        {#if isLoggingIn}
          <span class="auth-spinner-small"></span> Logging in...
        {:else}
          Log in with {targetEndpointName}
        {/if}
      </button>
      {#if loginErrorMessage}
        <div class="auth-error" data-testid="auth-error">{loginErrorMessage}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .auth-header {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    font-size: 13px;
  }

  @media (prefers-color-scheme: dark) {
    .auth-header {
      background: #1e293b;
      border-color: #334155;
      color: #f1f5f9;
    }
  }

  .auth-status-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #64748b;
  }

  .auth-user-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .auth-user-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .auth-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }

  .auth-avatar-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #2563eb;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 13px;
  }

  .auth-user-details {
    display: flex;
    flex-direction: column;
  }

  .auth-user-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .auth-username {
    font-weight: 600;
    color: #0f172a;
  }

  .auth-target-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
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

  .dev-mode-hint {
    display: block;
    margin-top: 2px;
    color: #d97706;
    font-size: 11px;
    font-style: italic;
  }

  @media (prefers-color-scheme: dark) {
    .auth-username {
      color: #f8fafc;
    }
  }

  .auth-changeset-count {
    font-size: 11px;
    color: #64748b;
  }

  .auth-logout-btn {
    background: transparent;
    border: 1px solid #cbd5e1;
    color: #64748b;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .auth-logout-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }

  @media (prefers-color-scheme: dark) {
    .auth-logout-btn {
      border-color: #475569;
      color: #94a3b8;
    }
    .auth-logout-btn:hover {
      background: #334155;
      color: #f8fafc;
    }
  }

  .auth-login-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .auth-login-prompt {
    color: #475569;
    font-size: 12px;
    line-height: 1.4;
  }

  @media (prefers-color-scheme: dark) {
    .auth-login-prompt {
      color: #94a3b8;
    }
  }

  .auth-login-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: #2e7d32;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .auth-login-btn:hover:not(:disabled) {
    background: #1b5e20;
  }

  .auth-login-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .auth-error {
    margin-top: 4px;
    font-size: 11px;
    color: #dc2626;
  }

  .auth-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid #cbd5e1;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .auth-spinner-small {
    width: 12px;
    height: 12px;
    border: 2px solid #ffffff;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
