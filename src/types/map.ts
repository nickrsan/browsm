/**
 * MapLibre & OpenFreeMap Data Models
 * Defines TypeScript interfaces for vector map markers, structure overlays, and styles.
 */

import type { OsmElement } from './osm';

/**
 * Category indicating the semantic role and marker color of a map pin.
 */
export type MapMarkerCategory = 'source' | 'matched' | 'nearby' | 'custom' | 'structure';

/**
 * Representation of a POI marker rendered on the MapLibre vector map.
 */
export interface MapMarker {
  id: string | number;
  lat: number;
  lon: number;
  title?: string;
  category?: MapMarkerCategory;
  element?: OsmElement;
}

/**
 * Representation of a building or structure polygon with POI tags.
 */
export interface MapStructure {
  id: string | number;
  geometry: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
  name?: string;
  isStructure?: boolean;
  element?: OsmElement;
}

/**
 * Vector tile style options supported by OpenFreeMap.
 */
export type MapStyleType = 'liberty' | 'bright' | 'positron' | 'dark' | 'auto';

/**
 * OpenFreeMap CDN vector style URLs (Free, global CDN, zero API key required).
 */
export const OPENFREEMAP_STYLES = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;
