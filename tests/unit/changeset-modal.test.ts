import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ChangesetModal from '@/components/ChangesetModal.svelte';
import * as osmApi from '@/services/osm-api';
import * as endpointResolver from '@/services/endpoint-resolver';
import type { OsmElement } from '@/types/osm';
import { ENDPOINT_PRESETS } from '@/types/settings';

vi.mock('@/services/osm-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/osm-api')>();
  return {
    ...actual,
    createChangeset: vi.fn(),
    closeChangeset: vi.fn(),
    createNode: vi.fn(),
    updateNode: vi.fn(),
    updateWayTags: vi.fn(),
  };
});

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

  it('displays error message if API call fails during upload and still closes changeset', async () => {
    vi.mocked(osmApi.createChangeset).mockResolvedValue(99902);
    vi.mocked(osmApi.updateNode).mockRejectedValue(new Error('Version conflict: node was updated by another user.'));
    vi.mocked(osmApi.closeChangeset).mockResolvedValue();

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
      expect(osmApi.closeChangeset).toHaveBeenCalledWith(
        'mock-sandbox-token',
        99902,
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
    });
  });

  it('creates a brand new POI node when targetElement is undefined', async () => {
    vi.mocked(osmApi.createChangeset).mockResolvedValue(99903);
    vi.mocked(osmApi.createNode).mockResolvedValue(777001);
    vi.mocked(osmApi.closeChangeset).mockResolvedValue();

    const onSuccess = vi.fn();

    render(ChangesetModal, {
      props: {
        isOpen: true,
        stagedTags: {
          name: 'Fresh Bakery',
          shop: 'bakery',
        },
        coordinates: { lat: 41.4901, lon: -71.3128 },
        onClose: vi.fn(),
        onSuccess,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Create New POI Node/i)).toBeInTheDocument();
    });

    const commitBtn = screen.getByRole('button', { name: /Confirm & Upload Changeset/i });
    await fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(osmApi.createChangeset).toHaveBeenCalled();
      expect(osmApi.createNode).toHaveBeenCalledWith(
        'mock-sandbox-token',
        expect.objectContaining({
          changesetId: 99903,
          lat: 41.4901,
          lon: -71.3128,
          tags: expect.objectContaining({
            name: 'Fresh Bakery',
            shop: 'bakery',
          }),
        }),
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
      expect(osmApi.closeChangeset).toHaveBeenCalledWith('mock-sandbox-token', 99903, 'https://master.apis.dev.openstreetmap.org/api/0.6');
      expect(onSuccess).toHaveBeenCalledWith(99903, 777001);
    });
  });

  it('shows fallback button on 404 not found and allows switching to create new node', async () => {
    const error404 = new osmApi.OsmApiError('Node #12345 was not found on OSM server (HTTP 404)', 404);
    vi.mocked(osmApi.createChangeset).mockResolvedValue(99904);
    vi.mocked(osmApi.updateNode).mockRejectedValueOnce(error404);
    vi.mocked(osmApi.createNode).mockResolvedValue(777002);
    vi.mocked(osmApi.closeChangeset).mockResolvedValue();

    render(ChangesetModal, {
      props: {
        isOpen: true,
        stagedTags,
        targetElement: mockNode,
        coordinates: { lat: 41.49, lon: -71.31 },
        onClose: vi.fn(),
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Target: OSM Dev Server/i)).toBeInTheDocument();
    });

    // 1st attempt: update node fails with 404
    const commitBtn = screen.getByRole('button', { name: /Confirm & Upload Changeset/i });
    await fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(screen.getByText(/was not found on this OSM server/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch to Creating as a New POI Node/i })).toBeInTheDocument();
    });

    // Click fallback button
    const fallbackBtn = screen.getByRole('button', { name: /Switch to Creating as a New POI Node/i });
    await fireEvent.click(fallbackBtn);

    // Target action updates to Create New POI Node
    expect(screen.getByText(/Create New POI Node/i)).toBeInTheDocument();

    // 2nd attempt: commits as createNode
    await fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(osmApi.createNode).toHaveBeenCalledWith(
        'mock-sandbox-token',
        expect.objectContaining({
          lat: 41.49,
          lon: -71.31,
          tags: expect.objectContaining({
            name: 'Roasted Bean Cafe',
          }),
        }),
        'https://master.apis.dev.openstreetmap.org/api/0.6'
      );
    });
  });
});
