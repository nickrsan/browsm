/**
 * Multi-Endpoint and Developer Mode Settings Data Models
 * Defines types, presets, and validation utilities for multi-target OSM/OHM backends,
 * granular developer mode read/write split routing, and user preferences.
 */

import type { OsmAuthToken } from './auth';

/**
 * Identifier for supported built-in endpoint presets or custom target.
 */
export type EndpointPreset = 'osm-prod' | 'osm-dev' | 'openhistoricalmap' | 'custom';

/**
 * Granular Developer Mode routing strategies.
 * - 'disabled': Standard live mode. Reads and writes target active endpoint (default: OSM Production).
 * - 'writes_only': Split routing. Reads query live OSM production for real POIs; writes (changesets, nodes, notes) route to Dev API.
 * - 'reads_and_writes': Full sandbox. Both reads and writes route to OSM Dev API sandbox.
 */
export type DevModeRouting = 'disabled' | 'writes_only' | 'reads_and_writes';

/**
 * User's preferred external OpenStreetMap editor.
 */
export type PreferredEditor = 'id' | 'rapid' | 'josm';

/**
 * Comprehensive configuration for an OpenStreetMap-compatible API and OAuth 2.0 backend.
 */
export interface EndpointConfig {
  id: string;
  name: string;
  description: string;
  apiBaseUrl: string;
  authUrl: string;
  tokenUrl: string;
  webUrl: string;
  clientId: string;
  scopes: string[];
}

/**
 * Global persistent settings state stored in browser.storage.local.
 */
export interface SettingsState {
  activeEndpointId: EndpointPreset | string;
  devModeRouting: DevModeRouting;
  customEndpoint?: EndpointConfig;
  defaultChangesetCommentPrefix?: string;
  preferredEditor: PreferredEditor;
}

/**
 * Resolved runtime endpoint metadata containing active configuration, token, and routing flags.
 */
export interface ResolvedEndpoint {
  config: EndpointConfig;
  token?: OsmAuthToken;
  isDevMode: boolean;
  routingMode: DevModeRouting;
}

/**
 * Registry of official built-in endpoint presets.
 */
export const ENDPOINT_PRESETS: Record<EndpointPreset, EndpointConfig> = {
  'osm-prod': {
    id: 'osm-prod',
    name: 'OpenStreetMap (Live)',
    description: 'The standard live OpenStreetMap production database and API.',
    apiBaseUrl: 'https://api.openstreetmap.org/api/0.6',
    authUrl: 'https://www.openstreetmap.org/oauth2/authorize',
    tokenUrl: 'https://www.openstreetmap.org/oauth2/token',
    webUrl: 'https://www.openstreetmap.org',
    clientId: 'browsm-web-extension',
    scopes: ['read_prefs', 'write_api', 'write_notes'],
  },
  'osm-dev': {
    id: 'osm-dev',
    name: 'OSM Dev Server (Sandbox)',
    description: 'OpenStreetMap sandbox testing environment for safe experimentation without modifying live data.',
    apiBaseUrl: 'https://master.apis.dev.openstreetmap.org/api/0.6',
    authUrl: 'https://master.apis.dev.openstreetmap.org/oauth2/authorize',
    tokenUrl: 'https://master.apis.dev.openstreetmap.org/oauth2/token',
    webUrl: 'https://master.apis.dev.openstreetmap.org',
    clientId: 'browsm-web-extension',
    scopes: ['read_prefs', 'write_api', 'write_notes'],
  },
  'openhistoricalmap': {
    id: 'openhistoricalmap',
    name: 'OpenHistoricalMap',
    description: 'Open historical mapping platform powered by OpenStreetMap API 0.6 and OAuth 2.0 architecture.',
    apiBaseUrl: 'https://www.openhistoricalmap.org/api/0.6',
    authUrl: 'https://www.openhistoricalmap.org/oauth2/authorize',
    tokenUrl: 'https://www.openhistoricalmap.org/oauth2/token',
    webUrl: 'https://www.openhistoricalmap.org',
    clientId: 'browsm-web-extension',
    scopes: ['read_prefs', 'write_api', 'write_notes'],
  },
  'custom': {
    id: 'custom',
    name: 'Custom Instance',
    description: 'User-configured OpenStreetMap Rails port, local development server, or regional deployment.',
    apiBaseUrl: '',
    authUrl: '',
    tokenUrl: '',
    webUrl: '',
    clientId: 'browsm-web-extension',
    scopes: ['read_prefs', 'write_api', 'write_notes'],
  },
};

/**
 * Default settings configuration for fresh installations.
 */
export const DEFAULT_SETTINGS_STATE: SettingsState = {
  activeEndpointId: 'osm-prod',
  devModeRouting: 'disabled',
  defaultChangesetCommentPrefix: 'Surveyed via Browsm',
  preferredEditor: 'id',
};

/**
 * Sanitizes and normalizes an endpoint URL (trims whitespace and removes trailing slashes).
 */
export function sanitizeEndpointUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  return trimmed.replace(/\/+$/, '');
}

/**
 * Validates a custom or preset EndpointConfig object.
 */
export function validateEndpointConfig(config: Partial<EndpointConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Endpoint name is required.');
  }

  const validateUrl = (url: string | undefined, fieldName: string) => {
    if (!url || url.trim().length === 0) {
      errors.push(`${fieldName} is required.`);
      return;
    }
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push(`${fieldName} must use HTTP or HTTPS protocol.`);
      }
    } catch {
      errors.push(`${fieldName} must be a valid URL format.`);
    }
  };

  validateUrl(config.apiBaseUrl, 'API Base URL');
  validateUrl(config.authUrl, 'OAuth Authorize URL');
  validateUrl(config.tokenUrl, 'OAuth Token URL');

  if (config.webUrl) {
    try {
      const parsed = new URL(config.webUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push('Web URL must use HTTP or HTTPS protocol.');
      }
    } catch {
      errors.push('Web URL must be a valid URL format.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Resolves an EndpointConfig by its identifier or fallback custom configuration.
 */
export function getEndpointConfig(
  endpointId: EndpointPreset | string,
  customConfig?: EndpointConfig
): EndpointConfig {
  if (endpointId in ENDPOINT_PRESETS && endpointId !== 'custom') {
    return ENDPOINT_PRESETS[endpointId as EndpointPreset];
  }

  if (endpointId === 'custom' && customConfig) {
    return {
      ...ENDPOINT_PRESETS.custom,
      ...customConfig,
      id: 'custom',
    };
  }

  if (customConfig && customConfig.id === endpointId) {
    return customConfig;
  }

  // Fallback to OSM Production preset if not found
  return ENDPOINT_PRESETS['osm-prod'];
}
