import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pathToExtension = path.resolve(__dirname, '../../.output/chrome-mv3');

async function testWithArgs() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-'));
  try {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages'],
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    const page = await context.newPage();
    page.on('console', msg => console.log('PAGE:', msg.text()));
    
    // Check chrome://version to see command line flags
    await page.goto('chrome://version');
    const cmdLine = await page.textContent('#command_line');
    console.log('Command Line Flags:\n', cmdLine);

    await context.close();
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

testWithArgs().catch(console.error);
