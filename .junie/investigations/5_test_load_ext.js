import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

console.log('Path exists:', fs.existsSync(pathToExtension));
console.log('Manifest exists:', fs.existsSync(path.join(pathToExtension, 'manifest.json')));
console.log('Manifest content:', fs.readFileSync(path.join(pathToExtension, 'manifest.json'), 'utf8'));

async function testDirect() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--headless=new',
      `--load-extension=${pathToExtension}`,
      `--disable-extensions-except=${pathToExtension}`,
      '--no-sandbox',
      '--enable-logging=stderr',
      '--v=1',
    ],
  });

  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto('chrome://extensions');
  console.log('Opened chrome://extensions');
  
  await context.close();
}

testDirect().catch(console.error);
