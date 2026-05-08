import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', 'dist');

test.describe('AIRSS new tab sanity', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airss-e2e-'));
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('newtab renders the AIRSS heading', async () => {
    const page = await context.newPage();
    await page.goto('chrome://newtab');
    await expect(page.locator('body')).toContainText('AIRSS');
  });
});
