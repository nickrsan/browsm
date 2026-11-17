import { describe, it, expect, vi } from 'vitest';
import {
  escapeXml,
  parseXml,
  serializeTagsXml,
  getUserDetails,
  createChangeset,
  closeChangeset,
  createNode,
  updateNode,
  updateWayTags,
  fetchElement,
} from '@/services/osm-api';

describe('OpenStreetMap API 0.6 Client (osm-api)', () => {
  const baseUrl = 'https://api.openstreetmap.org/api/0.6';
  const token = 'mock_access_token_123';

  describe('XML Helpers', () => {
    it('escapes XML special characters properly', () => {
      const raw = `Tom & Jerry <"Bakery" / 'Cafe'>`;
      const escaped = escapeXml(raw);
      expect(escaped).toBe('Tom &amp; Jerry &lt;&quot;Bakery&quot; / &apos;Cafe&apos;&gt;');
    });

    it('serializes tags to XML elements', () => {
      const tags = {
        name: 'The Anchor & Compass',
        amenity: 'pub',
      };
      const xml = serializeTagsXml(tags);
      expect(xml).toContain('<tag k="name" v="The Anchor &amp; Compass"/>');
      expect(xml).toContain('<tag k="amenity" v="pub"/>');
    });

    it('parses valid XML string into DOM document', () => {
      const xml = '<osm version="0.6"><node id="100" lat="41.4" lon="-71.3"/></osm>';
      const doc = parseXml(xml);
      expect(doc.querySelector('node')?.getAttribute('id')).toBe('100');
    });
  });

  describe('getUserDetails', () => {
    it('fetches and parses user profile XML', async () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <user id="987654" display_name="coastal_mapper" account_created="2020-05-12T14:30:00Z">
    <description>Local mapper in Newport</description>
    <changesets count="425"/>
    <img href="https://example.com/avatar.png"/>
    <roles>
      <role>moderator</role>
    </roles>
  </user>
</osm>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => sampleXml,
      });

      const user = await getUserDetails(token, baseUrl, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openstreetmap.org/api/0.6/user/details',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      expect(user.id).toBe(987654);
      expect(user.username).toBe('coastal_mapper');
      expect(user.changesetCount).toBe(425);
      expect(user.description).toBe('Local mapper in Newport');
      expect(user.img).toBe('https://example.com/avatar.png');
      expect(user.roles).toEqual(['moderator']);
    });

    it('throws error when user details endpoint fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(getUserDetails(token, baseUrl, mockFetch)).rejects.toThrow('Failed to fetch OSM user details (HTTP 401)');
    });
  });

  describe('Changeset Lifecycle', () => {
    it('creates a new changeset and returns integer ID', async () => {
      let sentBody = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        sentBody = String(init?.body || '');
        return {
          ok: true,
          text: async () => '12345678',
        };
      });

      const changesetId = await createChangeset(
        token,
        {
          comment: 'Add phone number for Cafe',
          source: 'https://cafe.example.com',
          extraTags: { host: 'browsm' },
        },
        baseUrl,
        mockFetch
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openstreetmap.org/api/0.6/changeset/create',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/xml',
          }),
        })
      );

      expect(changesetId).toBe(12345678);
      expect(sentBody).toContain('<tag k="comment" v="Add phone number for Cafe"/>');
      expect(sentBody).toContain('<tag k="source" v="https://cafe.example.com"/>');
      expect(sentBody).toContain('<tag k="host" v="browsm"/>');
    });

    it('closes an open changeset', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
      });

      await closeChangeset(token, 12345678, baseUrl, mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openstreetmap.org/api/0.6/changeset/12345678/close',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it('handles already-closed changesets (HTTP 409) without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => 'The changeset 12345678 was closed at ...',
      });

      await expect(closeChangeset(token, 12345678, baseUrl, mockFetch)).resolves.toBeUndefined();
    });
  });

  describe('Node Operations', () => {
    it('creates a new node in changeset', async () => {
      let sentBody = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        sentBody = String(init?.body || '');
        return {
          ok: true,
          text: async () => '87654321',
        };
      });

      const nodeId = await createNode(
        token,
        {
          changesetId: 12345678,
          lat: 41.4901,
          lon: -71.3128,
          tags: {
            amenity: 'restaurant',
            name: 'Harbor Grill',
          },
        },
        baseUrl,
        mockFetch
      );

      expect(nodeId).toBe(87654321);
      expect(sentBody).toContain('<node changeset="12345678" lat="41.4901" lon="-71.3128">');
      expect(sentBody).toContain('<tag k="amenity" v="restaurant"/>');
      expect(sentBody).toContain('<tag k="name" v="Harbor Grill"/>');
    });

    it('updates an existing node and returns new version', async () => {
      let sentBody = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        sentBody = String(init?.body || '');
        return {
          ok: true,
          text: async () => '4',
        };
      });

      const newVersion = await updateNode(
        token,
        {
          changesetId: 12345678,
          id: 555000,
          lat: 41.4902,
          lon: -71.3129,
          version: 3,
          tags: {
            amenity: 'restaurant',
            name: 'Harbor Grill Updated',
            phone: '+1 401-555-9876',
          },
        },
        baseUrl,
        mockFetch
      );

      expect(newVersion).toBe(4);
      expect(sentBody).toContain('<node id="555000" changeset="12345678" lat="41.4902" lon="-71.3129" version="3">');
      expect(sentBody).toContain('<tag k="phone" v="+1 401-555-9876"/>');
    });
  });

  describe('Way Operations', () => {
    it('updates way tags and node references and returns new version', async () => {
      let sentBody = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        sentBody = String(init?.body || '');
        return {
          ok: true,
          text: async () => '2',
        };
      });

      const newVersion = await updateWayTags(
        token,
        {
          changesetId: 12345678,
          id: 999111,
          version: 1,
          nodeRefs: [101, 102, 103, 101],
          tags: {
            building: 'retail',
            shop: 'bakery',
            name: 'Ocean Bakery',
          },
        },
        baseUrl,
        mockFetch
      );

      expect(newVersion).toBe(2);
      expect(sentBody).toContain('<way id="999111" changeset="12345678" version="1">');
      expect(sentBody).toContain('<nd ref="101"/>');
      expect(sentBody).toContain('<nd ref="102"/>');
      expect(sentBody).toContain('<tag k="shop" v="bakery"/>');
    });
  });

  describe('fetchElement', () => {
    it('fetches an OSM node and parses tags and coordinates', async () => {
      const nodeXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="123456" lat="41.4905" lon="-71.3120" version="5" changeset="888" user="osm_user" uid="12" timestamp="2026-01-10T12:00:00Z">
    <tag k="amenity" v="cafe"/>
    <tag k="name" v="Corner Cafe"/>
  </node>
</osm>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => nodeXml,
      });

      const element = await fetchElement('node', 123456, baseUrl, mockFetch);

      expect(element.id).toBe(123456);
      expect(element.type).toBe('node');
      expect(element.lat).toBe(41.4905);
      expect(element.lon).toBe(-71.312);
      expect(element.version).toBe(5);
      expect(element.tags.amenity).toBe('cafe');
      expect(element.tags.name).toBe('Corner Cafe');
    });
  });
});
