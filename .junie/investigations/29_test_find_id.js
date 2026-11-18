import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testDiscover() {
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
  await page.goto('chrome://serviceworker-internals');
  const text = await page.textContent('body');
  console.log('SW internals content length:', text?.length);
  console.log('SW internals content snippet:\n', text?.slice(0, 500));

  await context.close();
}

testDiscover().catch(console.error);
