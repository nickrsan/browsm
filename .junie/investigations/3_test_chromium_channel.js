import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function run() {
  console.log('Testing launchPersistentContext with channel: chromium');
  try {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker', { timeout: 5000 });
    }
    console.log('Service worker found:', serviceWorker.url());
    const extId = serviceWorker.url().split('/')[2];
    console.log('Extension ID:', extId);

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/sidebar.html`);
    console.log('Sidebar loaded! Title:', await page.title());

    await context.close();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
