<script lang="ts">
  import { onMount } from 'svelte';
  import MapLibreMap from '@/components/MapLibreMap.svelte';
  import AuthHeader from '@/components/AuthHeader.svelte';
  import NoteModal from '@/components/NoteModal.svelte';
  import { messaging } from '@/lib/messaging';
  import type { NominatimResult, OsmElement } from '@/types/osm';
  import type { EditorWorkflowState } from '@/types/messaging';
  import type { MapMarker, MapStructure } from '@/types/map';
  import type { SearchSessionState } from '@/types/diff';
  import type { SchemaOrgPlace } from '@/types/schema';

  /**
   * Reactive state for vector map coordinates, zoom, markers, and building structures
   */
  let mapCenter = $state<[number, number]>([0, 0]); // [lon, lat]
  let mapZoom = $state<number>(1);
  let markers = $state<MapMarker[]>([]);
  let structures = $state<MapStructure[]>([]);
  let selectedElementId = $state<string | number | null>(null);

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
  let isNoteModalOpen = $state<boolean>(false);

  /**
   * Converts OSM elements into MapMarker and MapStructure items for the vector map.
   */
  function populateMapElements(elements: OsmElement[], primaryLat?: number, primaryLon?: number, primaryTitle?: string, primaryId?: string) {
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
   * Updates sidebar reactive state and centers the vector map from received payloads.
   */
  function updateFromPayload(payload: {
    state?: EditorWorkflowState;
    lat?: number | string;
    lon?: number | string;
    display_name?: string;
    osm_id?: string;
    full_response?: NominatimResult | Record<string, unknown>;
    timestamp?: number;
  }) {
    if (payload.timestamp && payload.timestamp <= lastTimestamp) {
      return;
    }
    if (payload.timestamp) {
      lastTimestamp = payload.timestamp;
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
      } else {
        mapCenter = [0, 0];
        mapZoom = 1;
        markers = [];
        structures = [];
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

    const query = detectedPagePlace.name ||
      [
        detectedPagePlace.address?.streetAddress,
        detectedPagePlace.address?.addressLocality,
        detectedPagePlace.address?.postalCode,
      ].filter(Boolean).join(', ');

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
   * Registers messaging listeners and initializes storage state with proper teardown.
   */
  $effect(() => {
    // Load initial lookup state and detected schema from local storage
    browser.storage.local.get(['lookupState', 'searchSession', 'currentSchema']).then((rawStorage) => {
      const storage = rawStorage as {
        currentSchema?: SchemaOrgPlace;
        searchSession?: SearchSessionState;
        lookupState?: {
          state?: EditorWorkflowState;
          lat?: number | string;
          lon?: number | string;
          display_name?: string;
          osm_id?: string;
          full_response?: NominatimResult | Record<string, unknown>;
          timestamp?: number;
        };
      };
      if (storage?.currentSchema) {
        detectedPagePlace = storage.currentSchema;
      }
      if (storage?.searchSession?.nearbyElements) {
        nearbyElementsList = storage.searchSession.nearbyElements;
      }
      if (storage?.lookupState) {
        updateFromPayload(storage.lookupState);
      }
    }).catch((err) => {
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
    });

    return () => {
      unwatchUpdateEditor();
      unwatchAdjustMap();
      unwatchSchema();
    };
  });

  /**
   * Opens the OpenStreetMap iD editor focused on the resolved element.
   */
  function editLast() {
    if (lastOsmResponse && lastOsmResponse.osm_type && lastOsmResponse.osm_id) {
      browser.tabs.create({
        url: `https://www.openstreetmap.org/edit?${lastOsmResponse.osm_type}=${lastOsmResponse.osm_id}`,
      });
    }
  }
</script>

<div class="sidebar">
  <header class="sidebar-header">
    <h1>Look up Address in OSM</h1>
    <p class="subtitle">OpenStreetMap in-browser verification & editing</p>
  </header>

  <AuthHeader />

  <!-- Search input bar -->
  <form class="search-bar" onsubmit={handleDirectSearch}>
    <input
      type="text"
      placeholder="Search address, place, or coordinates..."
      bind:value={searchQuery}
      aria-label="Search OpenStreetMap"
    />
    <button type="submit" class="btn-search">Search</button>
  </form>

  <!-- In-Page Schema Detection Alert -->
  {#if detectedPagePlace}
    <div class="schema-alert">
      <div class="schema-info">
        <span class="schema-badge">Detected on Page</span>
        <strong>{detectedPagePlace.name || detectedPagePlace.type}</strong>
        {#if detectedPagePlace.address?.streetAddress}
          <span class="schema-address">{detectedPagePlace.address.streetAddress}, {detectedPagePlace.address.addressLocality || ''}</span>
        {/if}
      </div>
      <button class="btn-inspect" onclick={handleInspectPagePlace}>Inspect</button>
    </div>
  {/if}

  {#if status === 'instructions'}
    <div id="instructions">
      To get started, select an address on a web page, then right click and choose "Check Address in OSM".
    </div>
  {/if}

  <div class="map-section">
    <MapLibreMap
      center={mapCenter}
      zoom={mapZoom}
      {markers}
      {structures}
      {selectedElementId}
      height="350px"
    />
  </div>

  {#if status === 'searching'}
    <div id="searching">Querying Nominatim and OpenStreetMap...</div>
  {:else if status === 'response'}
    <div id="response">
      {#if showEditInfo}
        <div id="edit_info">
          <h3>See an issue?</h3>
          <div class="action-btn-group">
            <button onclick={editLast}>Edit in iD</button>
            <button class="btn-note" onclick={() => (isNoteModalOpen = true)}>Create Map Note</button>
          </div>
        </div>
      {/if}

      <!-- Nearby POIs / structures list -->
      {#if nearbyElementsList.length > 0}
        <div class="nearby-section">
          <h3>Nearby Places & Structures ({nearbyElementsList.length})</h3>
          <ul class="nearby-list">
            {#each nearbyElementsList.slice(0, 5) as elem}
              <li class="nearby-item">
                <span class="elem-badge">{elem.type}</span>
                <span class="elem-title">{elem.tags.name || elem.tags.amenity || elem.tags.shop || elem.tags.building || `OSM #${elem.id}`}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <h3>Nominatim Response</h3>
      <button onclick={() => (showFullResponse = !showFullResponse)}>
        {#if showFullResponse} Hide Response {:else} Show Response {/if}
      </button>
      {#if showFullResponse}
        <pre id="full_nominatim_response">{fullResponse}</pre>
      {/if}
    </div>
  {/if}
  <NoteModal
    isOpen={isNoteModalOpen}
    place={detectedPagePlace}
    initialLat={mapCenter[1]}
    initialLon={mapCenter[0]}
    onclose={() => (isNoteModalOpen = false)}
  />
</div>

<style>
  .sidebar {
    padding: 1em;
    font-family: 'Noto Sans', Arial, Helvetica, sans-serif;
    color: #212121;
  }
  .sidebar-header {
    margin-bottom: 0.75em;
  }
  .sidebar-header h1 {
    font-size: 1.3em;
    margin: 0;
    color: #1b5e20;
  }
  .subtitle {
    font-size: 0.85em;
    color: #616161;
    margin: 0.2em 0 0 0;
  }
  .search-bar {
    display: flex;
    gap: 0.5em;
    margin-bottom: 0.85em;
  }
  .search-bar input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .search-bar input:focus {
    outline: none;
    border-color: #2e7d32;
    box-shadow: 0 0 0 2px rgba(46, 125, 50, 0.2);
  }
  .btn-search {
    padding: 8px 14px;
    background-color: #2e7d32;
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
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
    padding: 8px 12px;
    margin-bottom: 0.85em;
  }
  .schema-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.85em;
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
  .schema-address {
    color: #555;
    font-size: 0.8em;
  }
  .btn-inspect {
    padding: 6px 12px;
    background-color: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.8em;
    cursor: pointer;
  }
  .btn-inspect:hover {
    background-color: #0d47a1;
  }
  .map-section {
    margin-bottom: 1em;
  }
  .nearby-section {
    margin: 1em 0;
    padding: 0.5em 0;
    border-top: 1px solid #eee;
  }
  .nearby-section h3 {
    font-size: 0.95em;
    margin: 0 0 0.5em 0;
    color: #333;
  }
  .nearby-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .nearby-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85em;
    padding: 4px 6px;
    background: #f9f9f9;
    border-radius: 3px;
  }
  .elem-badge {
    background: #e0e0e0;
    font-size: 0.7em;
    padding: 1px 4px;
    border-radius: 2px;
    text-transform: uppercase;
  }
  .elem-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-all;
    background: #f4f4f4;
    padding: 0.5em;
    font-size: 0.8em;
  }
  button {
    padding: 8px 16px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:hover {
    background-color: #45a049;
  }
  .action-btn-group {
    display: flex;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .btn-note {
    background-color: #0284c7;
  }
  .btn-note:hover {
    background-color: #0369a1;
  }
</style>
