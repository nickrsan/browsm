import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Sidebar from '@/entrypoints/sidebar/Sidebar.svelte';
import { messaging } from '@/lib/messaging';

// Mock Leaflet
const mockSetView = vi.fn().mockReturnThis();
const mockRemove = vi.fn();
const mockSetLatLng = vi.fn().mockReturnThis();
const mockBindPopup = vi.fn().mockReturnValue({
  openPopup: vi.fn(),
});
const mockAddTo = vi.fn().mockReturnValue({
  setLatLng: mockSetLatLng,
  bindPopup: mockBindPopup,
});

vi.mock('leaflet', () => {
  return {
    default: {
      map: vi.fn(() => ({
        setView: mockSetView,
        remove: mockRemove,
      })),
      marker: vi.fn(() => ({
        addTo: mockAddTo,
        setLatLng: mockSetLatLng,
        bindPopup: mockBindPopup,
      })),
      tileLayer: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
      })),
    },
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

  it('renders the map container element', () => {
    const { container } = render(Sidebar);
    const mapDiv = container.querySelector('#map');
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
