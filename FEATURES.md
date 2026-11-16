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
