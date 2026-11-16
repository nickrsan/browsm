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
        '--disable-gpu',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    const extensionId = background.url().split('/')[2];
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
