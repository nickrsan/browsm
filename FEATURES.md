# Browsm Feature Registry

This registry tracks existing and planned features of the Browsm extension to ensure backward compatibility and prevent regression during refactoring and new feature development.

## Existing Features (Maintained)

1. **Context Menu Address Lookup**: User can select address text on any webpage, right-click, and select "Check Address in OSM" to query Nominatim.
2. **Nominatim Address Validation**: Sends structured search request to Nominatim API (`https://nominatim.openstreetmap.org/search`) with a custom User-Agent.
3. **Browser Notifications**: Displays system notifications when searching, when a valid address is found (with coordinates), or when not found.
4. **Sidebar Map Display**: Embeds a Leaflet map in the extension sidebar/sidepanel, centering and pinning the geocoded location.
5. **Storage Synchronization**: Synchronizes address lookup state via `browser.storage.local` (`lookupState`), allowing the sidebar to retain state across opens.
6. **Nominatim Full Response Inspector**: Toggleable JSON payload viewer in the sidebar displaying raw response details.
7. **Direct iD Editor Launch**: Opens `https://www.openstreetmap.org/edit` pre-focused on the resolved OSM element ID (`node`, `way`, or `relation`).
8. **Action Icon State Management**: Dynamically updates the browser extension action icon based on status (`active`, `inactive`, `no-address`).

## Phase 1 Features (Stabilization & Modernization)

9. **Svelte 5 Runes Architecture**: Components refactored to standard Svelte 5 runes (`$state`, `$derived`, `$effect`, `onclick`) with robust lifecycle management and zero memory leaks.
10. **Strict TypeScript Typing**: Centralized type definitions for OSM entities (`OsmElement`, `OsmChangeset`), Nominatim responses (`NominatimResult`), Schema.org data (`SchemaOrgPlace`), Tag diffs (`TagDiffItem`), and messaging contracts.
11. **Vitest Unit & Component Testing Suite**: Automated testing suite with `vitest`, `jsdom`, and `@testing-library/svelte` covering messaging contracts, storage synchronization, and component logic.
12. **Mozilla Add-on Policies (2026) Compliance**: Least-privilege manifest permissions, strict HTTPS transport, self-contained dependencies without remote code execution, and no Content Security Policy relaxation.

## Phase 2 Features (MapLibre GL JS & OpenFreeMap Vector Integration)

13. **MapLibre GL Vector Map Engine**: Replaced raster Leaflet tiles with GPU-accelerated MapLibre GL JS vector rendering, enabling smooth fractional zooming, high-DPI clarity, and pitch/rotation capabilities.
14. **OpenFreeMap Vector Tile Integration**: Built-in support for OpenFreeMap vector styles (`liberty`, `bright`, `positron`, `dark`) hosted on global CDN with zero API key configuration or rate limit throttling.
15. **Automatic Dark Mode Synchronization**: Vector map style dynamically synchronizes with user's system and browser color scheme preferences (`prefers-color-scheme`).
16. **Structure & Building Polygon Overlays**: Interactive GeoJSON polygon rendering for building perimeters and structures (`way` geometry) with hover effects and selection highlighting.
17. **Semantic POI Marker Hierarchy**: Color-coded SVG marker pins distinguishing matched live OSM entities (green), webpage sources (blue), nearby elements (orange), and custom pins (purple).
18. **Responsive Map Lifecycle**: Encapsulated Svelte 5 `$effect` lifecycle with automatic `ResizeObserver` viewport tracking and comprehensive WebGL canvas memory cleanup.

## Phase 3 Features (In-Page Schema Extraction, Context Selection & Direct Search Engine)

19. **In-Page Schema.org & Microdata Extraction**: Automatic content-script detection of structured JSON-LD (`@graph`, arrays, nested entities), HTML5 Microdata (`itemscope` `itemtype`), and OpenGraph metadata for local businesses, restaurants, and places.
20. **Dynamic Toolbar Action Badging & Tooltips**: High-contrast emerald green badge (`POI`) and descriptive action tooltips signaling detected places to the user unobtrusively.
21. **Cached Nominatim Geocoding**: High-performance structured and free-form address lookup with local `browser.storage.local` caching (24-hour TTL) and User-Agent compliance.
22. **OSM API 0.6 Micro Bounding-Box Retrieval**: Real-time XML querying (`/api/0.6/map?bbox=...`) parsing both standalone POI nodes and building structures (`way` polygons with centroids).
23. **Spatial & Tag Candidate Matching**: Multi-criteria matching scoring name similarity (Sørensen-Dice coefficient), geographic proximity, phone, and website against live OSM entities.
24. **OSM Tag Normalization Engine**: Automated sanitization of address components (`addr:*`), phone numbers (international E.123 format), canonical URLs, and opening hours (`opening_hours`), plus Schema.org category mapping.
25. **Direct In-Sidebar Search & Browse**: Dedicated search input in the sidebar allowing direct geocoding and live browsing of nearby POIs and building structures.
26. **Compact Popup Place Inspector**: Lightweight extension popup card presenting detected place metadata and a 1-click shortcut to verify and edit in the sidebar workspace.

## Phase 4 Features (OSM OAuth 2.0 PKCE Client & Changeset / Note Submission Service)

27. **Zero-Server OAuth 2.0 PKCE Client (RFC 7636)**: Client-side Proof Key for Code Exchange using Web Cryptography API (`crypto.subtle`) for SHA-256 challenge generation, eliminating external secret-holding servers and securing public client authentication.
28. **Secure Token Storage & Session Lifecycle**: Stores access tokens and user profile metadata in isolated `browser.storage.local` (`browsm_osm_auth_state`) with reactive session restoration across popup and sidebar surfaces.
29. **OSM API 0.6 Changeset Management**: Type-safe XML serialization for opening changesets (`PUT /api/0.6/changeset/create`), attaching standardized tags (`created_by=Browsm <version>`, `source=website`), and closing changesets (`PUT /api/0.6/changeset/{id}/close`).
30. **OSM Node & Structure Tag Editing**: Direct node creation (`PUT /api/0.6/node/create`), node modification (`PUT /api/0.6/node/{id}`), and way structure tag updates (`PUT /api/0.6/way/{id}`) with optimistic version tracking.
31. **Non-Destructive Map Notes Submission**: Built-in Map Notes creator (`POST /api/0.6/notes`) formatting detected webpage POI details and suggested tags, enabling safe community suggestions without direct map edits.
32. **Unified Reactive Authentication Header & Modal**: Svelte 5 `AuthHeader` displaying user avatar, username, changeset counter, and login/logout controls, paired with `NoteModal` for rapid note dispatch.
