# Browsm Developer & API Documentation

This document describes the architectural layout, TypeScript data models, messaging protocols, testing strategy, and coding standards for developers contributing to the Browsm extension.

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
│   │   ├── popup/             # Action popup UI
│   │   └── sidebar/           # Sidebar workspace & Vector Map
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

## 2. TypeScript Data Contracts

All core entities are strictly typed in `src/types/`:

### OpenStreetMap & Nominatim Models (`src/types/osm.ts`)
- `OsmElement`: Represents a live OSM Node, Way, or Relation with tags and optional structure geometry.
- `OsmChangeset`: Structure for staging and submitting changeset metadata (`created_by`, `comment`, `source`).
- `NominatimResult`: Strongly-typed schema for Nominatim responses (`osm_id`, `display_name`, `lat`, `lon`, `address`).

### Schema.org Place Models (`src/types/schema.ts`)
- `SchemaOrgPlace`: Normalized representation of business metadata extracted from web pages (`name`, `address`, `geo`, `telephone`, `url`, `openingHours`).

### Tag Diff Models (`src/types/diff.ts`)
- `TagDiffItem`: Represents a key-level discrepancy between page metadata and OSM live tags (`identical`, `missing_in_osm`, `outdated_in_osm`, `new_in_page`).
- `SearchSessionState`: Tracks the active search/browse workflow state.

---

## 3. Extension Messaging Protocol (`src/lib/messaging.ts`)

Messaging between background service workers, content scripts, popup, and sidebar uses `@webext-core/messaging` with the following typed contracts:

| Channel / Message | Payload Interface | Description |
| :--- | :--- | :--- |
| `updateEditor` | `UpdateEditorPayload` | Updates view mode (`searching`, `instructions`, `response`). |
| `adjustMap` | `AdjustMapPayload` | Repositions map marker and transmits resolved place attributes. |
| `updateIcon` | `UpdateIconPayload` | Updates toolbar action icon (`active`, `inactive`, `no-address`). |
| `showMap` | `ShowMapPayload` | Center map on arbitrary coordinate pair. |
| `schemaDetected` | `SchemaDetectedPayload` | Emits parsed Schema.org place from content script. |
| `searchPoi` | `SearchPoiPayload` | Initiates text or coordinate search from UI or selection. |

---

## 4. Svelte 5 Runes Architecture

All components utilize Svelte 5 standard runes:
- `$state`: Reactive variables for UI state, map references, and form inputs.
- `$derived`: Reactive computed values for diff summaries and validation checks.
- `$effect`: Encapsulated lifecycle effects with explicit teardown functions (used for Leaflet map destruction and event unsubscriptions to prevent memory leaks).
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
