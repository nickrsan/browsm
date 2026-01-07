const NOMINATIM_API = "https://nominatim.openstreetmap.org/search";
let detectedAddress = false;

const FIREFOX = typeof browser !== "undefined";
const CHROME = !FIREFOX;


/**
 * Helper: Query Nominatim to validate an address
 */
async function validateAddress(address) {
    const queryUrl = `${NOMINATIM_API}?q=${encodeURIComponent(address)}&format=json`;
    try {
        const response = await fetch(queryUrl, {"User-Agent":"Browsm1.0"});
        const results = await response.json();
        if (results && results.length > 0) {
            return results[0]; // Return the first matched result
        } else {
            return null; // No results found
        }
    } catch (error) {
        console.error("Error querying Nominatim:", error);
        return null;
    }
}
/**
 * Create context menu for checking selected address
 */
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "check-address",
        title: "Check Address in OSM",
        contexts: ["selection"] // Only show when text is selected
    });
});

/**
 * Handle context menu click (when user selects "Check Address")
 */

async function checkAddress (info, tab) {
    if (info.menuItemId === "check-address" && info.selectionText) {
        const selectedText = info.selectionText.trim();

        //if(result){
        //console.log("Showing popup with map:", result);
        console.log("Opening popup before awaiting Promise. Selected text to geocode:", selectedText);
        if(FIREFOX)
            browser.sidebarAction.open();
        else
            chrome.action.setPopup({popup: "editor.html"});
        //}

        chrome.runtime.sendMessage({ action: "updateEditor", payload: { state: "searching" } });
        // Notify user that validation is starting
        chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/loading-icon.png",
            title: "Validating Address...",
            message: `Checking if "${selectedText}" has already been added to OpenStreetMap.`
        });

        const result = await validateAddress(selectedText);

        const { display_name, name, lat, lon, addresstype } = result;

        if (result && result["addresstype"] != "road" && result["name"] != "") {
            // Found a valid address - Notify the user]
            console.log("Found valid address:", result);
            browser.notifications.create({
                type: "basic",
                iconUrl: "icons/icon-success_1024.png",
                title: "Address Found!",
                message: `Valid address detected: ${display_name}\nCoordinates: ${lat}, ${lon}`
            });

            chrome.runtime.sendMessage({
                action: "updateIcon",
                payload: {
                    state: "active"
                }
            });

            chrome.runtime.sendMessage({
                action: "showMap",
                payload: {
                    display_name: display_name,
                    lat: lat,
                    lon: lon
                }
            });
        } else {
            console.log("Address not found:", result);
            // Address invalid - Notify the user
            browser.notifications.create({
                type: "basic",
                iconUrl: "icons/icon-failed_1024.png",
                title: "Address Not Found!",
                message: `Could not find the address: "${selectedText}".`
            });
        }

        if(result)
            chrome.runtime.sendMessage({ action: "adjustMap", payload: {full_response: result, osm_id: result.osm_id, lat: result.lat, lon: result.lon, display_name: result.display_name}});


    }
}
chrome.contextMenus.onClicked.addListener(checkAddress);

/**
 * Dynamically update extension icon based on state (detected address, no address, inactive)
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.data === "updateIcon") {
        const { state } = sender.payload;

        let iconPath;
        switch (state) {
            case "active":
                iconPath = "icons/icon-success_1024.png"; // Visible when an address is detected
                break;
            case "inactive":
                iconPath = "icons/icon-inactive_1024.png"; // Default icon (e.g., no address detected)
                break;
            case "no-address":
                iconPath = "icons/icon-inactive_1024.png"; // Specific icon for "no address detected"
                break;
            default:
                iconPath = "icons/icon-failed_1024.png"; // Fallback in case of errors
                break;
        }

        chrome.action.setIcon({ path: iconPath });
    }

    if (message.data === "showMap") {
        console.log("Showing popup with map:", sender.payload);
        browser.browserAction.openPopup();
        chrome.runtime.sendMessage({ action: "adjustMap", payload: sender.payload });
    }
});