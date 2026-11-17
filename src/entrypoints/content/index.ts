import { messaging } from '@/lib/messaging';
import { extractSchemaFromDocument } from '@/services/schema-parser';
import type { SchemaOrgPlace } from '@/types/schema';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    let lastDetectedPlace: SchemaOrgPlace | null = null;
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let currentHostname = window.location.hostname;
    let currentHref = window.location.href;

    /**
     * Checks if the page domain or URL changed (e.g. via client-side routing)
     * and broadcasts a domain change event to reset sidebar state when leaving a domain.
     */
    function checkUrlAndDomainChange() {
      const newHostname = window.location.hostname;
      const newHref = window.location.href;

      if (newHostname !== currentHostname) {
        const previousDomain = currentHostname;
        currentHostname = newHostname;
        currentHref = newHref;
        lastDetectedPlace = null;

        messaging.sendMessage('pageDomainChanged', {
          previousDomain,
          newDomain: newHostname,
          url: newHref,
        });

        scanForSchema();
      } else if (newHref !== currentHref) {
        currentHref = newHref;
        scanForSchema();
      }
    }

    /**
     * Scans the document for Schema.org JSON-LD or Microdata POI markup.
     */
    function scanForSchema() {
      try {
        const place = extractSchemaFromDocument(document, window.location.href);
        if (place) {
          // Check if place data has changed to prevent redundant messages
          const placeKey = `${place.name || ''}_${place.type}_${place.address?.streetAddress || ''}_${place.geo?.latitude || ''}`;
          const lastKey = lastDetectedPlace
            ? `${lastDetectedPlace.name || ''}_${lastDetectedPlace.type}_${lastDetectedPlace.address?.streetAddress || ''}_${lastDetectedPlace.geo?.latitude || ''}`
            : '';

          if (placeKey !== lastKey) {
            lastDetectedPlace = place;
            messaging.sendMessage('schemaDetected', {
              place,
            });
          }
        }
      } catch (err) {
        console.debug('[Browsm] Schema extraction error:', err);
      }
    }

    // Hook HTML5 history API for single page application (SPA) client-side navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(checkUrlAndDomainChange, 0);
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(checkUrlAndDomainChange, 0);
      return result;
    };

    window.addEventListener('popstate', checkUrlAndDomainChange);
    window.addEventListener('hashchange', checkUrlAndDomainChange);

    // Initial extraction once DOM is idle
    scanForSchema();

    // Set up MutationObserver to catch dynamically injected JSON-LD scripts or microdata in SPAs
    const observer = new MutationObserver((mutations) => {
      checkUrlAndDomainChange();
      let shouldRecheck = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (
              el.tagName === 'SCRIPT' &&
              el.getAttribute('type') === 'application/ld+json'
            ) {
              shouldRecheck = true;
              break;
            }
            if (el.hasAttribute?.('itemscope') || el.querySelector?.('[itemscope]')) {
              shouldRecheck = true;
              break;
            }
          }
        }
        if (shouldRecheck) break;
      }

      if (shouldRecheck) {
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(() => {
          scanForSchema();
        }, 500);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  },
});
