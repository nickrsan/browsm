<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { messaging } from '@/lib/messaging';
  import type { NominatimResult } from '@/types/osm';
  import type { EditorWorkflowState } from '@/types/messaging';

  /**
   * DOM element reference for the Leaflet map container
   */
  let mapContainer = $state<HTMLDivElement | null>(null);
  let mapInstance = $state<L.Map | null>(null);
  let currentMarker = $state<L.Marker | null>(null);

  /**
   * Reactive state for sidebar workflow and place details
   */
  let status = $state<EditorWorkflowState>('instructions');
  let displayName = $state<string>('');
  let fullResponse = $state<string>('');
  let showFullResponse = $state<boolean>(false);
  let showEditInfo = $state<boolean>(false);
  let lastOsmResponse = $state<NominatimResult | null>(null);
  let lastTimestamp = $state<number>(0);

  /**
   * Updates sidebar reactive state and centers the Leaflet map from received payloads.
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

      if (mapInstance && parsedLat !== undefined && parsedLon !== undefined && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLon)) {
        mapInstance.setView([parsedLat, parsedLon], 16);
        if (currentMarker) {
          currentMarker.setLatLng([parsedLat, parsedLon]);
        } else {
          currentMarker = L.marker([parsedLat, parsedLon]).addTo(mapInstance);
        }
        currentMarker.bindPopup(name).openPopup();
      } else if (mapInstance) {
        mapInstance.setView([0, 0], 1);
      }
    }
  }

  /**
   * Initializes the Leaflet map and registers messaging listeners with proper teardown.
   */
  $effect(() => {
    if (!mapContainer) return;

    const initializedMap = L.map(mapContainer).setView([0, 0], 1);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(initializedMap);

    mapInstance = initializedMap;

    // Load initial state from local storage if available
    browser.storage.local.get('lookupState').then((storage) => {
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

    return () => {
      unwatchUpdateEditor();
      unwatchAdjustMap();
      initializedMap.remove();
      mapInstance = null;
      currentMarker = null;
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
  <h1>Look up Address in OSM</h1>

  {#if status === 'instructions'}
    <div id="instructions">
      To get started, select an address on a web page, then right click and choose "Check Address in OSM".
    </div>
  {/if}

  <div id="map" bind:this={mapContainer}></div>

  {#if status === 'searching'}
    <div id="searching">Querying Nominatim...</div>
  {:else if status === 'response'}
    <div id="response">
      {#if showEditInfo}
        <div id="edit_info">
          <h3>See an issue?</h3>
          <button onclick={editLast}>Edit in iD</button>
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
</div>

<style>
  .sidebar {
    padding: 1em;
    font-family: 'Noto Sans', Arial, Helvetica, sans-serif;
  }
  #map {
    height: 400px;
    width: 100%;
    margin-bottom: 1em;
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
    cursor: pointer;
  }
  button:hover {
    background-color: #45a049;
  }
</style>
