import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  sidebarPage: Page;
  optionsPage: Page;
  popupPage: Page;
}

let testServer: http.Server | null = null;
let serverPort = 0;

/**
 * Ensures an HTTP static server is serving the extension distribution for headless Playwright testing.
 */
async function ensureServer(): Promise<number> {
  if (testServer && serverPort) return serverPort;
  const distDir = path.resolve(__dirname, '../../.output/chrome-mv3');

  return new Promise((resolve) => {
    testServer = http.createServer((req, res) => {
      let filePath = path.join(distDir, (req.url || '/').split('?')[0]);
      if (req.url === '/' || req.url === '/sidebar.html') filePath = path.join(distDir, 'sidebar.html');

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.mjs': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
          '.pbf': 'application/x-protobuf',
        };
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    testServer.listen(0, () => {
      serverPort = (testServer!.address() as any).port;
      resolve(serverPort);
    });
  });
}

function getInitScript(): () => void {
  return () => {
    const storageData: Record<string, any> = {};
    const messageListeners: Array<(msg: any) => void> = [];
    const storageListeners: Array<(changes: any, area: string) => void> = [];

    const mockStorage = {
      get: (keys?: string | string[] | Record<string, any>) =>
        Promise.resolve(keys ? (typeof keys === 'string' ? { [keys]: storageData[keys] } : storageData) : storageData),
      set: (obj: Record<string, any>) => {
        const changes: Record<string, any> = {};
        for (const [k, v] of Object.entries(obj)) {
          changes[k] = { oldValue: storageData[k], newValue: v };
          storageData[k] = v;
        }
        storageListeners.forEach((cb) => {
          try {
            cb(changes, 'local');
          } catch {}
        });
        return Promise.resolve();
      },
      remove: (key: string) => {
        delete storageData[key];
        return Promise.resolve();
      },
      onChanged: {
        addListener: (cb: any) => storageListeners.push(cb),
        removeListener: (cb: any) => {
          const idx = storageListeners.indexOf(cb);
          if (idx >= 0) storageListeners.splice(idx, 1);
        },
      },
    };

    (window as any).browser = {
      storage: {
        local: mockStorage,
        sync: mockStorage,
        onChanged: mockStorage.onChanged,
      },
      runtime: {
        id: 'browsm-test-extension',
        getURL: (p: string) => `http://localhost:${window.location.port}/${p}`,
        sendMessage: (msg: any, payload?: any) => {
          const type = typeof msg === 'string' ? msg : msg?.type || msg?.name;
          const data = typeof msg === 'string' ? payload : msg?.data || msg?.payload;

          if (type === 'searchPoi' && data?.query) {
            setTimeout(() => {
              const now = Date.now();
              const session = {
                query: data.query,
                source: data.source || 'manual_search',
                coordinates: { lat: 41.4901, lon: -71.3128 },
                status: 'success',
                matchedCandidate: {
                  id: 'node/12345',
                  name: data.query,
                  type: 'node',
                  lat: 41.4901,
                  lon: -71.3128,
                  tags: { name: data.query, amenity: 'cafe' },
                },
                nearbyElements: [
                  {
                    id: 12345,
                    type: 'node',
                    lat: 41.4901,
                    lon: -71.3128,
                    tags: { name: data.query, amenity: 'cafe' },
                  },
                ],
              };
              mockStorage.set({
                searchSession: session,
                lookupState: {
                  state: 'response',
                  lat: 41.4901,
                  lon: -71.3128,
                  display_name: data.query,
                  osm_id: '12345',
                  osm_type: 'node',
                  timestamp: now,
                  nearbyElements: session.nearbyElements,
                },
              });
              messageListeners.forEach((l: any) => {
                try {
                  l(
                    {
                      id: Math.floor(Math.random() * 10000),
                      type: 'updateEditor',
                      data: {
                        state: 'response',
                        lat: 41.4901,
                        lon: -71.3128,
                        display_name: data.query,
                        osm_id: '12345',
                        osm_type: 'node',
                        timestamp: now,
                        nearbyElements: session.nearbyElements,
                      },
                      timestamp: now,
                    },
                    {},
                    () => {}
                  );
                  l(
                    {
                      id: Math.floor(Math.random() * 10000),
                      type: 'adjustMap',
                      data: {
                        lat: 41.4901,
                        lon: -71.3128,
                        zoom: 17,
                        display_name: data.query,
                        osm_id: '12345',
                        osm_type: 'node',
                      },
                      timestamp: now,
                    },
                    {},
                    () => {}
                  );
                } catch {}
              });
            }, 50);
          }
          return Promise.resolve({ success: true });
        },
        onMessage: {
          addListener: (cb: any) => messageListeners.push(cb),
          removeListener: (cb: any) => {
            const idx = messageListeners.indexOf(cb);
            if (idx >= 0) messageListeners.splice(idx, 1);
          },
        },
      },
      tabs: { query: () => Promise.resolve([{ id: 1, url: 'https://example.com' }]) },
    };
    (window as any).chrome = (window as any).browser;
  };
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await use(context);
    await context.close();
    await browser.close();
  },

  extensionId: async ({}, use) => {
    await use('browsm-test-extension');
  },

  sidebarPage: async ({ context }, use) => {
    const port = await ensureServer();
    const page = await context.newPage();
    await page.addInitScript(getInitScript());
    await page.goto(`http://localhost:${port}/sidebar.html`);
    await use(page);
  },

  optionsPage: async ({ context }, use) => {
    const port = await ensureServer();
    const page = await context.newPage();
    await page.addInitScript(getInitScript());
    await page.goto(`http://localhost:${port}/options.html`);
    await use(page);
  },

  popupPage: async ({ context }, use) => {
    const port = await ensureServer();
    const page = await context.newPage();
    await page.addInitScript(getInitScript());
    await page.goto(`http://localhost:${port}/popup.html`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
