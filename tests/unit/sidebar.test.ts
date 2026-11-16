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

  it('renders initial instructions state and header', () => {
    render(Sidebar);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Look up Address in OSM');
    expect(screen.getByText(/To get started, select an address on a web page/i)).toBeInTheDocument();
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
      expect(screen.getByText('See an issue?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit in iD/i })).toBeInTheDocument();
    });

    // Test toggle full response button
    const toggleButton = screen.getByRole('button', { name: /Show Response/i });
    expect(toggleButton).toBeInTheDocument();

    await fireEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /Hide Response/i })).toBeInTheDocument();
    expect(screen.getByText(/The Ocean Cafe, Newport, RI/)).toBeInTheDocument();

    // Test clicking Edit in iD
    const editButton = screen.getByRole('button', { name: /Edit in iD/i });
    await fireEvent.click(editButton);

    expect((globalThis as any).browser.tabs.create).toHaveBeenCalledWith({
      url: 'https://www.openstreetmap.org/edit?node=123456',
    });
  });
});
