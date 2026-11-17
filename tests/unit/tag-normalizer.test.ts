import { describe, it, expect } from 'vitest';
import {
  schemaTypeToOsmTags,
  normalizePhoneToE123,
  normalizeWebsite,
  normalizeAddressToTags,
  normalizeOpeningHours,
  convertSchemaPlaceToOsmTags,
  canonicalizeWebsiteUrl,
  canonicalizePhoneDigits,
  isMinorTagDifference,
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

  describe('Website URL Canonicalization', () => {
    it('strips trailing slashes from root and subpaths', () => {
      expect(canonicalizeWebsiteUrl('https://example.com/')).toBe('https://example.com');
      expect(canonicalizeWebsiteUrl('https://example.com')).toBe('https://example.com');
      expect(canonicalizeWebsiteUrl('http://example.com/menu/')).toBe('http://example.com/menu');
    });

    it('handles URLs without protocol and lowercase domains', () => {
      expect(canonicalizeWebsiteUrl('EXAMPLE.COM/about/')).toBe('https://example.com/about');
      expect(canonicalizeWebsiteUrl(undefined)).toBeUndefined();
    });
  });

  describe('Phone Digits Canonicalization', () => {
    it('extracts digits and normalizes 10-digit North American numbers', () => {
      expect(canonicalizePhoneDigits('(401) 847-1234')).toBe('14018471234');
      expect(canonicalizePhoneDigits('+1-401-847-1234')).toBe('14018471234');
      expect(canonicalizePhoneDigits('+1 401 847 1234')).toBe('14018471234');
      expect(canonicalizePhoneDigits('401.847.1234')).toBe('14018471234');
    });

    it('preserves international phone numbers with other country codes', () => {
      expect(canonicalizePhoneDigits('+44 20 7946 0912')).toBe('442079460912');
      expect(canonicalizePhoneDigits(undefined)).toBeUndefined();
    });
  });

  describe('Minor Tag Difference Detection (isMinorTagDifference)', () => {
    it('identifies trailing slash URL differences as minor', () => {
      expect(
        isMinorTagDifference('website', 'https://hiddendumplinghousemidtown.com/', 'https://hiddendumplinghousemidtown.com')
      ).toBe(true);
      expect(
        isMinorTagDifference('contact:website', 'https://example.com/menu', 'https://example.com/menu/')
      ).toBe(true);
    });

    it('identifies phone number punctuation/spacing differences as minor', () => {
      expect(isMinorTagDifference('phone', '+1 401 847 1234', '(401) 847-1234')).toBe(true);
      expect(isMinorTagDifference('phone', '+1-401-847-1234', '+1 401 847 1234')).toBe(true);
      expect(isMinorTagDifference('contact:phone', '401.847.1234', '+1-401-847-1234')).toBe(true);
    });

    it('identifies multiple internal spaces as minor difference', () => {
      expect(isMinorTagDifference('addr:street', 'Ocean   Avenue', 'Ocean Avenue')).toBe(true);
    });

    it('identifies case difference in boolean tags as minor', () => {
      expect(isMinorTagDifference('wheelchair', 'Yes', 'yes')).toBe(true);
      expect(isMinorTagDifference('takeaway', 'YES', 'yes')).toBe(true);
    });

    it('returns false for genuine semantic differences', () => {
      expect(isMinorTagDifference('phone', '+1 401 847 1234', '+1 401 847 9999')).toBe(false);
      expect(isMinorTagDifference('website', 'https://redparrot.com', 'https://otherplace.com')).toBe(false);
      expect(isMinorTagDifference('name', 'Old Cafe', 'New Cafe')).toBe(false);
      expect(isMinorTagDifference('opening_hours', 'Mo-Fr 09:00-17:00', 'Mo-Su 10:00-22:00')).toBe(false);
    });

    it('returns false when values are identical or missing', () => {
      expect(isMinorTagDifference('website', 'https://example.com', 'https://example.com')).toBe(false);
      expect(isMinorTagDifference('phone', undefined, '+1 401 847 1234')).toBe(false);
      expect(isMinorTagDifference('phone', '+1 401 847 1234', undefined)).toBe(false);
    });
  });
});
