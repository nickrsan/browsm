import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function test() {
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  console.log('Context launched in headless: true');
  let [background] = context.serviceWorkers();
  if (!background) {
    console.log('Waiting for serviceworker...');
    try {
      background = await context.waitForEvent('serviceworker', { timeout: 4000 });
      console.log('SW URL:', background.url());
    } catch (e) {
      console.log('Timeout waiting for SW');
    }
  } else {
    console.log('Immediate SW URL:', background.url());
  }

  await context.close();
}

test();
