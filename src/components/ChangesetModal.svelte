<script lang="ts">
  import { onMount } from 'svelte';
  import { resolveApiEndpoint } from '@/services/endpoint-resolver';
  import { createChangeset, closeChangeset, createNode, updateNode, updateWayTags } from '@/services/osm-api';
  import { authStore } from '@/stores/auth.svelte';
  import { settingsStore } from '@/stores/settings.svelte';
  import type { OsmElement } from '@/types/osm';
  import type { ResolvedEndpoint } from '@/types/settings';

  interface Props {
    isOpen: boolean;
    stagedTags: Record<string, string>;
    targetElement?: OsmElement;
    coordinates?: { lat: number; lon: number };
    onClose: () => void;
    onSuccess?: (changesetId: number, elementId: number) => void;
  }

  const {
    isOpen = false,
    stagedTags = {},
    targetElement,
    coordinates,
    onClose,
    onSuccess,
  }: Props = $props();

  // Dialog state
  let resolvedEndpoint = $state<ResolvedEndpoint | null>(null);
  let comment = $state<string>('');
  let source = $state<string>('website');
  let isSubmitting = $state<boolean>(false);
  let submitProgress = $state<string>('');
  let errorMessage = $state<string | null>(null);
  let createdChangesetId = $state<number | null>(null);
  let resultElementId = $state<number | null>(null);

  // Compute clean tags (non-empty strings only)
  const cleanStagedTags = $derived(
    Object.fromEntries(
      Object.entries(stagedTags).filter(([k, v]) => k.trim().length > 0 && v.trim().length > 0)
    )
  );

  // Compute tag diffs for review
  const diffSummary = $derived.by(() => {
    const originalTags = targetElement?.tags || {};
    const added: Array<{ key: string; value: string }> = [];
    const modified: Array<{ key: string; oldValue: string; newValue: string }> = [];
    const deleted: Array<{ key: string; oldValue: string }> = [];

    // Check added and modified
    for (const [k, v] of Object.entries(cleanStagedTags)) {
      if (!(k in originalTags)) {
        added.push({ key: k, value: v });
      } else if (originalTags[k] !== v) {
        modified.push({ key: k, oldValue: originalTags[k], newValue: v });
      }
    }

    // Check deleted
    for (const [k, v] of Object.entries(originalTags)) {
      if (!(k in cleanStagedTags)) {
        deleted.push({ key: k, oldValue: v });
      }
    }

    return { added, modified, deleted };
  });

  const totalChangesCount = $derived(
    targetElement
      ? diffSummary.added.length + diffSummary.modified.length + diffSummary.deleted.length
      : Object.keys(cleanStagedTags).length
  );

  // Load endpoint resolution and initial comments on open
  $effect(() => {
    if (isOpen) {
      resolveApiEndpoint('write').then((endpoint) => {
        resolvedEndpoint = endpoint;
      });

      // Initialize comment
      const prefix = settingsStore.state.defaultChangesetCommentPrefix || 'Surveyed via Browsm';
      const name = cleanStagedTags.name || targetElement?.tags?.name;
      if (name) {
        comment = `${prefix}: ${name}`;
      } else {
        comment = prefix;
      }

      errorMessage = null;
      createdChangesetId = null;
      resultElementId = null;
      isSubmitting = false;
      submitProgress = '';
    }
  });

  async function handleCommit() {
    if (!comment.trim()) {
      errorMessage = 'Changeset comment is required.';
      return;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const endpoint = resolvedEndpoint || (await resolveApiEndpoint('write'));
      const token = endpoint.token?.accessToken;

      if (!token) {
        throw new Error(
          `You must be signed in to ${endpoint.config.name} to upload changesets. Please sign in via the header or settings.`
        );
      }

      const baseUrl = endpoint.config.apiBaseUrl;

      // 1. Create Changeset
      submitProgress = 'Creating changeset...';
      const changesetId = await createChangeset(
        token,
        {
          comment: comment.trim(),
          source: source.trim() || undefined,
          extraTags: {
            created_by: 'Browsm 0.1.0 (https://github.com/nicksantos/browsm)',
          },
        },
        baseUrl
      );
      createdChangesetId = changesetId;

      let elementId: number;
      try {
        // 2. Perform Element Create or Update
        if (targetElement) {
          submitProgress = `Updating ${targetElement.type} #${targetElement.id}...`;
          elementId = targetElement.id;

          if (targetElement.type === 'node') {
            await updateNode(
              token,
              {
                id: targetElement.id,
                version: targetElement.version,
                lat: targetElement.lat,
                lon: targetElement.lon,
                changesetId,
                tags: cleanStagedTags,
              },
              baseUrl
            );
          } else if (targetElement.type === 'way') {
            await updateWayTags(
              token,
              {
                id: targetElement.id,
                version: targetElement.version,
                changesetId,
                tags: cleanStagedTags,
                nodeRefs: [], // Keep existing geometry refs
              },
              baseUrl
            );
          }
        } else {
          submitProgress = 'Creating new POI node...';
          const lat = coordinates?.lat ?? 0;
          const lon = coordinates?.lon ?? 0;
          elementId = await createNode(
            token,
            {
              changesetId,
              lat,
              lon,
              tags: cleanStagedTags,
            },
            baseUrl
          );
        }

        resultElementId = elementId;
      } finally {
        // 3. Always close the changeset to prevent dangling open changesets
        submitProgress = 'Closing changeset...';
        try {
          await closeChangeset(token, changesetId, baseUrl);
        } catch (closeErr) {
          console.warn(`Failed to close changeset #${changesetId}:`, closeErr);
        }
      }

      submitProgress = 'Changeset successfully committed!';
      if (onSuccess) {
        onSuccess(changesetId, elementId);
      }
    } catch (err) {
      console.error('Failed to commit changeset:', err);
      errorMessage = (err as Error).message || 'Failed to upload changeset to OpenStreetMap.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if isOpen}
  <div
    class="modal-backdrop"
    onclick={onClose}
    onkeydown={(e) => {
      if (e.key === 'Escape') onClose();
    }}
    role="presentation"
  >
    <div
      class="modal-dialog"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="changeset-modal-title"
      tabindex="-1"
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-titles">
          <h2 id="changeset-modal-title" class="modal-title">Commit to OpenStreetMap</h2>
          {#if resolvedEndpoint}
            <span
              class="target-badge"
              class:badge-dev={resolvedEndpoint.isDevMode}
              class:badge-prod={!resolvedEndpoint.isDevMode}
            >
              Target: {resolvedEndpoint.config.name}
            </span>
          {/if}
        </div>
        <button
          type="button"
          class="btn-close"
          onclick={onClose}
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        {#if createdChangesetId !== null}
          <!-- Success View -->
          <div class="success-box">
            <div class="success-icon">🎉</div>
            <h3 class="success-title">Changeset Uploaded Successfully!</h3>
            <p class="success-desc">
              Your changes have been saved to <strong>{resolvedEndpoint?.config.name}</strong>.
            </p>

            <div class="links-list">
              <a
                href="{resolvedEndpoint?.config.webUrl}/changeset/{createdChangesetId}"
                target="_blank"
                rel="noopener noreferrer"
                class="external-link"
              >
                View Changeset #{createdChangesetId} ↗
              </a>

              {#if resultElementId}
                <a
                  href="{resolvedEndpoint?.config.webUrl}/{targetElement?.type || 'node'}/{resultElementId}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="external-link"
                >
                  View {targetElement?.type || 'Node'} #{resultElementId} ↗
                </a>
              {/if}
            </div>

            <button type="button" class="btn-primary btn-done" onclick={onClose}>
              Done
            </button>
          </div>
        {:else}
          <!-- Environment & Safety Warning -->
          {#if resolvedEndpoint}
            {#if resolvedEndpoint.isDevMode}
              <div class="banner banner-dev">
                <span class="banner-icon">🛡️</span>
                <div>
                  <strong>Developer Sandbox Active:</strong> All changes will be safely committed to
                  <code>{resolvedEndpoint.config.apiBaseUrl}</code> without modifying live production map data.
                </div>
              </div>
            {:else}
              <div class="banner banner-prod">
                <span class="banner-icon">⚠️</span>
                <div>
                  <strong>Live Production Warning:</strong> You are committing directly to the
                  live OpenStreetMap database. Ensure your edits are accurate and verifiable.
                </div>
              </div>
            {/if}
          {/if}

          <!-- Operation Target Summary -->
          <div class="summary-card">
            {#if targetElement}
              <div class="summary-line">
                <span class="summary-label">Target Element:</span>
                <span class="summary-val">
                  <strong>{targetElement.type} #{targetElement.id}</strong>
                  ({totalChangesCount} {totalChangesCount === 1 ? 'tag change' : 'tag changes'})
                </span>
              </div>
            {:else}
              <div class="summary-line">
                <span class="summary-label">Target Action:</span>
                <span class="summary-val">
                  <strong>Create New POI Node</strong> at ({coordinates?.lat?.toFixed(5)}, {coordinates?.lon?.toFixed(5)})
                  ({Object.keys(cleanStagedTags).length} tags)
                </span>
              </div>
            {/if}
          </div>

          <!-- Diff Review Section -->
          <div class="diff-preview-section">
            <h4 class="section-title">Staged Tag Modifications</h4>
            {#if totalChangesCount === 0}
              <p class="text-muted">No tag modifications staged.</p>
            {:else}
              <div class="diff-chips-list">
                {#each diffSummary.added as add}
                  <div class="diff-chip chip-added">
                    <span class="chip-op">+</span>
                    <span class="chip-key">{add.key}</span> =
                    <span class="chip-val">{add.value}</span>
                  </div>
                {/each}

                {#each diffSummary.modified as mod}
                  <div class="diff-chip chip-modified">
                    <span class="chip-op">⇄</span>
                    <span class="chip-key">{mod.key}</span>:
                    <span class="chip-old">{mod.oldValue}</span> →
                    <span class="chip-val">{mod.newValue}</span>
                  </div>
                {/each}

                {#each diffSummary.deleted as del}
                  <div class="diff-chip chip-deleted">
                    <span class="chip-op">-</span>
                    <span class="chip-key">{del.key}</span> (deleted)
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Changeset Metadata Form -->
          <div class="form-group">
            <label for="changeset-comment" class="form-label">
              Changeset Comment <span class="required">*</span>
            </label>
            <input
              id="changeset-comment"
              type="text"
              bind:value={comment}
              placeholder="e.g. Surveyed local business info via Browsm"
              class="form-input"
              disabled={isSubmitting}
            />
            <span class="form-hint">Briefly describe your edits for the OSM mapping community.</span>
          </div>

          <div class="form-group">
            <label for="changeset-source" class="form-label">Source</label>
            <input
              id="changeset-source"
              type="text"
              bind:value={source}
              placeholder="website, survey, etc."
              class="form-input"
              disabled={isSubmitting}
            />
          </div>

          <!-- Error Alert -->
          {#if errorMessage}
            <div class="alert alert-error" role="alert">
              ❌ {errorMessage}
            </div>
          {/if}

          <!-- Progress Status -->
          {#if isSubmitting}
            <div class="progress-box">
              <span class="spinner">⏳</span>
              <span class="progress-text">{submitProgress}</span>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Modal Footer -->
      {#if createdChangesetId === null}
        <div class="modal-footer">
          <button
            type="button"
            class="btn-secondary"
            onclick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn-primary"
            onclick={handleCommit}
            disabled={isSubmitting || totalChangesCount === 0 || !comment.trim()}
          >
            {isSubmitting ? 'Uploading...' : 'Confirm & Upload Changeset'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(2px);
    padding: 16px;
  }

  .modal-dialog {
    background: var(--bg-card, #ffffff);
    color: var(--text-primary, #1a1a1a);
    border-radius: 8px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .modal-dialog {
      background: var(--bg-card, #1e1e1e);
      color: var(--text-primary, #f0f0f0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
  }

  @media (prefers-color-scheme: dark) {
    .modal-header {
      border-color: #333333;
    }
  }

  .header-titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .target-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    display: inline-block;
  }

  .badge-dev {
    background: #fff3e0;
    color: #e65100;
  }

  .badge-prod {
    background: #e8f5e9;
    color: #2e7d32;
  }

  @media (prefers-color-scheme: dark) {
    .badge-dev {
      background: #3e2700;
      color: #ffb74d;
    }
    .badge-prod {
      background: #19381e;
      color: #81c784;
    }
  }

  .btn-close {
    background: transparent;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    padding: 4px;
  }

  .btn-close:hover {
    opacity: 1;
  }

  .modal-body {
    padding: 16px 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .modal-footer {
    padding: 12px 18px;
    border-top: 1px solid var(--border-color, #e0e0e0);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    background: var(--bg-footer, #fafafa);
  }

  @media (prefers-color-scheme: dark) {
    .modal-footer {
      border-color: #333333;
      background: #181818;
    }
  }

  .banner {
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .banner-dev {
    background: #fff8e1;
    color: #b78103;
    border: 1px solid #ffe082;
  }

  .banner-prod {
    background: #fbe9e7;
    color: #d84315;
    border: 1px solid #ffccbc;
  }

  @media (prefers-color-scheme: dark) {
    .banner-dev {
      background: #2b220b;
      color: #ffd54f;
      border-color: #4a3b12;
    }
    .banner-prod {
      background: #2c1611;
      color: #ff8a65;
      border-color: #4e271e;
    }
  }

  .summary-card {
    background: var(--bg-hover, #f8f9fa);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
  }

  @media (prefers-color-scheme: dark) {
    .summary-card {
      background: #252525;
      border-color: #333;
    }
  }

  .summary-line {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .summary-label {
    color: var(--text-secondary, #666);
    font-size: 12px;
  }

  .diff-preview-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .diff-chips-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 140px;
    overflow-y: auto;
    border: 1px solid var(--border-color, #eee);
    border-radius: 4px;
    padding: 8px;
    background: var(--bg-input, #fff);
  }

  @media (prefers-color-scheme: dark) {
    .diff-chips-list {
      background: #252525;
      border-color: #333;
    }
  }

  .diff-chip {
    font-size: 11px;
    font-family: monospace;
    padding: 3px 6px;
    border-radius: 3px;
    display: flex;
    gap: 4px;
    align-items: center;
    word-break: break-all;
  }

  .chip-added {
    background: #e8f5e9;
    color: #1b5e20;
  }

  .chip-modified {
    background: #e3f2fd;
    color: #0d47a1;
  }

  .chip-deleted {
    background: #ffebee;
    color: #b71c1c;
  }

  @media (prefers-color-scheme: dark) {
    .chip-added {
      background: #1b381e;
      color: #81c784;
    }
    .chip-modified {
      background: #102a43;
      color: #90caf9;
    }
    .chip-deleted {
      background: #3e1616;
      color: #ef9a9a;
    }
  }

  .chip-op {
    font-weight: bold;
  }

  .chip-key {
    font-weight: 600;
  }

  .chip-old {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .chip-val {
    font-weight: 600;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-label {
    font-size: 12px;
    font-weight: 600;
  }

  .required {
    color: #e53e3e;
  }

  .form-input {
    padding: 7px 10px;
    font-size: 13px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-input, #fff);
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .form-input {
      background: #282828;
      border-color: #444;
    }
  }

  .form-hint {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }

  @media (prefers-color-scheme: dark) {
    .form-hint {
      color: #999;
    }
  }

  .btn-primary {
    background: #2e7d32;
    color: #fff;
    border: none;
    padding: 7px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background: #1b5e20;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border-color, #ccc);
    padding: 7px 14px;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    color: inherit;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.05);
  }

  .alert-error {
    padding: 8px 12px;
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
    border-radius: 4px;
    font-size: 12px;
  }

  @media (prefers-color-scheme: dark) {
    .alert-error {
      background: #3b1414;
      color: #fca5a5;
      border-color: #5c2020;
    }
  }

  .progress-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 4px;
    font-size: 12px;
    color: #1e40af;
  }

  @media (prefers-color-scheme: dark) {
    .progress-box {
      background: #172554;
      border-color: #1e3a8a;
      color: #93c5fd;
    }
  }

  /* Success View */
  .success-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 20px 10px;
    gap: 12px;
  }

  .success-icon {
    font-size: 40px;
  }

  .success-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #15803d;
  }

  @media (prefers-color-scheme: dark) {
    .success-title {
      color: #4ade80;
    }
  }

  .success-desc {
    margin: 0;
    font-size: 13px;
    color: var(--text-secondary, #555);
  }

  .links-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0;
  }

  .external-link {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
    font-size: 13px;
  }

  .external-link:hover {
    text-decoration: underline;
  }

  @media (prefers-color-scheme: dark) {
    .external-link {
      color: #60a5fa;
    }
  }

  .btn-done {
    min-width: 120px;
    margin-top: 8px;
  }
</style>
