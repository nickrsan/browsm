# Browsm
Browsm is a web browser extension to support checking, adding, and editing
point of interest data in OpenStreetMap as you browse the web normally. With it,
you can be on the page of a local business, highlight the address, and see if it
is already in OpenStreetMap or needs to be added.

The first version just supports looking up the address to see if it returns the business (or
attraction, facility, etc), but the goal of future versions will be to provide an
in-extension editor for location and tags.

# Goals
1. Facilitate checking and adding missing POIs to OpenStreetMap
2. Aid in keeping existing POI data fresh by alerting the user of mismatches
3. Allow the user to ein-extension editor for location and tags.
dit without leaving the business' webpage so that data can be most easily transferred.
4. Generally to aid frequent OpenStreetMap contributors in tasks related to editing and improving the map.

# Demo
![browsm_demo_2026_01_05.gif](docs/browsm_demo_2026_01_05.gif)

# Installation
This add-on is still in early development and is not yet available via addons.mozilla.org (AMO) or the Chrome Web Store.
For now, to install the addon, you must download one of the releases for your platform and then use the browser's built-in
extension debugging tools to install and test the extension. 

For Firefox, this involves:
1. Go to the URL `about:debugging`
2. On the left side, choose "This Firefox"
3. Click the "Load Temporary Add-on" button and select the `manifest.json` file from the downloaded release.

I will be working to get the extension into the web stores soon, so if you are not comfortable with the above steps,
you will need to wait for the full release.

# Developing
Clone the repository, then run `pnpm install` followed by `pnpm run dev` to develop in Chromium or `pnpm run dev:firefox` to develop in Firefox.
In practice, on my machine, running the Firefox development version has not worked, and I have used the instructions from the
installation section above to run and test the extension.

# Compatibility
Browsm uses the WXT framework to produce functionality that should work in Firefox and
Chromium-based browsers. Currently, I am testing it in Firefox and testing and maintenance of Chromium-based browser compatibility will follow at a future date.

# Contributing
Pull requests are now welcome! If you wish to check in with me before developing a feature, you can find me on
https://community.openstreetmap.org and also in the OpenStreetMap US Slack.

The following items are desired and would be welcome for pull requests:
1. Code quality improvements, including proper conversion of the code to typescript
2. Development of unit/integration tests. Bug fixes.
3. Internationalization/language capabilities, accessibility improvements and other items that make it more usable and accessible.
4. Any other features currently listed in [tasks.md](tasks.md) or that clearly aligns with the goals stated above. I'll make a proper roadmap later.

If you submit a Pull Request, you are agreeing to release the code you provide under the MIT license.

# License
MIT License