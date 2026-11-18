import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateBboxAroundCoords,
  fetchOsmElementsInBbox,
  findBestMatch,
  filterAndSortNearbyElements,
} from '@/services/spatial-matcher';
import { resolveApiEndpoint, resolveWriteEndpoint, resolveReadEndpoint } from '@/services/endpoint-resolver';
import { fetchElement } from '@/services/osm-api';
import type { OsmElement } from '@/types/osm';
import type { SettingsState } from '@/types/settings';

describe('Nominatim Geocoding to Target API Confirmation Workflow', () => {
  const devApiUrl = 'https://master.apis.dev.openstreetmap.org/api/0.6';
  const prodApiUrl = 'https://api.openstreetmap.org/api/0.6';

  const mockDevSettings: SettingsState = {
    activeEndpointId: 'osm-dev',
    devModeRouting: 'reads_and_writes',
    nearbySearchRadius: 50,
    preferredEditor: 'id',
    messagePollIntervalMinutes: 10,
  };

  const mockProdSettings: SettingsState = {
    activeEndpointId: 'osm-prod',
    devModeRouting: 'disabled',
    nearbySearchRadius: 50,
    preferredEditor: 'id',
    messagePollIntervalMinutes: 10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves correct target API URL for Dev API vs Production presets', async () => {
    const devEndpoint = await resolveWriteEndpoint(mockDevSettings);
    expect(devEndpoint.config.apiBaseUrl).toBe(devApiUrl);

    const prodEndpoint = await resolveWriteEndpoint(mockProdSettings);
    expect(prodEndpoint.config.apiBaseUrl).toBe(prodApiUrl);
  });

  it('queries Dev API bbox and matches Dev API node instead of using production Nominatim ID', async () => {
    // Nominatim geocoding returns coordinates with a production OSM ID
    const nominatimResult = {
      display_name: 'The Red Parrot, Newport, RI',
      lat: '41.4901',
      lon: '-71.3128',
      osm_id: '999888777', // Production ID
      osm_type: 'node',
      name: 'The Red Parrot',
    };

    const targetLat = parseFloat(nominatimResult.lat);
    const targetLon = parseFloat(nominatimResult.lon);

    // Mock fetch for Dev API /map?bbox= endpoint returning a Dev API node with ID 4001
    const devBboxXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="4001" lat="41.4901" lon="-71.3128" version="3">
    <tag k="name" v="The Red Parrot"/>
    <tag k="amenity" v="restaurant"/>
    <tag k="cuisine" v="seafood"/>
  </node>
</osm>`;

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(devBboxXml),
    });

    const bbox = calculateBboxAroundCoords(targetLat, targetLon, 50);
    const devEndpoint = await resolveWriteEndpoint(mockDevSettings);
    const rawElements = await fetchOsmElementsInBbox(bbox, devEndpoint.config.apiBaseUrl, customFetch);

    // Verify Dev API URL was called
    expect(customFetch).toHaveBeenCalledTimes(1);
    const calledUrl = customFetch.mock.calls[0][0];
    expect(calledUrl).toContain(devApiUrl);

    const nearbyElements = filterAndSortNearbyElements(rawElements, targetLat, targetLon, 50);
    expect(nearbyElements.length).toBe(1);
    expect(nearbyElements[0].id).toBe(4001);

    // Score and match
    const isProdApi = devEndpoint.config.apiBaseUrl === prodApiUrl;
    const matchResult = findBestMatch(
      {
        name: nominatimResult.name,
        lat: targetLat,
        lon: targetLon,
        osmId: isProdApi ? nominatimResult.osm_id : undefined,
        osmType: isProdApi ? nominatimResult.osm_type : undefined,
      },
      nearbyElements
    );

    expect(matchResult.matchedElement).toBeDefined();
    expect(matchResult.matchedElement?.id).toBe(4001); // Dev API node ID, NOT production 999888777
    expect(matchResult.matchedElement?.tags.amenity).toBe('restaurant');
  });

  it('treats Dev API search as New POI Candidate when no elements exist in bbox on Dev API', async () => {
    const nominatimResult = {
      display_name: 'Brand New Cafe, Newport, RI',
      lat: '41.4905',
      lon: '-71.3120',
      osm_id: '555666777', // Production ID
      osm_type: 'node',
      name: 'Brand New Cafe',
    };

    const targetLat = parseFloat(nominatimResult.lat);
    const targetLon = parseFloat(nominatimResult.lon);

    // Dev API bbox returns empty OSM document
    const emptyDevBboxXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
</osm>`;

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(emptyDevBboxXml),
    });

    const bbox = calculateBboxAroundCoords(targetLat, targetLon, 50);
    const devEndpoint = await resolveWriteEndpoint(mockDevSettings);
    const rawElements = await fetchOsmElementsInBbox(bbox, devEndpoint.config.apiBaseUrl, customFetch);
    const nearbyElements = filterAndSortNearbyElements(rawElements, targetLat, targetLon, 50);

    const isProdApi = devEndpoint.config.apiBaseUrl === prodApiUrl;
    const matchResult = findBestMatch(
      {
        name: nominatimResult.name,
        lat: targetLat,
        lon: targetLon,
        osmId: isProdApi ? nominatimResult.osm_id : undefined,
        osmType: isProdApi ? nominatimResult.osm_type : undefined,
      },
      nearbyElements
    );

    // Since we are on Dev API and bbox is empty, no element should be matched
    expect(matchResult.matchedElement).toBeUndefined();

    // The assigned osmIdString must be empty rather than the production ID
    const osmIdString = matchResult.matchedElement ? String(matchResult.matchedElement.id) : '';
    expect(osmIdString).toBe('');
  });

  it('verifies production node via fetchElement when not found in initial bbox', async () => {
    const nominatimResult = {
      display_name: 'Historic Lighthouse, Newport, RI',
      lat: '41.4850',
      lon: '-71.3200',
      osm_id: '12345678',
      osm_type: 'node',
      name: 'Historic Lighthouse',
    };

    const prodNodeXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="12345678" lat="41.4850" lon="-71.3200" version="5" changeset="999">
    <tag k="name" v="Historic Lighthouse"/>
    <tag k="historic" v="lighthouse"/>
  </node>
</osm>`;

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(prodNodeXml),
    });

    const verifiedNode = await fetchElement('node', 12345678, prodApiUrl, customFetch);
    expect(verifiedNode).toBeDefined();
    expect(verifiedNode.id).toBe(12345678);
    expect(verifiedNode.version).toBe(5);
    expect(verifiedNode.tags.historic).toBe('lighthouse');
  });
});
