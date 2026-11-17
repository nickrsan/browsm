import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testExtension() {
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
  await page.goto('chrome://extensions-internals');
  const text = await page.textContent('body');
  console.log('Installed extensions:', JSON.parse(text).map(e => ({ id: e.id, name: e.name, path: e.path })));

  // If Browsm is there, get its ID!
  const ext = JSON.parse(text).find(e => e.name === 'Browsm');
  if (ext) {
    console.log('Browsm found with ID:', ext.id);
  }

  await context.close();
}

testExtension().catch(console.error);
