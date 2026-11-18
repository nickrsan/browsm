/**
 * Centralized Dynamic Endpoint Routing Resolver
 * Determines the target API base URL, OAuth configuration, and access tokens
 * based on operation type ('read' vs. 'write') and granular Developer Mode routing flags.
 */

import {
  ENDPOINT_PRESETS,
  DEFAULT_SETTINGS_STATE,
  getEndpointConfig,
  type SettingsState,
  type ResolvedEndpoint,
  type DevModeRouting,
  type EndpointConfig,
} from '@/types/settings';
import type { OsmAuthState, OsmAuthToken } from '@/types/auth';
import { getStoredAuthState, getAllStoredAuthStates } from './osm-auth';

export const SETTINGS_STORAGE_KEY = 'browsm_settings_state';

/**
 * Visual badge representation for extension headers.
 */
export interface EndpointBadgeInfo {
  text: string;
  variant: 'default' | 'warning' | 'danger' | 'purple' | 'teal';
  tooltip: string;
  isDev: boolean;
}

/**
 * Loads current settings from browser storage with fallback to default settings.
 */
export async function loadStoredSettings(): Promise<SettingsState> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const data = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
      const stored = data[SETTINGS_STORAGE_KEY] as SettingsState | undefined;
      if (stored && stored.activeEndpointId) {
        return {
          ...DEFAULT_SETTINGS_STATE,
          ...stored,
        };
      }
    }
  } catch (err) {
    console.debug('[Browsm] Error loading stored settings:', err);
  }
  return DEFAULT_SETTINGS_STATE;
}

/**
 * Synchronously resolves the target endpoint configuration and auth token.
 */
export function resolveEndpointSync(
  operationType: 'read' | 'write',
  settings: SettingsState = DEFAULT_SETTINGS_STATE,
  authStateMap: Record<string, OsmAuthState> = {}
): ResolvedEndpoint {
  const routingMode = settings.devModeRouting || 'disabled';

  // 1. Dev Mode: Writes Only (Split Routing)
  if (routingMode === 'writes_only') {
    if (operationType === 'read') {
      // Reads target live OpenStreetMap production
      const config = ENDPOINT_PRESETS['osm-prod'];
      const token = authStateMap['osm-prod']?.token;
      return {
        config,
        token,
        isDevMode: true,
        routingMode: 'writes_only',
      };
    } else {
      // Writes (changesets, nodes, notes) route safely to Dev API sandbox
      const config = ENDPOINT_PRESETS['osm-dev'];
      const token = authStateMap['osm-dev']?.token;
      return {
        config,
        token,
        isDevMode: true,
        routingMode: 'writes_only',
      };
    }
  }

  // 2. Dev Mode: Full Sandbox (Reads and Writes to Dev API)
  if (routingMode === 'reads_and_writes') {
    const config = ENDPOINT_PRESETS['osm-dev'];
    const token = authStateMap['osm-dev']?.token;
    return {
      config,
      token,
      isDevMode: true,
      routingMode: 'reads_and_writes',
    };
  }

  // 3. Dev Mode Disabled (Standard Live or explicit target)
  const targetId = settings.activeEndpointId || 'osm-prod';
  const config = getEndpointConfig(targetId, settings.customEndpoint);
  const token = authStateMap[targetId]?.token;
  const isDevMode = targetId === 'osm-dev';

  return {
    config,
    token,
    isDevMode,
    routingMode: 'disabled',
  };
}

/**
 * Asynchronously resolves the active endpoint configuration and access token.
 */
export async function resolveApiEndpoint(
  operationType: 'read' | 'write',
  customSettings?: SettingsState,
  customAuthMap?: Record<string, OsmAuthState>
): Promise<ResolvedEndpoint> {
  const settings = customSettings || (await loadStoredSettings());
  const authMap = customAuthMap || (await getAllStoredAuthStates());
  return resolveEndpointSync(operationType, settings, authMap);
}

/**
 * Convenience helper to resolve the read endpoint.
 */
export async function resolveReadEndpoint(
  customSettings?: SettingsState,
  customAuthMap?: Record<string, OsmAuthState>
): Promise<ResolvedEndpoint> {
  return resolveApiEndpoint('read', customSettings, customAuthMap);
}

/**
 * Convenience helper to resolve the write endpoint.
 */
export async function resolveWriteEndpoint(
  customSettings?: SettingsState,
  customAuthMap?: Record<string, OsmAuthState>
): Promise<ResolvedEndpoint> {
  return resolveApiEndpoint('write', customSettings, customAuthMap);
}

/**
 * Generates badge metadata for the sidebar and popup headers based on current settings.
 */
export function getEndpointBadgeInfo(settings: SettingsState): EndpointBadgeInfo {
  const routing = settings.devModeRouting || 'disabled';

  if (routing === 'writes_only') {
    return {
      text: 'DEV: WRITES ONLY',
      variant: 'warning',
      tooltip: 'Developer Mode (Writes Only): Reads live OSM data, test edits route to OSM Dev sandbox.',
      isDev: true,
    };
  }

  if (routing === 'reads_and_writes') {
    return {
      text: 'DEV: FULL',
      variant: 'danger',
      tooltip: 'Full Developer Sandbox: All reads & writes route to OSM Dev server exclusively.',
      isDev: true,
    };
  }

  // Dev Mode Disabled
  const activeId = settings.activeEndpointId || 'osm-prod';

  if (activeId === 'openhistoricalmap') {
    return {
      text: 'OHM',
      variant: 'purple',
      tooltip: 'OpenHistoricalMap: Connected to OpenHistoricalMap API.',
      isDev: false,
    };
  }

  if (activeId === 'osm-dev') {
    return {
      text: 'DEV API',
      variant: 'danger',
      tooltip: 'OSM Dev Server: Connected to sandbox API.',
      isDev: true,
    };
  }

  if (activeId === 'custom') {
    const customName = settings.customEndpoint?.name || 'Custom';
    return {
      text: 'CUSTOM',
      variant: 'teal',
      tooltip: `Custom API: Connected to ${customName}`,
      isDev: false,
    };
  }

  // Default OSM Production
  return {
    text: '',
    variant: 'default',
    tooltip: 'OpenStreetMap (Live Production)',
    isDev: false,
  };
}
