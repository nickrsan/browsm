import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');
const fixedId = 'onmgodgkamegnkbkkdbheoiobellncel';

async function testFixedId() {
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
  console.log(`Navigating to chrome-extension://${fixedId}/sidebar.html...`);
  await page.goto(`chrome-extension://${fixedId}/sidebar.html`);
  console.log('Sidebar page loaded!');
  console.log('Title:', await page.title());
  const header = await page.textContent('.sidebar-main-title');
  console.log('Header text:', header);

  console.log('Service workers after page load:', context.serviceWorkers().map(s => s.url()));

  await context.close();
}

testFixedId().catch(console.error);
