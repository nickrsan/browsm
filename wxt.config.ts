import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: "Browsm",
    version: "0.1.0",
    permissions: [
      "contextMenus",
      "notifications",
      "storage",
      "activeTab",
      "scripting",
      "identity",
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
    side_panel: {
      default_path: "sidebar.html"
    },
    icons: {
      32: "icon/browsm_32.png",
      48: "icon/browsm_48.png",
      64: "icon/browsm_64.png"
    },
  }
});
