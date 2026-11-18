import { describe, it, expect, vi } from 'vitest';
import {
  createOsmNote,
  fetchNote,
  formatNoteTextFromPlace,
  parseNoteFromXml,
} from '@/services/osm-notes';
import type { SchemaOrgPlace } from '@/types/schema';
import { parseXml } from '@/services/osm-api';

describe('OpenStreetMap Map Notes Service (osm-notes)', () => {
  const baseUrl = 'https://api.openstreetmap.org/api/0.6';

  describe('formatNoteTextFromPlace', () => {
    it('formats clean note message from SchemaOrgPlace', () => {
      const place: SchemaOrgPlace = {
        name: 'The Whales Tail',
        type: 'Restaurant',
        address: {
          streetAddress: '100 Ocean Ave',
          addressLocality: 'Newport',
          addressRegion: 'RI',
          postalCode: '02840',
          addressCountry: 'USA',
        },
        telephone: '+1 401-555-1212',
        url: 'https://whalestail.example.com',
        openingHours: ['Mo-Sa 11:00-22:00'],
        sourceUrl: 'https://whalestail.example.com/about',
      };

      const suggestedTags = {
        amenity: 'restaurant',
        name: 'The Whales Tail',
        phone: '+1 401-555-1212',
      };

      const noteText = formatNoteTextFromPlace(place, suggestedTags, 'Verified open during visit.');

      expect(noteText).toContain('POI information detected from webpage via Browsm:');
      expect(noteText).toContain('Name: The Whales Tail');
      expect(noteText).toContain('Category: Restaurant');
      expect(noteText).toContain('Address: 100 Ocean Ave, Newport, RI, 02840, USA');
      expect(noteText).toContain('Phone: +1 401-555-1212');
      expect(noteText).toContain('Website: https://whalestail.example.com');
      expect(noteText).toContain('Opening Hours: Mo-Sa 11:00-22:00');
      expect(noteText).toContain('amenity=restaurant');
      expect(noteText).toContain('Note from mapper: Verified open during visit.');
      expect(noteText).toContain('Source URL: https://whalestail.example.com/about');
    });
  });

  describe('createOsmNote', () => {
    it('sends POST /notes and parses returned note XML', async () => {
      const noteXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <note lon="-71.3128" lat="41.4901">
    <id>778899</id>
    <url>https://api.openstreetmap.org/api/0.6/notes/778899</url>
    <date_created>2026-11-16 12:00:00 UTC</date_created>
    <status>open</status>
    <comments>
      <comment>
        <date>2026-11-16 12:00:00 UTC</date>
        <action>opened</action>
        <text>Add missing restaurant</text>
        <user>local_mapper</user>
        <uid>42</uid>
      </comment>
    </comments>
  </note>
</osm>`;

      let requestBody = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        requestBody = String(init?.body || '');
        return {
          ok: true,
          text: async () => noteXml,
        };
      });

      const note = await createOsmNote(
        {
          lat: 41.4901,
          lon: -71.3128,
          text: 'Add missing restaurant',
        },
        'user_access_token',
        baseUrl,
        mockFetch
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openstreetmap.org/api/0.6/notes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer user_access_token',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );

      expect(requestBody).toContain('lat=41.4901');
      expect(requestBody).toContain('lon=-71.3128');
      expect(requestBody).toContain('text=Add+missing+restaurant');

      expect(note.id).toBe(778899);
      expect(note.lat).toBe(41.4901);
      expect(note.lon).toBe(-71.3128);
      expect(note.status).toBe('open');
      expect(note.url).toBe('https://www.openstreetmap.org/note/778899');
      expect(note.comments).toHaveLength(1);
      expect(note.comments[0].user).toBe('local_mapper');
      expect(note.comments[0].text).toBe('Add missing restaurant');
    });

    it('throws error when notes creation fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Coordinates outside bounds',
      });

      await expect(
        createOsmNote({ lat: 999, lon: 999, text: 'bad' }, undefined, baseUrl, mockFetch)
      ).rejects.toThrow('Failed to create OSM Note (HTTP 400): Coordinates outside bounds');
    });
  });

  describe('fetchNote', () => {
    it('fetches existing note and parses comments', async () => {
      const noteXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <note lon="-71.3128" lat="41.4901">
    <id>12345</id>
    <date_created>2026-11-10 10:00:00 UTC</date_created>
    <status>open</status>
    <comments>
      <comment>
        <date>2026-11-10 10:00:00 UTC</date>
        <action>opened</action>
        <text>Original note</text>
      </comment>
      <comment>
        <date>2026-11-11 12:00:00 UTC</date>
        <action>commented</action>
        <text>I will check this out</text>
        <user>mapper_two</user>
      </comment>
    </comments>
  </note>
</osm>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => noteXml,
      });

      const note = await fetchNote(12345, baseUrl, mockFetch);

      expect(note).not.toBeNull();
      expect(note?.id).toBe(12345);
      expect(note?.comments).toHaveLength(2);
      expect(note?.comments[1].action).toBe('commented');
    });

    it('returns null on 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      const note = await fetchNote(999999, baseUrl, mockFetch);
      expect(note).toBeNull();
    });
  });
});
