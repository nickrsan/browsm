import { messaging } from '@/lib/messaging';

export default defineBackground(() => {
  const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";

  async function validateAddress(address: string) {
    const queryUrl = `${NOMINATIM_API}?q=${encodeURIComponent(address)}&format=json`;
    try {
      const response = await fetch(queryUrl, { headers: { "User-Agent": "Browsm1.0" } });
      const results = await response.json();
      if (results && results.length > 0) {
        return results[0];
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error querying Nominatim:", error);
      return null;
    }
  }

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: "check-address",
      title: "Check Address in OSM",
      contexts: ["selection"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "check-address" && info.selectionText && tab?.id !== undefined) {
      const selectedText = info.selectionText.trim();

      // Open sidebar or popup
      // Note: sidebarAction.open() is Firefox-only as per original background.js
      if (import.meta.env.BROWSER === 'firefox') {
        // @ts-ignore
        browser.sidebarAction.open();
      } else if (import.meta.env.BROWSER === 'chrome') {
        // @ts-ignore
        browser.sidePanel.setOptions({
          tabId: tab.id,
          path: 'sidebar.html',
          enabled: true
        });
        // @ts-ignore
        browser.sidePanel.open({ tabId: tab.id });
      } else {
        browser.action.setPopup({ popup: "sidebar.html" });
      }

      await browser.storage.local.set({ 
        lookupState: { state: "searching", timestamp: Date.now() } 
      });
      messaging.sendMessage('updateEditor', { state: "searching" });

      browser.notifications.create({
        type: "basic",
        iconUrl: "/icon/browsm_64.png",
        title: "Validating Address...",
        message: `Checking if "${selectedText}" has already been added to OpenStreetMap.`
      });

      const result = await validateAddress(selectedText);

      if (result && result["addresstype"] != "road" && result["name"] != "") {
        const { display_name, lat, lon } = result;
        
        browser.notifications.create({
          type: "basic",
          iconUrl: "/icon/browsm_64.png",
          title: "Address Found!",
          message: `Valid address detected: ${display_name}\nCoordinates: ${lat}, ${lon}`
        });

        await browser.storage.local.set({
          lookupState: {
            state: "response",
            lat: result.lat,
            lon: result.lon,
            display_name: result.display_name,
            osm_id: result.osm_id,
            full_response: result,
            timestamp: Date.now()
          }
        });

        messaging.sendMessage('adjustMap', {
          lat: result.lat,
          lon: result.lon,
          display_name: result.display_name,
          osm_id: result.osm_id,
          full_response: result
        });

        messaging.sendMessage('updateIcon', { state: "active" });
      } else {
        browser.notifications.create({
          type: "basic",
          iconUrl: "/icon/browsm_64.png",
          title: "Address Not Found!",
          message: `Could not find the address: "${selectedText}".`
        });
      }
    }
  });

  messaging.onMessage('updateIcon', ({ data: payload }) => {
    const { state } = payload;
    let iconPath;
    switch (state) {
      case "active":
        iconPath = "/icon/browsm_64.png"; // Should use success icon if available
        break;
      case "inactive":
      case "no-address":
        iconPath = "/icon/browsm_64.png"; // Should use inactive icon
        break;
      default:
        iconPath = "/icon/browsm_64.png";
        break;
    }
    browser.action.setIcon({ path: iconPath });
  });

  messaging.onMessage('showMap', ({ data: payload }) => {
    // In WXT we don't necessarily need to call openPopup if we use sidebar
    // browser.action.openPopup();
    messaging.sendMessage('adjustMap', payload);
  });
});
