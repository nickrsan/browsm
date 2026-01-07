(async function detectPageData() {
    let address = "";
    let businessName = "";
    let osmType = null;

    const typeKeywords = {
        "amenity": ["restaurant", "cafe", "bank", "bar"],
        "healthcare": ["hospital", "clinic", "doctor"],
        "education": ["school", "college", "university"],
        // Add more keywords as needed
    };

    // Function to classify the type of business
    function classifyBusiness(pageText) {
        for (const [key, keywords] of Object.entries(typeKeywords)) {
            for (const keyword of keywords) {
                if (pageText.toLowerCase().includes(keyword)) {
                    return key;
                }
            }
        }
        return null;
    }

    // Helper to parse address parts
    function parseAddressFromText(pageText) {
        const addressPattern = /(\d{1,6}\s+\w+(\s+\w+)*(,\s*\w+)*,?\s+\w+,\s+\w{2},\s+\d{5})/; // Example US address pattern
        const match = pageText.match(addressPattern);
        if (match) {
            return match[0]; // Return the full detected address string
        }
        return null;
    }

    // Attempt to extract business name
    const businessEl = document.querySelector("h1");
    if (businessEl) businessName = businessEl.innerText.trim();

    // Look for an `<address>` tag or similar patterns
    const addressEl = document.querySelector("address");
    if (addressEl) {
        address = addressEl.innerText.trim();
    } else {
        // Fall back to parsing free-text on the page
        const pageText = document.body.innerText;
        address = parseAddressFromText(pageText);
        osmType = classifyBusiness(pageText);
    }

    console.log("Extracted details:", { address, businessName, osmType });

    // Notify the background script to update the icon based on detection status
    const detectionState = address ? "active" : "no-address";
    chrome.runtime.sendMessage({
        action: "updateIcon",
        payload: { state: detectionState }
    });

    // Send the extracted data if an address is found
    if (address || businessName) {
        chrome.runtime.sendMessage({
            action: "pageDataFound",
            payload: { address, businessName, osmType }
        });
    }

    /**
     * Add support for validating address when text is selected and right-clicked.
     */
    document.addEventListener("mouseup", async (event) => {
        // Check if some text is selected
        const selectedText = window.getSelection()?.toString().trim();
        if (selectedText) {
            console.log("Selected text for address validation:", selectedText);

            // Notify the background script to initiate address validation
            chrome.runtime.sendMessage({
                action: "validateSelectedAddress",
                payload: { address: selectedText }
            });
        }
    });
})();