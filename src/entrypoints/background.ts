import { messaging } from '@/lib/messaging';
import type { NominatimResult } from '@/types/osm';

export default defineBackground(() => {
  const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';

  /**
   * Validates an address query against the OpenStreetMap Nominatim geocoding service.
   * Enforces a descriptive User-Agent header in compliance with Nominatim API usage policies.
   */
  async function validateAddress(address: string): Promise<NominatimResult | null> {
    const queryUrl = `${NOMINATIM_API}?q=${encodeURIComponent(address)}&format=json&addressdetails=1`;
    try {
      const response = await fetch(queryUrl, {
        headers: {
          'User-Agent': 'Browsm/0.1.0 (OpenStreetMap POI Editor Extension)',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Nominatim query failed with HTTP status ${response.status}`);
      }
      const results: NominatimResult[] = await response.json();
      if (results && results.length > 0) {
        return results[0];
      }
      return null;
    } catch (error) {
      console.error('Error querying Nominatim:', error);
      return null;
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: 'check-address',
      title: 'Check Address in OSM',
      contexts: ['selection'],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'check-address' && info.selectionText && tab?.id !== undefined) {
      const selectedText = info.selectionText.trim();

      // Open sidebar or side panel depending on browser platform
      if (import.meta.env.BROWSER === 'firefox') {
        // @ts-ignore Firefox sidebar action API
        if (browser.sidebarAction?.open) {
          // @ts-ignore
          browser.sidebarAction.open();
        }
      } else if (import.meta.env.BROWSER === 'chrome') {
        // @ts-ignore Chromium side panel API
        if (browser.sidePanel?.setOptions && browser.sidePanel?.open) {
          // @ts-ignore
          browser.sidePanel.setOptions({
            tabId: tab.id,
            path: 'sidebar.html',
            enabled: true,
          });
          // @ts-ignore
          browser.sidePanel.open({ tabId: tab.id });
        }
      } else {
        browser.action.setPopup({ popup: 'sidebar.html' });
      }

      await browser.storage.local.set({
        lookupState: {
          state: 'searching',
          timestamp: Date.now(),
        },
      });
      messaging.sendMessage('updateEditor', { state: 'searching' });

      browser.notifications.create({
        type: 'basic',
        iconUrl: '/icon/browsm_64.png',
        title: 'Validating Address...',
        message: `Checking if "${selectedText}" has already been added to OpenStreetMap.`,
      });

      const result = await validateAddress(selectedText);

      if (result && result.addresstype !== 'road' && result.name !== '') {
        const parsedLat = Number(result.lat);
        const parsedLon = Number(result.lon);
        const osmIdString = String(result.osm_id);

        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/browsm_64.png',
          title: 'Address Found!',
          message: `Valid address detected: ${result.display_name}\nCoordinates: ${result.lat}, ${result.lon}`,
        });

        await browser.storage.local.set({
          lookupState: {
            state: 'response',
            lat: parsedLat,
            lon: parsedLon,
            display_name: result.display_name,
            osm_id: osmIdString,
            full_response: result,
            timestamp: Date.now(),
          },
        });

        messaging.sendMessage('adjustMap', {
          lat: parsedLat,
          lon: parsedLon,
          display_name: result.display_name,
          osm_id: osmIdString,
          osm_type: typeof result.osm_type === 'string' ? result.osm_type : undefined,
          full_response: result,
        });

        messaging.sendMessage('updateIcon', { state: 'active' });
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: '/icon/browsm_64.png',
          title: 'Address Not Found!',
          message: `Could not find the address: "${selectedText}".`,
        });
      }
    }
  });

  messaging.onMessage('updateIcon', ({ data: payload }) => {
    const { state } = payload;
    let iconPath: string;
    switch (state) {
      case 'active':
        iconPath = '/icon/browsm_64.png';
        break;
      case 'inactive':
      case 'no-address':
        iconPath = '/icon/browsm_64.png';
        break;
      default:
        iconPath = '/icon/browsm_64.png';
        break;
    }
    browser.action.setIcon({ path: iconPath });
  });

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
});
