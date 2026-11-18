import { describe, it, expect, vi } from 'vitest';
import { messaging } from '@/lib/messaging';
import type {
  UpdateEditorPayload,
  AdjustMapPayload,
  UpdateIconPayload,
  ShowMapPayload,
  SchemaDetectedPayload,
  SearchPoiPayload,
} from '@/types/messaging';

describe('Messaging Contracts & Protocol', () => {
  it('exposes messaging sender and receiver functions', () => {
    expect(messaging.sendMessage).toBeDefined();
    expect(messaging.onMessage).toBeDefined();
  });

  it('validates UpdateEditorPayload structure', () => {
    const payload: UpdateEditorPayload = {
      state: 'searching',
    };
    expect(['searching', 'instructions', 'response']).toContain(payload.state);
  });

  it('validates AdjustMapPayload structure', () => {
    const payload: AdjustMapPayload = {
      lat: 41.4901,
      lon: -71.3128,
      display_name: 'Test Place, Newport, RI',
      osm_id: '1234567',
      osm_type: 'node',
      full_response: {
        place_id: 123,
        lat: '41.4901',
        lon: '-71.3128',
      },
    };

    expect(typeof payload.lat).toBe('number');
    expect(typeof payload.lon).toBe('number');
    expect(payload.display_name).toBe('Test Place, Newport, RI');
    expect(payload.osm_id).toBe('1234567');
    expect(payload.osm_type).toBe('node');
  });

  it('validates UpdateIconPayload structure', () => {
    const payload: UpdateIconPayload = {
      state: 'active',
    };
    expect(['active', 'inactive', 'no-address']).toContain(payload.state);
  });

  it('validates ShowMapPayload structure', () => {
    const payload: ShowMapPayload = {
      display_name: 'Custom Location',
      lat: 51.5074,
      lon: -0.1278,
    };
    expect(payload.lat).toBe(51.5074);
    expect(payload.lon).toBe(-0.1278);
  });

  it('validates SchemaDetectedPayload structure', () => {
    const payload: SchemaDetectedPayload = {
      place: {
        name: 'The Daily Cafe',
        type: 'Cafe',
        sourceUrl: 'https://dailycafe.example.com',
      },
      tabId: 42,
    };
    expect(payload.place.name).toBe('The Daily Cafe');
    expect(payload.tabId).toBe(42);
  });

  it('validates SearchPoiPayload structure', () => {
    const payload: SearchPoiPayload = {
      query: '123 Main St, Springfield',
      source: 'manual_search',
    };
    expect(payload.query).toBe('123 Main St, Springfield');
    expect(payload.source).toBe('manual_search');
  });
});
