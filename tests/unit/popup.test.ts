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
});
