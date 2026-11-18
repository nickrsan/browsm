import { describe, it, expect } from 'vitest';
import {
  ENDPOINT_PRESETS,
  DEFAULT_SETTINGS_STATE,
  sanitizeEndpointUrl,
  validateEndpointConfig,
  getEndpointConfig,
  type EndpointConfig,
  type SettingsState,
  type ResolvedEndpoint,
} from '@/types';

describe('Settings Types & Endpoint Presets', () => {
  it('defines valid official endpoint presets for OSM Prod, OSM Dev, and OpenHistoricalMap', () => {
    expect(ENDPOINT_PRESETS['osm-prod']).toBeDefined();
    expect(ENDPOINT_PRESETS['osm-prod'].apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
    expect(ENDPOINT_PRESETS['osm-prod'].authUrl).toBe('https://www.openstreetmap.org/oauth2/authorize');
    expect(ENDPOINT_PRESETS['osm-prod'].tokenUrl).toBe('https://www.openstreetmap.org/oauth2/token');
    expect(ENDPOINT_PRESETS['osm-prod'].webUrl).toBe('https://www.openstreetmap.org');
    expect(ENDPOINT_PRESETS['osm-prod'].scopes).toEqual(['read_prefs', 'write_api', 'write_notes']);

    expect(ENDPOINT_PRESETS['osm-dev']).toBeDefined();
    expect(ENDPOINT_PRESETS['osm-dev'].apiBaseUrl).toBe('https://master.apis.dev.openstreetmap.org/api/0.6');
    expect(ENDPOINT_PRESETS['osm-dev'].authUrl).toBe('https://master.apis.dev.openstreetmap.org/oauth2/authorize');
    expect(ENDPOINT_PRESETS['osm-dev'].tokenUrl).toBe('https://master.apis.dev.openstreetmap.org/oauth2/token');
    expect(ENDPOINT_PRESETS['osm-dev'].webUrl).toBe('https://master.apis.dev.openstreetmap.org');

    expect(ENDPOINT_PRESETS['openhistoricalmap']).toBeDefined();
    expect(ENDPOINT_PRESETS['openhistoricalmap'].apiBaseUrl).toBe('https://www.openhistoricalmap.org/api/0.6');
    expect(ENDPOINT_PRESETS['openhistoricalmap'].authUrl).toBe('https://www.openhistoricalmap.org/oauth2/authorize');
    expect(ENDPOINT_PRESETS['openhistoricalmap'].tokenUrl).toBe('https://www.openhistoricalmap.org/oauth2/token');
    expect(ENDPOINT_PRESETS['openhistoricalmap'].webUrl).toBe('https://www.openhistoricalmap.org');

    expect(ENDPOINT_PRESETS['custom']).toBeDefined();
    expect(ENDPOINT_PRESETS['custom'].id).toBe('custom');
  });

  it('provides sensible default settings state', () => {
    const defaults: SettingsState = DEFAULT_SETTINGS_STATE;
    expect(defaults.activeEndpointId).toBe('osm-prod');
    expect(defaults.devModeRouting).toBe('disabled');
    expect(defaults.preferredEditor).toBe('id');
    expect(defaults.defaultChangesetCommentPrefix).toBe('Surveyed via Browsm');
  });

  it('correctly models ResolvedEndpoint interface', () => {
    const resolved: ResolvedEndpoint = {
      config: ENDPOINT_PRESETS['osm-dev'],
      isDevMode: true,
      routingMode: 'writes_only',
      token: {
        accessToken: 'mock-sandbox-token',
        tokenType: 'Bearer',
        scope: 'read_prefs write_api write_notes',
        createdAt: 1700000000,
      },
    };

    expect(resolved.isDevMode).toBe(true);
    expect(resolved.routingMode).toBe('writes_only');
    expect(resolved.config.apiBaseUrl).toContain('master.apis.dev');
    expect(resolved.token?.accessToken).toBe('mock-sandbox-token');
  });

  describe('sanitizeEndpointUrl', () => {
    it('removes trailing slashes and trims whitespace', () => {
      expect(sanitizeEndpointUrl('  https://api.openstreetmap.org/api/0.6///  ')).toBe(
        'https://api.openstreetmap.org/api/0.6'
      );
      expect(sanitizeEndpointUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    });

    it('handles empty or non-string inputs safely', () => {
      expect(sanitizeEndpointUrl('')).toBe('');
      // @ts-expect-error test invalid runtime input
      expect(sanitizeEndpointUrl(null)).toBe('');
      // @ts-expect-error test invalid runtime input
      expect(sanitizeEndpointUrl(undefined)).toBe('');
    });
  });

  describe('validateEndpointConfig', () => {
    it('validates a complete, valid endpoint configuration', () => {
      const config: EndpointConfig = {
        id: 'local-dev',
        name: 'Local Rails Port',
        description: 'Local development server on port 3000',
        apiBaseUrl: 'http://127.0.0.1:3000/api/0.6',
        authUrl: 'http://127.0.0.1:3000/oauth2/authorize',
        tokenUrl: 'http://127.0.0.1:3000/oauth2/token',
        webUrl: 'http://127.0.0.1:3000',
        clientId: 'local-app-id',
        scopes: ['read_prefs', 'write_api'],
      };

      const result = validateEndpointConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing required fields and invalid URLs', () => {
      const result = validateEndpointConfig({
        name: '',
        apiBaseUrl: 'not-a-valid-url',
        authUrl: 'ftp://invalid-protocol.example.com',
        tokenUrl: '',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Endpoint name is required.');
      expect(result.errors).toContain('API Base URL must be a valid URL format.');
      expect(result.errors).toContain('OAuth Authorize URL must use HTTP or HTTPS protocol.');
      expect(result.errors).toContain('OAuth Token URL is required.');
    });
  });

  describe('getEndpointConfig', () => {
    it('resolves built-in preset configurations by id', () => {
      const osmProd = getEndpointConfig('osm-prod');
      expect(osmProd.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');

      const osmDev = getEndpointConfig('osm-dev');
      expect(osmDev.apiBaseUrl).toBe('https://master.apis.dev.openstreetmap.org/api/0.6');

      const ohm = getEndpointConfig('openhistoricalmap');
      expect(ohm.apiBaseUrl).toBe('https://www.openhistoricalmap.org/api/0.6');
    });

    it('resolves custom endpoint configuration when supplied', () => {
      const customConfig: EndpointConfig = {
        id: 'custom',
        name: 'My Custom OSM Server',
        description: 'Self-hosted regional OSM server',
        apiBaseUrl: 'https://osm.example.org/api/0.6',
        authUrl: 'https://osm.example.org/oauth2/authorize',
        tokenUrl: 'https://osm.example.org/oauth2/token',
        webUrl: 'https://osm.example.org',
        clientId: 'custom-client',
        scopes: ['read_prefs', 'write_api', 'write_notes'],
      };

      const config = getEndpointConfig('custom', customConfig);
      expect(config.name).toBe('My Custom OSM Server');
      expect(config.apiBaseUrl).toBe('https://osm.example.org/api/0.6');
    });

    it('falls back to OSM Production when unknown preset is requested without customConfig', () => {
      const config = getEndpointConfig('non-existent-preset');
      expect(config.id).toBe('osm-prod');
      expect(config.apiBaseUrl).toBe('https://api.openstreetmap.org/api/0.6');
    });
  });
});
