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
- `canonicalizePhoneDigits(rawPhone?: string): string | undefined`
  - Extracts normalized dialable digits (normalizing North American 10-digit to 11-digit with country code 1) for semantic phone comparison.
- `normalizeWebsite(rawUrl?: string): string | undefined`
  - Validates and normalizes website URLs with `https://` protocol.
- `canonicalizeWebsiteUrl(rawUrl?: string): string | undefined`
  - Canonicalizes URLs by stripping trailing slashes, lowercasing protocol and host, and standardizing empty root paths.
- `isMinorTagDifference(key: string, sourceVal?: string, osmVal?: string): boolean`
  - Determines if a discrepancy between source and live OSM values is cosmetic (such as trailing slashes in URLs, phone number parentheses/hyphens/spaces, or redundant whitespace).
- `validateOsmTag(key: string, value: string): { isValid: boolean; warning?: string }`
  - Validates OSM tag keys and values in real time, checking for whitespace, international phone prefix requirements, URL protocols, and standard boolean enum values.
- `COMMON_OSM_TAG_KEYS: string[]`
  - Recommended list of common OSM POI keys used for autocomplete suggestions.

### External Editors Launcher (`src/services/external-editors.ts`)
- `getEditorUrl(editor: PreferredEditor, options: EditorLaunchOptions): string`
  - Constructs URL for opening location or entity in iD, Rapid, or JOSM Remote Control.
- `launchEditor(editor: PreferredEditor, options: EditorLaunchOptions, customFetch?: typeof fetch): Promise<EditorLaunchResult>`
  - Dispatches editor launch via `window.open` for web-based editors (iD, Rapid) or triggers JOSM Remote Control HTTP GET on `http://127.0.0.1:8111/load_and_zoom`.

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
- `findBestMatch(target: { name?: string; phone?: string; website?: string; lat?: number; lon?: number; osmId?: number | string; osmType?: string }, candidates: OsmElement[]): SpatialMatchResult`
  - Scores candidates using direct OSM ID matching, Sørensen-Dice name similarity across multiple name tags (`name`, `name:en`, `alt_name`, `official_name`, `brand`, `operator`), coordinate distance, phone, website, and category tags.
- `generateTagDiff(sourceTags: Record<string, string>, targetElement?: OsmElement, sourceOrigin?: string, sourceNote?: string): TagDiffItem[]`
  - Generates itemized diffs between page metadata tags and live OSM element tags, categorizes cosmetic formatting discrepancies as `minor_difference` (ignored by default with OSM value preserved), attaches provenance metadata, and applies 3-tier sorting (staged changes top, minor/ignored differences middle, identical tags bottom).

### OAuth 2.0 PKCE Client (`src/services/osm-auth.ts`)
- `getAuthStorageKey(endpointId?: string): string`
  - Generates namespaced storage key (e.g. `browsm_auth_osm-prod`, `browsm_auth_osm-dev`, `browsm_auth_openhistoricalmap`).
- `getStoredAuthState(endpointId?: string): Promise<OsmAuthState>`
  - Retrieves stored auth state for a specific endpoint with transparent legacy key migration.
- `saveStoredAuthState(state: OsmAuthState, endpointId?: string): Promise<void>`
  - Persists token and profile details under endpoint-isolated storage key.
- `clearStoredAuthState(endpointId?: string): Promise<void>`
  - Clears credentials for the specified endpoint.
- `getAllStoredAuthStates(): Promise<Record<string, OsmAuthState>>`
  - Retrieves all active auth states across configured endpoints.
- `generateCodeVerifier(length?: number): string`
  - Generates cryptographically secure random string for RFC 7636 PKCE.
- `generateCodeChallenge(verifier: string): Promise<string>`
  - Computes SHA-256 Base64URL challenge using standard Web Cryptography API (`crypto.subtle`).
- `buildAuthorizationUrl(config: OsmAuthConfig, codeChallenge: string, state: string): string`
  - Generates OpenStreetMap OAuth 2.0 authorization URL.
- `exchangeCodeForToken(config: OsmAuthConfig, code: string, codeVerifier: string): Promise<OsmAuthToken>`
  - Exchanges authorization code for bearer access token.
- `loginWithOsm(configOverride?: Partial<OsmAuthConfig>, customFetch?: typeof fetch, endpointId?: string): Promise<OsmAuthState>`
  - Launches `browser.identity.launchWebAuthFlow`, completes token exchange, fetches user profile, and persists state in `browser.storage.local` under target endpoint ID.
- `logoutOsm(endpointId?: string): Promise<void>`
  - Clears stored authentication state for the specified endpoint.

### Centralized Endpoint Resolver (`src/services/endpoint-resolver.ts`)
- `resolveApiEndpoint(operationType: 'read' | 'write', customSettings?: SettingsState, customAuthMap?: Record<string, OsmAuthState>): Promise<ResolvedEndpoint>`
  - Resolves target API base URL, OAuth configuration, and credentials based on operation type and developer mode routing flags.
- `resolveEndpointSync(operationType: 'read' | 'write', settings: SettingsState, authStateMap: Record<string, OsmAuthState>): ResolvedEndpoint`
  - Synchronous resolver utility executing the split-routing decision matrix.
- `getEndpointBadgeInfo(settings: SettingsState): EndpointBadgeInfo`
  - Generates badge text, color variant, and tooltip for headers (`DEV: WRITES ONLY`, `DEV: FULL`, `OHM`, `CUSTOM`).

### Reactive Settings Store (`src/stores/settings.svelte.ts`)
- `settingsStore`: Svelte 5 runes-powered singleton class managing:
  - `activeEndpointId`: Current target preset or custom endpoint ID.
  - `devModeRouting`: Granular routing mode (`disabled`, `writes_only`, `reads_and_writes`).
  - `customEndpoint`: User-configured custom instance URLs and credentials.
  - `activeEndpointConfig`: Resolved `EndpointConfig`.
  - `badgeInfo`: Current `EndpointBadgeInfo`.
  - `isDevMode`: boolean flag.
  - `setActiveEndpoint(id)`: Changes target endpoint preset.
  - `setDevModeRouting(routing)`: Updates developer mode routing mode.
  - `setCustomEndpoint(config, selectAsActive)`: Saves custom server configuration.
  - `resetToDefaults()`: Restores factory configuration.

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
