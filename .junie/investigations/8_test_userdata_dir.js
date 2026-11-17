import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testOptions() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-test-profile-'));
  console.log('Tmp dir:', tmpDir);
  console.log('Ext path:', pathToExtension);

  // Let's test standard launchPersistentContext with userDataDir
  const context = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  console.log('Service workers:', context.serviceWorkers().map(s => s.url()));
  
  // Try opening chrome://extensions
  const page = await context.newPage();
  await page.goto('chrome://extensions-internals');
  const text = await page.textContent('body');
  console.log('Extensions-internals in headless=false:', JSON.parse(text).map(e => e.name));

  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

testOptions().catch(console.error);
