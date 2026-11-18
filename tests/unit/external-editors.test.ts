import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEditorUrl, launchEditor } from '@/services/external-editors';
import type { OsmElement } from '@/types/osm';

describe('External Editors Launcher Service', () => {
  const mockNode: OsmElement = {
    id: 12345,
    type: 'node',
    lat: 41.49,
    lon: -71.31,
    version: 1,
    tags: { name: 'Test Coffee', amenity: 'cafe' },
  };

  const mockWay: OsmElement = {
    id: 67890,
    type: 'way',
    lat: 41.49,
    lon: -71.31,
    version: 2,
    tags: { name: 'Test Building', building: 'yes' },
  };

  describe('getEditorUrl', () => {
    it('generates standard iD editor URL with coordinates', () => {
      const url = getEditorUrl('id', { lat: 41.49, lon: -71.31, zoom: 17 });
      expect(url).toBe('https://www.openstreetmap.org/edit?editor=id#map=17/41.49000/-71.31000');
    });

    it('generates iD editor URL selecting a specific node', () => {
      const url = getEditorUrl('id', { lat: 41.49, lon: -71.31, element: mockNode });
      expect(url).toBe('https://www.openstreetmap.org/edit?editor=id&node=12345#map=18/41.49000/-71.31000');
    });

    it('generates iD editor URL selecting a specific way', () => {
      const url = getEditorUrl('id', { lat: 41.49, lon: -71.31, element: mockWay });
      expect(url).toBe('https://www.openstreetmap.org/edit?editor=id&way=67890#map=18/41.49000/-71.31000');
    });

    it('supports custom webUrl (e.g. OpenHistoricalMap) for iD', () => {
      const url = getEditorUrl('id', {
        lat: 41.49,
        lon: -71.31,
        element: mockNode,
        webUrl: 'https://www.openhistoricalmap.org',
      });
      expect(url).toBe('https://www.openhistoricalmap.org/edit?editor=id&node=12345#map=18/41.49000/-71.31000');
    });

    it('generates Rapid editor URL with map coordinates and entity selector', () => {
      const urlNoEl = getEditorUrl('rapid', { lat: 41.49, lon: -71.31, zoom: 16 });
      expect(urlNoEl).toBe('https://rapideditor.org/edit#map=16/41.49000/-71.31000');

      const urlNode = getEditorUrl('rapid', { lat: 41.49, lon: -71.31, element: mockNode });
      expect(urlNode).toBe('https://rapideditor.org/edit#map=18/41.49000/-71.31000&id=n12345');

      const urlWay = getEditorUrl('rapid', { lat: 41.49, lon: -71.31, element: mockWay });
      expect(urlWay).toBe('https://rapideditor.org/edit#map=18/41.49000/-71.31000&id=w67890');
    });

    it('generates JOSM Remote Control URL with bounding box and entity selector', () => {
      const url = getEditorUrl('josm', { lat: 41.49, lon: -71.31, element: mockNode });
      expect(url).toContain('http://127.0.0.1:8111/load_and_zoom?');
      expect(url).toContain('left=');
      expect(url).toContain('right=');
      expect(url).toContain('top=');
      expect(url).toContain('bottom=');
      expect(url).toContain('&select=node12345');
    });
  });

  describe('launchEditor', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('launches iD editor via window.open', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const res = await launchEditor('id', { lat: 41.49, lon: -71.31 });

      expect(res.success).toBe(true);
      expect(res.url).toContain('https://www.openstreetmap.org/edit?editor=id');
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://www.openstreetmap.org/edit?editor=id'),
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('launches Rapid editor via window.open', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const res = await launchEditor('rapid', { lat: 41.49, lon: -71.31 });

      expect(res.success).toBe(true);
      expect(res.url).toContain('https://rapideditor.org/edit');
      expect(openSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://rapideditor.org/edit'),
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('launches JOSM via Remote Control HTTP GET request when successful', async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
      const res = await launchEditor('josm', { lat: 41.49, lon: -71.31, element: mockNode }, mockFetch);

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://127.0.0.1:8111/load_and_zoom?'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles JOSM connection errors with clear troubleshooting guidance', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const res = await launchEditor('josm', { lat: 41.49, lon: -71.31 }, mockFetch);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Could not connect to JOSM Remote Control');
    });
  });
});
