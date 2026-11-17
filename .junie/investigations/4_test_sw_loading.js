import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testWithArgs(name, options) {
  console.log(`\n--- Testing ${name} ---`);
  let context;
  try {
    context = await chromium.launchPersistentContext('', options);
    console.log('Browser launched.');
    
    // Check if service workers already present
    let sw = context.serviceWorkers();
    console.log('Initial service workers:', sw.map(s => s.url()));

    if (sw.length === 0) {
      console.log('Waiting for serviceworker event (3s)...');
      try {
        const found = await context.waitForEvent('serviceworker', { timeout: 3000 });
        console.log('Event found SW:', found.url());
      } catch (e) {
        console.log('No SW event in 3s');
      }
    }

    // Check chrome://extensions-internals
    const page = await context.newPage();
    await page.goto('chrome://extensions-internals');
    const text = await page.textContent('body');
    const parsed = JSON.parse(text);
    console.log('Installed extensions:', parsed.map(e => ({ id: e.id, name: e.name })));
    
    if (parsed.length > 0) {
      const ext = parsed.find(e => e.name === 'Browsm');
      if (ext) {
        console.log('Found Browsm extension ID:', ext.id);
        const sidebarPage = await context.newPage();
        await sidebarPage.goto(`chrome-extension://${ext.id}/sidebar.html`);
        console.log('Sidebar title:', await sidebarPage.title());
        const heading = await sidebarPage.textContent('.sidebar-main-title');
        console.log('Sidebar heading:', heading);
      }
    }
  } catch (err) {
    console.error('Error in ' + name, err.message);
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

async function main() {
  await testWithArgs('headless: false with --headless=new and ignoreDefaultArgs', {
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      '--headless=new',
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ]
  });

  await testWithArgs('headless: true with channel chromium and ignoreDefaultArgs', {
    headless: true,
    channel: 'chromium',
    ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
    ]
  });
}

main().catch(console.error);
