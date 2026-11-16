# Mozilla Add-on Policies Compliance Review (Dec 2026 Preview)

This review verifies Browsm's compliance against the Mozilla Add-on Policies (including the December 2026 policy preview) to ensure smooth submission, automated validation, and human review approval on addons.mozilla.org (AMO).

---

## 1. Permission Hygiene & Least Privilege Principle
- **Policy Requirement**: Add-ons must request only the permissions strictly necessary to deliver stated functionality. Broad permissions must be justified or avoided.
- **Implementation & Audit**:
  - Removed broad `declarativeNetRequest` and `declarativeNetRequestWithHostAccess` permissions.
  - Replaced `<all_urls>` with specific origin permissions (`https://*.openstreetmap.org/*`, `https://nominatim.openstreetmap.org/*`).
  - Context menu selection triggers use standard `activeTab` permission when interacting with user-selected text.
  - Manifest permissions retained: `contextMenus`, `notifications`, `storage`, `activeTab`, `scripting`.

---

## 2. No Remote Code Execution & Self-Contained Bundling
- **Policy Requirement**: All code executed by the add-on must be included within the extension package. Loading remote executable code (e.g., via `eval`, `new Function`, or external `<script>` injection) is strictly forbidden.
- **Implementation & Audit**:
  - All libraries (Svelte runtime, Leaflet, `@webext-core/messaging`) are bundled locally via Vite / WXT.
  - No external CDN scripts are loaded at runtime.
  - Leaflet tile images and Nominatim queries are data/asset requests over secure HTTPS only, never executing code.

---

## 3. Secure Transport (Strict HTTPS)
- **Policy Requirement**: All network communications with external APIs or tile servers must use encrypted HTTPS channels.
- **Implementation & Audit**:
  - Nominatim API endpoint: `https://nominatim.openstreetmap.org/search`.
  - Tile layer endpoint: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.
  - OpenStreetMap editor links: `https://www.openstreetmap.org/edit`.

---

## 4. Privacy, Attribution & User Transparency
- **Policy Requirement**: Add-ons must respect user privacy, not collect unauthorized telemetry, and identify themselves transparently to third-party APIs.
- **Implementation & Audit**:
  - Nominatim queries include an explicit User-Agent: `Browsm/0.1.0 (OpenStreetMap POI Editor Extension)`.
  - No personal data or browsing history is tracked or sent to third-party analytics services.
  - Local state is stored exclusively in extension-isolated storage (`browser.storage.local`).
