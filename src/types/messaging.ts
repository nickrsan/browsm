/**
 * Extension Messaging Data Contracts
 * Defines strict TypeScript payload types for all cross-component messaging in Browsm.
 */

import type { NominatimResult } from './osm';
import type { SchemaOrgPlace } from './schema';

/**
 * State of the sidebar editor workflow.
 */
export type EditorWorkflowState = 'searching' | 'instructions' | 'response';

/**
 * Action icon visual state.
 */
export type IconState = 'active' | 'inactive' | 'no-address';

/**
 * Payload sent to update the editor view state.
 */
export interface UpdateEditorPayload {
  state: EditorWorkflowState;
}

/**
 * Payload sent to adjust the sidebar map position and display details.
 */
export interface AdjustMapPayload {
  lat: number;
  lon: number;
  display_name: string;
  osm_id: string;
  osm_type?: string;
  full_response: NominatimResult | Record<string, unknown>;
}

/**
 * Payload sent to update the extension action badge and icon status.
 */
export interface UpdateIconPayload {
  state: IconState;
}

/**
 * Payload sent to center and display a coordinate location on the map.
 */
export interface ShowMapPayload {
  display_name: string;
  lat: number;
  lon: number;
}

/**
 * Payload sent when Schema.org or Microdata POI is detected on a web page.
 */
export interface SchemaDetectedPayload {
  place: SchemaOrgPlace;
  tabId?: number;
}

/**
 * Payload sent to initiate a search query from page text selection or manual input.
 */
export interface SearchPoiPayload {
  query: string;
  source: 'selection' | 'manual_search' | 'schema_org';
}
