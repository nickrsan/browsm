import { describe, it, expect, vi, beforeEach } from 'vitest';
import { messaging } from '@/lib/messaging';

describe('Content script domain navigation handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects domain change and broadcasts pageDomainChanged message', () => {
    const sendSpy = vi.spyOn(messaging, 'sendMessage').mockResolvedValue(undefined as any);

    let currentHostname = 'www.example.com';
    let currentHref = 'https://www.example.com/about';

    function handleNavigation(newUrl: string) {
      const parsed = new URL(newUrl);
      if (parsed.hostname !== currentHostname) {
        const previousDomain = currentHostname;
        currentHostname = parsed.hostname;
        currentHref = newUrl;

        messaging.sendMessage('pageDomainChanged', {
          previousDomain,
          newDomain: parsed.hostname,
          url: newUrl,
        });
      }
    }

    // Same domain navigation
    handleNavigation('https://www.example.com/contact');
    expect(sendSpy).not.toHaveBeenCalled();

    // Cross-domain navigation
    handleNavigation('https://www.wikipedia.org/wiki/OpenStreetMap');
    expect(sendSpy).toHaveBeenCalledWith('pageDomainChanged', {
      previousDomain: 'www.example.com',
      newDomain: 'www.wikipedia.org',
      url: 'https://www.wikipedia.org/wiki/OpenStreetMap',
    });
  });
});
