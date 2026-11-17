import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  sidebarPage: Page;
  optionsPage: Page;
  popupPage: Page;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Look for Browsm's background service worker
    let workers = context.serviceWorkers();
    let browsmWorker = workers.find(
      (sw) => sw.url().endsWith('/background.js') && !sw.url().includes('admccjkmockfdflocgggjfgdacdodkdf')
    );

    if (!browsmWorker) {
      // Query chrome://extensions-internals as a reliable way to get loaded extension ID
      try {
        const tempPage = await context.newPage();
        await tempPage.goto('chrome://extensions-internals');
        const text = await tempPage.textContent('body');
        const exts = JSON.parse(text || '[]');
        const browsmExt = exts.find((e: { name: string; id: string }) => e.name === 'Browsm');
        await tempPage.close();
        if (browsmExt?.id) {
          await use(browsmExt.id);
          return;
        }
      } catch {
        // Fallback
      }

      const sw = await context.waitForEvent('serviceworker', { timeout: 5000 });
      browsmWorker = sw;
    }

    const extensionId = browsmWorker.url().split('/')[2];
    await use(extensionId);
  },

  sidebarPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidebar.html`);
    await use(page);
  },

  optionsPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await use(page);
  },

  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(page);
  },
});

export { expect } from '@playwright/test';
