<script lang="ts">
  import { onMount } from 'svelte';
  import NoteModal from '@/components/NoteModal.svelte';
  import { messaging } from '@/lib/messaging';
  import type { SchemaOrgPlace } from '@/types/schema';

  let detectedPlace = $state<SchemaOrgPlace | null>(null);
  let statusMessage = $state<string>('Scanning page for place markup...');
  let isNoteModalOpen = $state<boolean>(false);

  onMount(async () => {
    try {
      const storage = await browser.storage.local.get('currentSchema');
      if (storage?.currentSchema) {
        detectedPlace = storage.currentSchema as SchemaOrgPlace;
        statusMessage = '';
      } else {
        statusMessage = 'No Schema.org or Microdata place detected on this page.';
      }
    } catch {
      statusMessage = 'Ready to search OpenStreetMap.';
    }
  });

  async function openSidebarWorkspace() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTabId = tabs[0]?.id;

      if (import.meta.env.BROWSER === 'firefox') {
        // @ts-ignore
        if (browser.sidebarAction?.open) {
          // @ts-ignore
          await browser.sidebarAction.open();
        }
      } else if (import.meta.env.BROWSER === 'chrome' && activeTabId !== undefined) {
        // @ts-ignore
        if (browser.sidePanel?.open) {
          // @ts-ignore
          await browser.sidePanel.open({ tabId: activeTabId });
        }
      }
      window.close();
    } catch (err) {
      console.error('Failed to open sidebar from popup:', err);
    }
  }

  function handleSearchFromPopup() {
    if (detectedPlace) {
      const query = detectedPlace.name || detectedPlace.address?.streetAddress || '';
      if (query) {
        messaging.sendMessage('searchPoi', {
          query,
          source: 'schema_org',
        });
      }
    }
    openSidebarWorkspace();
  }
</script>

<main class="popup-container">
  <header class="popup-header">
    <div class="header-brand">
      <img src="/icon/browsm_32.png" alt="Browsm Logo" class="popup-logo" />
      <h2>Browsm</h2>
    </div>
    <span class="version-tag">v0.1.0</span>
  </header>

  {#if detectedPlace}
    <div class="place-card">
      <div class="place-header">
        <span class="badge-type">{detectedPlace.type}</span>
        <h3 class="place-name">{detectedPlace.name || 'Unnamed Place'}</h3>
      </div>

      {#if detectedPlace.address}
        <div class="detail-row">
          <span class="detail-label">Address:</span>
          <span class="detail-value">
            {[
              detectedPlace.address.streetAddress,
              detectedPlace.address.addressLocality,
              detectedPlace.address.postalCode,
            ].filter(Boolean).join(', ')}
          </span>
        </div>
      {/if}

      {#if detectedPlace.telephone}
        <div class="detail-row">
          <span class="detail-label">Phone:</span>
          <span class="detail-value">{detectedPlace.telephone}</span>
        </div>
      {/if}

      {#if detectedPlace.geo}
        <div class="detail-row">
          <span class="detail-label">Coords:</span>
          <span class="detail-value">{detectedPlace.geo.latitude.toFixed(5)}, {detectedPlace.geo.longitude.toFixed(5)}</span>
        </div>
      {/if}

      <div class="action-buttons">
        <button class="btn-primary" onclick={handleSearchFromPopup}>
          Verify in OSM
        </button>
        <button class="btn-note-popup" onclick={() => (isNoteModalOpen = true)}>
          Quick Add Note
        </button>
      </div>
    </div>
  {:else}
    <div class="empty-card">
      <p class="empty-text">{statusMessage}</p>
      <button class="btn-secondary" onclick={openSidebarWorkspace}>
        Open Sidebar Editor
      </button>
    </div>
  {/if}

  <NoteModal
    isOpen={isNoteModalOpen}
    place={detectedPlace}
    initialLat={detectedPlace?.geo?.latitude || 0}
    initialLon={detectedPlace?.geo?.longitude || 0}
    onclose={() => (isNoteModalOpen = false)}
  />
</main>

<style>
  .popup-container {
    width: 300px;
    padding: 12px;
    font-family: 'Noto Sans', Arial, Helvetica, sans-serif;
    color: #212121;
    background: #ffffff;
  }
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .popup-logo {
    width: 24px;
    height: 24px;
  }
  .popup-header h2 {
    font-size: 1.1em;
    margin: 0;
    color: #1b5e20;
  }
  .version-tag {
    font-size: 0.75em;
    color: #757575;
  }
  .place-card {
    background: #f9fbf9;
    border: 1px solid #c8e6c9;
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .badge-type {
    background: #2e7d32;
    color: #ffffff;
    font-size: 0.7em;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 3px;
    text-transform: uppercase;
    display: inline-block;
  }
  .place-name {
    font-size: 1em;
    margin: 4px 0 0 0;
    color: #1b5e20;
  }
  .detail-row {
    font-size: 0.82em;
    display: flex;
    gap: 6px;
  }
  .detail-label {
    color: #616161;
    font-weight: 500;
    min-width: 50px;
  }
  .detail-value {
    color: #212121;
    word-break: break-word;
  }
  .action-buttons {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .btn-primary {
    width: 100%;
    padding: 8px;
    background: #2e7d32;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover {
    background: #1b5e20;
  }
  .btn-note-popup {
    width: 100%;
    padding: 6px 8px;
    background: #0284c7;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.85em;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-note-popup:hover {
    background: #0369a1;
  }
  .empty-card {
    padding: 12px 6px;
    text-align: center;
  }
  .empty-text {
    font-size: 0.85em;
    color: #616161;
    margin-bottom: 12px;
  }
  .btn-secondary {
    padding: 8px 14px;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.85em;
    cursor: pointer;
  }
  .btn-secondary:hover {
    background: #0d47a1;
  }
</style>
