import { describe, it, expect } from 'vitest';
import {
  schemaTypeToOsmTags,
  normalizePhoneToE123,
  normalizeWebsite,
  normalizeAddressToTags,
  normalizeOpeningHours,
  convertSchemaPlaceToOsmTags,
} from '@/services/tag-normalizer';
import type { SchemaOrgPlace } from '@/types/schema';

describe('Tag Normalizer Service', () => {
  describe('Schema type to OSM tag mapping', () => {
    it('maps standard Schema types to OSM key-values', () => {
      expect(schemaTypeToOsmTags('Restaurant')).toEqual({ amenity: 'restaurant' });
      expect(schemaTypeToOsmTags('CafeOrCoffeeShop')).toEqual({ amenity: 'cafe' });
      expect(schemaTypeToOsmTags('Bakery')).toEqual({ shop: 'bakery' });
      expect(schemaTypeToOsmTags('Hotel')).toEqual({ tourism: 'hotel' });
      expect(schemaTypeToOsmTags('Pharmacy')).toEqual({ amenity: 'pharmacy', healthcare: 'pharmacy' });
      expect(schemaTypeToOsmTags('AutoRepair')).toEqual({ shop: 'car_repair' });
      expect(schemaTypeToOsmTags('Dentist')).toEqual({ amenity: 'dentist', healthcare: 'dentist' });
      expect(schemaTypeToOsmTags('UnknownThing')).toEqual({});
    });
  });

  describe('Phone number normalization (E.123)', () => {
    it('normalizes 10-digit North American phone numbers', () => {
      expect(normalizePhoneToE123('(401) 847-1234')).toBe('+1 401 847 1234');
      expect(normalizePhoneToE123('401.847.1234')).toBe('+1 401 847 1234');
      expect(normalizePhoneToE123('1-401-847-1234')).toBe('+1 401 847 1234');
    });

    it('cleans tel: prefixes and preserves international formats', () => {
      expect(normalizePhoneToE123('tel:+44 20 7946 0919')).toBe('+44 20 7946 0919');
      expect(normalizePhoneToE123(undefined)).toBeUndefined();
    });
  });

  describe('Website normalization', () => {
    it('adds https protocol if missing', () => {
      expect(normalizeWebsite('newportchowder.com')).toBe('https://newportchowder.com/');
      expect(normalizeWebsite('http://example.com/menu')).toBe('http://example.com/menu');
    });

    it('handles undefined or invalid inputs', () => {
      expect(normalizeWebsite(undefined)).toBeUndefined();
      expect(normalizeWebsite('')).toBeUndefined();
    });
  });

  describe('Address to OSM tag mapping', () => {
    it('splits house number and street name', () => {
      const tags = normalizeAddressToTags({
        streetAddress: '120 Ocean Avenue',
        addressLocality: 'Newport',
        addressRegion: 'RI',
        postalCode: '02840',
        addressCountry: 'US',
      });

      expect(tags).toEqual({
        'addr:housenumber': '120',
        'addr:street': 'Ocean Avenue',
        'addr:city': 'Newport',
        'addr:state': 'RI',
        'addr:postcode': '02840',
        'addr:country': 'US',
      });
    });

    it('handles street address without clear house number', () => {
      const tags = normalizeAddressToTags({
        streetAddress: 'Broadway & 10th St',
        addressLocality: 'New York',
      });

      expect(tags['addr:street']).toBe('Broadway & 10th St');
      expect(tags['addr:housenumber']).toBeUndefined();
      expect(tags['addr:city']).toBe('New York');
    });
  });

  describe('Opening hours normalization', () => {
    it('joins array of opening hours specifications with semicolons', () => {
      const hours = normalizeOpeningHours(['Mo-Fr 09:00-17:00', 'Sa 10:00-14:00']);
      expect(hours).toBe('Mo-Fr 09:00-17:00; Sa 10:00-14:00');
    });

    it('handles single string opening hours', () => {
      expect(normalizeOpeningHours('24/7')).toBe('24/7');
      expect(normalizeOpeningHours(undefined)).toBeUndefined();
    });
  });

  describe('Complete place to OSM tags conversion', () => {
    it('generates unified OSM tags dictionary from SchemaOrgPlace', () => {
      const place: SchemaOrgPlace = {
        name: 'The Red Parrot',
        type: 'Restaurant',
        address: {
          streetAddress: '348 Thames St',
          addressLocality: 'Newport',
          addressRegion: 'RI',
          postalCode: '02840',
          addressCountry: 'US',
        },
        telephone: '401-847-3800',
        url: 'redparrotrestaurant.com',
        openingHours: ['Mo-Su 11:30-22:00'],
        sourceUrl: 'https://redparrotrestaurant.com',
      };

      const osmTags = convertSchemaPlaceToOsmTags(place);
      expect(osmTags).toEqual({
        name: 'The Red Parrot',
        amenity: 'restaurant',
        'addr:housenumber': '348',
        'addr:street': 'Thames St',
        'addr:city': 'Newport',
        'addr:state': 'RI',
        'addr:postcode': '02840',
        'addr:country': 'US',
        phone: '+1 401 847 3800',
        website: 'https://redparrotrestaurant.com/',
        opening_hours: 'Mo-Su 11:30-22:00',
      });
    });
  });
});
