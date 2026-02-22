import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: "Browsm",
    version: "1.0",
    permissions: [
      "contextMenus",
      "notifications",
      "storage",
      "activeTab",
      "scripting",
      "declarativeNetRequest",
      "declarativeNetRequestWithHostAccess"
    ],
    host_permissions: [
      "<all_urls>",
      "https://www.openstreetmap.org/*"
    ],
    declarative_net_request: {
      rule_resources: [
        {
          id: "header-rules",
          enabled: true,
          path: "rules.json"
        }
      ]
    },
    browser_specific_settings: {
      gecko: {
        id: "browsm@nicksantos.com"
      }
    },
    web_accessible_resources: [
      {
        resources: ["oauth-callback.html"],
        matches: ["https://www.openstreetmap.org/*"]
      }
    ],
    sidebar_action: {
      default_title: "Browsm",
      default_panel: "sidebar.html"
    },
    side_panel: {
      default_path: "sidebar.html"
    }
  }
});
