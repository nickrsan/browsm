/**
 * OpenStreetMap Tag Normalizer
 * Converts structured web data (Schema.org, Microdata, Free-form strings) into standard OSM tagging conventions.
 */

import type { SchemaOrgPlace, SchemaOrgAddress } from '@/types/schema';
import type { OsmTags } from '@/types/osm';

/**
 * Maps Schema.org types to default OSM tags.
 */
const SCHEMA_TYPE_TO_OSM_MAP: Record<string, OsmTags> = {
  restaurant: { amenity: 'restaurant' },
  foodestablishment: { amenity: 'restaurant' },
  cafeorcoffeeshop: { amenity: 'cafe' },
  cafe: { amenity: 'cafe' },
  barorpub: { amenity: 'bar' },
  bar: { amenity: 'bar' },
  pub: { amenity: 'pub' },
  fastfoodrestaurant: { amenity: 'fast_food' },
  icecreamshop: { amenity: 'ice_cream' },
  bakery: { shop: 'bakery' },
  supermarket: { shop: 'supermarket' },
  grocerystore: { shop: 'supermarket' },
  conveniencestore: { shop: 'convenience' },
  clothingstore: { shop: 'clothes' },
  bookstore: { shop: 'books' },
  hardwarestore: { shop: 'doityourself' },
  departmentstore: { shop: 'department_store' },
  florist: { shop: 'florist' },
  beautysalon: { shop: 'beauty' },
  hairsalon: { shop: 'hairdresser' },
  automotiverepair: { shop: 'car_repair' },
  autobodyrepair: { shop: 'car_repair' },
  autorepair: { shop: 'car_repair' },
  gasstation: { amenity: 'fuel' },
  bankorcreditunion: { amenity: 'bank' },
  bank: { amenity: 'bank' },
  pharmacy: { amenity: 'pharmacy', healthcare: 'pharmacy' },
  dentist: { amenity: 'dentist', healthcare: 'dentist' },
  physician: { amenity: 'clinic', healthcare: 'clinic' },
  medicalclinic: { amenity: 'clinic', healthcare: 'clinic' },
  hospital: { amenity: 'hospital', healthcare: 'hospital' },
  library: { amenity: 'library' },
  hotel: { tourism: 'hotel' },
  lodgingbusiness: { tourism: 'hotel' },
  motel: { tourism: 'motel' },
  hostel: { tourism: 'hostel' },
  museum: { tourism: 'museum' },
  touristattraction: { tourism: 'attraction' },
  gym: { leisure: 'fitness_centre' },
  movietheater: { amenity: 'cinema' },
  nightclub: { amenity: 'nightclub' },
  postoffice: { amenity: 'post_office' },
  drycleaningorlaundry: { shop: 'laundry' },
};

/**
 * Normalizes Schema.org type to corresponding OSM primary tag.
 */
export function schemaTypeToOsmTags(schemaType: string): OsmTags {
  if (!schemaType) return {};
  const normalized = schemaType.toLowerCase().replace(/[^a-z0-9]/g, '');
  return SCHEMA_TYPE_TO_OSM_MAP[normalized] || {};
}

/**
 * Normalizes a phone number into clean international E.123 / standard format.
 * Examples: "(401) 847-1234" -> "+1 401 847 1234" (if US assumed) or "+1 401-847-1234"
 */
export function normalizePhoneToE123(rawPhone?: string): string | undefined {
  if (!rawPhone) return undefined;

  let cleaned = rawPhone.trim();
  if (!cleaned) return undefined;

  // If starts with tel: prefix, remove it
  cleaned = cleaned.replace(/^tel:/i, '').trim();

  // If already in international format starting with +
  if (cleaned.startsWith('+')) {
    // If it already contains spaces or formatting, preserve it
    if (/\s/.test(cleaned)) {
      return cleaned;
    }
    const digitsOnly = cleaned.replace(/[^\d+]/g, '');
    // Standard format: +<country> <rest>
    if (digitsOnly.length >= 11) {
      return digitsOnly.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3 $4');
    }
    return cleaned;
  }

  // Remove unwanted characters except numbers, +, -, and spaces
  cleaned = cleaned.replace(/[^\d+ \-().]/g, '').trim();

  // Handle standard 10-digit North American numbers (e.g. (401) 847-1234 or 401-847-1234)
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 10)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.substring(1, 4)} ${digits.substring(4, 7)} ${digits.substring(7, 11)}`;
  }

  return cleaned;
}

/**
 * Canonicalizes a website URL by stripping trailing slashes, standardizing protocol, and lowercasing host.
 */
export function canonicalizeWebsiteUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let cleaned = rawUrl.trim();
  if (!cleaned) return undefined;

  // Add https:// protocol if missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const url = new URL(cleaned);
    let pathname = url.pathname;
    if (pathname === '/') {
      pathname = '';
    } else {
      pathname = pathname.replace(/\/+$/, '');
    }
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${pathname}${url.search}${url.hash}`;
  } catch {
    return cleaned.replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Extracts normalized digits from a phone number string for semantic comparison.
 */
export function canonicalizePhoneDigits(rawPhone?: string): string | undefined {
  if (!rawPhone) return undefined;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return undefined;

  // Normalize North American 10-digit to 11-digit with country code 1
  if (digits.length === 10) {
    return `1${digits}`;
  }
  return digits;
}

/**
 * Checks if a difference between source tag value and OSM tag value is a minor cosmetic/formatting difference.
 * Minor differences include trailing slashes in URLs, phone number punctuation (parentheses, dashes, spaces),
 * and redundant internal whitespace.
 */
export function isMinorTagDifference(key: string, sourceVal?: string, osmVal?: string): boolean {
  if (!sourceVal || !osmVal) return false;
  if (sourceVal.trim() === osmVal.trim()) return false;

  const k = key.toLowerCase().trim();

  // 1. Website / URL tags
  if (k === 'website' || k === 'contact:website' || k === 'url' || k.endsWith(':website') || k.endsWith(':url')) {
    const cSource = canonicalizeWebsiteUrl(sourceVal);
    const cOsm = canonicalizeWebsiteUrl(osmVal);
    if (cSource && cOsm && cSource === cOsm) {
      return true;
    }
  }

  // 2. Phone / Fax tags
  if (k === 'phone' || k === 'contact:phone' || k === 'fax' || k === 'contact:fax' || k === 'telephone') {
    const dSource = canonicalizePhoneDigits(sourceVal);
    const dOsm = canonicalizePhoneDigits(osmVal);
    if (dSource && dOsm && dSource === dOsm) {
      return true;
    }
  }

  // 3. Normalized internal whitespace
  const normSource = sourceVal.replace(/\s+/g, ' ').trim();
  const normOsm = osmVal.replace(/\s+/g, ' ').trim();
  if (normSource === normOsm) {
    return true;
  }

  // 4. Case-insensitive comparison for boolean / enumerated OSM tags
  const enumKeys = [
    'wheelchair',
    'building',
    'source',
    'drive_through',
    'diet:vegetarian',
    'diet:vegan',
    'smoking',
    'internet_access',
    'takeaway',
    'delivery',
  ];
  if (enumKeys.includes(k) && normSource.toLowerCase() === normOsm.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Normalizes and validates a website URL.
 */
export function normalizeWebsite(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;

  let cleaned = rawUrl.trim();
  if (!cleaned) return undefined;

  // Add https:// protocol if missing
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  try {
    const url = new URL(cleaned);
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * Normalizes postal address components into standard OSM addr:* tags.
 */
export function normalizeAddressToTags(address?: SchemaOrgAddress): OsmTags {
  if (!address) return {};

  const tags: OsmTags = {};

  if (address.streetAddress) {
    const street = address.streetAddress.trim();

    // Check if street address starts with a house number (e.g. "120 Ocean Avenue" or "12-B Main St")
    const match = street.match(/^(\d+[\w\-/]*)\s+(.+)$/);
    if (match) {
      tags['addr:housenumber'] = match[1].trim();
      tags['addr:street'] = match[2].trim();
    } else {
      tags['addr:street'] = street;
    }
  }

  if (address.addressLocality) {
    tags['addr:city'] = address.addressLocality.trim();
  }

  if (address.addressRegion) {
    tags['addr:state'] = address.addressRegion.trim();
  }

  if (address.postalCode) {
    tags['addr:postcode'] = String(address.postalCode).trim();
  }

  if (address.addressCountry) {
    const country = address.addressCountry.trim();
    // If country is 2-letter ISO code, capitalize it
    if (country.length === 2) {
      tags['addr:country'] = country.toUpperCase();
    } else {
      tags['addr:country'] = country;
    }
  }

  return tags;
}

/**
 * Normalizes opening hours into OSM opening_hours syntax.
 */
export function normalizeOpeningHours(rawHours?: string[] | string): string | undefined {
  if (!rawHours) return undefined;

  const hoursList = Array.isArray(rawHours) ? rawHours : [rawHours];
  if (hoursList.length === 0) return undefined;

  const cleanList = hoursList
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (cleanList.length === 0) return undefined;

  // Join multiple specifications with semicolons per OSM convention
  return cleanList.join('; ');
}

/**
 * Converts a SchemaOrgPlace entity into a normalized set of OSM tags.
 */
export function convertSchemaPlaceToOsmTags(place: SchemaOrgPlace): OsmTags {
  const tags: OsmTags = {};

  if (place.name) {
    tags.name = place.name.trim();
  }

  if (place.alternateName) {
    tags.alt_name = place.alternateName.trim();
  }

  // Primary category tags
  const typeTags = schemaTypeToOsmTags(place.type);
  Object.assign(tags, typeTags);

  // Address tags
  const addressTags = normalizeAddressToTags(place.address);
  Object.assign(tags, addressTags);

  // Phone
  const phone = normalizePhoneToE123(place.telephone);
  if (phone) {
    tags.phone = phone;
  }

  // Website
  const website = normalizeWebsite(place.url);
  if (website) {
    tags.website = website;
  }

  // Email
  if (place.email) {
    tags.email = place.email.trim();
  }

  // Opening hours
  const hours = normalizeOpeningHours(place.openingHours);
  if (hours) {
    tags.opening_hours = hours;
  }

  return tags;
}

/**
 * Common OpenStreetMap tag keys recommended for POIs and businesses.
 */
export const COMMON_OSM_TAG_KEYS: string[] = [
  'name',
  'alt_name',
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'office',
  'craft',
  'healthcare',
  'building',
  'addr:housenumber',
  'addr:street',
  'addr:city',
  'addr:postcode',
  'addr:state',
  'addr:country',
  'phone',
  'website',
  'email',
  'opening_hours',
  'cuisine',
  'operator',
  'brand',
  'wheelchair',
  'delivery',
  'takeaway',
  'outdoor_seating',
  'description',
  'contact:phone',
  'contact:website',
  'contact:email',
  'contact:instagram',
  'contact:facebook',
  'wikidata',
  'wikipedia',
];

/**
 * Validates an individual OSM tag key and value, returning validation status and helpful warning hints.
 */
export function validateOsmTag(
  key: string,
  value: string
): { isValid: boolean; warning?: string } {
  if (!key || key.trim().length === 0) {
    return { isValid: false, warning: 'Tag key cannot be empty.' };
  }

  const cleanKey = key.trim();
  const cleanVal = value.trim();

  // If value is empty, it represents tag deletion
  if (cleanVal.length === 0) {
    return { isValid: true };
  }

  // Key format check (no spaces, valid characters)
  if (/\s/.test(cleanKey)) {
    return { isValid: false, warning: 'OSM tag keys should not contain spaces (use colons or underscores).' };
  }

  // Phone validation
  if (cleanKey === 'phone' || cleanKey === 'contact:phone' || cleanKey === 'fax') {
    if (/[a-zA-Z]/.test(cleanVal)) {
      return { isValid: false, warning: 'Phone number should not contain alphabetic characters.' };
    }
    if (!cleanVal.startsWith('+')) {
      return {
        isValid: true,
        warning: 'OSM recommendation: Use international format starting with country code (e.g. +1 401 555 1234).',
      };
    }
  }

  // Website validation
  if (cleanKey === 'website' || cleanKey === 'contact:website' || cleanKey === 'url') {
    if (!/^https?:\/\//i.test(cleanVal)) {
      return {
        isValid: true,
        warning: 'Websites in OSM should include protocol prefix (e.g. https://example.com).',
      };
    }
    try {
      new URL(cleanVal);
    } catch {
      return { isValid: false, warning: 'Invalid URL format.' };
    }
  }

  // Email validation
  if (cleanKey === 'email' || cleanKey === 'contact:email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanVal)) {
      return { isValid: false, warning: 'Invalid email address format.' };
    }
  }

  // Wheelchair validation
  if (cleanKey === 'wheelchair') {
    const validWheelchair = ['yes', 'no', 'limited', 'designated'];
    if (!validWheelchair.includes(cleanVal.toLowerCase())) {
      return {
        isValid: true,
        warning: `Standard values for wheelchair are: ${validWheelchair.join(', ')}`,
      };
    }
  }

  // Yes / No boolean tag values
  if (['delivery', 'takeaway', 'outdoor_seating', 'drive_through'].includes(cleanKey)) {
    const validBooleans = ['yes', 'no', 'limited', 'only'];
    if (!validBooleans.includes(cleanVal.toLowerCase())) {
      return {
        isValid: true,
        warning: `Standard values for ${cleanKey} are: ${validBooleans.join(', ')}`,
      };
    }
  }

  return { isValid: true };
}
