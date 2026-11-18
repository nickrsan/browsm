export interface ManifestEnv {
  browser: string;
}

/**
 * Builds the WebExtension manifest definition according to target browser.
 * Firefox requires `sidebar_action` while Chromium uses `side_panel` and the `sidePanel` permission.
 */
export function generateManifest(env: ManifestEnv) {
  const isFirefox = env.browser === 'firefox';
  return {
    name: "Browsm",
    version: "0.1.0",
    permissions: [
      "contextMenus",
      "notifications",
      "storage",
      "activeTab",
      "scripting",
      "identity",
      ...(isFirefox ? [] : ["sidePanel"]),
    ],
    host_permissions: [
      "https://*.openstreetmap.org/*",
      "https://nominatim.openstreetmap.org/*",
      "https://tiles.openfreemap.org/*",
      "https://*.openfreemap.org/*",
      "https://*.openfreemap.com/*",
      "https://*.openhistoricalmap.org/*",
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://*.openfreemap.org https://*.openfreemap.com; connect-src 'self' https://*.openstreetmap.org https://nominatim.openstreetmap.org https://*.openfreemap.org https://*.openfreemap.com https://*.openhistoricalmap.org;",
    },
    browser_specific_settings: {
      gecko: {
        id: "browsm@nicksantos.com"
      }
    },
    ...(isFirefox
      ? {
          sidebar_action: {
            default_title: "Browsm",
            default_panel: "sidebar.html",
            default_icon: {
              32: "icon/browsm_32.png",
              48: "icon/browsm_48.png",
              64: "icon/browsm_64.png",
            },
          },
        }
      : {
          side_panel: {
            default_path: "sidebar.html",
          },
        }),
    icons: {
      32: "icon/browsm_32.png",
      48: "icon/browsm_48.png",
      64: "icon/browsm_64.png",
    },
  };
}
