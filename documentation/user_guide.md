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

### Sidebar Place Inspector & Vector Map
- **Vector Map View**: Powered by MapLibre GL and OpenFreeMap vector tiles, featuring crisp text rendering, fractional zooming, and dark mode synchronization.
- **Marker Hierarchy**: Color-coded map pins distinguish matched live OSM entities (green), webpage sources (blue), nearby elements (orange), and custom pins (purple).
- **Building & Structure Polygons**: Building perimeters with POI tags are rendered with semi-transparent polygon fills and outline strokes.
- **Nearby Places List**: Lists detected OSM nodes and structures in the immediate vicinity.
- **Nominatim Response**: Click **"Show Response"** to inspect the structured geocoding details, place rank, category, and OpenStreetMap element ID.
- **Edit in iD**: If an OSM element exists (`node`, `way`, or `relation`), click **"Edit in iD"** to open the official OpenStreetMap web editor directly focused on the element for instant updates.

---

## 5. Tips & Best Practices
- **Accurate Selections**: Selecting the complete street address (including city and postal code if present) yields the most accurate geocoding results.
- **Local Caching**: Repeated lookups for the same place are loaded instantly from local storage cache without consuming API quotas.
- **Privacy & Safety**: Browsm only performs network requests to OpenStreetMap services when you explicitly trigger an address lookup or when structured data is detected on an active page.
