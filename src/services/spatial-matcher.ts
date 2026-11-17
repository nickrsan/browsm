/**
 * OpenStreetMap Spatial Matching & Tag Comparison Service
 * Retrieves bounding-box XML via OSM API 0.6, parses nodes and building ways,
 * scores candidate matches, and generates tag comparison diffs.
 */

import type { OsmElement, OsmTags, LatLon } from '@/types/osm';
import type { SpatialMatchResult, TagDiffItem, TagDiffStatus } from '@/types/diff';
import { isMinorTagDifference } from '@/services/tag-normalizer';

const OSM_API_BASE = 'https://api.openstreetmap.org/api/0.6';

/**
 * Calculates a bounding box around a coordinate point for a given radius in meters.
 */
export function calculateBboxAroundCoords(
  lat: number,
  lon: number,
  radiusMeters = 50
): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const earthRadius = 6378137; // meters
  const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
  const dLon = (radiusMeters / (earthRadius * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);

  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

/**
 * Computes Haversine distance in meters between two coordinate points.
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6378137; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates Sørensen-Dice string similarity coefficient (0.0 to 1.0).
 */
export function calculateStringSimilarity(str1?: string, str2?: string): number {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    const ratio = minLen / maxLen;
    return Math.max(0.85, ratio);
  }
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1.0 : 0.0;

  const getBigrams = (str: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  for (const b of bigrams1) {
    if (bigrams2.has(b)) {
      intersection++;
    }
  }

  return (2 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Parses tags from an XML Element containing <tag k="..." v="..."/> children.
 */
export function parseXmlTags(element: Element): OsmTags {
  const tags: OsmTags = {};
  const tagNodes = element.querySelectorAll('tag');
  for (const tag of tagNodes) {
    const k = tag.getAttribute('k');
    const v = tag.getAttribute('v');
    if (k && v !== null) {
      tags[k] = v;
    }
  }
  return tags;
}

/**
 * Parses OSM API 0.6 bounding box XML into OsmElement structures.
 */
export function parseOsmBboxXml(xmlString: string): OsmElement[] {
  if (typeof DOMParser === 'undefined') {
    return [];
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

  const nodeMap = new Map<number, LatLon>();
  const elements: OsmElement[] = [];

  // 1. First pass: Parse all <node> elements
  const nodeElements = xmlDoc.querySelectorAll('node');
  for (const node of nodeElements) {
    const id = parseInt(node.getAttribute('id') || '0', 10);
    const lat = parseFloat(node.getAttribute('lat') || '0');
    const lon = parseFloat(node.getAttribute('lon') || '0');
    const version = parseInt(node.getAttribute('version') || '1', 10);
    const changeset = parseInt(node.getAttribute('changeset') || '0', 10);
    const timestamp = node.getAttribute('timestamp') || undefined;
    const user = node.getAttribute('user') || undefined;

    if (id && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      nodeMap.set(id, { lat, lon });
      const tags = parseXmlTags(node);

      // Only include standalone nodes that have meaningful POI or descriptive tags
      if (Object.keys(tags).length > 0) {
        elements.push({
          id,
          type: 'node',
          lat,
          lon,
          version,
          changeset: changeset || undefined,
          timestamp,
          user,
          tags,
          isStructure: false,
        });
      }
    }
  }

  // 2. Second pass: Parse all <way> elements
  const wayElements = xmlDoc.querySelectorAll('way');
  for (const way of wayElements) {
    const id = parseInt(way.getAttribute('id') || '0', 10);
    const version = parseInt(way.getAttribute('version') || '1', 10);
    const changeset = parseInt(way.getAttribute('changeset') || '0', 10);
    const timestamp = way.getAttribute('timestamp') || undefined;
    const user = way.getAttribute('user') || undefined;
    const tags = parseXmlTags(way);

    const ndNodes = way.querySelectorAll('nd');
    const geometry: LatLon[] = [];

    for (const nd of ndNodes) {
      const ref = parseInt(nd.getAttribute('ref') || '0', 10);
      const coord = nodeMap.get(ref);
      if (coord) {
        geometry.push(coord);
      }
    }

    if (geometry.length > 0) {
      // Calculate centroid of the way geometry
      let sumLat = 0;
      let sumLon = 0;
      for (const pt of geometry) {
        sumLat += pt.lat;
        sumLon += pt.lon;
      }
      const centroidLat = sumLat / geometry.length;
      const centroidLon = sumLon / geometry.length;

      const hasStructureTag = Boolean(
        tags.building ||
        tags.amenity ||
        tags.shop ||
        tags.tourism ||
        tags.leisure ||
        tags.healthcare ||
        tags.office ||
        tags.craft
      );

      // Include ways with tags or building geometry
      if (Object.keys(tags).length > 0 || geometry.length >= 3) {
        elements.push({
          id,
          type: 'way',
          lat: centroidLat,
          lon: centroidLon,
          version,
          changeset: changeset || undefined,
          timestamp,
          user,
          tags,
          geometry,
          isStructure: hasStructureTag,
        });
      }
    }
  }

  return elements;
}

/**
 * Fetches and parses all OSM elements in a geographic bounding box via OSM API 0.6.
 */
export async function fetchOsmElementsInBbox(
  bbox: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  },
  baseUrl: string = OSM_API_BASE,
  customFetch: typeof fetch = fetch
): Promise<OsmElement[]> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBaseUrl}/map?bbox=${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;

  try {
    const response = await customFetch(url, {
      headers: {
        'User-Agent': 'Browsm/0.1.0 (OpenStreetMap POI Editor Extension)',
        'Accept': 'application/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`OSM bbox request failed with HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    return parseOsmBboxXml(xmlText);
  } catch (error) {
    console.error('Error fetching OSM bbox:', error);
    return [];
  }
}

/**
 * Compares source tags against an existing OSM element and produces TagDiffItems.
 */
export function generateTagDiff(
  sourceTags: Record<string, string>,
  targetElement?: OsmElement,
  sourceOrigin?: 'schema_org' | 'microdata' | 'opengraph' | 'page_text' | 'manual_search' | 'custom' | string,
  sourceNote?: string
): TagDiffItem[] {
  const osmTags = targetElement?.tags || {};
  const allKeys = new Set([...Object.keys(sourceTags), ...Object.keys(osmTags)]);
  const diffs: TagDiffItem[] = [];

  for (const key of allKeys) {
    const sourceVal = sourceTags[key]?.trim();
    const osmVal = osmTags[key]?.trim();

    let status: TagDiffStatus;
    let action: 'apply' | 'ignore';
    let stagedValue: string;

    if (sourceVal && osmVal) {
      if (sourceVal === osmVal) {
        status = 'identical';
        action = 'ignore';
        stagedValue = osmVal;
      } else if (isMinorTagDifference(key, sourceVal, osmVal)) {
        status = 'minor_difference';
        action = 'ignore';
        stagedValue = osmVal;
      } else {
        status = 'outdated_in_osm';
        action = 'apply';
        stagedValue = sourceVal;
      }
    } else if (sourceVal && !osmVal) {
      status = 'missing_in_osm';
      action = 'apply';
      stagedValue = sourceVal;
    } else {
      // Exists in OSM but not in webpage source
      status = 'identical';
      action = 'ignore';
      stagedValue = osmVal || '';
    }

    diffs.push({
      key,
      sourceValue: sourceVal,
      osmValue: osmVal,
      stagedValue,
      status,
      action,
      sourceOrigin: sourceVal ? sourceOrigin : undefined,
      sourceNote: sourceVal ? sourceNote : undefined,
    });
  }

  // Sort diffs:
  // 1. Items with staged changes at the top (action != 'ignore' and stagedValue != osmValue)
  // 2. Items with ignored differences or minor differences next
  // 3. Items with no changes / identical last
  diffs.sort((a, b) => {
    const getTier = (item: TagDiffItem): number => {
      const isModified = item.stagedValue !== (item.osmValue || '');
      if (isModified && item.action !== 'ignore') return 1;
      if (
        item.status === 'minor_difference' ||
        (item.sourceValue && item.osmValue && item.sourceValue !== item.osmValue && item.action === 'ignore')
      ) {
        return 2;
      }
      return 3;
    };

    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) return tierA - tierB;

    const priorityKeys = [
      'name',
      'amenity',
      'shop',
      'tourism',
      'addr:housenumber',
      'addr:street',
      'phone',
      'website',
      'opening_hours',
    ];
    const idxA = priorityKeys.indexOf(a.key);
    const idxB = priorityKeys.indexOf(b.key);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.key.localeCompare(b.key);
  });

  return diffs;
}

/**
 * Scores and identifies the best candidate match from nearby OSM elements.
 */
export function findBestMatch(
  target: {
    name?: string;
    phone?: string;
    website?: string;
    lat?: number;
    lon?: number;
    osmId?: number | string;
    osmType?: string;
    tags?: Record<string, string>;
  },
  candidates: OsmElement[]
): SpatialMatchResult {
  const targetLat = target.lat ?? 0;
  const targetLon = target.lon ?? 0;

  let bestScore = 0;
  let bestElement: OsmElement | undefined;

  for (const candidate of candidates) {
    let score = 0;

    // 0. Direct OSM ID match (immediate exact match)
    if (target.osmId !== undefined && target.osmId !== '' && String(candidate.id) === String(target.osmId)) {
      if (!target.osmType || candidate.type === target.osmType) {
        score += 1.0;
      }
    }

    // 1. Name match across primary and alternate name tags (up to 0.45)
    if (target.name) {
      const nameCandidates = [
        candidate.tags.name,
        candidate.tags['name:en'],
        candidate.tags.alt_name,
        candidate.tags.official_name,
        candidate.tags.brand,
        candidate.tags.operator,
      ].filter((val): val is string => Boolean(val));

      let maxNameSim = 0;
      for (const candName of nameCandidates) {
        const sim = calculateStringSimilarity(target.name, candName);
        if (sim > maxNameSim) {
          maxNameSim = sim;
        }
      }
      score += maxNameSim * 0.45;
    }

    // 2. Proximity match (up to 0.35)
    if (target.lat !== undefined && target.lon !== undefined) {
      const dist = calculateDistanceMeters(target.lat, target.lon, candidate.lat, candidate.lon);
      if (dist <= 10) {
        score += 0.35;
      } else if (dist <= 30) {
        score += 0.25;
      } else if (dist <= 60) {
        score += 0.15;
      } else if (dist <= 100) {
        score += 0.05;
      }
    }

    // 3. Phone match (up to 0.10)
    if (target.phone && candidate.tags.phone) {
      const cleanTargetPhone = target.phone.replace(/\D/g, '');
      const cleanCandPhone = candidate.tags.phone.replace(/\D/g, '');
      if (cleanTargetPhone && cleanCandPhone && (cleanTargetPhone.includes(cleanCandPhone) || cleanCandPhone.includes(cleanTargetPhone))) {
        score += 0.10;
      }
    }

    // 4. Website match (up to 0.10)
    if (target.website && candidate.tags.website) {
      const w1 = target.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
      const w2 = candidate.tags.website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
      if (w1 && w2 && (w1 === w2 || w1.includes(w2) || w2.includes(w1))) {
        score += 0.10;
      }
    }

    // 5. Category / tag overlap (amenity, shop, tourism, leisure, building) (up to 0.10)
    if (target.tags) {
      const categoryKeys = ['amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'building'];
      for (const key of categoryKeys) {
        if (target.tags[key] && candidate.tags[key] && target.tags[key] === candidate.tags[key]) {
          score += 0.05;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestElement = candidate;
    }
  }

  let matchStatus: 'exact_match' | 'possible_match' | 'no_match';
  if (bestScore >= 0.70) {
    matchStatus = 'exact_match';
  } else if (bestScore >= 0.35) {
    matchStatus = 'possible_match';
  } else {
    matchStatus = 'no_match';
  }

  const sourceTags = target.tags || {};
  const tagDiffs = generateTagDiff(sourceTags, bestElement);

  return {
    matchStatus,
    targetCoordinates: { lat: targetLat, lon: targetLon },
    matchedElement: bestElement,
    nearbyElements: candidates,
    tagDiffs,
  };
}
