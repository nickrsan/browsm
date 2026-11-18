import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');
const extId = 'blkfojginckkcfbcpkibbgbbjojkpgch';

async function testComputedId() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  const page = await context.newPage();
  console.log(`Navigating to chrome-extension://${extId}/sidebar.html...`);
  try {
    await page.goto(`chrome-extension://${extId}/sidebar.html`);
    console.log('Sidebar loaded! Title:', await page.title());
  } catch (e) {
    console.error('Error navigating:', e.message);
  }

  await context.close();
}

testComputedId().catch(console.error);
