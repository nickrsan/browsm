import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function run() {
  console.log('Launching browser with extension:', pathToExtension);
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

  console.log('Context launched. Service workers:', context.serviceWorkers().map(s => s.url()));
  
  // What if we open chrome://serviceworker-internals or chrome://extensions?
  const page = await context.newPage();
  await page.goto('chrome://serviceworker-internals/');
  const text = await page.textContent('body');
  console.log('SW internals:\n', text.slice(0, 1000));

  await context.close();
}

run().catch(console.error);
