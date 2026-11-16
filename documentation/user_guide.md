# Browsm User Guide

Welcome to **Browsm**, the in-browser OpenStreetMap assistant for discovering, verifying, and updating Point of Interest (POI) data while browsing the web.

---

## 1. Getting Started

### Installation & Activation
1. Install the Browsm extension in your browser (Firefox or Chromium-based browsers such as Chrome, Edge, Brave).
2. Pin the **Browsm** icon to your browser toolbar for quick access.
3. Open the sidebar / side panel in your browser to view the map and place inspector.

---

## 2. Searching & Checking Addresses

### Address Lookup via Right-Click Menu
1. Highlight any address or business location text on any webpage (e.g. `"100 Ocean Ave, Newport, RI"`).
2. Right-click the highlighted text to open the browser context menu.
3. Select **"Check Address in OSM"**.
4. The extension automatically:
   - Queries OpenStreetMap's Nominatim geocoding service.
   - Centers and pins the location on the Leaflet map in your sidebar.
   - Shows a notification indicating whether the address was found or needs review.

---

## 3. Reviewing & Editing in OpenStreetMap

### Sidebar Place Inspector
- **Map View**: Displays an interactive map centered on the geocoded location with a pin marker.
- **Nominatim Response**: Click **"Show Response"** to inspect the structured geocoding details, place rank, category, and OpenStreetMap element ID.
- **Edit in iD**: If an OSM element exists (`node`, `way`, or `relation`), click **"Edit in iD"** to open the official OpenStreetMap web editor directly focused on the element for instant updates.

---

## 4. Tips & Best Practices
- **Accurate Selections**: Selecting the complete street address (including city and postal code if present) yields the most accurate geocoding results.
- **Privacy & Safety**: Browsm only performs network requests to OpenStreetMap services when you explicitly trigger an address lookup.
