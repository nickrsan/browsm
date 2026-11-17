import { firefox } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToFirefoxExt = path.resolve(__dirname, '../../.output/firefox-mv3');

async function testFirefox() {
  console.log('Testing launch Firefox with path:', pathToFirefoxExt);
  try {
    const context = await firefox.launchPersistentContext('', {
      headless: true,
      args: ['-headless'],
      firefoxUserPrefs: {
        'extensions.webextensions.uuids': '{"browsm@nicksantos.com": "e7b0a8f8-b342-4f3b-8ea9-4be6458569bf"}',
      },
    });

    console.log('Firefox persistent context launched!');
    const page = await context.newPage();
    page.on('console', msg => console.log('FIREFOX CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('FIREFOX PAGE ERROR:', err));

    await page.goto('moz-extension://e7b0a8f8-b342-4f3b-8ea9-4be6458569bf/sidebar.html');
    console.log('Firefox sidebar page opened!');
    console.log('Title:', await page.title());

    await context.close();
  } catch (e) {
    console.error('Firefox error:', e);
  }
}

testFirefox();
