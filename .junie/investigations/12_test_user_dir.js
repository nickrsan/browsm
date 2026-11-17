import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testWithUserDir() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-'));
  console.log('Testing with userDataDir:', userDataDir);
  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [sw] = context.serviceWorkers();
    if (!sw) {
      console.log('Waiting for SW event...');
      try {
        sw = await context.waitForEvent('serviceworker', { timeout: 3000 });
      } catch (e) {
        console.log('SW event timed out');
      }
    }

    console.log('Service workers in context:', context.serviceWorkers().map(s => s.url()));

    const page = await context.newPage();
    await page.goto('chrome://extensions-internals');
    const text = await page.textContent('body');
    const exts = JSON.parse(text);
    console.log('Installed extensions:', exts.map(e => ({ id: e.id, name: e.name })));

    await context.close();
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

testWithUserDir().catch(console.error);
