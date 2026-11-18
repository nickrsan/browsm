/**
 * Schema.org and In-Page Microdata Data Models
 * Defines types for structured business, address, and POI data extracted from web pages.
 */

/**
 * Structured postal address extracted from Schema.org markup.
 */
export interface SchemaOrgAddress {
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

/**
 * Geographic coordinates extracted from Schema.org geo markup.
 */
export interface SchemaOrgGeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Representation of a Place or LocalBusiness extracted from Schema.org JSON-LD or Microdata.
 */
export interface SchemaOrgPlace {
  /**
   * Primary name of the business or place.
   */
  name?: string;
  /**
   * Alternate or secondary name.
   */
  alternateName?: string;
  /**
   * Schema type, e.g. "Restaurant", "LocalBusiness", "Store", "Place".
   */
  type: string;
  /**
   * Structured address components.
   */
  address?: SchemaOrgAddress;
  /**
   * Geographic coordinates if embedded in markup.
   */
  geo?: SchemaOrgGeoCoordinates;
  /**
   * Contact telephone number.
   */
  telephone?: string;
  /**
   * Primary website or canonical URL.
   */
  url?: string;
  /**
   * Extracted opening hours specification strings (e.g. "Mo-Fr 09:00-17:00").
   */
  openingHours?: string[];
  /**
   * Contact email address.
   */
  email?: string;
  /**
   * Originating page URL from which this record was extracted.
   */
  sourceUrl: string;
  /**
   * Specific extraction source mechanism (e.g. JSON-LD, Microdata, OpenGraph).
   */
  metadataSource?: 'json_ld' | 'microdata' | 'opengraph' | 'heuristic' | string;
}
