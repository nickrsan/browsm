import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');
const bgScript = fs.readFileSync(path.join(pathToExtension, 'background.js'), 'utf8');

async function testBg() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  try {
    await page.evaluate((code) => {
      // Create mock browser object
      window.browser = {
        storage: { local: { get: () => Promise.resolve({}), set: () => Promise.resolve() } },
        runtime: { onMessage: { addListener: () => {} }, sendMessage: () => Promise.resolve() },
      };
      eval(code);
    }, bgScript);
    console.log('Evaluated background.js successfully without errors');
  } catch (e) {
    console.error('Eval error:', e);
  }

  await browser.close();
}

testBg();
