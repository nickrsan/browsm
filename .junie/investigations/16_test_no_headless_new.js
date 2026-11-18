import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testHeadlessModes() {
  console.log('Testing with headless: false, args without --headless=new');
  try {
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    console.log('Context created');
    let sw = context.serviceWorkers();
    console.log('Immediate SW:', sw.map(s => s.url()));
    if (!sw.length) {
      console.log('Waiting for SW...');
      try {
        const found = await context.waitForEvent('serviceworker', { timeout: 3000 });
        console.log('Found SW:', found.url());
      } catch (e) {
        console.log('Timeout waiting for SW');
      }
    }
    await context.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testHeadlessModes();
