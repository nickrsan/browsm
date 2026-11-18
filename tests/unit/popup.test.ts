import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import App from '@/entrypoints/popup/App.svelte';
import { messaging } from '@/lib/messaging';

describe('Popup App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 101 }]),
      },
      runtime: {
        getURL: vi.fn().mockReturnValue('chrome-extension://ext-id/sidebar.html'),
      },
    };
  });

  it('renders default empty state when no schema markup is detected', async () => {
    render(App);

    expect(screen.getByText('Browsm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Sidebar Editor/i })).toBeInTheDocument();
  });

  it('renders detected place card when currentSchema exists in storage', async () => {
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      currentSchema: {
        name: 'The Lobster Shack',
        type: 'Restaurant',
        telephone: '+1 401 555 7777',
        address: {
          streetAddress: '50 Commercial Wharf',
          addressLocality: 'Newport',
          postalCode: '02840',
        },
        geo: {
          latitude: 41.4905,
          longitude: -71.3130,
        },
      },
    });

    render(App);

    expect(await screen.findByText('The Lobster Shack')).toBeInTheDocument();
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
    expect(screen.getByText('+1 401 555 7777')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify in OSM/i })).toBeInTheDocument();
  });

  it('renders detected place card when tab-specific schema exists in storage', async () => {
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockImplementation(async (keys: string[]) => {
      if (keys.includes('tab_schema_101')) {
        return {
          tab_schema_101: {
            name: 'Tab Specific Bakery',
            type: 'Bakery',
            telephone: '+1 401 555 8888',
            sourceUrl: 'https://bakery.example.com',
          },
        };
      }
      return {};
    });

    render(App);

    expect(await screen.findByText('Tab Specific Bakery')).toBeInTheDocument();
    expect(screen.getByText('Bakery')).toBeInTheDocument();
    expect(screen.getByText('+1 401 555 8888')).toBeInTheDocument();
  });

  it('opens sidebar using browser.sidebarAction.open when available (Firefox)', async () => {
    const sidebarActionOpen = vi.fn().mockResolvedValue(undefined);
    // @ts-ignore
    globalThis.browser.sidebarAction = { open: sidebarActionOpen };
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    render(App);

    const openBtn = screen.getByRole('button', { name: /Open Sidebar Editor/i });
    await fireEvent.click(openBtn);

    await vi.waitFor(() => {
      expect(sidebarActionOpen).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  it('opens sidebar using browser.sidePanel.open when available (Chromium)', async () => {
    const sidePanelOpen = vi.fn().mockResolvedValue(undefined);
    const sidePanelSetOptions = vi.fn().mockResolvedValue(undefined);
    // @ts-ignore
    globalThis.browser.sidePanel = { open: sidePanelOpen, setOptions: sidePanelSetOptions };
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    render(App);

    const openBtn = screen.getByRole('button', { name: /Open Sidebar Editor/i });
    await fireEvent.click(openBtn);

    await vi.waitFor(() => {
      expect(sidePanelSetOptions).toHaveBeenCalledWith({
        tabId: 101,
        path: 'sidebar.html',
        enabled: true,
      });
      expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 101 });
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  it('falls back to browser.tabs.create when sidebar APIs are not available', async () => {
    const tabsCreate = vi.fn().mockResolvedValue({ id: 102 });
    // @ts-ignore
    globalThis.browser.tabs.create = tabsCreate;
    // @ts-ignore
    globalThis.browser.runtime = { getURL: vi.fn().mockReturnValue('moz-extension://ext-id/sidebar.html') };
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

    render(App);

    const openBtn = screen.getByRole('button', { name: /Open Sidebar Editor/i });
    await fireEvent.click(openBtn);

    await vi.waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith({ url: 'moz-extension://ext-id/sidebar.html' });
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});
