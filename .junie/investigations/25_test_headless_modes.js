import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testMode(name, opts) {
  console.log(`\nTesting mode: ${name}`);
  let context;
  try {
    context = await chromium.launchPersistentContext('', opts);
    let sw = context.serviceWorkers();
    console.log(`Immediate SWs in ${name}:`, sw.map(s => s.url()));
    if (!sw.length) {
      try {
        const found = await context.waitForEvent('serviceworker', { timeout: 2000 });
        console.log(`SW event in ${name}:`, found.url());
      } catch (e) {
        console.log(`No SW event in ${name}`);
      }
    }
  } catch (err) {
    console.log(`Error in ${name}:`, err.message);
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function main() {
  await testMode('headless: false with --headless=new', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  await testMode('headless: false with --headless=old', {
    headless: false,
    args: [
      '--headless=old',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });

  await testMode('headless: true with args', {
    headless: true,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ],
  });
}

main();
