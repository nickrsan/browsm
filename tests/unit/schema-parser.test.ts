import { describe, it, expect } from 'vitest';
import {
  isSupportedSchemaType,
  extractPrimaryType,
  parsePostalAddress,
  parseGeoCoordinates,
  parseOpeningHours,
  parseJsonLdObject,
  extractJsonLdFromDocument,
  extractMicrodataFromDocument,
  extractMetaTagsFromDocument,
  extractSchemaFromDocument,
} from '@/services/schema-parser';

describe('Schema Parser Service', () => {
  describe('Type detection and resolution', () => {
    it('identifies supported Schema.org place and business types', () => {
      expect(isSupportedSchemaType('Restaurant')).toBe(true);
      expect(isSupportedSchemaType('https://schema.org/LocalBusiness')).toBe(true);
      expect(isSupportedSchemaType('http://schema.org/CafeOrCoffeeShop')).toBe(true);
      expect(isSupportedSchemaType('Bakery')).toBe(true);
      expect(isSupportedSchemaType('Hotel')).toBe(true);
      expect(isSupportedSchemaType('Pharmacy')).toBe(true);
      expect(isSupportedSchemaType('Article')).toBe(false);
      expect(isSupportedSchemaType('Person')).toBe(false);
    });

    it('handles arrays of schema types', () => {
      expect(isSupportedSchemaType(['Place', 'Restaurant'])).toBe(true);
      expect(isSupportedSchemaType(['Thing', 'WebPage'])).toBe(false);
    });

    it('extracts primary type cleanly', () => {
      expect(extractPrimaryType('https://schema.org/Restaurant')).toBe('Restaurant');
      expect(extractPrimaryType(['Place', 'Restaurant'])).toBe('Restaurant');
    });
  });

  describe('Address, Coordinates, and Hours parsers', () => {
    it('parses structured postal address objects', () => {
      const raw = {
        streetAddress: '120 Ocean Ave',
        addressLocality: 'Newport',
        addressRegion: 'RI',
        postalCode: '02840',
        addressCountry: 'US',
      };
      const parsed = parsePostalAddress(raw);
      expect(parsed).toEqual({
        streetAddress: '120 Ocean Ave',
        addressLocality: 'Newport',
        addressRegion: 'RI',
        postalCode: '02840',
        addressCountry: 'US',
      });
    });

    it('parses address with country object', () => {
      const raw = {
        streetAddress: '10 High St',
        addressCountry: { name: 'United States' },
      };
      const parsed = parsePostalAddress(raw);
      expect(parsed?.addressCountry).toBe('United States');
    });

    it('parses geographic coordinates within valid ranges', () => {
      expect(parseGeoCoordinates({ latitude: 41.4901, longitude: -71.3128 })).toEqual({
        latitude: 41.4901,
        longitude: -71.3128,
      });

      expect(parseGeoCoordinates({ lat: '41.4901', lon: '-71.3128' })).toEqual({
        latitude: 41.4901,
        longitude: -71.3128,
      });

      // Out of bounds lat/lon returns undefined
      expect(parseGeoCoordinates({ lat: 105, lon: -71.3128 })).toBeUndefined();
    });

    it('parses opening hours from strings and specifications', () => {
      const hours = parseOpeningHours('Mo-Fr 09:00-17:00', null);
      expect(hours).toEqual(['Mo-Fr 09:00-17:00']);

      const spec = [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: 'https://schema.org/Monday',
          opens: '08:00',
          closes: '20:00',
        },
      ];
      const parsedSpec = parseOpeningHours(null, spec);
      expect(parsedSpec).toEqual(['Mo 08:00-20:00']);
    });
  });

  describe('JSON-LD Document Extraction', () => {
    it('extracts LocalBusiness from JSON-LD script', () => {
      const doc = document.implementation.createHTMLDocument('Test Page');
      const script = doc.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: 'The Newport Chowder Co',
        telephone: '(401) 847-1234',
        url: 'https://newportchowder.com',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '120 Ocean Ave',
          addressLocality: 'Newport',
          addressRegion: 'RI',
          postalCode: '02840',
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 41.4901,
          longitude: -71.3128,
        },
      });
      doc.head.appendChild(script);

      const place = extractJsonLdFromDocument(doc, 'https://newportchowder.com');
      expect(place).not.toBeNull();
      expect(place?.name).toBe('The Newport Chowder Co');
      expect(place?.type).toBe('Restaurant');
      expect(place?.telephone).toBe('(401) 847-1234');
      expect(place?.address?.streetAddress).toBe('120 Ocean Ave');
      expect(place?.geo?.latitude).toBe(41.4901);
    });

    it('extracts place from @graph structure in JSON-LD', () => {
      const doc = document.implementation.createHTMLDocument('Graph Page');
      const script = doc.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Example Site' },
          {
            '@type': 'Bakery',
            name: 'Harbor Bakery',
            address: { streetAddress: '45 Thames St' },
          },
        ],
      });
      doc.head.appendChild(script);

      const place = extractJsonLdFromDocument(doc, 'https://example.com');
      expect(place).not.toBeNull();
      expect(place?.name).toBe('Harbor Bakery');
      expect(place?.type).toBe('Bakery');
    });
  });

  describe('Microdata & Meta Extraction', () => {
    it('extracts place from HTML5 Microdata', () => {
      const doc = document.implementation.createHTMLDocument('Microdata Page');
      doc.body.innerHTML = `
        <div itemscope itemtype="http://schema.org/CafeOrCoffeeShop">
          <span itemprop="name">Coastal Cafe</span>
          <a itemprop="telephone" href="tel:+14015551234">401-555-1234</a>
          <div itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
            <span itemprop="streetAddress">88 Spring St</span>
            <span itemprop="addressLocality">Newport</span>
          </div>
        </div>
      `;

      const place = extractMicrodataFromDocument(doc, 'https://coastalcafe.com');
      expect(place).not.toBeNull();
      expect(place?.name).toBe('Coastal Cafe');
      expect(place?.type).toBe('CafeOrCoffeeShop');
      expect(place?.telephone).toBe('+14015551234');
      expect(place?.address?.streetAddress).toBe('88 Spring St');
    });

    it('falls back to OpenGraph meta tags when structured markup is absent', () => {
      const doc = document.implementation.createHTMLDocument('OG Meta Page');
      doc.head.innerHTML = `
        <meta property="og:title" content="Historic Inn" />
        <meta property="og:latitude" content="41.4850" />
        <meta property="og:longitude" content="-71.3100" />
        <meta property="business:contact_data:street_address" content="12 Pelham St" />
      `;

      const place = extractSchemaFromDocument(doc, 'https://historicinn.com');
      expect(place).not.toBeNull();
      expect(place?.name).toBe('Historic Inn');
      expect(place?.geo?.latitude).toBe(41.485);
      expect(place?.address?.streetAddress).toBe('12 Pelham St');
    });
  });
});
