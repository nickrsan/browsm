/**
 * OpenStreetMap OAuth 2.0 PKCE & API Data Models
 * Strict TypeScript types for authentication, user profiles, changesets, and Map Notes.
 */

import type { OsmElement, OsmTags } from './osm';

/**
 * OpenStreetMap OAuth 2.0 Client Configuration.
 */
export interface OsmAuthConfig {
  clientId: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  apiBaseUrl: string;
  scopes: string[];
}

/**
 * Default OpenStreetMap OAuth 2.0 Configuration for Browsm.
 */
export const DEFAULT_OSM_AUTH_CONFIG: OsmAuthConfig = {
  clientId: 'browsm-web-extension',
  redirectUri: typeof browser !== 'undefined' && browser.identity?.getRedirectURL
    ? browser.identity.getRedirectURL('osm-auth')
    : 'https://127.0.0.1/osm-auth',
  authUrl: 'https://www.openstreetmap.org/oauth2/authorize',
  tokenUrl: 'https://www.openstreetmap.org/oauth2/token',
  apiBaseUrl: 'https://api.openstreetmap.org/api/0.6',
  scopes: ['read_prefs', 'write_api', 'write_notes'],
};

/**
 * OAuth 2.0 Access Token response payload.
 */
export interface OsmAuthToken {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: number;
  expiresIn?: number;
  refreshToken?: string;
}

/**
 * OpenStreetMap authenticated user profile details.
 */
export interface OsmUserDetails {
  id: number;
  username: string;
  accountCreated: string;
  changesetCount?: number;
  description?: string;
  img?: string;
  roles?: string[];
}

/**
 * Global reactive authentication state for OpenStreetMap.
 */
export interface OsmAuthState {
  isAuthenticated: boolean;
  user?: OsmUserDetails;
  token?: OsmAuthToken;
  isLoading: boolean;
  error?: string;
}

/**
 * Parameters for creating an OSM Changeset.
 */
export interface CreateChangesetParams {
  comment: string;
  source?: string;
  createdBy?: string;
  extraTags?: Record<string, string>;
}

/**
 * Parameters for creating a new OSM Node.
 */
export interface CreateNodeParams {
  changesetId: number;
  lat: number;
  lon: number;
  tags: OsmTags;
}

/**
 * Parameters for updating an existing OSM Node.
 */
export interface UpdateNodeParams {
  changesetId: number;
  id: number;
  lat: number;
  lon: number;
  version: number;
  tags: OsmTags;
}

/**
 * Parameters for updating an existing OSM Way (e.g., building polygon with POI tags).
 */
export interface UpdateWayParams {
  changesetId: number;
  id: number;
  version: number;
  tags: OsmTags;
  nodeRefs: number[];
}

/**
 * OpenStreetMap Map Note entity.
 */
export interface OsmNote {
  id: number;
  lat: number;
  lon: number;
  url: string;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt?: string;
  comments: Array<{
    date: string;
    user?: string;
    uid?: number;
    action: 'opened' | 'commented' | 'closed' | 'reopened';
    text: string;
  }>;
}

/**
 * Parameters for creating a new OSM Map Note.
 */
export interface CreateNoteParams {
  lat: number;
  lon: number;
  text: string;
}
