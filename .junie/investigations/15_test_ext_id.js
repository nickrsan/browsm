import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function getExtId() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  // What service workers exist right away?
  console.log('SWs immediately:', context.serviceWorkers().map(s => s.url()));

  // What if we open a page or check targets?
  const page = await context.newPage();
  
  // What pages/targets exist?
  console.log('Pages:', context.pages().map(p => p.url()));
  console.log('Background pages:', context.backgroundPages().map(p => p.url()));
  
  // Wait a second and check SWs again
  await page.waitForTimeout(1000);
  console.log('SWs after 1s:', context.serviceWorkers().map(s => s.url()));

  await context.close();
}

getExtId().catch(console.error);
