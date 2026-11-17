import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../../.output/chrome-mv3');

// Simple static server
const server = http.createServer((req, res) => {
  let filePath = path.join(distDir, req.url.split('?')[0]);
  if (req.url === '/' || req.url === '/sidebar.html') filePath = path.join(distDir, 'sidebar.html');

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log('Test server running on port:', port);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Inject webextension mock API
  await page.addInitScript(() => {
    const storageData = {};
    const mockStorage = {
      get: (keys) => Promise.resolve(keys ? (typeof keys === 'string' ? { [keys]: storageData[keys] } : storageData) : storageData),
      set: (obj) => { Object.assign(storageData, obj); return Promise.resolve(); },
      remove: (key) => { delete storageData[key]; return Promise.resolve(); },
    };
    window.browser = {
      storage: { local: mockStorage, sync: mockStorage },
      runtime: {
        id: 'test-ext-id',
        getURL: (p) => `http://localhost:${window.location.port}/${p}`,
        sendMessage: () => Promise.resolve({ success: true }),
        onMessage: { addListener: () => {}, removeListener: () => {} },
      },
      tabs: { query: () => Promise.resolve([{ id: 1, url: 'https://example.com' }]) },
    };
    window.chrome = window.browser;
  });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto(`http://localhost:${port}/sidebar.html`);
  console.log('Sidebar page loaded!');
  console.log('Sidebar title:', await page.title());
  const header = await page.textContent('.sidebar-main-title');
  console.log('Sidebar header text:', header);

  await browser.close();
  server.close();
});
