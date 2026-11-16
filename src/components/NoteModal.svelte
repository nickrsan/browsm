<script lang="ts">
  import type { SchemaOrgPlace } from '@/types/schema';
  import type { OsmNote } from '@/types/auth';
  import { authStore } from '@/stores/auth.svelte';
  import { createOsmNote, formatNoteTextFromPlace } from '@/services/osm-notes';

  interface Props {
    place?: SchemaOrgPlace | null;
    initialLat?: number;
    initialLon?: number;
    isOpen?: boolean;
    onclose?: () => void;
    onsuccess?: (note: OsmNote) => void;
  }

  let {
    place = null,
    initialLat = 0,
    initialLon = 0,
    isOpen = false,
    onclose,
    onsuccess,
  }: Props = $props();

  let lat = $state(0);
  let lon = $state(0);
  let noteText = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | undefined>(undefined);
  let createdNote = $state<OsmNote | undefined>(undefined);

  $effect(() => {
    if (isOpen) {
      createdNote = undefined;
      errorMessage = undefined;
      if (place?.geo) {
        lat = place.geo.latitude;
        lon = place.geo.longitude;
      } else if (initialLat || initialLon) {
        lat = initialLat;
        lon = initialLon;
      }

      if (place) {
        noteText = formatNoteTextFromPlace(place);
      } else if (!noteText) {
        noteText = 'POI information reported via Browsm.';
      }
    }
  });

  async function handleSubmitNote() {
    if (!noteText.trim()) {
      errorMessage = 'Please enter note text before submitting.';
      return;
    }
    if (lat === 0 && lon === 0) {
      errorMessage = 'Invalid coordinates for Map Note.';
      return;
    }

    isSubmitting = true;
    errorMessage = undefined;

    try {
      const token = authStore.token?.accessToken;
      const note = await createOsmNote(
        {
          lat,
          lon,
          text: noteText.trim(),
        },
        token
      );

      createdNote = note;
      if (onsuccess) {
        onsuccess(note);
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    if (onclose) {
      onclose();
    }
  }
</script>

{#if isOpen}
  <div class="note-modal-overlay" data-testid="note-modal">
    <div class="note-modal-container">
      <div class="note-modal-header">
        <h3>Submit OpenStreetMap Note</h3>
        <button class="note-close-btn" onclick={handleClose} aria-label="Close dialog">×</button>
      </div>

      <div class="note-modal-body">
        {#if createdNote}
          <div class="note-success" data-testid="note-success-message">
            <div class="note-success-icon">✓</div>
            <h4>Map Note Created Successfully!</h4>
            <p>Your note has been placed on OpenStreetMap for local mappers to review.</p>
            <a
              href={createdNote.url}
              target="_blank"
              rel="noreferrer"
              class="note-link"
              data-testid="note-external-link"
            >
              View Note #{createdNote.id} on OpenStreetMap ↗
            </a>
            <div class="note-actions">
              <button class="note-btn-primary" onclick={handleClose}>Done</button>
            </div>
          </div>
        {:else}
          <p class="note-instructions">
            Notes allow you to report missing or outdated place information to the OSM community without directly editing map geometry.
          </p>

          <div class="note-coords-grid">
            <div class="note-field">
              <label for="note-lat">Latitude</label>
              <input id="note-lat" type="number" step="0.00001" bind:value={lat} />
            </div>
            <div class="note-field">
              <label for="note-lon">Longitude</label>
              <input id="note-lon" type="number" step="0.00001" bind:value={lon} />
            </div>
          </div>

          <div class="note-field">
            <label for="note-text">Note Message</label>
            <textarea
              id="note-text"
              rows="6"
              bind:value={noteText}
              placeholder="Describe the place or missing details..."
              data-testid="note-text-input"
            ></textarea>
          </div>

          {#if authStore.isAuthenticated && authStore.user}
            <div class="note-author-info">
              Submitting as: <strong>{authStore.user.username}</strong>
            </div>
          {:else}
            <div class="note-author-info text-muted">
              Submitting anonymously (or log in above to attribute to your account).
            </div>
          {/if}

          {#if errorMessage}
            <div class="note-error" data-testid="note-error-message">{errorMessage}</div>
          {/if}

          <div class="note-modal-footer">
            <button class="note-btn-secondary" onclick={handleClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button
              class="note-btn-primary"
              onclick={handleSubmitNote}
              disabled={isSubmitting}
              data-testid="note-submit-btn"
            >
              {#if isSubmitting}
                Submitting Note...
              {:else}
                Post Note to OSM
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .note-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 16px;
  }

  .note-modal-container {
    background: #ffffff;
    border-radius: 10px;
    width: 100%;
    max-width: 440px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #1e293b;
  }

  @media (prefers-color-scheme: dark) {
    .note-modal-container {
      background: #1e293b;
      color: #f1f5f9;
    }
  }

  .note-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
  }

  @media (prefers-color-scheme: dark) {
    .note-modal-header {
      border-color: #334155;
    }
  }

  .note-modal-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .note-close-btn {
    background: transparent;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #64748b;
    padding: 0 4px;
  }

  .note-modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .note-instructions {
    margin: 0;
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
  }

  .note-coords-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .note-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .note-field label {
    font-size: 12px;
    font-weight: 500;
  }

  .note-field input,
  .note-field textarea {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    background: #ffffff;
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .note-field input,
    .note-field textarea {
      background: #0f172a;
      border-color: #475569;
    }
  }

  .note-author-info {
    font-size: 12px;
    color: #334155;
  }

  @media (prefers-color-scheme: dark) {
    .note-author-info {
      color: #94a3b8;
    }
  }

  .note-error {
    color: #dc2626;
    font-size: 12px;
    background: #fef2f2;
    padding: 6px 10px;
    border-radius: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .note-error {
      background: #450a0a;
      color: #fca5a5;
    }
  }

  .note-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .note-btn-primary {
    background: #2e7d32;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .note-btn-primary:hover:not(:disabled) {
    background: #1b5e20;
  }

  .note-btn-secondary {
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    cursor: pointer;
  }

  @media (prefers-color-scheme: dark) {
    .note-btn-secondary {
      background: #334155;
      color: #e2e8f0;
      border-color: #475569;
    }
  }

  .note-success {
    text-align: center;
    padding: 16px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .note-success-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #2e7d32;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
  }

  .note-link {
    color: #2563eb;
    text-decoration: underline;
    font-size: 13px;
    margin: 6px 0 12px 0;
  }
</style>
