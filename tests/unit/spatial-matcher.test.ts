import { describe, it, expect } from 'vitest';
import {
  calculateBboxAroundCoords,
  calculateDistanceMeters,
  calculateStringSimilarity,
  parseOsmBboxXml,
  generateTagDiff,
  findBestMatch,
} from '@/services/spatial-matcher';
import type { OsmElement } from '@/types/osm';

describe('Spatial Matcher Service', () => {
  describe('Geographic calculations', () => {
    it('calculates bounding box within expected delta around Newport coordinates', () => {
      const bbox = calculateBboxAroundCoords(41.4901, -71.3128, 50);
      expect(bbox.minLat).toBeLessThan(41.4901);
      expect(bbox.maxLat).toBeGreaterThan(41.4901);
      expect(bbox.minLon).toBeLessThan(-71.3128);
      expect(bbox.maxLon).toBeGreaterThan(-71.3128);
    });

    it('calculates accurate distance between coordinates with Haversine formula', () => {
      // Distance between identical points is 0
      expect(calculateDistanceMeters(41.4901, -71.3128, 41.4901, -71.3128)).toBe(0);

      // Distance between two known points in Newport (approx 100-150m)
      const dist = calculateDistanceMeters(41.4901, -71.3128, 41.4910, -71.3128);
      expect(dist).toBeGreaterThan(90);
      expect(dist).toBeLessThan(110);
    });

    it('calculates string similarity with Sørensen-Dice coefficient', () => {
      expect(calculateStringSimilarity('The Red Parrot', 'The Red Parrot')).toBe(1.0);
      expect(calculateStringSimilarity('Red Parrot', 'The Red Parrot')).toBeGreaterThan(0.7);
      expect(calculateStringSimilarity('Red Parrot', 'Completely Unrelated')).toBeLessThan(0.2);
    });
  });

  describe('OSM API 0.6 BBox XML Parser', () => {
    it('parses nodes and way structures with geometry and tags', () => {
      const xmlSnippet = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="101" lat="41.4900" lon="-71.3120" version="2" changeset="555">
    <tag k="name" v="Corner Cafe"/>
    <tag k="amenity" v="cafe"/>
  </node>
  <node id="201" lat="41.4905" lon="-71.3125" version="1"/>
  <node id="202" lat="41.4905" lon="-71.3115" version="1"/>
  <node id="203" lat="41.4895" lon="-71.3115" version="1"/>
  <node id="204" lat="41.4895" lon="-71.3125" version="1"/>
  <way id="301" version="3" changeset="777">
    <nd ref="201"/>
    <nd ref="202"/>
    <nd ref="203"/>
    <nd ref="204"/>
    <tag k="building" v="commercial"/>
    <tag k="name" v="Ocean Plaza"/>
  </way>
</osm>`;

      const elements = parseOsmBboxXml(xmlSnippet);
      expect(elements.length).toBe(2);

      // Verify node
      const nodeElem = elements.find((e) => e.id === 101);
      expect(nodeElem).toBeDefined();
      expect(nodeElem?.type).toBe('node');
      expect(nodeElem?.tags.name).toBe('Corner Cafe');
      expect(nodeElem?.tags.amenity).toBe('cafe');

      // Verify way structure
      const wayElem = elements.find((e) => e.id === 301);
      expect(wayElem).toBeDefined();
      expect(wayElem?.type).toBe('way');
      expect(wayElem?.isStructure).toBe(true);
      expect(wayElem?.tags.building).toBe('commercial');
      expect(wayElem?.tags.name).toBe('Ocean Plaza');
      expect(wayElem?.geometry?.length).toBe(4);
      expect(wayElem?.lat).toBeCloseTo(41.4900, 3);
      expect(wayElem?.lon).toBeCloseTo(-71.3120, 3);
    });
  });

  describe('Tag Diff Generator', () => {
    it('compares source tags against OSM element tags and categorizes diffs', () => {
      const sourceTags = {
        name: 'Harbor Grill',
        amenity: 'restaurant',
        phone: '+1 401 555 9999',
        website: 'https://harborgrill.com',
      };

      const liveOsmElement: OsmElement = {
        id: 501,
        type: 'node',
        lat: 41.4901,
        lon: -71.3128,
        version: 1,
        tags: {
          name: 'Harbor Grill',
          amenity: 'restaurant',
          phone: '+1 401 555 0000', // Outdated phone
        },
      };

      const diffs = generateTagDiff(sourceTags, liveOsmElement);

      const nameDiff = diffs.find((d) => d.key === 'name');
      expect(nameDiff?.status).toBe('identical');
      expect(nameDiff?.action).toBe('ignore');

      const phoneDiff = diffs.find((d) => d.key === 'phone');
      expect(phoneDiff?.status).toBe('outdated_in_osm');
      expect(phoneDiff?.action).toBe('apply');
      expect(phoneDiff?.sourceValue).toBe('+1 401 555 9999');
      expect(phoneDiff?.osmValue).toBe('+1 401 555 0000');

      const websiteDiff = diffs.find((d) => d.key === 'website');
      expect(websiteDiff?.status).toBe('missing_in_osm');
      expect(websiteDiff?.action).toBe('apply');
    });

    it('categorizes minor differences (URL trailing slash, phone punctuation) as minor_difference and ignores by default', () => {
      const sourceTags = {
        name: 'Hidden Dumpling House',
        website: 'https://hiddendumplinghousemidtown.com/',
        phone: '(212) 555-1234',
        opening_hours: 'Mo-Su 11:00-22:00',
      };

      const liveOsmElement: OsmElement = {
        id: 701,
        type: 'node',
        lat: 40.75,
        lon: -73.98,
        version: 1,
        tags: {
          name: 'Hidden Dumpling House',
          website: 'https://hiddendumplinghousemidtown.com', // No trailing slash
          phone: '+1 212 555 1234', // Formatted international
          opening_hours: 'Mo-Fr 12:00-21:00', // Actual difference
        },
      };

      const diffs = generateTagDiff(
        sourceTags,
        liveOsmElement,
        'schema_org',
        'Extracted from Schema.org JSON-LD'
      );

      const websiteDiff = diffs.find((d) => d.key === 'website');
      expect(websiteDiff?.status).toBe('minor_difference');
      expect(websiteDiff?.action).toBe('ignore');
      expect(websiteDiff?.stagedValue).toBe('https://hiddendumplinghousemidtown.com');
      expect(websiteDiff?.sourceOrigin).toBe('schema_org');

      const phoneDiff = diffs.find((d) => d.key === 'phone');
      expect(phoneDiff?.status).toBe('minor_difference');
      expect(phoneDiff?.action).toBe('ignore');
      expect(phoneDiff?.stagedValue).toBe('+1 212 555 1234');

      const hoursDiff = diffs.find((d) => d.key === 'opening_hours');
      expect(hoursDiff?.status).toBe('outdated_in_osm');
      expect(hoursDiff?.action).toBe('apply');
      expect(hoursDiff?.stagedValue).toBe('Mo-Su 11:00-22:00');
      expect(hoursDiff?.sourceNote).toBe('Extracted from Schema.org JSON-LD');

      // Verify sorting: staged changes first (opening_hours), then minor diffs (phone, website), then identical (name)
      expect(diffs[0].key).toBe('opening_hours');
      const minorKeys = diffs.slice(1, 3).map((d) => d.key);
      expect(minorKeys).toContain('phone');
      expect(minorKeys).toContain('website');
      expect(diffs[3].key).toBe('name');
    });
  });

  describe('Candidate Matching & Scoring', () => {
    it('identifies exact match for candidate with matching name and close coordinates', () => {
      const candidates: OsmElement[] = [
        {
          id: 1,
          type: 'node',
          lat: 41.4901,
          lon: -71.3128,
          version: 1,
          tags: { name: 'The Red Parrot Restaurant', amenity: 'restaurant' },
        },
        {
          id: 2,
          type: 'node',
          lat: 41.4980,
          lon: -71.3200,
          version: 1,
          tags: { name: 'Unrelated Gas Station', amenity: 'fuel' },
        },
      ];

      const match = findBestMatch(
        {
          name: 'The Red Parrot',
          lat: 41.4901,
          lon: -71.3128,
        },
        candidates
      );

      expect(match.matchStatus).toBe('exact_match');
      expect(match.matchedElement?.id).toBe(1);
    });

    it('identifies exact match by direct osmId and osmType', () => {
      const candidates: OsmElement[] = [
        {
          id: 9999,
          type: 'node',
          lat: 41.4901,
          lon: -71.3128,
          version: 1,
          tags: { amenity: 'pub', name: 'Anchor Tavern' },
        },
        {
          id: 8888,
          type: 'node',
          lat: 41.4902,
          lon: -71.3129,
          version: 1,
          tags: { amenity: 'restaurant', name: 'Other Place' },
        },
      ];

      const match = findBestMatch(
        {
          osmId: '9999',
          osmType: 'node',
          lat: 41.4901,
          lon: -71.3128,
        },
        candidates
      );

      expect(match.matchStatus).toBe('exact_match');
      expect(match.matchedElement?.id).toBe(9999);
    });

    it('matches candidate using alternate name tags like brand or alt_name', () => {
      const candidates: OsmElement[] = [
        {
          id: 55,
          type: 'node',
          lat: 41.4901,
          lon: -71.3128,
          version: 1,
          tags: { brand: 'Subway', name: 'Subway #1234', amenity: 'fast_food' },
        },
      ];

      const match = findBestMatch(
        {
          name: 'Subway',
          lat: 41.4901,
          lon: -71.3128,
        },
        candidates
      );

      expect(match.matchStatus).toBe('exact_match');
      expect(match.matchedElement?.id).toBe(55);
    });

    it('returns no_match when candidate list is empty', () => {
      const match = findBestMatch({ name: 'New Cafe', lat: 41.49, lon: -71.31 }, []);
      expect(match.matchStatus).toBe('no_match');
      expect(match.matchedElement).toBeUndefined();
    });
  });
});
