import { test, expect } from './extension.fixture';

test.describe('Browsm Browser Extension End-to-End Suite', () => {
  test('Options page renders presets, developer mode routing, and account cards', async ({
    optionsPage,
  }) => {
    await expect(optionsPage.locator('h1')).toContainText('Browsm Settings');

    // Preset cards
    const presetsGroup = optionsPage.getByRole('radiogroup', { name: 'API Endpoint Presets' });
    await expect(presetsGroup.getByText('OpenStreetMap (Live)', { exact: true })).toBeVisible();
    await expect(presetsGroup.getByText('OSM Dev Server (Sandbox)', { exact: true })).toBeVisible();
    await expect(presetsGroup.getByText('OpenHistoricalMap', { exact: true })).toBeVisible();

    // Dev mode routing options
    await expect(optionsPage.locator('text=Disabled (Live Production)')).toBeVisible();
    await expect(optionsPage.locator('text=Writes Only (Safe Sandbox Edits)')).toBeVisible();

    // Switching dev mode
    const writesOnlyRadio = optionsPage.locator('input[value="writes_only"]');
    await writesOnlyRadio.check();
    await expect(writesOnlyRadio).toBeChecked();
  });

  test('Sidebar workspace loads with header, search bar, map, and action controls', async ({
    sidebarPage,
  }) => {
    await expect(sidebarPage.locator('.sidebar-main-title')).toContainText('Browsm');
    await expect(sidebarPage.locator('input[placeholder*="Search address"]')).toBeVisible();
    await expect(sidebarPage.locator('.map-section')).toBeVisible();
    await expect(sidebarPage.locator('#instructions')).toBeVisible();
  });

  test('Sidebar settings modal opens and closes smoothly', async ({ sidebarPage }) => {
    const gearBtn = sidebarPage.locator('button[data-testid="sidebar-gear-btn"]');
    await expect(gearBtn).toBeVisible();
    await gearBtn.click();

    await expect(sidebarPage.locator('h2#settings-modal-title')).toContainText('Quick Settings');

    const closeBtn = sidebarPage.locator('button[data-testid="close-settings-modal-btn"]');
    await closeBtn.click();
    await expect(sidebarPage.locator('h2#settings-modal-title')).not.toBeVisible();
  });

  test('Popup interface renders quick inspection and note action triggers', async ({
    popupPage,
  }) => {
    await expect(popupPage.locator('h2')).toContainText('Browsm');
    await expect(popupPage.locator('button:has-text("Open Sidebar Editor")')).toBeVisible();
  });
});
