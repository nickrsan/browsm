import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

const binaries = [
  '/home/nick-santos/.cache/ms-playwright/chromium-1105/chrome-linux/chrome',
  '/home/nick-santos/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  '/home/nick-santos/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
];

async function testBinary(binPath) {
  console.log('\nTesting binary:', binPath);
  try {
    const context = await chromium.launchPersistentContext('', {
      executablePath: binPath,
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
    const exts = JSON.parse(text);
    console.log('Installed extensions count:', exts.length, exts.map(e => e.name));
    await context.close();
  } catch (e) {
    console.error('Failed with:', e.message);
  }
}

async function main() {
  for (const bin of binaries) {
    await testBinary(bin);
  }
}

main().catch(console.error);
