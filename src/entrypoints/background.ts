import { messaging } from '@/lib/messaging';
import { geocodeQuery } from '@/services/geocoding';
import {
  calculateBboxAroundCoords,
  fetchOsmElementsInBbox,
  findBestMatch,
  filterAndSortNearbyElements,
} from '@/services/spatial-matcher';
import {
  loadStoredSettings,
  resolveWriteEndpoint,
  resolveReadEndpoint,
} from '@/services/endpoint-resolver';
import { fetchElement } from '@/services/osm-api';
import { convertSchemaPlaceToOsmTags } from '@/services/tag-normalizer';
import type { NominatimResult, OsmElement, OsmElementType } from '@/types/osm';
import type { SearchSessionState } from '@/types/diff';
import type { SchemaOrgPlace } from '@/types/schema';

export default defineBackground(() => {
  /**
   * Helper to open the sidebar or sidepanel across Chromium and Firefox.
   */
  async function openSidebar(tabId?: number) {
    try {
      // @ts-ignore Check Firefox sidebarAction API
      if (typeof browser !== 'undefined' && 'sidebarAction' in browser && typeof browser.sidebarAction?.open === 'function') {
        // @ts-ignore
        await browser.sidebarAction.open();
      // @ts-ignore Check Chromium sidePanel API
      } else if (typeof browser !== 'undefined' && 'sidePanel' in browser && typeof browser.sidePanel?.open === 'function') {
        if (tabId !== undefined && browser.sidePanel?.setOptions) {
          await browser.sidePanel.setOptions({
            tabId,
            path: 'sidebar.html',
            enabled: true,
          });
        }
        if (tabId !== undefined) {
          await browser.sidePanel.open({ tabId });
        } else {
          // @ts-ignore
          await browser.sidePanel.open();
        }
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

    // Step 2: Resolve the target OSM API endpoint (e.g. Dev API, Prod, or Custom)
    const settings = await loadStoredSettings();
    const searchRadius = settings.nearbySearchRadius ?? 50;
    const writeEndpoint = await resolveWriteEndpoint(settings);
    const readEndpoint = await resolveReadEndpoint(settings);
    const targetApiUrl = writeEndpoint.config.apiBaseUrl || readEndpoint.config.apiBaseUrl;
    const isProdApi =
      Boolean(targetApiUrl) &&
      targetApiUrl.includes('api.openstreetmap.org') &&
      !targetApiUrl.includes('dev.openstreetmap.org');

    // Step 3: Fetch all OSM elements from the active API server in a micro-bounding box
    const bbox = calculateBboxAroundCoords(parsedLat, parsedLon, searchRadius);
    const rawElements = await fetchOsmElementsInBbox(bbox, targetApiUrl);
    const nearbyElements = filterAndSortNearbyElements(rawElements, parsedLat, parsedLon, searchRadius);

    // Step 4: Score best matching element from the active API server
    const matchResult = findBestMatch(
      {
        name: firstResult.name || cleanQuery,
        lat: parsedLat,
        lon: parsedLon,
        osmId: isProdApi ? firstResult.osm_id : undefined,
        osmType: isProdApi ? (firstResult.osm_type as string) : undefined,
      },
      nearbyElements
    );

    let matchedElement: OsmElement | undefined = matchResult.matchedElement;

    // If on production and not matched from bbox, verify whether firstResult.osm_id actually exists on the target API
    if (!matchedElement && isProdApi && firstResult.osm_id && firstResult.osm_type) {
      const parsedId = parseInt(String(firstResult.osm_id), 10);
      const parsedType = String(firstResult.osm_type).toLowerCase() as OsmElementType;
      if (parsedId > 0 && ['node', 'way', 'relation'].includes(parsedType)) {
        try {
          const verifiedElement = await fetchElement(parsedType, parsedId, targetApiUrl);
          if (verifiedElement) {
            matchedElement = verifiedElement;
            if (!nearbyElements.some((e) => e.type === verifiedElement.type && e.id === verifiedElement.id)) {
              nearbyElements.unshift(verifiedElement);
            }
          }
        } catch {
          // Element doesn't exist on this API server or was deleted
        }
      }
    }

    const osmIdString = matchedElement ? String(matchedElement.id) : '';
    const osmTypeString = matchedElement ? matchedElement.type : '';
    const matchedElementId = matchedElement
      ? `${matchedElement.type}/${matchedElement.id}`
      : undefined;

    // Step 5: Persist session and notify UI with verified API data
    const searchSession: SearchSessionState = {
      query: cleanQuery,
      source,
      coordinates: { lat: parsedLat, lon: parsedLon },
      status: matchedElement ? 'matched' : 'no_match',
      matchedElementId,
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
        nearbyElements,
        matchedElementId,
      },
    });

    messaging.sendMessage('adjustMap', {
      lat: parsedLat,
      lon: parsedLon,
      display_name: firstResult.display_name,
      osm_id: osmIdString,
      osm_type: osmTypeString,
      full_response: firstResult,
      nearbyElements,
      matchedElementId,
    });

    messaging.sendMessage('updateIcon', { state: 'active' });

    return {
      geocode: firstResult,
      matchResult,
      nearbyElements,
      matchedElement,
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

  // Handle page domain navigation change from content scripts
  messaging.onMessage('pageDomainChanged', async ({ data: payload, sender }) => {
    const tabId = payload.tabId ?? sender?.tab?.id;
    if (tabId !== undefined) {
      await browser.action.setBadgeText({ text: '', tabId }).catch(() => {});
      await browser.action.setTitle({ title: 'Browsm: OpenStreetMap Companion', tabId }).catch(() => {});
      await browser.storage.local
        .remove([`tab_schema_${tabId}`, 'currentSchema', 'lookupState', 'searchSession'])
        .catch(() => {});
    } else {
      await browser.storage.local.remove(['currentSchema', 'lookupState', 'searchSession']).catch(() => {});
    }

    messaging.sendMessage('resetSidebar', { reason: 'domain_changed' });
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
