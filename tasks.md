# Structure
- [x] Make repo
- [] Restructure addon to be more standard
  - [] Switch to use WXT for dev experience + (Solid w/Web Components? Vue? Don't want anything too heavy, but want to manage state of components in a readable way) + Typescript most likely 
- [] Scaffold out actual repo - README, contributing guidelines, license, simple roadmap
- [] Document compatibility
- [] Make GitHub Action to build release branch
- [] Make GitHub Action to build a beta branch for test releases
- [] Document how to develop the extension
- [] Initial accessibility checks
- [] Issue template?

# Features
- [] Cache requests to Nominatim for a day
  - Use Session Storage `https://wxt.dev/storage.html#basic-usage` 
- [] Include extension version in user agent to Nominatim
- [] Pull in node/way/relation details from OSM and display current tags on page
- [] Allow users to set a preference for editor to open in iD/Rapid/JOSM(or an intent link for mobile?)
- [] Store previous searches and allow selecting and rendering a prior item without a Nominatim request?
  - LocalStorage for this. Need a preference for max history 
- [] Show the address requested in the extension and allow a "modify and search again" workflow in the pane.
- [] Include a "look up this domain" action in the context menu
- [] Do some kind of zoom level calculation when centering the item?
- [] Improve the loading message so it shows up even if the pane just popped up (some kind of localstorage of `searching` and then the page checks that on pane open?)
- [] Prettier rendering of Nominatim results
- [] Link to item directly on Nominatim/OSM
- [] Chromium compatibility?
- [] Some kind of "check currency" that shows if the object found has:
  - A phone number that is found on the current page - missing phone, incorrect phone, correct phone
  - A web address that matches the current page - same categories as above
  - A name that's a text string found somewhere in the current page
- [] Logic to find items in the page for background review. Could include regex, but also aria roles or intent links (e.g. tel:)
- [] Some kind of interaction chart for a product plan:
  - e.g. User chooses context menu item, but pane is already open, then ____
  - User chooses context menu item when pane is closed, then _____
  - etc
- [] Option to automatically close sidebar pane when opening editor
- [] Thorough Accessibility checks in UX
- [] Check if the current website:
  - Has an entry in Overture Places
  - Is *also* missing an entry that includes the URL in OSM
  - If so, then turn the icon to the alert.

# Tests
-[] Unit tests
-[] Cypress tests