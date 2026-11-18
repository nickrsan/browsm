/**
 * OpenStreetMap Map Notes Service
 * Enables non-destructive POI reporting and local data suggestions via the OSM Notes API.
 * Ideal for contributors who want to suggest additions or corrections without direct map edits.
 */

import type { SchemaOrgPlace } from '@/types/schema';
import type { OsmNote, CreateNoteParams } from '@/types/auth';
import { parseXml } from './osm-api';

const DEFAULT_API_BASE_URL = 'https://api.openstreetmap.org/api/0.6';

/**
 * Parses an OSM XML <note> node into a typed OsmNote object.
 */
export function parseNoteFromXml(noteEl: Element): OsmNote {
  const idStr = noteEl.querySelector('id')?.textContent || '0';
  const id = parseInt(idStr, 10);
  const lat = parseFloat(noteEl.getAttribute('lat') || '0');
  const lon = parseFloat(noteEl.getAttribute('lon') || '0');
  const status = (noteEl.querySelector('status')?.textContent?.trim() as 'open' | 'closed') || 'open';
  const createdAt = noteEl.querySelector('date_created')?.textContent?.trim() || '';
  const closedAt = noteEl.querySelector('date_closed')?.textContent?.trim() || undefined;

  const comments: OsmNote['comments'] = [];
  const commentEls = noteEl.querySelectorAll('comments > comment');
  commentEls.forEach((c) => {
    const date = c.querySelector('date')?.textContent?.trim() || '';
    const user = c.querySelector('user')?.textContent?.trim() || undefined;
    const uidStr = c.querySelector('uid')?.textContent?.trim();
    const uid = uidStr ? parseInt(uidStr, 10) : undefined;
    const action = (c.querySelector('action')?.textContent?.trim() as 'opened' | 'commented' | 'closed' | 'reopened') || 'opened';
    const text = c.querySelector('text')?.textContent?.trim() || '';

    comments.push({
      date,
      user,
      uid,
      action,
      text,
    });
  });

  return {
    id,
    lat,
    lon,
    url: `https://www.openstreetmap.org/note/${id}`,
    status,
    createdAt,
    closedAt,
    comments,
  };
}

/**
 * Creates a new OpenStreetMap Map Note via POST /api/0.6/notes.
 * If an access token is provided, the note is attributed to the authenticated user.
 */
export async function createOsmNote(
  params: CreateNoteParams,
  accessToken?: string,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<OsmNote> {
  const url = `${baseUrl.replace(/\/+$/, '')}/notes`;

  const bodyParams = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    text: params.text,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/xml, application/xml',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await customFetch(url, {
    method: 'POST',
    headers,
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create OSM Note (HTTP ${response.status}): ${errText}`);
  }

  const xmlText = await response.text();
  const doc = parseXml(xmlText);
  const noteEl = doc.querySelector('note');

  if (!noteEl) {
    throw new Error('Invalid OSM Notes API response: missing <note> element.');
  }

  return parseNoteFromXml(noteEl);
}

/**
 * Fetches an existing OSM Note by ID.
 */
export async function fetchNote(
  noteId: number,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<OsmNote | null> {
  const url = `${baseUrl.replace(/\/+$/, '')}/notes/${noteId}`;

  const response = await customFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/xml, application/xml',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errText = await response.text();
    throw new Error(`Failed to fetch OSM Note #${noteId} (HTTP ${response.status}): ${errText}`);
  }

  const xmlText = await response.text();
  const doc = parseXml(xmlText);
  const noteEl = doc.querySelector('note');

  if (!noteEl) {
    return null;
  }

  return parseNoteFromXml(noteEl);
}

/**
 * Formats a clean, informative OpenStreetMap Note message from extracted webpage metadata.
 */
export function formatNoteTextFromPlace(
  place: SchemaOrgPlace,
  suggestedTags?: Record<string, string>,
  userNote?: string
): string {
  const lines: string[] = [];

  lines.push('POI information detected from webpage via Browsm:');
  if (place.name) {
    lines.push(`Name: ${place.name}`);
  }
  if (place.type) {
    lines.push(`Category: ${place.type}`);
  }

  if (place.address) {
    const addrParts: string[] = [];
    if (place.address.streetAddress) addrParts.push(place.address.streetAddress);
    if (place.address.addressLocality) addrParts.push(place.address.addressLocality);
    if (place.address.addressRegion) addrParts.push(place.address.addressRegion);
    if (place.address.postalCode) addrParts.push(place.address.postalCode);
    if (place.address.addressCountry) addrParts.push(place.address.addressCountry);
    if (addrParts.length > 0) {
      lines.push(`Address: ${addrParts.join(', ')}`);
    }
  }

  if (place.telephone) {
    lines.push(`Phone: ${place.telephone}`);
  }
  if (place.url) {
    lines.push(`Website: ${place.url}`);
  }
  if (place.openingHours && place.openingHours.length > 0) {
    lines.push(`Opening Hours: ${place.openingHours.join('; ')}`);
  }

  if (suggestedTags && Object.keys(suggestedTags).length > 0) {
    lines.push('\nSuggested OSM Tags:');
    for (const [k, v] of Object.entries(suggestedTags)) {
      lines.push(`  ${k}=${v}`);
    }
  }

  if (userNote?.trim()) {
    lines.push(`\nNote from mapper: ${userNote.trim()}`);
  }

  lines.push(`\nSource URL: ${place.sourceUrl}`);

  return lines.join('\n');
}
