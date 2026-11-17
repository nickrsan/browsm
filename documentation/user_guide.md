# Browsm User Guide

Welcome to **Browsm**, the in-browser OpenStreetMap assistant for discovering, verifying, and updating Point of Interest (POI) data while browsing the web.

---

## 1. Getting Started

### Installation & Activation
1. Install the Browsm extension in your browser (Firefox or Chromium-based browsers such as Chrome, Edge, Brave).
2. Pin the **Browsm** icon to your browser toolbar for quick access.
3. Open the sidebar / side panel in your browser to view the map and place inspector.

---

## 2. In-Page Place & Business Detection

### Automatic Schema.org / Microdata Detection
When you visit local business websites (restaurants, stores, clinics, bakeries, hotels, etc.):
1. **Toolbar Badge**: Browsm scans the page for structured metadata (JSON-LD, HTML5 Microdata, and OpenGraph) and displays a green `POI` badge on the toolbar icon.
2. **Action Tooltip**: Hovering over the icon displays the business name and category.
3. **Popup Summary Card**: Clicking the toolbar icon opens a compact summary displaying the business name, address, phone number, and coordinates, with a 1-click button to **"Verify in OSM"**.

---

## 3. Searching & Checking Addresses

### Direct Search in Sidebar
- Use the search bar at the top of the sidebar to search for any business name, full address, city, or coordinate pair.
- Browsm checks the 24-hour local geocoding cache before querying Nominatim, ensuring instant responses.

### Address Lookup via Right-Click Menu
1. Highlight any address or business location text on any webpage (e.g. `"100 Ocean Ave, Newport, RI"`).
2. Right-click the highlighted text to open the browser context menu.
3. Select **"Search & Edit in Browsm"**.
4. The extension automatically:
   - Queries OpenStreetMap's Nominatim geocoding service.
   - Fetches all existing POI nodes and building structures within a 50-meter bounding box.
   - Centers and pins the location on the vector map in your sidebar.
   - Shows a notification indicating whether the address was found or needs review.

---

## 4. Reviewing & Editing in OpenStreetMap

### Authenticating with OpenStreetMap
1. At the top of the sidebar, click **"Log in with OpenStreetMap"**.
2. A secure browser authorization window will open directly on `openstreetmap.org`.
3. Grant permissions for reading preferences, editing map data, and writing notes.
4. Browsm uses **OAuth 2.0 with PKCE (Proof Key for Code Exchange)** to authenticate directly from your browser without passing credentials through any third-party proxy servers.
5. Once logged in, your OSM username, avatar, changeset statistics, and message notification indicator appear in the header.

### OpenStreetMap Messages & Periodic Notifications
When logged in with OpenStreetMap:
1. **Unread Message Counter**: An envelope icon in the `AuthHeader` displays your current unread message count. If there are new direct messages or changeset comments on OpenStreetMap, the badge highlights in blue with the exact number of unread messages.
2. **Direct Inbox Click-Through**: Clicking the envelope button immediately opens your OpenStreetMap messages inbox (`https://www.openstreetmap.org/messages/inbox` or your active endpoint's inbox) in a new browser tab.
3. **Sidebar-Only Polling**: While the sidebar is open, Browsm periodically checks the OSM API for new messages (defaulting to 10-minute intervals). When the sidebar is closed, all timers are cleanly stopped to conserve battery and CPU resources.
4. **Configurable Polling Interval**: You can customize or disable the message polling interval (options: Disabled, 5m, 10m [default], 15m, 30m, 60m) in the Quick Settings modal (`⚙️`) or in the Full Options Dashboard.

### Submitting Map Notes (Non-Destructive Suggestions)
If you discover a missing business, outdated phone number, or incorrect opening hours but do not want to directly edit map geometry:
1. Click **"Create Map Note"** in the sidebar or **"Quick Add Note"** in the extension popup.
2. Browsm automatically populates the note with coordinates, address details, phone number, website, and suggested OpenStreetMap tags formatted for local mappers.
3. Add any personal observations (e.g. *"Verified open during visit"*).
4. Click **"Post Note to OSM"**.
5. A confirmation message with a direct link to `https://www.openstreetmap.org/note/<id>` will be displayed.

### Sidebar Place Inspector & Vector Map
- **Vector Map View**: Powered by MapLibre GL and OpenFreeMap vector tiles, featuring crisp text rendering, fractional zooming, and dark mode synchronization.
- **Marker Hierarchy**: Color-coded map pins distinguish matched live OSM entities (green), webpage sources (blue), nearby elements (orange), and custom pins (purple).
- **Building & Structure Polygons**: Building perimeters with POI tags are rendered with semi-transparent polygon fills and outline strokes.
- **Nearby Places List**: Lists detected OSM nodes and structures in the immediate vicinity. Untagged nodes and ways lacking descriptive tags are filtered out, and tagged point nodes are prioritized ahead of area polygons, ordered by distance.
- **Configurable Nearby Search Radius**: You can adjust the search distance threshold (from 10 meters up to 500 meters, defaulting to 50 meters) in either the Quick Settings modal (`⚙️`) or the Options dashboard.
- **Clean Domain Transitions**: When you navigate to a new website domain, Browsm automatically clears previous candidate diffs and inspection state, keeping your workspace clean without premature search indicators.
- **Nominatim Response**: Click **"Show Response"** to inspect the structured geocoding details, place rank, category, and OpenStreetMap element ID.
### Tag Comparison Matrix & Diff Review
When a location is selected or searched, Browsm compares the extracted webpage metadata against the live OpenStreetMap entity:
1. **Side-by-Side Review**: A 4-column matrix displays `OSM Tag Key`, `Webpage Source`, `Live OSM Value`, and `Staged Value`.
2. **Visual Status Badges**:
   - 🟢 `Matches OSM`: Webpage and live OpenStreetMap data are in sync.
   - 🔘 `Minor Diff`: Cosmetic/formatting difference (such as a trailing slash in a URL or phone number punctuation) where the semantic value is identical; OSM value is preserved and faded back by default.
   - 🟡 `Missing in OSM`: Webpage contains verified information (e.g. phone number or website) not currently on the map.
   - 🔵 `Outdated / Different`: Webpage data differs from the existing OSM tag.
   - 🟣 `Staged`: Value has been modified or added for the upcoming changeset.
3. **3-Tier Intelligent Sorting**:
   - **Top**: Tags with staged modifications ready for commit.
   - **Middle**: Tags with minor or ignored differences.
   - **Bottom**: Unmodified and identical tags.
4. **Source Provenance Badges & Verification Notes**:
   - Tags display origin badges (`🏷️ Schema.org`, `🏷️ Microdata`, `🏷️ OpenGraph`, `🔍 Search`) indicating where the data was parsed.
   - When opening hours originate from embedded Schema.org JSON-LD markup, an advisory notice (`⚠️ Embedded schema hours: verify against page text`) reminds contributors to check the structured metadata against hours visibly rendered on the webpage.
5. **1-Click Merge & Reset**:
   - Click `→ Copy` next to any webpage value to stage it immediately.
   - Click `↺ Revert` to restore the original live OSM value.
   - Click **"Apply All Suggested"** to copy all missing and updated tags from the page at once.
   - Click **"Reset All"** to discard all staged edits.
6. **Inline Editing & Real-Time Validation**:
   - Type directly into the staged value box to customize tags.
   - Real-time warnings alert you to format issues (e.g. international phone formats with country codes, website URL prefixes, valid wheelchair tag values).
7. **Adding Custom Tags**:
   - Use the **"Add Custom Tag"** panel at the bottom of the matrix.
   - Built-in autocomplete suggests recommended OSM keys (`cuisine`, `wheelchair`, `operator`, `brand`, `delivery`, `takeaway`, etc.).

### Committing Changesets to OpenStreetMap
Once you have reviewed and staged your tag edits:
1. Click **"Commit Changeset..."** in the bottom action bar.
2. The **Commit to OpenStreetMap** modal opens:
   - **Environment Safety Banner**: Confirms whether you are committing to **Live Production OSM** (with a safety reminder) or the **Developer Sandbox**.
   - **Target Summary**: Shows whether you are updating an existing node/structure or creating a new POI node.
   - **Diff Review Chips**: Color-coded chips summarize added (`+`), modified (`⇄`), and deleted (`-`) tags.
   - **Changeset Comment**: Enter a brief summary of your survey (prefilled with your preferred default prefix and place name).
   - **Source**: Specify the data source (defaults to `website`).
3. Click **"Confirm & Upload Changeset"**.
4. Browsm opens the changeset, applies your edits, and closes the changeset automatically.
5. On completion, direct links to the uploaded Changeset and modified Element on OpenStreetMap are displayed.

### Launching External Editors (iD, Rapid, JOSM)
If you need to perform advanced geometric mapping, relation editing, or complex building modifications:
1. In the bottom action bar, click **"Edit in [Editor] ▾"**.
2. Select your preferred editor:
   - **iD Web Editor**: Opens the official OpenStreetMap in-browser editor pre-zoomed and selecting the target element.
   - **Rapid Web Editor**: Opens Rapid editor with map features loaded.
   - **JOSM Remote Control**: Sends a direct command to your running desktop JOSM editor via `http://127.0.0.1:8111` to download the bounding box and select the entity automatically.

---

## 5. Multi-Endpoint & Developer Mode Settings

Browsm includes a flexible configuration system allowing contributors and developers to switch between different OpenStreetMap-compatible backends and test mapping workflows safely.

### Accessing Settings
- **Quick Settings Modal**: Click the gear icon (`⚙️`) in the top right of the Sidebar or Popup header for instant environment switching.
- **Full Settings Dashboard**: Right-click the extension icon and select **"Options"**, or click **"Open Full Settings Dashboard ↗"** from the Quick Settings modal.

### Granular Developer Mode Routing
Developer Mode allows you to test features and edits without affecting the live OpenStreetMap database:
1. 🟢 **Disabled (Live Production)**: Reads and writes interact directly with the live OpenStreetMap database. Changesets directly update live map features.
2. 🟠 **Writes Only (Safe Sandbox Edits - Recommended for Testing)**:
   - **Reads**: Query live OpenStreetMap production for real-world POIs and existing tags.
   - **Writes**: Route all test changesets, node creations, and notes safely to the official OSM Dev API sandbox (`master.apis.dev.openstreetmap.org`).
3. 🔴 **Full Dev Sandbox (Reads & Writes)**: Both reads and writes route exclusively to the OSM Dev API sandbox.

### Target Backend Environments
- **OpenStreetMap (Live)**: The standard production OpenStreetMap database (`api.openstreetmap.org`).
- **OSM Dev Server (Sandbox)**: The official OpenStreetMap test sandbox (`master.apis.dev.openstreetmap.org`).
- **OpenHistoricalMap (OHM)**: Historical mapping platform powered by OpenStreetMap API 0.6 and OAuth 2.0 (`openhistoricalmap.org`).
- **Custom Instance**: Connect to local development Rails ports (e.g. `http://127.0.0.1:3000/api/0.6`) or private regional OSM servers.

### Account & Token Manager
- You can log in and manage OAuth credentials for each environment independently in the **Options** page.
- Browsm isolates authentication tokens per endpoint in local storage (`browsm_auth_<endpointId>`), so you remain logged in across production, sandbox, and historical mapping environments simultaneously.

---

## 6. Tips & Best Practices
- **Accurate Selections**: Selecting the complete street address (including city and postal code if present) yields the most accurate geocoding results.
- **Local Caching**: Repeated lookups for the same place are loaded instantly from local storage cache without consuming API quotas.
- **Safe Testing**: When experimenting with new features or editing workflows, enable **"Developer Mode (Writes Only)"** to test changesets safely against the sandbox while working with live POI data.
- **Privacy & Safety**: Browsm only performs network requests to OpenStreetMap services when you explicitly trigger an address lookup or when structured data is detected on an active page.
