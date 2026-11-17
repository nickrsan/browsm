import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import MapLibreMap from '@/components/MapLibreMap.svelte';
import { OPENFREEMAP_STYLES, type MapMarker, type MapStructure } from '@/types/map';

const { mockAddProtocol } = vi.hoisted(() => ({
  mockAddProtocol: vi.fn(),
}));

const mockFlyTo = vi.fn();
const mockAddSource = vi.fn();
const mockAddLayer = vi.fn();
const mockAddControl = vi.fn();
const mockOn = vi.fn();
const mockRemove = vi.fn();
const mockSetData = vi.fn();
const mockGetSource = vi.fn().mockReturnValue({ setData: mockSetData });
const mockGetCenter = vi.fn().mockReturnValue({ lng: 0, lat: 0 });
const mockGetCanvas = vi.fn().mockReturnValue({ style: {} });
const mockSetStyle = vi.fn();

const mockMarkerSetLngLat = vi.fn().mockReturnThis();
const mockMarkerAddTo = vi.fn().mockReturnThis();
const mockMarkerSetPopup = vi.fn().mockReturnThis();
const mockMarkerRemove = vi.fn();

let mapConstructorOptions: any = null;

vi.mock('maplibre-gl', () => {
  return {
    addProtocol: mockAddProtocol,
    Map: vi.fn().mockImplementation(function (options: any) {
      mapConstructorOptions = options;
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
        setStyle: mockSetStyle,
      };
    }),
    Marker: vi.fn().mockImplementation(function () {
      return {
        setLngLat: mockMarkerSetLngLat,
        addTo: mockMarkerAddTo,
        setPopup: mockMarkerSetPopup,
        remove: mockMarkerRemove,
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

describe('MapLibreMap.svelte & Map Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapConstructorOptions = null;
  });

  it('registers PMTiles protocol handler with MapLibre', () => {
    render(MapLibreMap, {
      center: [-71.3128, 41.4901],
      zoom: 14,
    });

    expect(mockAddProtocol).toHaveBeenCalledWith('pmtiles', expect.any(Function));
  });

  it('defines valid OpenFreeMap CDN vector style URLs without API keys', () => {
    expect(OPENFREEMAP_STYLES.liberty).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(OPENFREEMAP_STYLES.bright).toBe('https://tiles.openfreemap.org/styles/bright');
    expect(OPENFREEMAP_STYLES.positron).toBe('https://tiles.openfreemap.org/styles/positron');
    expect(OPENFREEMAP_STYLES.dark).toBe('https://tiles.openfreemap.org/styles/dark');
  });

  it('renders MapLibre vector map wrapper element with custom height', () => {
    const { container } = render(MapLibreMap, {
      height: '350px',
      center: [-71.3128, 41.4901],
      zoom: 15,
    });

    const wrapper = container.querySelector('.browsm-map-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveStyle({ height: '350px' });
  });

  it('initializes MapLibre with the requested style type', () => {
    render(MapLibreMap, {
      styleType: 'dark',
      center: [-71.3128, 41.4901],
      zoom: 14,
    });

    expect(mapConstructorOptions).toBeDefined();
    expect(mapConstructorOptions.style).toBe(OPENFREEMAP_STYLES.dark);
    expect(mapConstructorOptions.center).toEqual([-71.3128, 41.4901]);
    expect(mapConstructorOptions.zoom).toBe(14);
  });

  it('registers layers and sources when map loads', () => {
    const structures: MapStructure[] = [
      {
        id: 'way/100',
        name: 'Historic Mill Building',
        isStructure: true,
        geometry: [
          { lat: 41.4901, lon: -71.3128 },
          { lat: 41.4905, lon: -71.3128 },
          { lat: 41.4905, lon: -71.3120 },
          { lat: 41.4901, lon: -71.3120 },
        ],
        tags: {
          building: 'commercial',
          amenity: 'restaurant',
          name: 'Historic Mill Restaurant',
        },
      },
    ];

    render(MapLibreMap, {
      structures,
      selectedElementId: 'way/100',
    });

    // Simulate map 'load' event callback
    const loadHandler = mockOn.mock.calls.find((call) => call[0] === 'load')?.[1];
    expect(loadHandler).toBeDefined();
    loadHandler();

    expect(mockAddSource).toHaveBeenCalledWith(
      'browsm-structures-source',
      expect.objectContaining({
        type: 'geojson',
        data: expect.objectContaining({
          type: 'FeatureCollection',
          features: expect.arrayContaining([
            expect.objectContaining({
              id: 'way/100',
              properties: expect.objectContaining({
                id: 'way/100',
                name: 'Historic Mill Building',
                isSelected: true,
              }),
            }),
          ]),
        }),
      })
    );

    expect(mockAddLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'browsm-structures-fill', type: 'fill' })
    );
    expect(mockAddLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'browsm-structures-line', type: 'line' })
    );
  });

  it('instantiates styled marker pins for provided POI coordinates', async () => {
    const markers: MapMarker[] = [
      {
        id: 'poi-1',
        lat: 41.4901,
        lon: -71.3128,
        title: 'Matched Anchor Pub',
        category: 'matched',
      },
      {
        id: 'poi-2',
        lat: 41.4909,
        lon: -71.3135,
        title: 'Nearby Coffee Shop',
        category: 'nearby',
      },
    ];

    render(MapLibreMap, {
      markers,
    });

    // Simulate load event
    const loadHandler = mockOn.mock.calls.find((call) => call[0] === 'load')?.[1];
    loadHandler();

    await waitFor(() => {
      expect(mockMarkerSetLngLat).toHaveBeenCalledWith([-71.3128, 41.4901]);
      expect(mockMarkerSetLngLat).toHaveBeenCalledWith([-71.3135, 41.4909]);
      expect(mockMarkerAddTo).toHaveBeenCalled();
    });
  });

  it('renders fallback content when MapLibre initialization throws or WebGL is unsupported', async () => {
    const { Map } = vi.mocked(await import('maplibre-gl'));
    Map.mockImplementationOnce(function () {
      throw new Error('WebGL unsupported');
    });

    const { container } = render(MapLibreMap, {
      center: [-71.3128, 41.4901],
      zoom: 14,
      markers: [
        {
          id: 'poi-1',
          lat: 41.4901,
          lon: -71.3128,
          title: 'Fallback POI',
        },
      ],
    });

    const fallback = container.querySelector('.browsm-map-fallback');
    expect(fallback).toBeInTheDocument();
    expect(fallback?.textContent).toContain('Vector Map View');
    expect(fallback?.textContent).toContain('41.49010, -71.31280');
    expect(fallback?.textContent).toContain('1 POI(s) detected at this location');
  });

  it('handles map click callback passing lat and lon', () => {
    const onMapClick = vi.fn();
    render(MapLibreMap, {
      center: [-71.3128, 41.4901],
      zoom: 14,
      onMapClick,
    });

    const clickHandler = mockOn.mock.calls.find((call) => call[0] === 'click' && typeof call[1] === 'function')?.[1];
    expect(clickHandler).toBeDefined();

    clickHandler({ lngLat: { lng: -71.3128, lat: 41.4901 } });
    expect(onMapClick).toHaveBeenCalledWith({ lat: 41.4901, lon: -71.3128 });
  });
});
