import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testPageFirst() {
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

  const page = await context.newPage();
  await page.goto('chrome://extensions');
  console.log('Opened chrome://extensions');

  const sws = context.serviceWorkers();
  console.log('SWs after opening extensions:', sws.map(s => s.url()));

  await context.close();
}

testPageFirst().catch(console.error);
