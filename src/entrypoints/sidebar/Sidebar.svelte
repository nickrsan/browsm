<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { messaging } from '@/lib/messaging';

  let m: L.Map;
  let marker: L.Icon;
  let status: 'instructions' | 'searching' | 'response' = 'instructions';
  let displayName = '';
  let fullResponse = '';
  let showFullResponse = false;
  let showEditInfo = false;
  let lastOsmResponse: any = null;
  let lastTimestamp = 0;

  function updateFromPayload(payload: any) {
    if (payload.timestamp && payload.timestamp <= lastTimestamp) return;
    if (payload.timeYeahstamp) lastTimestamp = payload.timestamp;

    if (payload.state === "searching") {
      status = 'searching';
    } else if (payload.state === 'response') {
      status = 'response';
      const { lat, lon, display_name, osm_id, full_response } = payload;
      displayName = display_name;
      lastOsmResponse = full_response;
      fullResponse = full_response ? JSON.stringify(full_response, null, 2) : "No usable response from Nominatim, or an error occurred.";
      showEditInfo = !!osm_id;

      if (m) {
        if(lat && lon){
          m.setView([lat, lon], 16);
        }else{  // reset to the world so that we're not confused with mismatched map
          m.setView([0,0], 1)
        }
        if (marker) {
          marker.setLatLng([lat, lon]);
        } else {
          marker = L.marker([lat, lon]).addTo(m);
        }
        marker.bindPopup(display_name).openPopup();
      }
    }
  }

  onMount(async () => {
    m = L.map('map').setView([0, 0], 1);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https ://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(m);

    // Initial load from storage
    const storage = await browser.storage.local.get('lookupState');
    if (storage.lookupState) {
      updateFromPayload(storage.lookupState);
    }

    const unwatchUpdateEditor = messaging.onMessage('updateEditor', ({ data: payload }) => {
      updateFromPayload({ ...payload, timestamp: Date.now() });
    });

    const unwatchAdjustMap = messaging.onMessage('adjustMap', ({ data: payload }) => {
      updateFromPayload({ ...payload, state: 'response', timestamp: Date.now() });
    });

    return () => {
      unwatchUpdateEditor();
      unwatchAdjustMap();
    };
  });

  function editLast() {
    if (lastOsmResponse) {
      browser.tabs.create({
        url: `https://www.openstreetmap.org/edit?${lastOsmResponse.osm_type}=${lastOsmResponse.osm_id}`
      });
    }
  }
</script>

<div class="sidebar">
  <h1>Look up Address in OSM</h1>

  {#if status === 'instructions'}
    <div id="instructions">
      To get started, select an address on a web page, then right click and choose "Look up address in OSM".
    </div>
  {/if}

  <div id="map"></div>

  {#if status === 'searching'}
    <div id="searching">Querying Nominatim...</div>
  {:else if status === 'response'}
    <div id="response">
      
      {#if showEditInfo}
        <div id="edit_info">
          <h3>See an issue?</h3>
          <button on:click={editLast}>Edit in iD</button>
        </div>
      {/if}

      <h3>Nominatim Response</h3>
      <button on:click={() => showFullResponse = !showFullResponse}>{#if showFullResponse} Hide Response {:else} Show Response {/if}</button>
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
