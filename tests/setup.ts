import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const mockStorage: Record<string, unknown> = {};

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn().mockReturnValue(false),
    },
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        if (!key) return mockStorage;
        return { [key]: mockStorage[key] };
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(async () => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
    },
  },
  action: {
    setIcon: vi.fn().mockResolvedValue(undefined),
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
    setPopup: vi.fn().mockResolvedValue(undefined),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  notifications: {
    create: vi.fn().mockResolvedValue('test-notification-id'),
  },
  tabs: {
    create: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
  },
  sidePanel: {
    setOptions: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue(undefined),
  },
};

// Polyfill globals for webextension-polyfill and browser extension tests
// @ts-ignore
globalThis.chrome = mockChrome;
// @ts-ignore
globalThis.browser = mockChrome;
