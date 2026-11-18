import { describe, it, expect } from 'vitest';
import type {
  OsmElement,
  OsmChangeset,
  NominatimResult,
  SchemaOrgPlace,
  TagDiffItem,
  SearchSessionState,
} from '@/types';

describe('Data Models & Types', () => {
  it('correctly models an OpenStreetMap Node entity', () => {
    const node: OsmElement = {
      id: 123456,
      type: 'node',
      lat: 41.4901,
      lon: -71.3128,
      version: 3,
      changeset: 98765,
      timestamp: '2026-11-16T10:00:00Z',
      user: 'mapper123',
      uid: 54321,
      tags: {
        amenity: 'restaurant',
        name: 'The Ocean Cafe',
        'addr:street': 'Ocean Ave',
        'addr:housenumber': '100',
        phone: '+1 401 555 0199',
        website: 'https://oceancafe.example.com',
      },
    };

    expect(node.id).toBe(123456);
    expect(node.type).toBe('node');
    expect(node.tags.name).toBe('The Ocean Cafe');
    expect(node.tags.amenity).toBe('restaurant');
  });

  it('correctly models an OpenStreetMap Way / Building structure with geometry', () => {
    const building: OsmElement = {
      id: 789101,
      type: 'way',
      lat: 41.4905,
      lon: -71.3130,
      version: 1,
      isStructure: true,
      geometry: [
        { lat: 41.4904, lon: -71.3131 },
        { lat: 41.4906, lon: -71.3131 },
        { lat: 41.4906, lon: -71.3129 },
        { lat: 41.4904, lon: -71.3129 },
      ],
      tags: {
        building: 'retail',
        shop: 'bakery',
        name: 'Harbor Bakery',
      },
    };

    expect(building.isStructure).toBe(true);
    expect(building.geometry).toHaveLength(4);
    expect(building.tags.shop).toBe('bakery');
  });

  it('correctly models an OSM Changeset payload', () => {
    const changeset: OsmChangeset = {
      isOpen: true,
      createdAt: '2026-11-16T12:00:00Z',
      tags: {
        created_by: 'Browsm 0.1.0',
        comment: 'Add opening hours and phone number for Harbor Bakery',
        source: 'https://harborbakery.example.com',
      },
    };

    expect(changeset.isOpen).toBe(true);
    expect(changeset.tags.created_by).toBe('Browsm 0.1.0');
    expect(changeset.tags.source).toContain('harborbakery.example.com');
  });

  it('correctly models a Nominatim Geocoding response', () => {
    const nominatim: NominatimResult = {
      place_id: 456789,
      licence: 'Data © OpenStreetMap contributors, ODbL 1.0',
      osm_type: 'node',
      osm_id: '123456',
      lat: '41.4901000',
      lon: '-71.3128000',
      class: 'amenity',
      type: 'restaurant',
      place_rank: 30,
      importance: 0.5,
      name: 'The Ocean Cafe',
      display_name: 'The Ocean Cafe, 100, Ocean Ave, Newport, RI, 02840, USA',
      address: {
        house_number: '100',
        road: 'Ocean Ave',
        city: 'Newport',
        state: 'Rhode Island',
        postcode: '02840',
        country: 'United States',
        country_code: 'us',
        amenity: 'restaurant',
      },
    };

    expect(nominatim.place_id).toBe(456789);
    expect(nominatim.address?.city).toBe('Newport');
    expect(Number(nominatim.lat)).toBeCloseTo(41.4901);
  });

  it('correctly models a Schema.org Place extraction record', () => {
    const place: SchemaOrgPlace = {
      name: 'The Ocean Cafe',
      type: 'Restaurant',
      address: {
        streetAddress: '100 Ocean Ave',
        addressLocality: 'Newport',
        addressRegion: 'RI',
        postalCode: '02840',
        addressCountry: 'US',
      },
      geo: {
        latitude: 41.4901,
        longitude: -71.3128,
      },
      telephone: '+1-401-555-0199',
      url: 'https://oceancafe.example.com',
      openingHours: ['Mo-Fr 08:00-20:00', 'Sa-Su 09:00-21:00'],
      sourceUrl: 'https://oceancafe.example.com/about',
    };

    expect(place.name).toBe('The Ocean Cafe');
    expect(place.geo?.latitude).toBe(41.4901);
    expect(place.openingHours).toHaveLength(2);
  });

  it('correctly models Tag Diff items and status transitions', () => {
    const tagDiff: TagDiffItem = {
      key: 'phone',
      sourceValue: '+1 401 555 0199',
      osmValue: '+1 401 555 0000',
      stagedValue: '+1 401 555 0199',
      status: 'outdated_in_osm',
      action: 'apply',
    };

    expect(tagDiff.status).toBe('outdated_in_osm');
    expect(tagDiff.action).toBe('apply');
    expect(tagDiff.stagedValue).toBe('+1 401 555 0199');
  });

  it('correctly models Search Session state', () => {
    const session: SearchSessionState = {
      query: '100 Ocean Ave, Newport, RI',
      source: 'selection',
      coordinates: { lat: 41.4901, lon: -71.3128 },
      status: 'matched',
      matchedElementId: 'node/123456',
      nearbyElements: [],
    };

    expect(session.status).toBe('matched');
    expect(session.source).toBe('selection');
  });
});
