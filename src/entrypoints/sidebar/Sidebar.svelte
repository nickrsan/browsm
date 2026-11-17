<script lang="ts">
  import { onMount } from 'svelte';
  import MapLibreMap from '@/components/MapLibreMap.svelte';
  import AuthHeader from '@/components/AuthHeader.svelte';
  import NoteModal from '@/components/NoteModal.svelte';
  import SettingsModal from '@/components/SettingsModal.svelte';
  import ChangesetModal from '@/components/ChangesetModal.svelte';
  import TagDiffTable from '@/components/TagDiffTable.svelte';
  import { settingsStore } from '@/stores/settings.svelte';
  import { authStore } from '@/stores/auth.svelte';
  import { messaging } from '@/lib/messaging';
  import { convertSchemaPlaceToOsmTags } from '@/services/tag-normalizer';
  import { generateTagDiff, fetchOsmElementsInBbox, calculateBboxAroundCoords, findBestMatch } from '@/services/spatial-matcher';
  import { launchEditor, type EditorLaunchResult } from '@/services/external-editors';
  import type { NominatimResult, OsmElement } from '@/types/osm';
  import type { EditorWorkflowState } from '@/types/messaging';
  import type { MapMarker, MapStructure } from '@/types/map';
  import type { SearchSessionState, TagDiffItem, TagDiffAction } from '@/types/diff';
  import type { SchemaOrgPlace } from '@/types/schema';
  import type { PreferredEditor } from '@/types/settings';

  /**
   * Reactive state for vector map coordinates, zoom, markers, and building structures
   */
  let mapCenter = $state<[number, number]>([0, 0]); // [lon, lat]
  let mapZoom = $state<number>(1);
  let markers = $state<MapMarker[]>([]);
  let structures = $state<MapStructure[]>([]);
  let selectedElementId = $state<string | number | null>(null);
  let selectedElement = $state<OsmElement | null>(null);

  /**
   * Reactive state for sidebar workflow, search input, and place details
   */
  let status = $state<EditorWorkflowState>('instructions');
  let searchQuery = $state<string>('');
  let displayName = $state<string>('');
  let fullResponse = $state<string>('');
  let showFullResponse = $state<boolean>(false);
  let showEditInfo = $state<boolean>(false);
  let lastOsmResponse = $state<NominatimResult | null>(null);
  let lastTimestamp = $state<number>(0);
  let nearbyElementsList = $state<OsmElement[]>([]);
  let detectedPagePlace = $state<SchemaOrgPlace | null>(null);

  /**
   * Staged tag modifications and comparison matrix state
   */
  let stagedTags = $state<Record<string, string>>({});
  let diffItems = $state<TagDiffItem[]>([]);
  let activeTab = $state<'diff' | 'nearby' | 'raw'>('diff');

  /**
   * Modals and editor controls state
   */
  let isNoteModalOpen = $state<boolean>(false);
  let isSettingsModalOpen = $state<boolean>(false);
  let isChangesetModalOpen = $state<boolean>(false);
  let isEditorDropdownOpen = $state<boolean>(false);
  let editorFeedback = $state<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  /**
   * Computes the diff items between page metadata and a selected OSM element (or new node).
   */
  function computeDiffs(elem: OsmElement | null, pagePlace: SchemaOrgPlace | null) {
    const pageTags = pagePlace ? convertSchemaPlaceToOsmTags(pagePlace) : {};

    if (elem) {
      const generated = generateTagDiff(pageTags, elem);
      diffItems = generated;
      const initialStaged: Record<string, string> = {};
      for (const item of generated) {
        if (item.stagedValue) {
          initialStaged[item.key] = item.stagedValue;
        }
      }
      stagedTags = initialStaged;
    } else {
      // Adding new POI: all page tags are staged
      const items: TagDiffItem[] = [];
      const initialStaged: Record<string, string> = {};

      for (const [k, v] of Object.entries(pageTags)) {
        if (v) {
          items.push({
            key: k,
            sourceValue: v,
            osmValue: undefined,
            stagedValue: v,
            status: 'missing_in_osm',
            action: 'apply',
          });
          initialStaged[k] = v;
        }
      }
      diffItems = items;
      stagedTags = initialStaged;
    }
  }

  /**
   * Converts OSM elements into MapMarker and MapStructure items for the vector map.
   */
  function populateMapElements(
    elements: OsmElement[],
    primaryLat?: number,
    primaryLon?: number,
    primaryTitle?: string,
    primaryId?: string
  ) {
    const newMarkers: MapMarker[] = [];
    const newStructures: MapStructure[] = [];

    // Add primary marker if coordinates provided
    if (primaryLat !== undefined && primaryLon !== undefined && !Number.isNaN(primaryLat) && !Number.isNaN(primaryLon)) {
      newMarkers.push({
        id: primaryId || 'primary-result',
        lat: primaryLat,
        lon: primaryLon,
        title: primaryTitle || 'Selected Place',
        category: 'matched',
      });
    }

    // Process nearby elements
    for (const el of elements) {
      if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
        newStructures.push({
          id: el.id,
          name: el.tags.name || el.tags.building || 'Building',
          geometry: el.geometry,
          tags: el.tags,
          isStructure: el.isStructure ?? true,
          element: el,
        });
      } else if (el.type === 'node') {
        // Skip duplicate if it matches primary ID
        if (primaryId && String(el.id) === String(primaryId)) continue;

        newMarkers.push({
          id: el.id,
          lat: el.lat,
          lon: el.lon,
          title: el.tags.name || el.tags.amenity || el.tags.shop || `Node ${el.id}`,
          category: 'nearby',
          element: el,
        });
      }
    }

    markers = newMarkers;
    structures = newStructures;
    nearbyElementsList = elements;
  }

  /**
   * Selects an OSM element (or null for new POI creation) and refreshes tag diff matrix.
   */
  function selectElement(elem: OsmElement | null) {
    selectedElement = elem;
    selectedElementId = elem ? elem.id : null;
    computeDiffs(elem, detectedPagePlace);
  }

  /**
   * Updates sidebar reactive state and centers the vector map from received payloads.
   */
  function updateFromPayload(payload: {
    state?: EditorWorkflowState;
    lat?: number | string;
    lon?: number | string;
    display_name?: string;
    osm_id?: string;
    osm_type?: string;
    full_response?: NominatimResult | Record<string, unknown>;
    timestamp?: number;
    nearbyElements?: OsmElement[];
    matchedElementId?: string;
  }) {
    if (payload.timestamp && payload.timestamp <= lastTimestamp) {
      return;
    }
    if (payload.timestamp) {
      lastTimestamp = payload.timestamp;
    }

    if (payload.nearbyElements) {
      nearbyElementsList = payload.nearbyElements;
    }

    if (payload.state === 'searching') {
      status = 'searching';
    } else if (payload.state === 'response' || payload.lat !== undefined) {
      status = 'response';
      const parsedLat = payload.lat !== undefined ? Number(payload.lat) : undefined;
      const parsedLon = payload.lon !== undefined ? Number(payload.lon) : undefined;
      const name = payload.display_name || '';

      displayName = name;
      lastOsmResponse = (payload.full_response as NominatimResult) || null;
      fullResponse = payload.full_response
        ? JSON.stringify(payload.full_response, null, 2)
        : 'No usable response from Nominatim, or an error occurred.';
      showEditInfo = Boolean(payload.osm_id);

      if (parsedLat !== undefined && parsedLon !== undefined && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLon)) {
        mapCenter = [parsedLon, parsedLat];
        mapZoom = 16;
        populateMapElements(nearbyElementsList, parsedLat, parsedLon, name, payload.osm_id);

        // Check if an explicit matchedElementId was resolved
        if (payload.matchedElementId && nearbyElementsList.length > 0) {
          const directMatch = nearbyElementsList.find(
            (el) => `${el.type}/${el.id}` === payload.matchedElementId || String(el.id) === payload.matchedElementId
          );
          if (directMatch) {
            selectElement(directMatch);
            return;
          }
        }

        // Find candidate match or initialize new node
        if (nearbyElementsList.length > 0) {
          const matchResult = findBestMatch(
            {
              name: name || detectedPagePlace?.name,
              lat: parsedLat,
              lon: parsedLon,
              osmId: payload.osm_id,
              osmType: payload.osm_type,
              phone: detectedPagePlace?.telephone,
              website: detectedPagePlace?.url,
            },
            nearbyElementsList
          );
          if (matchResult.matchedElement) {
            selectElement(matchResult.matchedElement);
          } else if (payload.osm_id) {
            const idMatch = nearbyElementsList.find((el) => String(el.id) === String(payload.osm_id));
            if (idMatch) {
              selectElement(idMatch);
            } else {
              selectElement(null);
            }
          } else {
            selectElement(null);
          }
        } else {
          selectElement(null);
        }
      } else {
        mapCenter = [0, 0];
        mapZoom = 1;
        markers = [];
        structures = [];
        selectElement(null);
      }
    }
  }

  /**
   * Executes a direct search query from the sidebar search input.
   */
  function handleDirectSearch(e?: Event) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    status = 'searching';
    messaging.sendMessage('searchPoi', {
      query,
      source: 'manual_search',
    });
  }

  /**
   * Loads a detected page schema into the search and diff pipeline.
   */
  function handleInspectPagePlace() {
    if (!detectedPagePlace) return;

    const query =
      detectedPagePlace.name ||
      [
        detectedPagePlace.address?.streetAddress,
        detectedPagePlace.address?.addressLocality,
        detectedPagePlace.address?.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

    if (query) {
      searchQuery = query;
      status = 'searching';
      messaging.sendMessage('searchPoi', {
        query,
        source: 'schema_org',
      });
    }
  }

  /**
   * Updates an individual tag key's staged value in the matrix.
   */
  function handleUpdateTag(key: string, value: string, action: TagDiffAction = 'custom') {
    stagedTags = {
      ...stagedTags,
      [key]: value,
    };

    // Update diff items
    diffItems = diffItems.map((item) => {
      if (item.key === key) {
        return {
          ...item,
          stagedValue: value,
          action,
        };
      }
      return item;
    });
  }

  /**
   * Deletes / removes a tag from the staged modification set.
   */
  function handleDeleteTag(key: string) {
    if (selectedElement?.tags && key in selectedElement.tags) {
      // If tag existed in original OSM entity, mark staged as empty string for deletion
      handleUpdateTag(key, '', 'custom');
    } else {
      // Remove completely from staged tags
      const updated = { ...stagedTags };
      delete updated[key];
      stagedTags = updated;
      diffItems = diffItems.filter((i) => i.key !== key);
    }
  }

  /**
   * Adds a new custom tag key and value to the staging list.
   */
  function handleAddCustomTag(key: string, value: string) {
    stagedTags = {
      ...stagedTags,
      [key]: value,
    };

    const existingIndex = diffItems.findIndex((i) => i.key === key);
    if (existingIndex >= 0) {
      diffItems[existingIndex].stagedValue = value;
      diffItems = [...diffItems];
    } else {
      diffItems = [
        ...diffItems,
        {
          key,
          sourceValue: undefined,
          osmValue: undefined,
          stagedValue: value,
          status: 'new_in_page',
          action: 'custom',
        },
      ];
    }
  }

  /**
   * Applies all suggested values from webpage metadata into staged tags.
   */
  function handleApplyAllSuggested() {
    const updated = { ...stagedTags };
    for (const item of diffItems) {
      if (item.sourceValue && item.stagedValue !== item.sourceValue) {
        updated[item.key] = item.sourceValue;
        item.stagedValue = item.sourceValue;
        item.action = 'apply';
      }
    }
    stagedTags = updated;
    diffItems = [...diffItems];
  }

  /**
   * Resets all staged tags back to original OSM values.
   */
  function handleResetAll() {
    computeDiffs(selectedElement, detectedPagePlace);
  }

  /**
   * Launches an external editor (iD, Rapid, JOSM Remote Control).
   */
  async function handleLaunchEditor(editor: PreferredEditor) {
    isEditorDropdownOpen = false;
    editorFeedback = null;

    const result: EditorLaunchResult = await launchEditor(editor, {
      lat: mapCenter[1],
      lon: mapCenter[0],
      zoom: mapZoom,
      element: selectedElement || undefined,
      webUrl: settingsStore.activeEndpointConfig.webUrl,
    });

    if (result.success) {
      const editorNames: Record<PreferredEditor, string> = {
        id: 'iD Editor',
        rapid: 'Rapid Editor',
        josm: 'JOSM Remote Control',
      };
      editorFeedback = {
        text: `Opened in ${editorNames[editor]} successfully.`,
        type: 'success',
      };
    } else {
      editorFeedback = {
        text: result.error || 'Failed to launch editor.',
        type: 'error',
      };
    }

    setTimeout(() => {
      editorFeedback = null;
    }, 5000);
  }

  /**
   * Registers messaging listeners and initializes storage state with proper teardown.
   */
  $effect(() => {
    // Load initial lookup state and detected schema from local storage
    browser.storage.local
      .get(['lookupState', 'searchSession', 'currentSchema'])
      .then((rawStorage) => {
        const storage = rawStorage as {
          currentSchema?: SchemaOrgPlace;
          searchSession?: SearchSessionState;
          lookupState?: {
            state?: EditorWorkflowState;
            lat?: number | string;
            lon?: number | string;
            display_name?: string;
            osm_id?: string;
            osm_type?: string;
            full_response?: NominatimResult | Record<string, unknown>;
            timestamp?: number;
            nearbyElements?: OsmElement[];
            matchedElementId?: string;
          };
        };
        if (storage?.currentSchema) {
          detectedPagePlace = storage.currentSchema;
        }
        if (storage?.searchSession?.nearbyElements) {
          nearbyElementsList = storage.searchSession.nearbyElements;
        }
        if (storage?.lookupState) {
          updateFromPayload({
            ...storage.lookupState,
            nearbyElements:
              storage.lookupState.nearbyElements ||
              storage.searchSession?.nearbyElements ||
              nearbyElementsList,
            matchedElementId:
              storage.lookupState.matchedElementId || storage.searchSession?.matchedElementId,
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load initial storage state in sidebar:', err);
      });

    const unwatchUpdateEditor = messaging.onMessage('updateEditor', ({ data: payload }) => {
      updateFromPayload({ ...payload, timestamp: Date.now() });
    });

    const unwatchAdjustMap = messaging.onMessage('adjustMap', ({ data: payload }) => {
      updateFromPayload({ ...payload, state: 'response', timestamp: Date.now() });
    });

    const unwatchSchema = messaging.onMessage('schemaDetected', ({ data: payload }) => {
      detectedPagePlace = payload.place;
      if (status === 'response' || status === 'instructions') {
        computeDiffs(selectedElement, detectedPagePlace);
      }
    });

    return () => {
      unwatchUpdateEditor();
      unwatchAdjustMap();
      unwatchSchema();
    };
  });
</script>

<div class="sidebar">
  <!-- Top Header with Environment Badge and Settings -->
  <header class="sidebar-header">
    <div class="header-top-row">
      <div>
        <div class="title-with-badge">
          <h1 class="sidebar-main-title">Browsm</h1>
          {#if settingsStore.badgeInfo.text}
            <span
              class="sidebar-env-badge badge-{settingsStore.badgeInfo.variant}"
              title={settingsStore.badgeInfo.tooltip}
              data-testid="sidebar-env-badge"
            >
              {settingsStore.badgeInfo.text}
            </span>
          {/if}
        </div>
        <p class="subtitle">OpenStreetMap in-browser verification & editing</p>
      </div>
      <button
        type="button"
        class="btn-gear"
        onclick={() => (isSettingsModalOpen = true)}
        title="Settings & Environments"
        aria-label="Settings & Environments"
        data-testid="sidebar-gear-btn"
      >
        ⚙️
      </button>
    </div>
  </header>

  <AuthHeader />

  <!-- Direct Search Bar -->
  <form class="search-bar" onsubmit={handleDirectSearch}>
    <input
      type="text"
      placeholder="Search address, POI, or coordinates..."
      bind:value={searchQuery}
      aria-label="Search OpenStreetMap"
    />
    <button type="submit" class="btn-search">Search</button>
  </form>

  <!-- In-Page Schema Detection Alert -->
  {#if detectedPagePlace}
    <div class="schema-alert">
      <div class="schema-info">
        <span class="schema-badge">Detected on Webpage</span>
        <strong class="schema-name">{detectedPagePlace.name || detectedPagePlace.type}</strong>
        {#if detectedPagePlace.address?.streetAddress}
          <span class="schema-address">
            {detectedPagePlace.address.streetAddress}, {detectedPagePlace.address.addressLocality || ''}
          </span>
        {/if}
      </div>
      <button type="button" class="btn-inspect" onclick={handleInspectPagePlace}>
        Inspect
      </button>
    </div>
  {/if}

  <!-- Interactive MapLibre Vector Map -->
  <div class="map-section">
    <MapLibreMap
      center={mapCenter}
      zoom={mapZoom}
      {markers}
      {structures}
      {selectedElementId}
      height="300px"
      onMarkerClick={(m) => {
        if (m.element) selectElement(m.element);
      }}
      onStructureClick={(s) => {
        if (s.element) selectElement(s.element);
      }}
    />
  </div>

  <!-- Editor Feedback Alert -->
  {#if editorFeedback}
    <div class="editor-feedback feedback-{editorFeedback.type}" role="status">
      {editorFeedback.text}
    </div>
  {/if}

  {#if status === 'instructions'}
    <div id="instructions" class="instruction-card">
      <p>💡 <strong>How to use Browsm:</strong></p>
      <ol class="instruction-list">
        <li>Browse any local business or restaurant website.</li>
        <li>Select an address on the page, right-click, and choose <em>"Check Address in OSM"</em>.</li>
        <li>Or use the search bar above to look up any place directly.</li>
      </ol>
    </div>
  {:else if status === 'searching'}
    <div id="searching" class="searching-card">
      <span class="spinner-icon">⏳</span> Querying OpenStreetMap and Nominatim...
    </div>
  {:else if status === 'response'}
    <!-- Selected POI / Structure Header Card -->
    <div class="poi-selection-card">
      <div class="poi-header-row">
        <div class="poi-titles">
          <span class="poi-eyebrow">
            {#if selectedElement}
              Selected OSM {selectedElement.type} #{selectedElement.id}
            {:else}
              New POI Candidate
            {/if}
          </span>
          <h2 class="poi-main-name">
            {selectedElement?.tags?.name || stagedTags.name || displayName || 'Unnamed Location'}
          </h2>
        </div>

        <div class="poi-switch-actions">
          {#if selectedElement}
            <button
              type="button"
              class="btn-new-poi-toggle"
              onclick={() => selectElement(null)}
              title="Switch to creating a brand new POI at this location"
            >
              + Create New POI
            </button>
          {/if}
        </div>
      </div>

      <!-- Workspace Navigation Tabs -->
      <div class="workspace-tabs" role="tablist">
        <button
          type="button"
          class="ws-tab"
          class:active={activeTab === 'diff'}
          onclick={() => (activeTab = 'diff')}
        >
          Tag Diff Matrix
        </button>
        <button
          type="button"
          class="ws-tab"
          class:active={activeTab === 'nearby'}
          onclick={() => (activeTab = 'nearby')}
        >
          Nearby Places ({nearbyElementsList.length})
        </button>
        <button
          type="button"
          class="ws-tab"
          class:active={activeTab === 'raw'}
          onclick={() => (activeTab = 'raw')}
        >
          Raw Geo Data
        </button>
      </div>
    </div>

    <!-- Tab 1: Tag Comparison Matrix -->
    {#if activeTab === 'diff'}
      <TagDiffTable
        {diffItems}
        onUpdateTag={handleUpdateTag}
        onDeleteTag={handleDeleteTag}
        onAddTag={handleAddCustomTag}
        onApplyAllSuggested={handleApplyAllSuggested}
        onResetAll={handleResetAll}
      />
    {/if}

    <!-- Tab 2: Nearby Places & Structures -->
    {#if activeTab === 'nearby'}
      <div class="nearby-section">
        {#if nearbyElementsList.length === 0}
          <p class="text-muted">No nearby OSM nodes or structures found within 50 meters.</p>
        {:else}
          <div class="nearby-cards-grid">
            {#each nearbyElementsList as elem (elem.id)}
              {@const isSelected = selectedElementId === elem.id}
              <div
                class="nearby-element-card"
                class:card-selected={isSelected}
                onclick={() => selectElement(elem)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter') selectElement(elem);
                }}
              >
                <div class="card-top">
                  <span class="elem-badge">{elem.type}</span>
                  {#if isSelected}
                    <span class="selected-badge">Active</span>
                  {/if}
                </div>
                <strong class="elem-title">
                  {elem.tags.name || elem.tags.amenity || elem.tags.shop || elem.tags.building || `OSM #${elem.id}`}
                </strong>
                {#if elem.tags['addr:street']}
                  <span class="elem-address">
                    {elem.tags['addr:housenumber'] || ''} {elem.tags['addr:street']}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tab 3: Raw Nominatim Response -->
    {#if activeTab === 'raw'}
      <div class="raw-response-section">
        <pre class="raw-json-block">{fullResponse}</pre>
      </div>
    {/if}

    <!-- Bottom Action Toolbar -->
    <div class="sidebar-action-bar">
      <!-- Primary: Commit Changeset Button -->
      <button
        type="button"
        class="btn-action-primary"
        onclick={() => (isChangesetModalOpen = true)}
        title={authStore.isAuthenticated ? 'Upload staged modifications to OpenStreetMap' : 'Sign in to commit changes'}
      >
        <span class="btn-icon">💾</span>
        Commit Changeset...
      </button>

      <!-- Secondary: Create Note Button -->
      <button
        type="button"
        class="btn-action-secondary"
        onclick={() => (isNoteModalOpen = true)}
        title="Post a non-destructive OpenStreetMap Note for community review"
      >
        <span class="btn-icon">📝</span>
        Create Note
      </button>

      <!-- External Editors Dropdown Button -->
      <div class="editor-dropdown-wrapper">
        <button
          type="button"
          class="btn-action-editor"
          onclick={() => (isEditorDropdownOpen = !isEditorDropdownOpen)}
          title="Open location in external OpenStreetMap editor"
        >
          <span class="btn-icon">✏️</span>
          Edit in {settingsStore.state.preferredEditor.toUpperCase()} ▾
        </button>

        {#if isEditorDropdownOpen}
          <div class="editor-dropdown-menu" role="menu">
            <button
              type="button"
              class="dropdown-item"
              role="menuitem"
              onclick={() => handleLaunchEditor('id')}
            >
              iD Web Editor
            </button>
            <button
              type="button"
              class="dropdown-item"
              role="menuitem"
              onclick={() => handleLaunchEditor('rapid')}
            >
              Rapid Web Editor
            </button>
            <button
              type="button"
              class="dropdown-item"
              role="menuitem"
              onclick={() => handleLaunchEditor('josm')}
            >
              JOSM (Remote Control)
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Modals -->
  <ChangesetModal
    isOpen={isChangesetModalOpen}
    stagedTags={stagedTags}
    targetElement={selectedElement || undefined}
    coordinates={{ lat: mapCenter[1], lon: mapCenter[0] }}
    onClose={() => (isChangesetModalOpen = false)}
    onSuccess={(changesetId, elementId) => {
      // Refresh state or display confirmation
      editorFeedback = {
        text: `Successfully committed Changeset #${changesetId}!`,
        type: 'success',
      };
    }}
  />

  <NoteModal
    isOpen={isNoteModalOpen}
    place={detectedPagePlace}
    initialLat={mapCenter[1]}
    initialLon={mapCenter[0]}
    onclose={() => (isNoteModalOpen = false)}
  />

  <SettingsModal
    isOpen={isSettingsModalOpen}
    onClose={() => (isSettingsModalOpen = false)}
  />
</div>

<style>
  .sidebar {
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: var(--text-primary, #1a1a1a);
    background: var(--bg-main, #fbfbfb);
    min-height: 100vh;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  @media (prefers-color-scheme: dark) {
    .sidebar {
      background: #141414;
      color: #f0f0f0;
    }
  }

  .sidebar-header {
    margin-bottom: 2px;
  }

  .header-top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .btn-gear {
    background: none;
    border: none;
    font-size: 1.25em;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
    transition: background-color 0.15s ease;
  }

  .btn-gear:hover {
    background-color: rgba(0, 0, 0, 0.08);
  }

  @media (prefers-color-scheme: dark) {
    .btn-gear:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  .title-with-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sidebar-main-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: #2e7d32;
  }

  @media (prefers-color-scheme: dark) {
    .sidebar-main-title {
      color: #81c784;
    }
  }

  .sidebar-env-badge {
    font-size: 0.65em;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    line-height: 1.2;
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

  @media (prefers-color-scheme: dark) {
    .badge-warning {
      background: #382500;
      color: #ffb74d;
      border-color: #5c3d00;
    }
    .badge-danger {
      background: #3e1212;
      color: #ef9a9a;
      border-color: #5f1b1b;
    }
    .badge-purple {
      background: #2d0e38;
      color: #ce93d8;
      border-color: #4b185d;
    }
  }

  .subtitle {
    font-size: 0.8em;
    color: var(--text-secondary, #616161);
    margin: 2px 0 0 0;
  }

  @media (prefers-color-scheme: dark) {
    .subtitle {
      color: #9e9e9e;
    }
  }

  .search-bar {
    display: flex;
    gap: 6px;
  }

  .search-bar input {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    font-size: 0.85em;
    background: var(--bg-input, #fff);
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .search-bar input {
      background: #252525;
      border-color: #444;
    }
  }

  .search-bar input:focus {
    outline: none;
    border-color: #2e7d32;
    box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.2);
  }

  .btn-search {
    padding: 7px 12px;
    background-color: #2e7d32;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.85em;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-search:hover {
    background-color: #1b5e20;
  }

  .schema-alert {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #e8f5e9;
    border: 1px solid #a5d6a7;
    border-radius: 6px;
    padding: 8px 10px;
    gap: 8px;
  }

  @media (prefers-color-scheme: dark) {
    .schema-alert {
      background-color: #1b381e;
      border-color: #2e5433;
    }
  }

  .schema-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.8em;
  }

  .schema-badge {
    align-self: flex-start;
    background-color: #2e7d32;
    color: white;
    font-size: 0.7em;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .schema-name {
    color: var(--text-primary, #111);
  }

  @media (prefers-color-scheme: dark) {
    .schema-name {
      color: #f0f0f0;
    }
  }

  .schema-address {
    color: var(--text-secondary, #555);
    font-size: 0.85em;
  }

  @media (prefers-color-scheme: dark) {
    .schema-address {
      color: #bbb;
    }
  }

  .btn-inspect {
    padding: 5px 10px;
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-inspect:hover {
    background-color: #0d47a1;
  }

  .map-section {
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-color, #e0e0e0);
  }

  @media (prefers-color-scheme: dark) {
    .map-section {
      border-color: #333;
    }
  }

  .editor-feedback {
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .feedback-success {
    background: #e8f5e9;
    color: #1b5e20;
    border: 1px solid #c8e6c9;
  }

  .feedback-error {
    background: #ffebee;
    color: #b71c1c;
    border: 1px solid #ffcdd2;
  }

  .instruction-card,
  .searching-card {
    padding: 12px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    font-size: 0.85em;
    line-height: 1.4;
  }

  @media (prefers-color-scheme: dark) {
    .instruction-card,
    .searching-card {
      background: #1e1e1e;
      border-color: #333;
    }
  }

  .instruction-list {
    margin: 6px 0 0 16px;
    padding: 0;
  }

  .instruction-list li {
    margin-bottom: 4px;
  }

  .searching-card {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* POI Selection Card */
  .poi-selection-card {
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (prefers-color-scheme: dark) {
    .poi-selection-card {
      background: #1e1e1e;
      border-color: #333;
    }
  }

  .poi-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .poi-titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .poi-eyebrow {
    font-size: 11px;
    font-weight: 600;
    color: #1565c0;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  @media (prefers-color-scheme: dark) {
    .poi-eyebrow {
      color: #64b5f6;
    }
  }

  .poi-main-name {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .btn-new-poi-toggle {
    font-size: 11px;
    padding: 3px 8px;
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-new-poi-toggle:hover {
    background: #dcfce7;
  }

  @media (prefers-color-scheme: dark) {
    .btn-new-poi-toggle {
      background: #14331a;
      color: #86efac;
      border-color: #22542c;
    }
  }

  .workspace-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    padding-bottom: 4px;
  }

  @media (prefers-color-scheme: dark) {
    .workspace-tabs {
      border-color: #333;
    }
  }

  .ws-tab {
    background: transparent;
    border: none;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    color: var(--text-secondary, #666);
    border-radius: 3px;
  }

  @media (prefers-color-scheme: dark) {
    .ws-tab {
      color: #999;
    }
  }

  .ws-tab.active {
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 600;
  }

  @media (prefers-color-scheme: dark) {
    .ws-tab.active {
      background: #0c2d48;
      color: #7dd3fc;
    }
  }

  /* Nearby elements grid */
  .nearby-cards-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 260px;
    overflow-y: auto;
  }

  .nearby-element-card {
    padding: 8px 10px;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: all 0.15s ease;
  }

  .nearby-element-card:hover {
    border-color: #3b82f6;
    background: #f8fafc;
  }

  @media (prefers-color-scheme: dark) {
    .nearby-element-card {
      background: #222;
      border-color: #333;
    }
    .nearby-element-card:hover {
      background: #2a2a2a;
      border-color: #60a5fa;
    }
  }

  .card-selected {
    border-color: #2e7d32 !important;
    background: #f0fdf4 !important;
  }

  @media (prefers-color-scheme: dark) {
    .card-selected {
      background: #16311b !important;
      border-color: #4ade80 !important;
    }
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .elem-badge {
    font-size: 9px;
    font-weight: 700;
    background: #e2e8f0;
    color: #475569;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  @media (prefers-color-scheme: dark) {
    .elem-badge {
      background: #334155;
      color: #cbd5e1;
    }
  }

  .selected-badge {
    font-size: 9px;
    font-weight: 700;
    background: #2e7d32;
    color: #fff;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .elem-title {
    font-size: 12px;
  }

  .elem-address {
    font-size: 11px;
    color: var(--text-secondary, #666);
  }

  .raw-json-block {
    font-family: monospace;
    font-size: 11px;
    background: #222;
    color: #4ade80;
    padding: 10px;
    border-radius: 4px;
    max-height: 240px;
    overflow-y: auto;
  }

  /* Bottom Action Toolbar */
  .sidebar-action-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #e0e0e0);
  }

  @media (prefers-color-scheme: dark) {
    .sidebar-action-bar {
      border-color: #333;
    }
  }

  .btn-action-primary {
    flex: 2;
    min-width: 130px;
    padding: 8px 12px;
    background: #2e7d32;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.15s ease;
  }

  .btn-action-primary:hover {
    background: #1b5e20;
  }

  .btn-action-secondary {
    flex: 1;
    min-width: 100px;
    padding: 8px 10px;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .btn-action-secondary:hover {
    background: #e2e8f0;
  }

  @media (prefers-color-scheme: dark) {
    .btn-action-secondary {
      background: #222;
      color: #e2e8f0;
      border-color: #444;
    }
    .btn-action-secondary:hover {
      background: #333;
    }
  }

  .editor-dropdown-wrapper {
    position: relative;
    flex: 1;
    min-width: 110px;
  }

  .btn-action-editor {
    width: 100%;
    padding: 8px 10px;
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .btn-action-editor:hover {
    background: #e2e8f0;
  }

  @media (prefers-color-scheme: dark) {
    .btn-action-editor {
      background: #222;
      color: #e2e8f0;
      border-color: #444;
    }
    .btn-action-editor:hover {
      background: #333;
    }
  }

  .editor-dropdown-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    right: 0;
    background: var(--bg-card, #fff);
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    min-width: 160px;
    z-index: 50;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .editor-dropdown-menu {
      background: #222;
      border-color: #444;
    }
  }

  .dropdown-item {
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    font-size: 12px;
    cursor: pointer;
    color: inherit;
  }

  .dropdown-item:hover {
    background: #f1f5f9;
  }

  @media (prefers-color-scheme: dark) {
    .dropdown-item:hover {
      background: #333;
    }
  }
</style>
