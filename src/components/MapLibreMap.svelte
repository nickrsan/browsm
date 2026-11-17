<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Map as MapLibreInstance,
    Marker,
    NavigationControl,
    Popup,
    type GeoJSONSource,
  } from 'maplibre-gl';
  import type { Feature, FeatureCollection, Polygon } from 'geojson';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import {
    OPENFREEMAP_STYLES,
    type MapMarker,
    type MapStructure,
    type MapStyleType,
    type MapMarkerCategory,
  } from '@/types/map';

  interface Props {
    center?: [number, number]; // [lon, lat]
    zoom?: number;
    markers?: MapMarker[];
    structures?: MapStructure[];
    selectedElementId?: string | number | null;
    styleType?: MapStyleType;
    interactive?: boolean;
    crosshairMode?: boolean;
    height?: string;
    onMarkerClick?: (marker: MapMarker) => void;
    onStructureClick?: (structure: MapStructure) => void;
    onMapClick?: (coords: { lat: number; lon: number }) => void;
  }

  let {
    center = [0, 0],
    zoom = 1,
    markers = [],
    structures = [],
    selectedElementId = null,
    styleType = 'auto',
    interactive = true,
    crosshairMode = false,
    height = '400px',
    onMarkerClick,
    onStructureClick,
    onMapClick,
  }: Props = $props();

  let mapContainer = $state<HTMLDivElement | null>(null);
  let mapInstance = $state<MapLibreInstance | null>(null);
  let isMapLoaded = $state<boolean>(false);
  let webGlSupported = $state<boolean>(true);
  let activeMarkers: Marker[] = [];

  /**
   * Resolves the appropriate OpenFreeMap style URL based on preference and system theme.
   */
  function resolveStyleUrl(preferredStyle: MapStyleType): string {
    if (preferredStyle === 'auto') {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return OPENFREEMAP_STYLES.dark;
      }
      return OPENFREEMAP_STYLES.liberty;
    }
    return OPENFREEMAP_STYLES[preferredStyle] || OPENFREEMAP_STYLES.liberty;
  }

  /**
   * Converts MapStructure polygon coordinates into a valid GeoJSON FeatureCollection.
   */
  function buildStructuresGeoJson(structureList: MapStructure[], selectedId: string | number | null): FeatureCollection {
    const features: Feature[] = structureList
      .filter((s) => s.geometry && s.geometry.length >= 3)
      .map((s) => {
        // Ensure polygon ring is closed (first point === last point)
        const coords = s.geometry.map((pt) => [pt.lon, pt.lat]);
        if (
          coords.length > 0 &&
          (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])
        ) {
          coords.push([coords[0][0], coords[0][1]]);
        }

        const isSelected = selectedId !== null && String(s.id) === String(selectedId);

        return {
          type: 'Feature',
          id: s.id,
          properties: {
            id: s.id,
            name: s.name || s.tags?.name || 'Building / Structure',
            tags: s.tags || {},
            isSelected,
            isStructure: s.isStructure ?? true,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coords],
          },
        };
      });

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Generates a custom styled SVG element for a map marker pin.
   */
  function createMarkerElement(marker: MapMarker): HTMLElement {
    const el = document.createElement('div');
    el.className = `browsm-marker browsm-marker-${marker.category || 'default'}`;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', marker.title || `POI ${marker.id}`);

    // Color definitions for visual hierarchy
    let fillColor = '#1976D2'; // Blue for source webpage
    if (marker.category === 'matched') fillColor = '#2E7D32'; // Green for matched live OSM POI
    if (marker.category === 'nearby') fillColor = '#E65100'; // Orange for nearby POI
    if (marker.category === 'custom') fillColor = '#7B1FA2'; // Purple for custom dropped pin
    if (marker.category === 'structure') fillColor = '#00897B'; // Teal for structure POI

    el.innerHTML = `
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${fillColor}" stroke="#FFFFFF" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="#FFFFFF"/>
      </svg>
    `;

    el.style.cursor = 'pointer';
    el.style.transform = 'translate(-50%, -100%)';

    if (onMarkerClick) {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onMarkerClick(marker);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onMarkerClick(marker);
        }
      });
    }

    return el;
  }

  /**
   * Initializes MapLibre GL instance with OpenFreeMap vector styles and responsive lifecycle.
   */
  onMount(() => {
    if (!mapContainer || typeof window === 'undefined') return;

    let map: MapLibreInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

    try {
      const initialStyleUrl = resolveStyleUrl(styleType);

      const activeMap = new MapLibreInstance({
        container: mapContainer,
        style: initialStyleUrl,
        center: center,
        zoom: zoom,
        interactive: interactive,
        attributionControl: {
          compact: true,
          customAttribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> | <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a>',
        },
      });

      map = activeMap;

      if (interactive) {
        activeMap.addControl(new NavigationControl({ showCompass: true }), 'top-right');
      }

      activeMap.on('load', () => {
        isMapLoaded = true;
        mapInstance = activeMap;

        // Add GeoJSON structure source
        activeMap.addSource('browsm-structures-source', {
          type: 'geojson',
          data: buildStructuresGeoJson(structures, selectedElementId),
        });

        // Add fill layer for structures/buildings
        activeMap.addLayer({
          id: 'browsm-structures-fill',
          type: 'fill',
          source: 'browsm-structures-source',
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              '#2E7D32',
              '#1976D2',
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              0.45,
              0.2,
            ],
          },
        });

        // Add stroke outline layer for structures
        activeMap.addLayer({
          id: 'browsm-structures-line',
          type: 'line',
          source: 'browsm-structures-source',
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              '#1B5E20',
              '#0D47A1',
            ],
            'line-width': [
              'case',
              ['boolean', ['get', 'isSelected'], false],
              2.5,
              1.5,
            ],
          },
        });

        // Interaction events on structure polygons
        activeMap.on('click', 'browsm-structures-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feat = e.features[0];
          const matchedStruct = structures.find((s) => String(s.id) === String(feat.properties?.id));
          if (matchedStruct && onStructureClick) {
            onStructureClick(matchedStruct);
          }
        });

        activeMap.on('mouseenter', 'browsm-structures-fill', () => {
          activeMap.getCanvas().style.cursor = 'pointer';
        });

        activeMap.on('mouseleave', 'browsm-structures-fill', () => {
          activeMap.getCanvas().style.cursor = crosshairMode ? 'crosshair' : '';
        });
      });

      activeMap.on('click', (e) => {
        if (onMapClick) {
          onMapClick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        }
      });

      // Observe container size changes and adjust map viewport accordingly
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (activeMap && isMapLoaded) {
            activeMap.resize();
          }
        });
        resizeObserver.observe(mapContainer);
      }

      // Synchronize dark mode changes dynamically when styleType is 'auto'
      if (styleType === 'auto' && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQueryListener = (e: MediaQueryListEvent) => {
          const newStyle = e.matches ? OPENFREEMAP_STYLES.dark : OPENFREEMAP_STYLES.liberty;
          activeMap.setStyle(newStyle);
        };
        mediaQuery.addEventListener('change', mediaQueryListener);
      }
    } catch (err) {
      console.warn('MapLibre GL initialization error (falling back to placeholder):', err);
      webGlSupported = false;
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mediaQueryListener && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
      }
      activeMarkers.forEach((m) => m.remove());
      activeMarkers = [];
      if (map) {
        map.remove();
      }
      mapInstance = null;
      isMapLoaded = false;
    };
  });

  /**
   * Synchronizes cursor mode for click-to-place pin feature.
   */
  $effect(() => {
    if (mapInstance && isMapLoaded) {
      const canvas = mapInstance.getCanvas();
      if (canvas) {
        canvas.style.cursor = crosshairMode ? 'crosshair' : '';
      }
    }
  });

  /**
   * Synchronizes markers array onto the MapLibre map.
   */
  $effect(() => {
    if (!mapInstance || !isMapLoaded) return;

    // Clean up existing markers
    activeMarkers.forEach((m) => m.remove());
    activeMarkers = [];

    // Render new markers
    for (const marker of markers) {
      if (
        marker.lat !== undefined &&
        marker.lon !== undefined &&
        !Number.isNaN(marker.lat) &&
        !Number.isNaN(marker.lon)
      ) {
        const el = createMarkerElement(marker);
        const maplibreMarker = new Marker({ element: el })
          .setLngLat([marker.lon, marker.lat])
          .addTo(mapInstance);

        if (marker.title) {
          const popup = new Popup({ offset: 25, closeButton: false }).setText(marker.title);
          maplibreMarker.setPopup(popup);
        }

        activeMarkers.push(maplibreMarker);
      }
    }
  });

  /**
   * Synchronizes structure polygons onto the vector map source.
   */
  $effect(() => {
    if (!mapInstance || !isMapLoaded) return;
    const source = mapInstance.getSource('browsm-structures-source') as GeoJSONSource | undefined;
    if (source && typeof source.setData === 'function') {
      source.setData(buildStructuresGeoJson(structures, selectedElementId));
    }
  });

  /**
   * Synchronizes center and zoom updates.
   */
  $effect(() => {
    if (!mapInstance || !isMapLoaded) return;
    if (center && center.length === 2 && !Number.isNaN(center[0]) && !Number.isNaN(center[1])) {
      const currentCenter = mapInstance.getCenter();
      const dist = Math.hypot(currentCenter.lng - center[0], currentCenter.lat - center[1]);
      if (dist > 0.0001) {
        mapInstance.flyTo({
          center: center,
          zoom: zoom,
          essential: true,
          duration: 800,
        });
      }
    }
  });
</script>

<div class="browsm-map-wrapper" style="height: {height};">
  {#if webGlSupported}
    <div class="browsm-map-container" bind:this={mapContainer}></div>
  {:else}
    <div class="browsm-map-fallback">
      <div class="fallback-content">
        <p><strong>Vector Map View</strong></p>
        <p>Coordinates: {center[1].toFixed(5)}, {center[0].toFixed(5)}</p>
        {#if markers.length > 0}
          <p>{markers.length} POI(s) detected at this location</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .browsm-map-wrapper {
    position: relative;
    width: 100%;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #e0e0e0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .browsm-map-container {
    width: 100%;
    height: 100%;
  }

  .browsm-map-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
    color: #495057;
    text-align: center;
    padding: 1rem;
  }

  :global(.maplibregl-popup-content) {
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 500;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }
</style>
