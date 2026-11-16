/**
 * Tag Comparison, Spatial Matching, and Session State Models
 * Defines data structures for comparing extracted web data against live OSM entities.
 */

import type { OsmElement } from './osm';

/**
 * Status of an individual tag comparison item.
 */
export type TagDiffStatus =
  | 'identical'
  | 'missing_in_osm'
  | 'outdated_in_osm'
  | 'conflict'
  | 'new_in_page';

/**
 * Action selected by the user for applying a tag update.
 */
export type TagDiffAction = 'apply' | 'ignore' | 'custom';

/**
 * Individual tag comparison item representing a single OSM key-value discrepancy.
 */
export interface TagDiffItem {
  key: string;
  sourceValue?: string;
  osmValue?: string;
  stagedValue: string;
  status: TagDiffStatus;
  action: TagDiffAction;
  customValue?: string;
}

/**
 * Result of spatial matching between webpage POI data and nearby OSM entities.
 */
export interface SpatialMatchResult {
  matchStatus: 'exact_match' | 'possible_match' | 'no_match';
  targetCoordinates: { lat: number; lon: number };
  matchedElement?: OsmElement;
  nearbyElements: OsmElement[];
  tagDiffs: TagDiffItem[];
}

/**
 * State of an active search / browse session in the extension sidebar.
 */
export interface SearchSessionState {
  query: string;
  source: 'selection' | 'schema_org' | 'manual_search' | 'map_browse';
  coordinates?: { lat: number; lon: number };
  status: 'idle' | 'searching' | 'matched' | 'no_match' | 'error';
  errorMessage?: string;
  matchedElementId?: string;
  nearbyElements: OsmElement[];
}
