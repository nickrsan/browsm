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
        'extensions.webextensions.uuids': '{"browsm@nicksantos.com": "browsm-ext-uuid"}',
      },
    });

    const page = await context.newPage();
    console.log('Firefox persistent context launched!');
    await context.close();
  } catch (e) {
    console.error('Firefox error:', e.message);
  }
}

testFirefox();
