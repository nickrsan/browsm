import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceDir = path.resolve(__dirname, '../../.output/chrome-mv3');
const tempExtDir = path.join(os.tmpdir(), 'browsm-ext-test');

// Copy .output/chrome-mv3 to non-hidden temp dir
fs.cpSync(sourceDir, tempExtDir, { recursive: true });

async function testNonHidden() {
  console.log('Testing with non-hidden path:', tempExtDir);
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${tempExtDir}`,
      `--load-extension=${tempExtDir}`,
      '--no-sandbox',
    ],
  });

  const page = await context.newPage();
  await page.goto('chrome://extensions-internals');
  const text = await page.textContent('body');
  const exts = JSON.parse(text || '[]');
  console.log('Installed extensions:', exts.map(e => ({ name: e.name, id: e.id, path: e.path })));

  await context.close();
  fs.rmSync(tempExtDir, { recursive: true, force: true });
}

testNonHidden().catch(console.error);
