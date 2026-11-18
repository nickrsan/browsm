/**
 * OpenStreetMap API 0.6 Client Service
 * Provides type-safe wrappers for OSM API 0.6 operations:
 * - User Details (`GET /api/0.6/user/details`)
 * - Changeset Lifecycle (`PUT /api/0.6/changeset/create`, `PUT /api/0.6/changeset/{id}/close`)
 * - Element Operations (`PUT /api/0.6/node/create`, `PUT /api/0.6/node/{id}`, `PUT /api/0.6/way/{id}`)
 * - Entity Inspection (`GET /api/0.6/{type}/{id}`)
 */

import type {
  OsmElement,
  OsmElementType,
  OsmTags,
} from '@/types/osm';
import type {
  OsmUserDetails,
  CreateChangesetParams,
  CreateNodeParams,
  UpdateNodeParams,
  UpdateWayParams,
} from '@/types/auth';

const DEFAULT_API_BASE_URL = 'https://api.openstreetmap.org/api/0.6';

/**
 * Escapes special characters for XML attribute and text nodes.
 */
export function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parses an XML string into a DOM Document.
 */
export function parseXml(xmlString: string): Document {
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`);
    }
    return doc;
  }
  throw new Error('DOMParser is not available in current environment.');
}

/**
 * Serializes tags dictionary to OSM XML <tag> elements.
 */
export function serializeTagsXml(tags: OsmTags): string {
  return Object.entries(tags)
    .map(([k, v]) => `    <tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`)
    .join('\n');
}

/**
 * Custom error class for OpenStreetMap API errors with HTTP status codes.
 */
export class OsmApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OsmApiError';
    this.status = status;
  }
}

/**
 * Fetches authenticated user profile details from GET /api/0.6/user/details.
 */
export async function getUserDetails(
  accessToken: string,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<OsmUserDetails> {
  const url = `${baseUrl.replace(/\/+$/, '')}/user/details`;

  const response = await customFetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'text/xml, application/xml',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new OsmApiError(`Failed to fetch OSM user details (HTTP ${response.status}): ${errText}`, response.status);
  }

  const xmlText = await response.text();
  const doc = parseXml(xmlText);
  const userEl = doc.querySelector('user');

  if (!userEl) {
    throw new Error('Invalid OSM user details response: missing <user> element.');
  }

  const id = parseInt(userEl.getAttribute('id') || '0', 10);
  const username = userEl.getAttribute('display_name') || 'Anonymous';
  const accountCreated = userEl.getAttribute('account_created') || '';
  const description = userEl.querySelector('description')?.textContent || undefined;
  const changesetCountStr = userEl.querySelector('changesets')?.getAttribute('count');
  const changesetCount = changesetCountStr ? parseInt(changesetCountStr, 10) : undefined;
  const img = userEl.querySelector('img')?.getAttribute('href') || undefined;

  const messagesEl = userEl.querySelector('messages');
  const receivedEl = messagesEl?.querySelector('received');
  const unreadMessagesCount = receivedEl?.getAttribute('unread')
    ? parseInt(receivedEl.getAttribute('unread')!, 10)
    : (messagesEl ? 0 : undefined);
  const totalMessagesCount = receivedEl?.getAttribute('count')
    ? parseInt(receivedEl.getAttribute('count')!, 10)
    : (messagesEl ? 0 : undefined);

  const roles: string[] = [];
  const roleEls = userEl.querySelectorAll('roles > role');
  roleEls.forEach((r) => {
    if (r.textContent) roles.push(r.textContent.trim());
  });

  return {
    id,
    username,
    accountCreated,
    description,
    changesetCount,
    unreadMessagesCount,
    totalMessagesCount,
    img,
    roles: roles.length > 0 ? roles : undefined,
  };
}

/**
 * Fetches user message counts and inbox metadata from the OpenStreetMap API.
 */
export async function checkUserMessages(
  accessToken: string,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<{ unreadCount: number; totalCount: number }> {
  const user = await getUserDetails(accessToken, baseUrl, customFetch);
  return {
    unreadCount: user.unreadMessagesCount ?? 0,
    totalCount: user.totalMessagesCount ?? 0,
  };
}

/**
 * Creates a new OpenStreetMap Changeset and returns the created Changeset ID.
 */
export async function createChangeset(
  accessToken: string,
  params: CreateChangesetParams,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const url = `${baseUrl.replace(/\/+$/, '')}/changeset/create`;

  const createdBy = params.createdBy || 'Browsm 0.1.0 (https://github.com/nicksantos/browsm)';
  const extraTags = params.extraTags || {};

  const tags: Record<string, string> = {
    created_by: createdBy,
    comment: params.comment,
    ...extraTags,
  };

  if (params.source) {
    tags.source = params.source;
  }

  const tagsXml = serializeTagsXml(tags);
  const payloadXml = `<osm>
  <changeset>
${tagsXml}
  </changeset>
</osm>`;

  const response = await customFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create OSM changeset (HTTP ${response.status}): ${errText}`);
  }

  const changesetIdStr = (await response.text()).trim();
  const changesetId = parseInt(changesetIdStr, 10);

  if (Number.isNaN(changesetId) || changesetId <= 0) {
    throw new Error(`Unexpected changeset ID returned by OSM API: "${changesetIdStr}"`);
  }

  return changesetId;
}

/**
 * Closes an open OpenStreetMap Changeset.
 */
export async function closeChangeset(
  accessToken: string,
  changesetId: number,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, '')}/changeset/${changesetId}/close`;

  const response = await customFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    // If the changeset is already closed (HTTP 409 Conflict), treat it as successfully closed
    if (response.status === 409 && errText.toLowerCase().includes('closed')) {
      return;
    }
    throw new Error(`Failed to close changeset #${changesetId} (HTTP ${response.status}): ${errText}`);
  }
}

/**
 * Creates a new OpenStreetMap Node within an open changeset.
 * Uses standard REST endpoint POST /api/0.6/nodes with fallback to legacy PUT /api/0.6/node/create.
 * Returns the newly created Node ID.
 */
export async function createNode(
  accessToken: string,
  params: CreateNodeParams,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const primaryUrl = `${cleanBaseUrl}/nodes`;
  const legacyUrl = `${cleanBaseUrl}/node/create`;

  const tagsXml = serializeTagsXml(params.tags);
  const payloadXml = `<osm>
  <node changeset="${params.changesetId}" lat="${params.lat}" lon="${params.lon}">
${tagsXml}
  </node>
</osm>`;

  // Try standard REST POST /nodes first
  let response = await customFetch(primaryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  // If POST /nodes returns 404 or 405 (e.g. legacy or custom OSM API server), fall back to PUT /node/create
  if (!response.ok && (response.status === 404 || response.status === 405)) {
    response = await customFetch(legacyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/xml',
      },
      body: payloadXml,
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new OsmApiError(`Failed to create OSM node (HTTP ${response.status}): ${errText}`, response.status);
  }

  const nodeIdStr = (await response.text()).trim();
  const nodeId = parseInt(nodeIdStr, 10);

  if (Number.isNaN(nodeId) || nodeId <= 0) {
    throw new Error(`Unexpected node ID returned by OSM API: "${nodeIdStr}"`);
  }

  return nodeId;
}

/**
 * Creates a new OpenStreetMap Way within an open changeset.
 * Uses standard REST endpoint POST /api/0.6/ways with fallback to legacy PUT /api/0.6/way/create.
 * Returns the newly created Way ID.
 */
export async function createWay(
  accessToken: string,
  params: {
    changesetId: number;
    nodeRefs: number[];
    tags: OsmTags;
  },
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const primaryUrl = `${cleanBaseUrl}/ways`;
  const legacyUrl = `${cleanBaseUrl}/way/create`;

  const ndsXml = params.nodeRefs.map((ref) => `    <nd ref="${ref}"/>`).join('\n');
  const tagsXml = serializeTagsXml(params.tags);
  const payloadXml = `<osm>
  <way changeset="${params.changesetId}">
${ndsXml}
${tagsXml}
  </way>
</osm>`;

  let response = await customFetch(primaryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  if (!response.ok && (response.status === 404 || response.status === 405)) {
    response = await customFetch(legacyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/xml',
      },
      body: payloadXml,
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new OsmApiError(`Failed to create OSM way (HTTP ${response.status}): ${errText}`, response.status);
  }

  const wayIdStr = (await response.text()).trim();
  const wayId = parseInt(wayIdStr, 10);

  if (Number.isNaN(wayId) || wayId <= 0) {
    throw new Error(`Unexpected way ID returned by OSM API: "${wayIdStr}"`);
  }

  return wayId;
}

/**
 * Creates a new OpenStreetMap Relation within an open changeset.
 * Uses standard REST endpoint POST /api/0.6/relations with fallback to legacy PUT /api/0.6/relation/create.
 * Returns the newly created Relation ID.
 */
export async function createRelation(
  accessToken: string,
  params: {
    changesetId: number;
    members: Array<{ type: 'node' | 'way' | 'relation'; ref: number; role?: string }>;
    tags: OsmTags;
  },
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const primaryUrl = `${cleanBaseUrl}/relations`;
  const legacyUrl = `${cleanBaseUrl}/relation/create`;

  const membersXml = params.members
    .map((m) => `    <member type="${m.type}" ref="${m.ref}" role="${escapeXml(m.role || '')}"/>`)
    .join('\n');
  const tagsXml = serializeTagsXml(params.tags);
  const payloadXml = `<osm>
  <relation changeset="${params.changesetId}">
${membersXml}
${tagsXml}
  </relation>
</osm>`;

  let response = await customFetch(primaryUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  if (!response.ok && (response.status === 404 || response.status === 405)) {
    response = await customFetch(legacyUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/xml',
      },
      body: payloadXml,
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new OsmApiError(`Failed to create OSM relation (HTTP ${response.status}): ${errText}`, response.status);
  }

  const relIdStr = (await response.text()).trim();
  const relId = parseInt(relIdStr, 10);

  if (Number.isNaN(relId) || relId <= 0) {
    throw new Error(`Unexpected relation ID returned by OSM API: "${relIdStr}"`);
  }

  return relId;
}

/**
 * Uploads an osmChange XML document to an open changeset.
 * Endpoint: POST /api/0.6/changeset/{id}/upload
 * Guarantees atomic transaction execution for multiple created/modified/deleted elements.
 */
export async function uploadOsmChange(
  accessToken: string,
  changesetId: number,
  osmChangeXml: string,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/changeset/${changesetId}/upload`;

  const response = await customFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: osmChangeXml,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new OsmApiError(`Failed to upload diff to changeset #${changesetId} (HTTP ${response.status}): ${errText}`, response.status);
  }

  return await response.text();
}

/**
 * Updates an existing OpenStreetMap Node within an open changeset.
 * Returns the updated Node version number.
 */
export async function updateNode(
  accessToken: string,
  params: UpdateNodeParams,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const url = `${baseUrl.replace(/\/+$/, '')}/node/${params.id}`;

  const tagsXml = serializeTagsXml(params.tags);
  const payloadXml = `<osm>
  <node id="${params.id}" changeset="${params.changesetId}" lat="${params.lat}" lon="${params.lon}" version="${params.version}">
${tagsXml}
  </node>
</osm>`;

  const response = await customFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 404) {
      throw new OsmApiError(
        `Node #${params.id} was not found on OSM server (${baseUrl}). It may have been deleted or only exists on another server preset.`,
        404
      );
    }
    throw new OsmApiError(`Failed to update OSM node #${params.id} (HTTP ${response.status}): ${errText}`, response.status);
  }

  const versionStr = (await response.text()).trim();
  const newVersion = parseInt(versionStr, 10);

  if (Number.isNaN(newVersion) || newVersion <= 0) {
    throw new Error(`Unexpected version returned by OSM API for node #${params.id}: "${versionStr}"`);
  }

  return newVersion;
}

/**
 * Updates tags on an existing OpenStreetMap Way (e.g. building structure) within an open changeset.
 * Returns the updated Way version number.
 */
export async function updateWayTags(
  accessToken: string,
  params: UpdateWayParams,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<number> {
  const url = `${baseUrl.replace(/\/+$/, '')}/way/${params.id}`;

  const ndsXml = params.nodeRefs.map((ref) => `    <nd ref="${ref}"/>`).join('\n');
  const tagsXml = serializeTagsXml(params.tags);
  const payloadXml = `<osm>
  <way id="${params.id}" changeset="${params.changesetId}" version="${params.version}">
${ndsXml}
${tagsXml}
  </way>
</osm>`;

  const response = await customFetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/xml',
    },
    body: payloadXml,
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 404) {
      throw new OsmApiError(
        `Way #${params.id} was not found on OSM server (${baseUrl}). It may have been deleted or only exists on another server preset.`,
        404
      );
    }
    throw new OsmApiError(`Failed to update OSM way #${params.id} (HTTP ${response.status}): ${errText}`, response.status);
  }

  const versionStr = (await response.text()).trim();
  const newVersion = parseInt(versionStr, 10);

  if (Number.isNaN(newVersion) || newVersion <= 0) {
    throw new Error(`Unexpected version returned by OSM API for way #${params.id}: "${versionStr}"`);
  }

  return newVersion;
}

/**
 * Fetches an OSM element (node, way, or relation) and returns structured OsmElement.
 */
export async function fetchElement(
  type: OsmElementType,
  id: number,
  baseUrl: string = DEFAULT_API_BASE_URL,
  customFetch: typeof fetch = fetch
): Promise<OsmElement> {
  const url = `${baseUrl.replace(/\/+$/, '')}/${type}/${id}`;

  const response = await customFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/xml, application/xml',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch OSM ${type} #${id} (HTTP ${response.status}): ${errText}`);
  }

  const xmlText = await response.text();
  const doc = parseXml(xmlText);
  const element = doc.querySelector(type);

  if (!element) {
    throw new Error(`Invalid response: element <${type}> with id #${id} not found in XML.`);
  }

  const lat = parseFloat(element.getAttribute('lat') || '0');
  const lon = parseFloat(element.getAttribute('lon') || '0');
  const version = parseInt(element.getAttribute('version') || '1', 10);
  const changeset = parseInt(element.getAttribute('changeset') || '0', 10) || undefined;
  const user = element.getAttribute('user') || undefined;
  const uid = parseInt(element.getAttribute('uid') || '0', 10) || undefined;
  const timestamp = element.getAttribute('timestamp') || undefined;

  const tags: OsmTags = {};
  const tagNodes = element.querySelectorAll('tag');
  tagNodes.forEach((t) => {
    const k = t.getAttribute('k');
    const v = t.getAttribute('v');
    if (k && v !== null) {
      tags[k] = v;
    }
  });

  const nodeRefs: number[] = [];
  if (type === 'way') {
    const ndNodes = element.querySelectorAll('nd');
    ndNodes.forEach((nd) => {
      const ref = parseInt(nd.getAttribute('ref') || '0', 10);
      if (ref) nodeRefs.push(ref);
    });
  }

  return {
    id,
    type,
    lat,
    lon,
    version,
    changeset,
    user,
    uid,
    timestamp,
    tags,
    nodeRefs: nodeRefs.length > 0 ? nodeRefs : undefined,
  };
}
