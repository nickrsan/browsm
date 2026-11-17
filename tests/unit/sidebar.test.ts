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

  it('renders the vector map container element', () => {
    const { container } = render(Sidebar);
    const mapDiv = container.querySelector('.map-section');
    expect(mapDiv).toBeInTheDocument();
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

    render(Sidebar);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /The Ocean Cafe/i })).toBeInTheDocument();
      expect(screen.getByText('Tag Diff Matrix')).toBeInTheDocument();
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
});
