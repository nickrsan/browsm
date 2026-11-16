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
    ],
    browser_specific_settings: {
      gecko: {
        id: "browsm@nicksantos.com"
      }
    },
    sidebar_action: {
      default_title: "Browsm",
      default_panel: "sidebar.html"
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
