import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TagDiffTable from '@/components/TagDiffTable.svelte';
import type { TagDiffItem } from '@/types/diff';

describe('TagDiffTable Svelte Component', () => {
  const sampleDiffItems: TagDiffItem[] = [
    {
      key: 'name',
      sourceValue: 'The Roasted Bean Cafe',
      osmValue: 'Roasted Bean',
      stagedValue: 'The Roasted Bean Cafe',
      status: 'outdated_in_osm',
      action: 'apply',
    },
    {
      key: 'amenity',
      sourceValue: 'cafe',
      osmValue: 'cafe',
      stagedValue: 'cafe',
      status: 'identical',
      action: 'ignore',
    },
    {
      key: 'phone',
      sourceValue: '+1 401 555 0199',
      osmValue: undefined,
      stagedValue: '+1 401 555 0199',
      status: 'missing_in_osm',
      action: 'apply',
    },
    {
      key: 'website',
      sourceValue: 'https://roastedbean.example.com',
      osmValue: undefined,
      stagedValue: 'https://roastedbean.example.com',
      status: 'missing_in_osm',
      action: 'apply',
    },
  ];

  it('renders tag comparison matrix title and all diff items', () => {
    const { container } = render(TagDiffTable, { props: { diffItems: sampleDiffItems } });

    expect(screen.getByText('Tag Comparison Matrix')).toBeInTheDocument();
    const table = container.querySelector('.diff-table')!;
    expect(table).toBeInTheDocument();

    const keys = Array.from(table.querySelectorAll('.tag-key-name')).map((el) => el.textContent);
    expect(keys).toContain('name');
    expect(keys).toContain('amenity');
    expect(keys).toContain('phone');
    expect(keys).toContain('website');

    // Source values inside table
    expect(table.textContent).toContain('The Roasted Bean Cafe');
    expect(table.textContent).toContain('+1 401 555 0199');
  });

  it('displays staged modification counter pill', () => {
    render(TagDiffTable, { props: { diffItems: sampleDiffItems } });

    // 3 items are modified vs original OSM values (name, phone, website)
    expect(screen.getByText(/3 staged changes/i)).toBeInTheDocument();
  });

  it('filters rows when typing in the search filter box', async () => {
    const { container } = render(TagDiffTable, { props: { diffItems: sampleDiffItems } });

    const searchInput = screen.getByPlaceholderText('Filter tags by key or value...');
    await fireEvent.input(searchInput, { target: { value: 'phone' } });

    const table = container.querySelector('.diff-table')!;
    const keys = Array.from(table.querySelectorAll('.tag-key-name')).map((el) => el.textContent);
    expect(keys).toContain('phone');
    expect(keys).not.toContain('amenity');
  });

  it('switches between category filter tabs (Modified, Suggested, All)', async () => {
    const { container } = render(TagDiffTable, { props: { diffItems: sampleDiffItems } });

    const modifiedTab = screen.getByRole('button', { name: /Modified/i });
    await fireEvent.click(modifiedTab);

    // Identical amenity tag should be hidden from table
    const table = container.querySelector('.diff-table')!;
    const keys = Array.from(table.querySelectorAll('.tag-key-name')).map((el) => el.textContent);
    expect(keys).not.toContain('amenity');
    expect(keys).toContain('name');
  });

  it('triggers onUpdateTag when modifying staged input value', async () => {
    const onUpdateTag = vi.fn();
    render(TagDiffTable, {
      props: {
        diffItems: sampleDiffItems,
        onUpdateTag,
      },
    });

    const nameInput = screen.getByDisplayValue('The Roasted Bean Cafe');
    await fireEvent.input(nameInput, { target: { value: 'Custom Bean Name' } });

    expect(onUpdateTag).toHaveBeenCalledWith('name', 'Custom Bean Name', 'custom');
  });

  it('triggers onAddTag when submitting new custom tag form', async () => {
    const onAddTag = vi.fn();
    render(TagDiffTable, {
      props: {
        diffItems: sampleDiffItems,
        onAddTag,
      },
    });

    const keyInput = screen.getByPlaceholderText(/Key \(e\.g\./i);
    const valInput = screen.getByPlaceholderText(/Value \(e\.g\./i);
    const addBtn = screen.getByRole('button', { name: /\+ Add Tag/i });

    await fireEvent.input(keyInput, { target: { value: 'wheelchair' } });
    await fireEvent.input(valInput, { target: { value: 'yes' } });
    await fireEvent.click(addBtn);

    expect(onAddTag).toHaveBeenCalledWith('wheelchair', 'yes');
  });

  it('triggers onApplyAllSuggested and onResetAll callbacks', async () => {
    const onApplyAllSuggested = vi.fn();
    const onResetAll = vi.fn();

    render(TagDiffTable, {
      props: {
        diffItems: sampleDiffItems,
        onApplyAllSuggested,
        onResetAll,
      },
    });

    const applyAllBtn = screen.getByRole('button', { name: /Apply All Suggested/i });
    await fireEvent.click(applyAllBtn);
    expect(onApplyAllSuggested).toHaveBeenCalled();

    const resetAllBtn = screen.getByRole('button', { name: /Reset All/i });
    await fireEvent.click(resetAllBtn);
    expect(onResetAll).toHaveBeenCalled();
  });

  it('displays inline validation warnings for non-standard tag values', () => {
    const warningItems: TagDiffItem[] = [
      {
        key: 'phone',
        sourceValue: '401-555-1234',
        osmValue: undefined,
        stagedValue: '401-555-1234', // Missing + country code
        status: 'missing_in_osm',
        action: 'apply',
      },
      {
        key: 'website',
        sourceValue: 'not-a-valid-url',
        osmValue: undefined,
        stagedValue: 'not-a-valid-url',
        status: 'missing_in_osm',
        action: 'apply',
      },
    ];

    render(TagDiffTable, { props: { diffItems: warningItems } });

    expect(screen.getByText(/Use international format starting with country code/i)).toBeInTheDocument();
    expect(screen.getByText(/Websites in OSM should include protocol prefix/i)).toBeInTheDocument();
  });
});
