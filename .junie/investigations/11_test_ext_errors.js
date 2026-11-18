import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testLogging() {
  console.log('Testing extension loading from:', pathToExtension);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--headless=new',
      `--load-extension=${pathToExtension}`,
      `--disable-extensions-except=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  const page = await context.newPage();
  await page.goto('chrome://extensions');
  const text = await page.textContent('body');
  console.log('Extensions page body:', text);

  await context.close();
}

testLogging().catch(console.error);
