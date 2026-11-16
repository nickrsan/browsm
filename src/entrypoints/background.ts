import { messaging } from '@/lib/messaging';
import { geocodeQuery } from '@/services/geocoding';
import {
  calculateBboxAroundCoords,
  fetchOsmElementsInBbox,
  findBestMatch,
} from '@/services/spatial-matcher';
import { convertSchemaPlaceToOsmTags } from '@/services/tag-normalizer';
import type { NominatimResult } from '@/types/osm';
import type { SearchSessionState } from '@/types/diff';
import type { SchemaOrgPlace } from '@/types/schema';

export default defineBackground(() => {
  /**
   * Helper to open the sidebar or sidepanel across Chromium and Firefox.
   */
  async function openSidebar(tabId?: number) {
    try {
      if (import.meta.env.BROWSER === 'firefox') {
        // @ts-ignore Firefox sidebar action API
        if (browser.sidebarAction?.open) {
          // @ts-ignore
          await browser.sidebarAction.open();
        }
      } else if (import.meta.env.BROWSER === 'chrome' && tabId !== undefined) {
        // @ts-ignore Chromium side panel API
        if (browser.sidePanel?.setOptions && browser.sidePanel?.open) {
          // @ts-ignore
          await browser.sidePanel.setOptions({
            tabId,
            path: 'sidebar.html',
            enabled: true,
          });
          // @ts-ignore
          await browser.sidePanel.open({ tabId });
        }
      } else {
        browser.action.setPopup({ popup: 'sidebar.html' });
      }
    } catch (err) {
      console.debug('[Browsm] Could not open sidebar automatically:', err);
    }
  }

  /**
   * Performs an end-to-end POI search and spatial verification pipeline.
   */
  async function processPoiSearch(query: string, source: 'selection' | 'manual_search' | 'schema_org') {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;

    await browser.storage.local.set({
      lookupState: {
        state: 'searching',
        timestamp: Date.now(),
      },
    });
    messaging.sendMessage('updateEditor', { state: 'searching' });

    // Step 1: Geocode query via cached Nominatim service
    const geocodeResults = await geocodeQuery(cleanQuery);
    if (!geocodeResults || geocodeResults.length === 0) {
      const emptySession: SearchSessionState = {
        query: cleanQuery,
        source,
        status: 'no_match',
        errorMessage: `Could not find any location matching "${cleanQuery}".`,
        nearbyElements: [],
      };
      await browser.storage.local.set({ searchSession: emptySession });
      return null;
    }

    const firstResult = geocodeResults[0];
    const parsedLat = parseFloat(firstResult.lat);
    const parsedLon = parseFloat(firstResult.lon);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
      return null;
    }

    // Step 2: Fetch all OSM elements in a 50m micro-bounding box
    const bbox = calculateBboxAroundCoords(parsedLat, parsedLon, 50);
    const nearbyElements = await fetchOsmElementsInBbox(bbox);

    // Step 3: Score best matching element
    const matchResult = findBestMatch(
      {
        name: firstResult.name || cleanQuery,
        lat: parsedLat,
        lon: parsedLon,
      },
      nearbyElements
    );

    const osmIdString = matchResult.matchedElement ? String(matchResult.matchedElement.id) : String(firstResult.osm_id);
    const osmTypeString = matchResult.matchedElement ? matchResult.matchedElement.type : (firstResult.osm_type as string);

    // Step 4: Persist session and notify UI
    const searchSession: SearchSessionState = {
      query: cleanQuery,
      source,
      coordinates: { lat: parsedLat, lon: parsedLon },
      status: matchResult.matchStatus === 'no_match' ? 'no_match' : 'matched',
      matchedElementId: matchResult.matchedElement ? `${matchResult.matchedElement.type}/${matchResult.matchedElement.id}` : undefined,
      nearbyElements,
    };

    await browser.storage.local.set({
      searchSession,
      lookupState: {
        state: 'response',
        lat: parsedLat,
        lon: parsedLon,
        display_name: firstResult.display_name,
        osm_id: osmIdString,
        osm_type: osmTypeString,
        full_response: firstResult,
        timestamp: Date.now(),
      },
    });

    messaging.sendMessage('adjustMap', {
      lat: parsedLat,
      lon: parsedLon,
      display_name: firstResult.display_name,
      osm_id: osmIdString,
      osm_type: osmTypeString,
      full_response: firstResult,
    });

    messaging.sendMessage('updateIcon', { state: 'active' });

    return {
      geocode: firstResult,
      matchResult,
      nearbyElements,
    };
  }

  // Register context menu for text selection
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'check-address',
      title: 'Search & Edit in Browsm',
      contexts: ['selection'],
    });
  });

  // Handle right-click context menu clicks
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'check-address' && info.selectionText) {
      const selectedText = info.selectionText.trim();
      await openSidebar(tab?.id);

      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/browsm_64.png',
        title: 'Browsm: Searching OSM...',
        message: `Checking if "${selectedText}" exists in OpenStreetMap.`,
      });

      const outcome = await processPoiSearch(selectedText, 'selection');

      if (outcome && outcome.geocode) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/browsm_64.png',
          title: 'Location Found in OSM!',
          message: `${outcome.geocode.display_name}`,
        });
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/browsm_64.png',
          title: 'Not Found in OSM',
          message: `Could not locate "${selectedText}". You can add it via Browsm.`,
        });
      }
    }
  });

  // Handle in-page Schema.org detection from content scripts
  messaging.onMessage('schemaDetected', async ({ data: payload, sender }) => {
    const { place } = payload;
    const tabId = payload.tabId ?? sender?.tab?.id;

    if (tabId !== undefined) {
      // Set high-contrast green badge on extension action
      await browser.action.setBadgeText({
        text: 'POI',
        tabId,
      });

      await browser.action.setBadgeBackgroundColor({
        color: '#2E7D32', // Emerald green
        tabId,
      });

      const labelName = place.name ? `Browsm: Found ${place.name}` : `Browsm: Found ${place.type} on page`;
      await browser.action.setTitle({
        title: `${labelName} (Click to inspect & edit in OSM)`,
        tabId,
      });

      // Save detected place in local storage indexed by tab ID
      await browser.storage.local.set({
        [`tab_schema_${tabId}`]: place,
        currentSchema: place,
      });
    }
  });

  // Handle direct POI search from sidebar / popup
  messaging.onMessage('searchPoi', async ({ data: payload }) => {
    await processPoiSearch(payload.query, payload.source);
  });

  // Handle map center requests
  messaging.onMessage('showMap', ({ data: payload }) => {
    messaging.sendMessage('adjustMap', {
      lat: payload.lat,
      lon: payload.lon,
      display_name: payload.display_name,
      osm_id: '',
      full_response: {
        display_name: payload.display_name,
        lat: String(payload.lat),
        lon: String(payload.lon),
      },
    });
  });

  // Clean up tab-specific schema storage on tab close
  browser.tabs.onRemoved?.addListener((tabId) => {
    browser.storage.local.remove(`tab_schema_${tabId}`).catch(() => {});
  });
});
