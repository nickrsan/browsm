import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ChangesetModal from '@/components/ChangesetModal.svelte';
import * as osmApi from '@/services/osm-api';
import * as endpointResolver from '@/services/endpoint-resolver';
import type { OsmElement } from '@/types/osm';
import { ENDPOINT_PRESETS } from '@/types/settings';

vi.mock('@/services/osm-api', () => ({
  createChangeset: vi.fn(),
  closeChangeset: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  updateWayTags: vi.fn(),
}));

vi.mock('@/services/endpoint-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/endpoint-resolver')>();
  return {
    ...actual,
    resolveApiEndpoint: vi.fn(),
  };
});

describe('ChangesetModal Svelte Component', () => {
  const mockNode: OsmElement = {
    id: 12345,
    type: 'node',
    lat: 41.49,
    lon: -71.31,
    version: 3,
    tags: {
      name: 'Old Bean Cafe',
      amenity: 'cafe',
    },
  };

  const stagedTags = {
    name: 'Roasted Bean Cafe', // modified
    amenity: 'cafe',          // identical
    phone: '+1 401 555 0199', // added
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(endpointResolver.resolveApiEndpoint).mockResolvedValue({
      config: ENDPOINT_PRESETS['osm-dev'],
      isDevMode: true,
      routingMode: 'writes_only',
      token: {
        accessToken: 'mock-sandbox-token',
        tokenType: 'Bearer',
        scope: 'write_api write_notes',
        createdAt: 1700000000,
      },
    });
  });

  it('renders modal dialog with target environment banner, element info, and diff chips', async () => {
    render(ChangesetModal, {
      props: {
        isOpen: true,
        stagedTags,
        targetElement: mockNode,
        onClose: vi.fn(),
      },
    });

    expect(screen.getByText('Commit to OpenStreetMap')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Target: OSM Dev Server/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Target Element:/i)).toBeInTheDocument();
    expect(screen.getByText(/node #12345/i)).toBeInTheDocument();

    // Added and modified diff chips
    expect(screen.getByText('phone')).toBeInTheDocument();
    expect(screen.getByText('+1 401 555 0199')).toBeInTheDocument();
    expect(screen.getByText('Old Bean Cafe')).toBeInTheDocument();
    expect(screen.getByText('Roasted Bean Cafe')).toBeInTheDocument();
  });

  it('successfully creates changeset, updates node, and closes changeset on commit', async () => {
    vi.mocked(osmApi.createChangeset).mockResolvedValue(99901);
    vi.mocked(osmApi.updateNode).mockResolvedValue(4);
    vi.mocked(osmApi.closeChangeset).mockResolvedValue();

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(ChangesetModal, {
      props: {
        isOpen: true,
        stagedTags,
        targetElement: mockNode,
        onClose,
        onSuccess,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Target: OSM Dev Server/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /Confirm & Upload Changeset/i });
    await fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(osmApi.createChangeset).toHaveBeenCalledWith(
        'mock-sandbox-token',
        expect.objectContaining({
          comment: expect.stringContaining('Surveyed via Browsm'),
          source: 'website',
        }),
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
      expect(osmApi.updateNode).toHaveBeenCalledWith(
        'mock-sandbox-token',
        expect.objectContaining({
          id: 12345,
          version: 3,
          changesetId: 99901,
          tags: expect.objectContaining({
            name: 'Roasted Bean Cafe',
            phone: '+1 401 555 0199',
          }),
        }),
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
      expect(osmApi.closeChangeset).toHaveBeenCalledWith(
        'mock-sandbox-token',
        99901,
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
    });

    // Check success view
    await waitFor(() => {
      expect(screen.getByText('Changeset Uploaded Successfully!')).toBeInTheDocument();
      expect(screen.getByText(/View Changeset #99901/i)).toBeInTheDocument();
    });

    expect(onSuccess).toHaveBeenCalledWith(99901, 12345);
  });

  it('displays error message if API call fails during upload', async () => {
    vi.mocked(osmApi.createChangeset).mockRejectedValue(new Error('Version conflict: node was updated by another user.'));

    render(ChangesetModal, {
      props: {
        isOpen: true,
        stagedTags,
        targetElement: mockNode,
        onClose: vi.fn(),
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Target: OSM Dev Server/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /Confirm & Upload Changeset/i });
    await fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Version conflict/i)).toBeInTheDocument();
    });
  });
});
