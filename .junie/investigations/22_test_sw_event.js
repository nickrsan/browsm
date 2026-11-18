import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testEvent() {
  console.log('Starting launchPersistentContext...');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  console.log('Context launched. Checking service workers...');
  let [background] = context.serviceWorkers();
  if (!background) {
    console.log('SW not present immediately, waiting for event...');
    background = await context.waitForEvent('serviceworker');
  }
  console.log('Background SW found:', background.url());
  const extId = background.url().split('/')[2];
  console.log('Extension ID:', extId);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/sidebar.html`);
  console.log('Sidebar page loaded!');
  console.log('Title:', await page.title());

  await context.close();
}

testEvent().catch(console.error);
