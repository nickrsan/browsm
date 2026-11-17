import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function test() {
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
  await page.goto('chrome://extensions');
  // In chrome://extensions, check if developer mode is enabled or inspect extensions-manager
  const pageContent = await page.evaluate(() => {
    const manager = document.querySelector('extensions-manager');
    if (!manager) return 'No extensions-manager';
    const items = manager.shadowRoot?.querySelectorAll('extensions-item');
    return items ? Array.from(items).map(i => i.getAttribute('id')) : 'No shadowRoot items';
  });
  console.log('Extensions in extensions-manager:', pageContent);
  await context.close();
}

test().catch(console.error);
