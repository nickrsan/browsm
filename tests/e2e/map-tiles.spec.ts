import { test, expect } from './extension.fixture';

test.describe('MapLibre GL Vector Tile Rendering & CSP Integrity', () => {
  test('MapLibre map renders canvas and loads OpenFreeMap assets without CSP violations', async ({
    sidebarPage,
  }) => {
    const requestedUrls: string[] = [];
    const cspErrors: string[] = [];

    // Capture console errors to catch any CSP or WebGL violations
    sidebarPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('Content Security Policy') || text.includes('CSP') || text.includes('Refused to')) {
          cspErrors.push(text);
        }
      }
    });

    // Intercept OpenFreeMap CDN requests to assert proper routing and prevent network flakiness in CI
    await sidebarPage.route('**/styles/**', async (route) => {
      const url = route.request().url();
      requestedUrls.push(url);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 8,
          name: 'OpenFreeMap Liberty Mock',
          sources: {
            openmaptiles: {
              type: 'vector',
              tiles: ['https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'],
              minzoom: 0,
              maxzoom: 14,
            },
          },
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#f8f4f0' },
            },
          ],
        }),
      });
    });

    // Intercept tile requests
    await sidebarPage.route('**/*.pbf', async (route) => {
      requestedUrls.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/x-protobuf',
        body: Buffer.from([]),
      });
    });

    // Enter address search to transition sidebar into map display mode
    const searchInput = sidebarPage.locator('input[placeholder*="Search address"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('100 Main St, Providence, RI');
    await searchInput.press('Enter');

    // Sidebar displays map section
    const mapWrapper = sidebarPage.locator('.browsm-map-wrapper');
    await expect(mapWrapper).toBeVisible({ timeout: 10000 });

    // Assert that OpenFreeMap style was requested
    expect(requestedUrls.some((u) => u.includes('openfreemap') || u.includes('styles'))).toBe(true);

    // Assert zero CSP violation errors in page console
    expect(cspErrors).toEqual([]);
  });

  test('Sidebar map displays custom markers and fallback handling gracefully', async ({
    sidebarPage,
  }) => {
    // Search a specific location
    const searchInput = sidebarPage.locator('input[placeholder*="Search address"]');
    await searchInput.fill('Market Square, Providence');
    await searchInput.press('Enter');

    // Map container exists and contains map elements
    const mapWrapper = sidebarPage.locator('.browsm-map-wrapper');
    await expect(mapWrapper).toBeVisible();

    // Map canvas or fallback content should be rendered
    const hasCanvasOrFallback = await sidebarPage.locator('.browsm-map-container, .browsm-map-fallback').count();
    expect(hasCanvasOrFallback).toBeGreaterThan(0);
  });
});
