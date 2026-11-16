/**
 * OpenStreetMap & Nominatim Data Models
 * Defines strict TypeScript types for OSM elements, changesets, and geocoding responses.
 */

/**
 * Standard OSM element type representing nodes, ways, and relations.
 */
export type OsmElementType = 'node' | 'way' | 'relation';

/**
 * Key-value mapping for OpenStreetMap tags.
 */
export type OsmTags = Record<string, string>;

/**
 * Coordinate pair representing geographic position.
 */
export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Representation of an OpenStreetMap entity (Node, Way, or Relation).
 */
export interface OsmElement {
  id: number;
  type: OsmElementType;
  lat: number;
  lon: number;
  version: number;
  changeset?: number;
  timestamp?: string;
  user?: string;
  uid?: number;
  tags: OsmTags;
  /**
   * For ways/structures, ordered list of node coordinates defining the polygon perimeter.
   */
  geometry?: LatLon[];
  /**
   * Indicates whether this entity represents a building or structure containing POI tags.
   */
  isStructure?: boolean;
}

/**
 * OSM Changeset metadata used when creating and updating map edits.
 */
export interface OsmChangeset {
  id?: number;
  isOpen: boolean;
  createdAt: string;
  closedAt?: string;
  tags: {
    created_by: string;
    comment: string;
    source?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Address details object returned by Nominatim reverse and search geocoding.
 */
export interface NominatimAddress {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  amenity?: string;
  shop?: string;
  building?: string;
  [key: string]: string | undefined;
}

/**
 * Structured response from Nominatim Geocoding API (`https://nominatim.openstreetmap.org/search`).
 */
export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: OsmElementType | string;
  osm_id: number | string;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype?: string;
  name?: string;
  display_name: string;
  address?: NominatimAddress;
  boundingbox?: [string, string, string, string];
  extratags?: Record<string, string>;
}
