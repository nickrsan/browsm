import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Sidebar from '@/entrypoints/sidebar/Sidebar.svelte';
import { messaging } from '@/lib/messaging';

// Mock MapLibre GL
const mockFlyTo = vi.fn();
const mockAddSource = vi.fn();
const mockAddLayer = vi.fn();
const mockAddControl = vi.fn();
const mockOn = vi.fn();
const mockRemove = vi.fn();
const mockGetSource = vi.fn().mockReturnValue({ setData: vi.fn() });
const mockGetCenter = vi.fn().mockReturnValue({ lng: 0, lat: 0 });
const mockGetCanvas = vi.fn().mockReturnValue({ style: {} });

vi.mock('maplibre-gl', () => {
  return {
    Map: vi.fn().mockImplementation(function () {
      return {
        flyTo: mockFlyTo,
        addSource: mockAddSource,
        addLayer: mockAddLayer,
        addControl: mockAddControl,
        on: mockOn,
        remove: mockRemove,
        getSource: mockGetSource,
        getCenter: mockGetCenter,
        getCanvas: mockGetCanvas,
        resize: vi.fn(),
        setStyle: vi.fn(),
      };
    }),
    Marker: vi.fn().mockImplementation(function () {
      return {
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        setPopup: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      };
    }),
    NavigationControl: vi.fn().mockImplementation(function () {
      return {};
    }),
    Popup: vi.fn().mockImplementation(function () {
      return {
        setText: vi.fn().mockReturnThis(),
      };
    }),
  };
});

describe('Sidebar.svelte (Svelte 5 Workspace)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
  });

  it('renders initial instructions state and header title', () => {
    render(Sidebar);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Browsm');
    expect(screen.getByText(/How to use Browsm:/i)).toBeInTheDocument();
  });

  it('hides vector map and comparison matrix in initial instructions state', () => {
    const { container } = render(Sidebar);
    const mapDiv = container.querySelector('.map-section');
    expect(mapDiv).toBeNull();
    expect(screen.queryByText('Tag Comparison Matrix')).not.toBeInTheDocument();
    expect(screen.getByText(/How to use Browsm:/i)).toBeInTheDocument();
  });

  it('loads and displays initial state when storage contains a saved lookup', async () => {
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      lookupState: {
        state: 'response',
        lat: 41.4901,
        lon: -71.3128,
        display_name: 'The Ocean Cafe, Newport, RI',
        osm_id: '123456',
        full_response: {
          place_id: 12345,
          osm_type: 'node',
          osm_id: '123456',
          lat: '41.4901',
          lon: '-71.3128',
          display_name: 'The Ocean Cafe, Newport, RI',
        },
        timestamp: 100,
      },
    });

    const { container } = render(Sidebar);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /The Ocean Cafe/i })).toBeInTheDocument();
      expect(screen.getByText('Tag Comparison Matrix')).toBeInTheDocument();
      expect(container.querySelector('.map-section')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Commit Changeset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Note/i })).toBeInTheDocument();
    });

    // Test tab navigation (Raw Geo Data)
    const rawTab = screen.getByRole('button', { name: /Raw Geo Data/i });
    await fireEvent.click(rawTab);

    expect(screen.getAllByText(/The Ocean Cafe, Newport, RI/).length).toBeGreaterThan(0);
  });

  it('selects matched live OSM element and populates live OSM tags when nearbyElements is provided', async () => {
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      lookupState: {
        state: 'response',
        lat: 41.4901,
        lon: -71.3128,
        display_name: 'The Rusty Anchor Tavern, Newport, RI',
        osm_id: '98765',
        full_response: {
          place_id: 12345,
          osm_type: 'node',
          osm_id: '98765',
          lat: '41.4901',
          lon: '-71.3128',
          display_name: 'The Rusty Anchor Tavern, Newport, RI',
        },
        nearbyElements: [
          {
            id: 98765,
            type: 'node',
            lat: 41.4901,
            lon: -71.3128,
            version: 2,
            tags: {
              name: 'The Rusty Anchor Tavern',
              amenity: 'pub',
              phone: '+1 401 555 1234',
              website: 'https://rustyanchornewport.com',
            },
          },
        ],
        matchedElementId: 'node/98765',
        timestamp: 100,
      },
    });

    render(Sidebar);

    await waitFor(() => {
      expect(screen.getByText('Tag Comparison Matrix')).toBeInTheDocument();
      // Ensure live OSM values appear in the matrix instead of 'Not in OSM'
      expect(screen.getAllByText('The Rusty Anchor Tavern').length).toBeGreaterThan(0);
      expect(screen.getByText('pub')).toBeInTheDocument();
      expect(screen.getByText('+1 401 555 1234')).toBeInTheDocument();
      expect(screen.getByText('https://rustyanchornewport.com')).toBeInTheDocument();
    });
  });

  it('triggers direct search messaging on form submit', async () => {
    const sendMessageSpy = vi.spyOn(messaging, 'sendMessage').mockResolvedValue(undefined as any);

    render(Sidebar);

    const searchInput = screen.getByPlaceholderText('Search address, POI, or coordinates...');
    const searchBtn = screen.getByRole('button', { name: 'Search' });

    await fireEvent.input(searchInput, { target: { value: 'Bellevue Ave Newport' } });
    await fireEvent.click(searchBtn);

    expect(sendMessageSpy).toHaveBeenCalledWith('searchPoi', {
      query: 'Bellevue Ave Newport',
      source: 'manual_search',
    });
  });

  it('opens and closes settings modal via gear button', async () => {
    render(Sidebar);

    const gearBtn = screen.getByTestId('sidebar-gear-btn');
    await fireEvent.click(gearBtn);

    expect(screen.getByRole('heading', { level: 2, name: /Quick Settings/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close settings/i });
    await fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Quick Settings/i })).not.toBeInTheDocument();
    });
  });

  it('does not trigger a cascading loop when refreshing user details in message polling', async () => {
    const { authStore } = await import('@/stores/auth.svelte');
    const refreshSpy = vi.spyOn(authStore, 'refreshUserDetails').mockResolvedValue({
      id: 888,
      username: 'non_looping_user',
      accountCreated: '2023-01-01T00:00:00Z',
      unreadMessagesCount: 1,
    });

    render(Sidebar);

    // Allow effects and microtasks to settle
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Browsm');
    });

    // The polling effect should not execute more than once on mount
    expect(refreshSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('does not display searching indicator on cold start when storage contains stale searching state', async () => {
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      lookupState: {
        state: 'searching',
        timestamp: Date.now() - 60000,
      },
    });

    const { container } = render(Sidebar);

    await waitFor(() => {
      // Must not render searching notice or map
      expect(container.querySelector('#searching')).toBeNull();
      expect(screen.queryByText(/Querying OpenStreetMap/i)).not.toBeInTheDocument();
      // Should show instructions card
      expect(screen.getByText(/How to use Browsm:/i)).toBeInTheDocument();
    });
  });

  it('resets sidebar state to clean instructions on pageDomainChanged message', async () => {
    // Intercept messaging.onMessage to capture registered handlers
    const registeredHandlers: Record<string, (msg: any) => void> = {};
    const originalOnMessage = messaging.onMessage;
    vi.spyOn(messaging, 'onMessage').mockImplementation(((type: string, handler: any) => {
      registeredHandlers[type] = handler;
      return () => {
        delete registeredHandlers[type];
      };
    }) as any);

    // Start with a loaded response state in storage
    // @ts-ignore
    globalThis.browser.storage.local.get = vi.fn().mockResolvedValue({
      lookupState: {
        state: 'response',
        lat: 41.4901,
        lon: -71.3128,
        display_name: 'Stale Domain POI',
        osm_id: '123456',
        full_response: { display_name: 'Stale Domain POI' },
      },
      currentSchema: {
        name: 'Stale Place',
        type: 'Restaurant',
      },
    });

    const { container } = render(Sidebar);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Stale Place/i })).toBeInTheDocument();
    });

    // Invoke captured pageDomainChanged handler
    expect(registeredHandlers['pageDomainChanged']).toBeDefined();
    registeredHandlers['pageDomainChanged']({
      data: {
        previousDomain: 'old-site.com',
        newDomain: 'new-site.com',
        url: 'https://new-site.com',
      },
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: /Stale Place/i })).not.toBeInTheDocument();
      expect(screen.getByText(/How to use Browsm:/i)).toBeInTheDocument();
      expect(container.querySelector('.map-section')).toBeNull();
    });
  });
});
