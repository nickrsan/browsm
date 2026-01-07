const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
const OSM_API = "https://api.openstreetmap.org/api/0.6";
let oauthToken = null;

// Initialize the map
const map = L.map("map").setView([0, 0], 1); // Default start location
let marker = null;

// Add OpenStreetMap tile layer
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

var last_osm_response = null;



browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateEditor" && message.payload.state === "searching") {
        document.getElementById("instructions").style.display = "none";
        document.getElementById("response").style.display = "none";
        document.getElementById("searching").style.display = "block";
    }
    if (message.action === "adjustMap") {
        document.getElementById("instructions").style.display = "none";
        document.getElementById("response").style.display = "block";
        document.getElementById("searching").style.display = "none";

        console.log("Adjusting map to:", message, sender);
        const {lat, lon, display_name, osm_id, full_response} = message.payload;

        last_osm_response = full_response; // cache this so we can use it if they click the button

        if (full_response !== null){
            document.getElementById("full_nominatim_response").innerHTML = JSON.stringify(full_response, null, "");
        }else{
            document.getElementById("full_nominatim_response").innerHTML = "No usable response from Nominatim, or an error occurred.";
        }
        if (osm_id !== null){
            document.getElementById("edit_info").style.display = "block";
        }else{
            document.getElementById("edit_info").style.display = "none";
        }
        // Assuming you are using a library like Leaflet.js for map rendering
        map.setView([lat, lon], 16);

        // Add a marker at the target location
        L.marker([lat, lon])
                .addTo(map)
                .bindPopup(display_name)
                .openPopup();

        // Optionally, respond to the message sender
        sendResponse({status: "Map shown"});
    }
});




function edit_last(){
    browser.tabs.create({url: "https://www.openstreetmap.org/edit?" + last_osm_response.osm_type + "=" + last_osm_response.osm_id }); // + "#map=17/" + last_lat + "/" + last_lon});
}

document.getElementById("edit_last_in_id").addEventListener("click", edit_last);

/*

// Geocode the initial boundary (e.g., city/state/zip)
async function geocodeLocation(addressDetails) {
    const { street, city, state, zip } = addressDetails;
    const queryParts = [];

    if (street) queryParts.push(street);
    if (city) queryParts.push(city);
    if (state) queryParts.push(state);
    if (zip) queryParts.push(zip);

    const query = queryParts.join(", ");
    const response = await fetch(`${NOMINATIM_API}?q=${encodeURIComponent(query)}&format=json`);
    const results = await response.json();

    if (results && results.length > 0) {
        const { lat, lon } = results[0];
        map.setView([lat, lon], 13);

        if (!marker) {
            marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        } else {
            marker.setLatLng([lat, lon]);
        }
    } else {
        console.warn("Could not geocode location.");
    }
}

// Load the map and allow users to place a marker
map.on("click", (e) => {
    const { lat, lng } = e.latlng;
    if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    } else {
        marker.setLatLng([lat, lng]);
    }
});

// Get OAuth token from storage
async function getOAuthAccessToken() {
    const { osmAuth } = await chrome.storage.local.get("osm_auth");
    return osmAuth?.accessToken || null;
}

// Handle submission of the point with tags
document.getElementById("submit").addEventListener("click", async () => {
    if (!marker) {
        alert("Please place a point on the map!");
        return;
    }

    const lat = marker.getLatLng().lat;
    const lon = marker.getLatLng().lng;
    const tagsText = document.getElementById("tags").value;
    const tags = tagsText.split("\n").reduce((obj, line) => {
        const [key, value] = line.split("=");
        if (key && value) obj[key.trim()] = value.trim();
        return obj;
    }, {});

    oauthToken = await getOAuthAccessToken();
    if (!oauthToken) {
        alert("You must log in to OpenStreetMap to submit changes.");
        return;
    }

    try {
        // Create a changeset
        const changesetRequest = `<osm><changeset><tag k="created_by" v="OSM Editor Extension" /><tag k="comment" v="Added business node" /></changeset></osm>`;
        const changesetResponse = await fetch(`${OSM_API}/changeset/create`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${oauthToken}` },
            body: changesetRequest
        });
        const changesetId = await changesetResponse.text();

        // Add the node to the changeset
        const nodeRequest = `<osm><node changeset="${changesetId}" lat="${lat}" lon="${lon}">${Object.entries(tags)
            .map(([k, v]) => `<tag k="${k}" v="${v}" />`)
            .join("")}</node></osm>`;
        await fetch(`${OSM_API}/changeset/${changesetId}/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${oauthToken}` },
            body: nodeRequest
        });

        // Close the changeset
        await fetch(`${OSM_API}/changeset/${changesetId}/close`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${oauthToken}` }
        });

        alert("Business successfully added to OpenStreetMap!");
    } catch (error) {
        console.error("Error submitting changeset:", error);
        alert("Failed to submit business. Please try again.");
    }
});

// Example call to geocode location
/!*geocodeLocation({
    street: "123 Main Street",
    city: "Townsville",
    state: "TS",
    zip: "12345",
});*!/*/
