import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import NoteModal from '@/components/NoteModal.svelte';
import * as osmNotesService from '@/services/osm-notes';
import type { SchemaOrgPlace } from '@/types/schema';

describe('NoteModal.svelte Component', () => {
  const mockPlace: SchemaOrgPlace = {
    name: 'Newport Seafood Shack',
    type: 'Restaurant',
    address: {
      streetAddress: '45 Commercial Wharf',
      addressLocality: 'Newport',
      postalCode: '02840',
    },
    telephone: '+1 401-555-4321',
    geo: {
      latitude: 41.4885,
      longitude: -71.3142,
    },
    sourceUrl: 'https://newportseafood.example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render modal when isOpen is false', () => {
    render(NoteModal, {
      props: {
        isOpen: false,
      },
    });

    expect(screen.queryByTestId('note-modal')).not.toBeInTheDocument();
  });

  it('renders modal with pre-filled coordinates and note text when isOpen is true', async () => {
    render(NoteModal, {
      props: {
        isOpen: true,
        place: mockPlace,
        initialLat: 41.4885,
        initialLon: -71.3142,
      },
    });

    expect(screen.getByTestId('note-modal')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Submit OpenStreetMap Note');

    const textarea = screen.getByTestId('note-text-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('Newport Seafood Shack');
    expect(textarea.value).toContain('45 Commercial Wharf');
  });

  it('submits note and displays success confirmation link', async () => {
    const createNoteSpy = vi.spyOn(osmNotesService, 'createOsmNote').mockResolvedValue({
      id: 998877,
      lat: 41.4885,
      lon: -71.3142,
      url: 'https://www.openstreetmap.org/note/998877',
      status: 'open',
      createdAt: '2026-11-16 12:00:00 UTC',
      comments: [
        {
          date: '2026-11-16 12:00:00 UTC',
          action: 'opened',
          text: 'POI information',
        },
      ],
    });

    const onsuccessMock = vi.fn();

    render(NoteModal, {
      props: {
        isOpen: true,
        place: mockPlace,
        initialLat: 41.4885,
        initialLon: -71.3142,
        onsuccess: onsuccessMock,
      },
    });

    const submitBtn = screen.getByTestId('note-submit-btn');
    await fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createNoteSpy).toHaveBeenCalled();
      expect(screen.getByTestId('note-success-message')).toBeInTheDocument();
      expect(screen.getByTestId('note-external-link')).toHaveAttribute('href', 'https://www.openstreetmap.org/note/998877');
      expect(onsuccessMock).toHaveBeenCalled();
    });
  });
});
