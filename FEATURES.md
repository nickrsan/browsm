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

## Multi-Endpoint & Developer Mode Configuration Features

33. **Multi-Target Endpoint Presets**: One-click switching between OpenStreetMap Production (`api.openstreetmap.org`), OpenStreetMap Dev Sandbox (`master.apis.dev.openstreetmap.org`), OpenHistoricalMap (`openhistoricalmap.org`), and custom user-defined Rails port/regional server configurations.
34. **Granular Developer Mode Routing (Read / Write Splitting)**:
    - *Disabled (Live Production)*: Reads and writes interact directly with live OpenStreetMap.
    - *Writes Only (Safe Sandbox Edits)*: Reads query live OSM production for real-world POIs and existing tags; all changesets, node edits, and map notes route safely to the OSM Dev API sandbox.
    - *Full Dev Mode (Isolated Sandbox)*: Both reads and writes route exclusively to the OSM Dev API sandbox.
35. **Per-Endpoint Token Isolation**: Isolated storage of OAuth 2.0 PKCE credentials in `browser.storage.local` (`browsm_auth_<endpointId>`), enabling users to stay logged into production, sandbox, and OHM simultaneously without credential conflicts.
36. **Centralized Dynamic Endpoint Resolver**: Unified routing utility (`src/services/endpoint-resolver.ts`) resolving target API base URLs and tokens based on operation type (`read` vs. `write`) and developer mode settings.
37. **Dedicated Options Dashboard & Quick-Settings Modal**: Full WebExtension settings page (`src/entrypoints/options/`) and embedded sidebar/popup quick-settings drawer for fast environment switching.
38. **Visual Environment Status Badges**: High-contrast, color-coded badges in the sidebar and popup headers (`[DEV: WRITES ONLY]`, `[DEV: FULL]`, `[OHM]`, `[CUSTOM]`) providing visual awareness of active routing.
39. **Mozilla Add-on Policy Host Permission Expansion**: Explicit declaration of `https://*.openhistoricalmap.org/*` in `wxt.config.ts` conforming to Mozilla least-privilege extension policies.

## Phase 5 Features (Redesigned Sidebar UI, Tag Comparison Matrix & External Editors)

40. **Tag Comparison Matrix (`TagDiffTable.svelte`)**: Interactive 4-column diff table comparing OSM Tag Keys, Webpage Source Values, Live OSM Values, and Staged Editable Values with real-time validation warnings (phone format, URL protocols, wheelchair booleans).
41. **Selective Tag Merge & Bulk Action Controls**: 1-click `→ Copy` from webpage, `↺ Revert` to OSM, inline custom edits, and `Apply All Suggested` bulk synchronization.
42. **Interactive Custom Tag Addition with Autocomplete**: Add custom tag key/value pairs with built-in `<datalist>` auto-completion of common OSM POI keys (`operator`, `cuisine`, `wheelchair`, `delivery`, `brand`, etc.).
43. **Changeset Commit Workflow (`ChangesetModal.svelte`)**: Dialog with target environment safety badges, before/after tag diff preview chips, changeset comment and source inputs, real-time upload progress, and direct links to created changesets and elements.
44. **External Editor Launcher Integration (`external-editors.ts`)**: 1-click launch of iD Web Editor, Rapid Editor, and desktop JOSM (via Remote Control port 8111) pre-centered and pre-selecting the active node or structure polygon.
45. **Playwright Browser Extension E2E Suite**: End-to-end testing with unpacked Chromium extension fixtures verifying popup, sidebar, options dashboard, and settings interactions.
46. **Full Live OSM Value Matrix Synchronization**: Messaging and storage synchronization transmitting bounding-box elements and matched entity IDs to the Tag Comparison Matrix, ensuring live OSM values are populated and matched.
47. **WebExtension CSP Worker & Vector Tile Support**: Manifest V3 Content Security Policy configured with `worker-src 'self' blob:` and OpenFreeMap domains, paired with resilient `onMount` MapLibre lifecycle initialization.

## Map Inspection, Tag Comparison Optimization & Source Provenance Features

48. **Dynamic Map Zooming & Nearby Elements Visualization on Inspection**: Automatic centering, zoom adjustment (level 17), and vector polygon/pin rendering of nearby API elements whenever a POI is inspected, selected, or searched.
49. **Clean Progressive Disclosure Workflow**: Unready UI elements (vector map canvas, POI selection card, Tag Comparison Matrix, action buttons) remain cleanly hidden in the initial instructions state until the user clicks "Inspect" or triggers an address search.
50. **Minor Tag Difference Detection & 3-Tier Matrix Sorting**: Automatically ignores cosmetic formatting discrepancies (URL trailing slashes, phone number hyphens/parentheses/spaces, redundant whitespace) by fading them back, marking them as `Minor Diff`, and preserving OSM values without pre-selecting them for updates; sorts table with staged changes at the top, minor/ignored differences in the middle, and identical tags last.
51. **Source Provenance Annotations & Metadata Warnings**: Visual chips and tooltips indicating whether tag data originates from embedded Schema.org JSON-LD, HTML5 Microdata, OpenGraph meta tags, or manual search, with explicit advisories on embedded schema opening hours.
52. **Automated Changeset Lifecycle Guarantee**: Strict `try...finally` closure guarantee in `ChangesetModal.svelte` and idempotent HTTP 409 handling in `osm-api.ts`, ensuring that all opened changesets are reliably closed after node/way modifications or creation errors.
53. **PMTiles Protocol Vector Tile Archive Support**: Seamless registration of `pmtiles.Protocol` on `maplibre-gl`, enabling MapLibre to read OpenFreeMap and custom PMTiles vector archives directly.
54. **Resilient Popup Multi-Key State Loading & Theme Support**: Dedicated tab-specific (`tab_schema_${tabId}`) and global schema state hydration on mount in `App.svelte`, clean viewport styles, and full light/dark mode CSS adaptation.

## Phase 6 Features (Periodic OSM Message Polling & Automated CI/CD Workflows)

55. **OSM Message Notification Badge & Sidebar Polling**: Periodic polling of the OpenStreetMap API for user direct messages and changeset discussions while the sidebar is open (defaulting to 10-minute intervals, user-configurable to 5, 10, 15, 30, 60 minutes or disabled), featuring an interactive envelope icon with unread message counter badge in `AuthHeader` that opens the user's OSM inbox on click.
56. **GitHub Actions Pull Request Test & Build Workflow**: Automated CI/CD pipeline triggered on pull requests and pushes to `main`/`master` running TypeScript/Svelte checks (`pnpm check`), Vitest unit/component/integration tests (`pnpm test`), and full Chrome & Firefox Manifest V3 production builds.
57. **Resilient Storage Serialization & API Rate-Limit Safeguards**: Deep serialization of authentication and settings states into plain POJOs prior to `browser.storage.local` persistence (eliminating Firefox `DataCloneError` on Svelte 5 reactive Proxies), coupled with `untrack`-isolated polling effects in `Sidebar.svelte`, in-flight request deduplication, a 30-second polling cooldown, exponential backoff on repeated errors, and an automatic 5-minute backoff on HTTP 429 rate limit responses.

## Phase 7 Features (Map Tile CSP Hardening, Domain Transition State Management & Nearby POI Search Controls)

58. **OpenFreeMap Vector Tile & Font Glyph CSP Hardening**: Compliant Content Security Policy configuration (`connect-src`, `font-src`, `style-src 'unsafe-inline'`) permitting MapLibre GL to fetch vector tiles, style JSONs, sprites, and font glyphs from OpenFreeMap CDN endpoints without WebGL tile decoding or font-rendering blocking.
59. **Headless Map Tile Playwright Verification**: Automated E2E testing suite (`tests/e2e/map-tiles.spec.ts`) validating MapLibre canvas rendering, style routing, and CSP integrity in headless browser environments.
60. **Cross-Domain Navigation State Lifecycle & Clean Transition**: Automatic detection of URL and domain transitions in content scripts (`pageDomainChanged` message) and background worker, resetting sidebar inspection state, diff tables, and cached POIs to prevent stale data cross-contamination when navigating across different websites.
61. **Cold Start & Idle State Search Indicator Fix**: Ensures the "Searching..." status banner only renders when an active spatial or address search is in-flight, preventing stuck or premature searching notices on clean sidebar starts.
62. **Untagged OSM Element Filtering & Tagged Node Prioritization**: Filters out untagged nodes and ways lacking descriptive OpenStreetMap tags from the Nearby Places list, and strictly prioritizes tagged point nodes ahead of area ways and relations, secondary-sorted by geographic distance.
63. **Configurable Nearby Places Search Radius**: User-configurable search radius setting (`nearbySearchRadius`, 10m - 500m, defaulting to 50 meters) adjustable via slider controls in both the Quick Settings modal and Options dashboard, backed by persistent local storage.
64. **Bundled MapLibre Web Worker for Firefox Compatibility**: Configured `setWorkerUrl` with bundled `maplibre-gl-worker.mjs` asset URL and extension CSP (`worker-src 'self' blob:; script-src 'self' 'wasm-unsafe-eval'`), ensuring that MapLibre GL vector tiles and WebGL workers initialize cleanly without worker URL loading errors in Firefox.
65. **Firefox Sidebar Action & Chromium Side Panel Manifest Configuration**: Implemented target-specific WebExtension manifest generation (`src/config/manifest.ts`) providing `sidebar_action` for Firefox (`default_panel: 'sidebar.html'`, `default_title: 'Browsm'`) and `side_panel` for Chromium (`sidePanel` permission and `default_path: 'sidebar.html'`), eliminating Firefox `side_panel` manifest validation warnings and ensuring the sidebar is registered and available across Firefox and Chromium environments.
66. **RESTful OSM API 0.6 Element Creation (`POST /nodes`) & Changeset Upload Resilience**: Implemented standard RESTful `POST /api/0.6/nodes`, `POST /api/0.6/ways`, and `POST /api/0.6/relations` with automatic fallback to legacy `PUT /api/0.6/node/create`, added atomic diff uploads (`POST /api/0.6/changeset/{id}/upload`), and integrated interactive 404 error recovery in `ChangesetModal.svelte` allowing users to seamlessly switch to creating a new POI node when a target ID does not exist on the target OSM server instance.
67. **Target API POI Confirmation & Multi-Server Geocoding Workflow**: Uses Nominatim solely for initial geographic coordinate resolution, followed by an automated bounding box query (`/api/0.6/map?bbox=...`) against the user's active configured OSM API endpoint (such as the OSM Dev Sandbox or custom Rails port). Confirms true entity presence, Node IDs, versions, and tags from the active server, preventing invalid production Node ID mismatches and 404 update errors when experimenting or testing against sandbox servers.
