/**
 * Schema.org, Microdata, and Meta Tag Extractor
 * Parses structured JSON-LD, HTML5 Microdata, and OpenGraph metadata from web pages.
 */

import type { SchemaOrgPlace, SchemaOrgAddress, SchemaOrgGeoCoordinates } from '@/types/schema';

/**
 * Common Schema.org types that represent local places and businesses.
 */
const SUPPORTED_SCHEMA_TYPES = new Set([
  'localbusiness',
  'restaurant',
  'foodestablishment',
  'cafeorcoffeeshop',
  'barorpub',
  'bakery',
  'fastfoodrestaurant',
  'store',
  'grocerystore',
  'supermarket',
  'clothingstore',
  'conveniencestore',
  'bookstore',
  'hardwarestore',
  'lodgingbusiness',
  'hotel',
  'motel',
  'hostel',
  'dentist',
  'physician',
  'medicalclinic',
  'pharmacy',
  'bankorcreditunion',
  'automotiverepair',
  'autobodyrepair',
  'autorepair',
  'beautysalon',
  'hairsalon',
  'gasstation',
  'place',
  'touristattraction',
  'museum',
  'civicstructure',
  'library',
  'organization',
]);

/**
 * Checks if a Schema.org @type string or array matches a supported place/business category.
 */
export function isSupportedSchemaType(typeValue: unknown): boolean {
  if (typeof typeValue === 'string') {
    const normalized = typeValue.toLowerCase().replace(/^https?:\/\/schema\.org\//i, '');
    return SUPPORTED_SCHEMA_TYPES.has(normalized);
  }
  if (Array.isArray(typeValue)) {
    return typeValue.some((t) => isSupportedSchemaType(t));
  }
  return false;
}

/**
 * Resolves the primary type string from a single string or array of types.
 */
export function extractPrimaryType(typeValue: unknown): string {
  if (typeof typeValue === 'string') {
    return typeValue.replace(/^https?:\/\/schema\.org\//i, '');
  }
  if (Array.isArray(typeValue)) {
    const specificType = typeValue.find((t) => typeof t === 'string' && t.toLowerCase() !== 'thing' && t.toLowerCase() !== 'place');
    if (specificType) {
      return String(specificType).replace(/^https?:\/\/schema\.org\//i, '');
    }
    return String(typeValue[0] || 'LocalBusiness').replace(/^https?:\/\/schema\.org\//i, '');
  }
  return 'LocalBusiness';
}

/**
 * Parses postal address object from JSON-LD or Microdata.
 */
export function parsePostalAddress(rawAddress: unknown): SchemaOrgAddress | undefined {
  if (!rawAddress) return undefined;

  if (typeof rawAddress === 'string') {
    return {
      streetAddress: rawAddress.trim(),
    };
  }

  if (typeof rawAddress === 'object' && rawAddress !== null) {
    const addr = rawAddress as Record<string, unknown>;
    const streetAddress = typeof addr.streetAddress === 'string' ? addr.streetAddress.trim() : undefined;
    const addressLocality = typeof addr.addressLocality === 'string' ? addr.addressLocality.trim() : undefined;
    const addressRegion = typeof addr.addressRegion === 'string' ? addr.addressRegion.trim() : undefined;
    const postalCode = typeof addr.postalCode === 'string' || typeof addr.postalCode === 'number' ? String(addr.postalCode).trim() : undefined;
    const addressCountry = typeof addr.addressCountry === 'string'
      ? addr.addressCountry.trim()
      : typeof (addr.addressCountry as Record<string, unknown>)?.name === 'string'
      ? String((addr.addressCountry as Record<string, unknown>).name).trim()
      : undefined;

    if (streetAddress || addressLocality || addressRegion || postalCode || addressCountry) {
      return {
        streetAddress,
        addressLocality,
        addressRegion,
        postalCode,
        addressCountry,
      };
    }
  }

  return undefined;
}

/**
 * Parses geographic coordinates from JSON-LD or Microdata.
 */
export function parseGeoCoordinates(rawGeo: unknown): SchemaOrgGeoCoordinates | undefined {
  if (!rawGeo || typeof rawGeo !== 'object') return undefined;

  const geo = rawGeo as Record<string, unknown>;
  const rawLat = geo.latitude ?? geo.lat;
  const rawLon = geo.longitude ?? geo.lon ?? geo.lng;

  const lat = typeof rawLat === 'number' ? rawLat : typeof rawLat === 'string' ? parseFloat(rawLat) : NaN;
  const lon = typeof rawLon === 'number' ? rawLon : typeof rawLon === 'string' ? parseFloat(rawLon) : NaN;

  if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
    return { latitude: lat, longitude: lon };
  }

  return undefined;
}

/**
 * Parses opening hours from JSON-LD openingHours array/string or openingHoursSpecification.
 */
export function parseOpeningHours(rawHours: unknown, rawSpec: unknown): string[] | undefined {
  const result: string[] = [];

  if (typeof rawHours === 'string' && rawHours.trim()) {
    result.push(rawHours.trim());
  } else if (Array.isArray(rawHours)) {
    for (const h of rawHours) {
      if (typeof h === 'string' && h.trim()) {
        result.push(h.trim());
      }
    }
  }

  if (Array.isArray(rawSpec)) {
    for (const spec of rawSpec) {
      if (typeof spec === 'object' && spec !== null) {
        const item = spec as Record<string, unknown>;
        const dayOfWeek = item.dayOfWeek;
        const opens = item.opens;
        const closes = item.closes;

        if (opens && closes) {
          const days = Array.isArray(dayOfWeek)
            ? dayOfWeek.map((d) => String(d).replace(/^https?:\/\/schema\.org\//i, '').substring(0, 2)).join(',')
            : typeof dayOfWeek === 'string'
            ? dayOfWeek.replace(/^https?:\/\/schema\.org\//i, '').substring(0, 2)
            : 'Mo-Su';
          result.push(`${days} ${opens}-${closes}`);
        }
      }
    }
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Extracts a SchemaOrgPlace from a JSON-LD object.
 */
export function parseJsonLdObject(data: unknown, sourceUrl: string): SchemaOrgPlace | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  // If item is a @graph array, search for the best matching place/business object
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const parsed = parseJsonLdObject(item, sourceUrl);
      if (parsed) return parsed;
    }
    return null;
  }

  const type = obj['@type'];
  if (!isSupportedSchemaType(type)) {
    return null;
  }

  const name = typeof obj.name === 'string' ? obj.name.trim() : undefined;
  const alternateName = typeof obj.alternateName === 'string' ? obj.alternateName.trim() : undefined;
  const telephone = typeof obj.telephone === 'string' ? obj.telephone.trim() : undefined;
  const url = typeof obj.url === 'string' ? obj.url.trim() : undefined;
  const email = typeof obj.email === 'string' ? obj.email.trim() : undefined;
  const address = parsePostalAddress(obj.address);
  const geo = parseGeoCoordinates(obj.geo);
  const openingHours = parseOpeningHours(obj.openingHours, obj.openingHoursSpecification);

  // Require at least a name or an address/geo coordinates to consider it a valid place
  if (!name && !address && !geo) {
    return null;
  }

  return {
    name,
    alternateName,
    type: extractPrimaryType(type),
    address,
    geo,
    telephone,
    url: url || sourceUrl,
    openingHours,
    email,
    sourceUrl,
    metadataSource: 'json_ld',
  };
}

/**
 * Extracts structured Schema.org data from HTML <script type="application/ld+json"> blocks.
 */
export function extractJsonLdFromDocument(doc: Document, sourceUrl: string): SchemaOrgPlace | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const content = script.textContent?.trim();
      if (!content) continue;

      const parsedJson = JSON.parse(content);

      if (Array.isArray(parsedJson)) {
        for (const item of parsedJson) {
          const place = parseJsonLdObject(item, sourceUrl);
          if (place) return place;
        }
      } else {
        const place = parseJsonLdObject(parsedJson, sourceUrl);
        if (place) return place;
      }
    } catch {
      // Ignore JSON parse errors in malformed script tags
    }
  }

  return null;
}

/**
 * Extracts structured POI data from HTML5 Microdata (itemscope itemtype="http://schema.org/...").
 */
export function extractMicrodataFromDocument(doc: Document, sourceUrl: string): SchemaOrgPlace | null {
  const scopes = doc.querySelectorAll('[itemscope]');

  for (const scope of scopes) {
    const itemType = scope.getAttribute('itemtype');
    if (!itemType || !isSupportedSchemaType(itemType)) continue;

    const nameEl = scope.querySelector('[itemprop="name"]');
    const name = nameEl?.getAttribute('content') || nameEl?.textContent?.trim() || undefined;

    const phoneEl = scope.querySelector('[itemprop="telephone"]');
    const telephone = phoneEl?.getAttribute('content') || phoneEl?.getAttribute('href')?.replace(/^tel:/i, '') || phoneEl?.textContent?.trim() || undefined;

    const urlEl = scope.querySelector('[itemprop="url"]');
    const url = urlEl?.getAttribute('href') || urlEl?.getAttribute('content') || undefined;

    const emailEl = scope.querySelector('[itemprop="email"]');
    const email = emailEl?.getAttribute('content') || emailEl?.getAttribute('href')?.replace(/^mailto:/i, '') || emailEl?.textContent?.trim() || undefined;

    // Address
    let address: SchemaOrgAddress | undefined;
    const addressScope = scope.querySelector('[itemprop="address"]');
    if (addressScope) {
      const street = addressScope.querySelector('[itemprop="streetAddress"]')?.textContent?.trim();
      const city = addressScope.querySelector('[itemprop="addressLocality"]')?.textContent?.trim();
      const state = addressScope.querySelector('[itemprop="addressRegion"]')?.textContent?.trim();
      const postalCode = addressScope.querySelector('[itemprop="postalCode"]')?.textContent?.trim();
      const country = addressScope.querySelector('[itemprop="addressCountry"]')?.textContent?.trim();
      address = {
        streetAddress: street,
        addressLocality: city,
        addressRegion: state,
        postalCode: postalCode,
        addressCountry: country,
      };
    }

    // Geo
    let geo: SchemaOrgGeoCoordinates | undefined;
    const geoScope = scope.querySelector('[itemprop="geo"]');
    if (geoScope) {
      const latStr = geoScope.querySelector('[itemprop="latitude"]')?.getAttribute('content') || geoScope.querySelector('[itemprop="latitude"]')?.textContent?.trim();
      const lonStr = geoScope.querySelector('[itemprop="longitude"]')?.getAttribute('content') || geoScope.querySelector('[itemprop="longitude"]')?.textContent?.trim();
      if (latStr && lonStr) {
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          geo = { latitude: lat, longitude: lon };
        }
      }
    }

    if (name || address || geo) {
      return {
        name,
        type: extractPrimaryType(itemType),
        address,
        geo,
        telephone,
        url: url || sourceUrl,
        email,
        sourceUrl,
        metadataSource: 'microdata',
      };
    }
  }

  return null;
}

/**
 * Extracts OpenGraph and Meta tags as a supplementary fallback.
 */
export function extractMetaTagsFromDocument(doc: Document, sourceUrl: string): Partial<SchemaOrgPlace> | null {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim();
  const ogLat = doc.querySelector('meta[property="place:location:latitude"], meta[property="og:latitude"]')?.getAttribute('content')?.trim();
  const ogLon = doc.querySelector('meta[property="place:location:longitude"], meta[property="og:longitude"]')?.getAttribute('content')?.trim();
  const ogPhone = doc.querySelector('meta[property="business:contact_data:phone_number"]')?.getAttribute('content')?.trim();
  const ogStreet = doc.querySelector('meta[property="business:contact_data:street_address"]')?.getAttribute('content')?.trim();
  const ogCity = doc.querySelector('meta[property="business:contact_data:locality"]')?.getAttribute('content')?.trim();
  const ogPostal = doc.querySelector('meta[property="business:contact_data:postal_code"]')?.getAttribute('content')?.trim();

  if (!ogTitle && !ogLat && !ogStreet) {
    return null;
  }

  let geo: SchemaOrgGeoCoordinates | undefined;
  if (ogLat && ogLon) {
    const lat = parseFloat(ogLat);
    const lon = parseFloat(ogLon);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      geo = { latitude: lat, longitude: lon };
    }
  }

  let address: SchemaOrgAddress | undefined;
  if (ogStreet || ogCity || ogPostal) {
    address = {
      streetAddress: ogStreet,
      addressLocality: ogCity,
      postalCode: ogPostal,
    };
  }

  return {
    name: ogTitle,
    type: 'LocalBusiness',
    address,
    geo,
    telephone: ogPhone,
    sourceUrl,
    metadataSource: 'opengraph',
  };
}

/**
 * Unified schema extraction orchestrator.
 * Tries JSON-LD first, followed by HTML5 Microdata and OpenGraph meta tags.
 */
export function extractSchemaFromDocument(doc: Document, sourceUrl: string): SchemaOrgPlace | null {
  const jsonLd = extractJsonLdFromDocument(doc, sourceUrl);
  if (jsonLd) {
    return jsonLd;
  }

  const microdata = extractMicrodataFromDocument(doc, sourceUrl);
  if (microdata) {
    return microdata;
  }

  const meta = extractMetaTagsFromDocument(doc, sourceUrl);
  if (meta && (meta.name || meta.address || meta.geo)) {
    return {
      name: meta.name,
      type: meta.type || 'LocalBusiness',
      address: meta.address,
      geo: meta.geo,
      telephone: meta.telephone,
      sourceUrl,
      metadataSource: 'opengraph',
    };
  }

  return null;
}
