import { messaging } from '@/lib/messaging';
import { extractSchemaFromDocument } from '@/services/schema-parser';
import type { SchemaOrgPlace } from '@/types/schema';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    let lastDetectedPlace: SchemaOrgPlace | null = null;
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Initial extraction once DOM is idle
    scanForSchema();

    // Set up MutationObserver to catch dynamically injected JSON-LD scripts or microdata in SPAs
    const observer = new MutationObserver((mutations) => {
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
