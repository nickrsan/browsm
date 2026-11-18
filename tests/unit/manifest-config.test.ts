import { describe, it, expect } from 'vitest';
import { generateManifest } from '@/config/manifest';

describe('Extension Manifest Generation', () => {
  it('generates a compliant manifest for Firefox MV3 with sidebar_action and without side_panel', () => {
    const manifest = generateManifest({ browser: 'firefox' });

    expect(manifest.name).toBe('Browsm');
    expect(manifest.version).toBe('0.1.0');
    expect(manifest.browser_specific_settings.gecko.id).toBe('browsm@nicksantos.com');

    // Firefox must have sidebar_action configured
    expect(manifest).toHaveProperty('sidebar_action');
    expect((manifest as any).sidebar_action).toEqual({
      default_title: 'Browsm',
      default_panel: 'sidebar.html',
      default_icon: {
        32: 'icon/browsm_32.png',
        48: 'icon/browsm_48.png',
        64: 'icon/browsm_64.png',
      },
    });

    // Firefox must NOT have side_panel or sidePanel permission
    expect((manifest as any).side_panel).toBeUndefined();
    expect(manifest.permissions).not.toContain('sidePanel');

    // Verify required permissions
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.permissions).toContain('identity');

    // Verify CSP contains proper directives
    expect(manifest.content_security_policy.extension_pages).toContain("worker-src 'self' blob:;");
    expect(manifest.content_security_policy.extension_pages).toContain("style-src 'self' 'unsafe-inline';");
    expect(manifest.content_security_policy.extension_pages).toContain('https://*.openfreemap.org');
  });

  it('generates a compliant manifest for Chromium MV3 with side_panel and sidePanel permission', () => {
    const manifest = generateManifest({ browser: 'chrome' });

    expect(manifest.name).toBe('Browsm');
    expect(manifest.version).toBe('0.1.0');

    // Chromium must have side_panel and sidePanel permission
    expect(manifest).toHaveProperty('side_panel');
    expect((manifest as any).side_panel).toEqual({
      default_path: 'sidebar.html',
    });
    expect(manifest.permissions).toContain('sidePanel');

    // Chromium must NOT have sidebar_action
    expect((manifest as any).sidebar_action).toBeUndefined();
  });
});
