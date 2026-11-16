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
│   │   └── MapLibreMap.svelte # Encapsulated MapLibre vector map component
│   ├── entrypoints/
│   │   ├── background.ts      # Unified background service worker
│   │   ├── content/           # In-page Schema.org & Microdata extractor
│   │   ├── popup/             # Action popup UI
│   │   └── sidebar/           # Sidebar workspace & Vector Map
│   ├── services/
│   │   ├── schema-parser.ts   # JSON-LD, Microdata & OpenGraph extraction
│   │   ├── tag-normalizer.ts  # Address, phone (E.123), website & hours normalizer
│   │   ├── geocoding.ts       # Cached Nominatim geocoding client
│   │   └── spatial-matcher.ts # OSM API 0.6 bbox parser & candidate matcher
│   ├── lib/
│   │   └── messaging.ts       # Type-safe extension messaging hub
│   └── types/                 # Centralized TypeScript definitions
│       ├── osm.ts             # OSM elements & Nominatim responses
│       ├── map.ts             # Vector map models & OpenFreeMap styles
│       ├── schema.ts          # Schema.org place representations
│       ├── diff.ts            # Tag diffing & match session state
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
