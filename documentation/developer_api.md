# Browsm Developer & API Documentation

This document describes the architectural layout, TypeScript data models, services, messaging protocols, testing strategy, and coding standards for developers contributing to the Browsm extension.

---

## 1. Project Architecture

Browsm is built on the [WXT](https://wxt.dev) framework and [Svelte 5](https://svelte.dev), using standard WebExtension APIs across Firefox and Chromium platforms.

### Directory Structure
```
browsm/
├── src/
│   ├── components/
│   │   ├── MapLibreMap.svelte # Encapsulated MapLibre vector map component
│   │   ├── AuthHeader.svelte  # OSM OAuth user card & login/logout header
│   │   └── NoteModal.svelte   # Non-destructive Map Note creation dialog
│   ├── entrypoints/
│   │   ├── background.ts      # Unified background service worker
│   │   ├── content/           # In-page Schema.org & Microdata extractor
│   │   ├── popup/             # Action popup UI & quick note trigger
│   │   └── sidebar/           # Sidebar workspace & Vector Map
│   ├── services/
│   │   ├── schema-parser.ts   # JSON-LD, Microdata & OpenGraph extraction
│   │   ├── tag-normalizer.ts  # Address, phone (E.123), website & hours normalizer
│   │   ├── geocoding.ts       # Cached Nominatim geocoding client
│   │   ├── spatial-matcher.ts # OSM API 0.6 bbox parser & candidate matcher
│   │   ├── osm-auth.ts        # Zero-server OAuth 2.0 PKCE client
│   │   ├── osm-api.ts         # OSM API 0.6 changeset, node & way transaction client
│   │   └── osm-notes.ts       # OpenStreetMap Map Notes submission service
│   ├── stores/
│   │   └── auth.svelte.ts     # Svelte 5 reactive authentication store
│   ├── lib/
│   │   └── messaging.ts       # Type-safe extension messaging hub
│   └── types/                 # Centralized TypeScript definitions
│       ├── osm.ts             # OSM elements & Nominatim responses
│       ├── map.ts             # Vector map models & OpenFreeMap styles
│       ├── schema.ts          # Schema.org place representations
│       ├── diff.ts            # Tag diffing & match session state
│       ├── auth.ts            # OAuth tokens, user profiles, changesets & notes
│       ├── messaging.ts       # Payload definitions
│       └── index.ts           # Re-exports
├── tests/
│   ├── setup.ts               # Test environment setup & WebExt polyfills
│   └── unit/                  # Vitest unit & component test suites
├── wxt.config.ts              # Manifest & build configuration
└── vitest.config.ts           # Test runner configuration
```

---

## 2. Core Services API

### Schema Parser (`src/services/schema-parser.ts`)
- `extractSchemaFromDocument(doc: Document, sourceUrl: string): SchemaOrgPlace | null`
  - Scans `<script type="application/ld+json">` (direct, arrays, and `@graph` structures), HTML5 Microdata (`[itemscope][itemtype]`), and OpenGraph fallback meta tags.
- `isSupportedSchemaType(typeValue: unknown): boolean`
  - Validates whether a schema `@type` matches supported local business / place categories.

### Tag Normalizer (`src/services/tag-normalizer.ts`)
- `convertSchemaPlaceToOsmTags(place: SchemaOrgPlace): OsmTags`
  - Converts a structured `SchemaOrgPlace` into standardized OSM tags.
- `normalizeAddressToTags(address?: SchemaOrgAddress): OsmTags`
  - Splits street strings into `addr:housenumber` and `addr:street`, maps `addr:city`, `addr:state`, `addr:postcode`, `addr:country`.
- `normalizePhoneToE123(rawPhone?: string): string | undefined`
  - Normalizes phone numbers to international standard format with proper country prefixes.
- `normalizeWebsite(rawUrl?: string): string | undefined`
  - Validates and normalizes website URLs with `https://` protocol.

### Geocoding Service (`src/services/geocoding.ts`)
- `geocodeQuery(query: string, options?: GeocodeOptions): Promise<NominatimResult[]>`
  - Free-form address search with User-Agent enforcement and 24-hour local storage caching (`browser.storage.local`).
- `geocodeStructured(params: Record<string, string>, options?: GeocodeOptions): Promise<NominatimResult[]>`
  - Structured discrete parameter geocoding.
- `clearGeocodingCache(): Promise<void>`
  - Purges all cached geocoding records from local storage.

### Spatial Matcher Service (`src/services/spatial-matcher.ts`)
- `fetchOsmElementsInBbox(bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }): Promise<OsmElement[]>`
  - Queries `https://api.openstreetmap.org/api/0.6/map?bbox=...` and parses both standalone `<node>` elements and `<way>` building structures with geometry centroids.
- `findBestMatch(target: { name?: string; phone?: string; website?: string; lat?: number; lon?: number }, candidates: OsmElement[]): SpatialMatchResult`
  - Scores candidates using Sørensen-Dice name similarity, coordinate distance, phone, and website.
- `generateTagDiff(sourceTags: Record<string, string>, targetElement?: OsmElement): TagDiffItem[]`
  - Generates itemized diffs between page metadata tags and live OSM element tags.

### OAuth 2.0 PKCE Client (`src/services/osm-auth.ts`)
- `generateCodeVerifier(length?: number): string`
  - Generates cryptographically secure random string for RFC 7636 PKCE.
- `generateCodeChallenge(verifier: string): Promise<string>`
  - Computes SHA-256 Base64URL challenge using standard Web Cryptography API (`crypto.subtle`).
- `buildAuthorizationUrl(config: OsmAuthConfig, codeChallenge: string, state: string): string`
  - Generates OpenStreetMap OAuth 2.0 authorization URL.
- `exchangeCodeForToken(config: OsmAuthConfig, code: string, codeVerifier: string): Promise<OsmAuthToken>`
  - Exchanges authorization code for bearer access token.
- `loginWithOsm(configOverride?: Partial<OsmAuthConfig>): Promise<OsmAuthState>`
  - Launches `browser.identity.launchWebAuthFlow`, completes token exchange, fetches user profile, and persists state in `browser.storage.local`.
- `logoutOsm(): Promise<void>`
  - Clears stored authentication state.

### OSM API 0.6 Client (`src/services/osm-api.ts`)
- `getUserDetails(accessToken: string, baseUrl?: string): Promise<OsmUserDetails>`
  - Queries `GET /api/0.6/user/details` and parses user profile, changeset count, and roles.
- `createChangeset(accessToken: string, params: CreateChangesetParams, baseUrl?: string): Promise<number>`
  - Opens a new changeset with `created_by=Browsm` and `source=website`.
- `closeChangeset(accessToken: string, changesetId: number, baseUrl?: string): Promise<void>`
  - Closes an active changeset.
- `createNode(accessToken: string, params: CreateNodeParams, baseUrl?: string): Promise<number>`
  - Creates a new POI node and returns the created node ID.
- `updateNode(accessToken: string, params: UpdateNodeParams, baseUrl?: string): Promise<number>`
  - Updates an existing node and returns the incremented version.
- `updateWayTags(accessToken: string, params: UpdateWayParams, baseUrl?: string): Promise<number>`
  - Updates tags on an existing building structure/way.
- `fetchElement(type: OsmElementType, id: number, baseUrl?: string): Promise<OsmElement>`
  - Fetches XML for any node, way, or relation and parses structured `OsmElement`.

### Map Notes Service (`src/services/osm-notes.ts`)
- `createOsmNote(params: CreateNoteParams, accessToken?: string, baseUrl?: string): Promise<OsmNote>`
  - Submits a non-destructive Map Note via `POST /api/0.6/notes`.
- `fetchNote(noteId: number, baseUrl?: string): Promise<OsmNote | null>`
  - Retrieves note status and community comments.
- `formatNoteTextFromPlace(place: SchemaOrgPlace, suggestedTags?: Record<string, string>, userNote?: string): string`
  - Formats detected place attributes and suggested tags into a clean note body.

### Reactive Authentication Store (`src/stores/auth.svelte.ts`)
- `authStore`: Svelte 5 runes-powered singleton class exposing:
  - `isAuthenticated`: boolean
  - `isLoading`: boolean
  - `user`: `OsmUserDetails | undefined`
  - `token`: `OsmAuthToken | undefined`
  - `login()`: Initiates OAuth 2.0 PKCE flow.
  - `logout()`: Clears credentials and resets state.
  - `init()`: Restores authentication state from local storage.

---

## 3. Extension Messaging Protocol (`src/lib/messaging.ts`)

Messaging between background service workers, content scripts, popup, and sidebar uses `@webext-core/messaging` with the following typed contracts:

| Channel / Message | Payload Interface | Description |
| :--- | :--- | :--- |
| `updateEditor` | `UpdateEditorPayload` | Updates view mode (`searching`, `instructions`, `response`). |
| `adjustMap` | `AdjustMapPayload` | Repositions map marker and transmits resolved place attributes. |
| `updateIcon` | `UpdateIconPayload` | Updates toolbar action icon (`active`, `inactive`, `no-address`). |
| `showMap` | `ShowMapPayload` | Center map on arbitrary coordinate pair. |
| `schemaDetected` | `SchemaDetectedPayload` | Emits parsed Schema.org place from content script to background. |
| `searchPoi` | `SearchPoiPayload` | Initiates text or coordinate search from UI, popup, or context menu selection. |

---

## 4. Svelte 5 Runes Architecture

All components utilize Svelte 5 standard runes:
- `$state`: Reactive variables for UI state, map coordinates, search queries, and nearby element lists.
- `$derived`: Reactive computed values for diff summaries and validation checks.
- `$effect`: Encapsulated lifecycle effects with explicit teardown functions (used for map resize listeners, storage sync, and message subscriptions).
- `onclick`: Standard DOM event handlers replacing legacy `on:click` directives.

---

## 5. Development & Testing Commands

```bash
# Type check TypeScript and Svelte components
npm run check

# Run automated Vitest test suite
npm test

# Build extension for Chrome MV3
npm run build

# Build extension for Firefox MV3
npm run build:firefox

# Create distributable ZIP archive
npm run zip
```
