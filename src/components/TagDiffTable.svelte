<script lang="ts">
  import type { TagDiffItem, TagDiffAction, TagDiffStatus } from '@/types/diff';
  import { COMMON_OSM_TAG_KEYS, validateOsmTag } from '@/services/tag-normalizer';

  interface Props {
    diffItems: TagDiffItem[];
    onUpdateTag?: (key: string, value: string, action?: TagDiffAction) => void;
    onDeleteTag?: (key: string) => void;
    onAddTag?: (key: string, value: string) => void;
    onApplyAllSuggested?: () => void;
    onResetAll?: () => void;
    readOnly?: boolean;
  }

  const {
    diffItems = [],
    onUpdateTag,
    onDeleteTag,
    onAddTag,
    onApplyAllSuggested,
    onResetAll,
    readOnly = false,
  }: Props = $props();

  // Search filter inside the diff matrix
  let filterText = $state<string>('');
  let filterCategory = $state<'all' | 'modified' | 'missing' | 'identical'>('all');

  // New tag input state
  let newTagKey = $state<string>('');
  let newTagValue = $state<string>('');
  let newTagWarning = $state<string | undefined>(undefined);

  // Filtered diff items
  const filteredItems = $derived(
    diffItems.filter((item) => {
      // Category filter
      if (filterCategory === 'modified') {
        const isModified = item.stagedValue !== (item.osmValue || '');
        if (!isModified) return false;
      } else if (filterCategory === 'missing') {
        if (item.status !== 'missing_in_osm' && item.status !== 'new_in_page') return false;
      } else if (filterCategory === 'identical') {
        if (item.status !== 'identical') return false;
      }

      // Text filter
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase().trim();
      return (
        item.key.toLowerCase().includes(q) ||
        (item.sourceValue && item.sourceValue.toLowerCase().includes(q)) ||
        (item.osmValue && item.osmValue.toLowerCase().includes(q)) ||
        (item.stagedValue && item.stagedValue.toLowerCase().includes(q))
      );
    })
  );

  // Count of staged modifications vs OSM initial values
  const modifiedCount = $derived(
    diffItems.filter((item) => item.stagedValue !== (item.osmValue || '')).length
  );

  // Count of suggested improvements from page
  const suggestedCount = $derived(
    diffItems.filter(
      (item) => item.status === 'missing_in_osm' || item.status === 'outdated_in_osm'
    ).length
  );

  function handleStagedChange(key: string, val: string) {
    if (onUpdateTag) {
      onUpdateTag(key, val, 'custom');
    }
  }

  function handleCopyFromSource(item: TagDiffItem) {
    if (item.sourceValue && onUpdateTag) {
      onUpdateTag(item.key, item.sourceValue, 'apply');
    }
  }

  function handleRevertToOsm(item: TagDiffItem) {
    if (onUpdateTag) {
      onUpdateTag(item.key, item.osmValue || '', 'ignore');
    }
  }

  function handleDelete(key: string) {
    if (onDeleteTag) {
      onDeleteTag(key);
    }
  }

  function handleAddNewTag() {
    const k = newTagKey.trim();
    const v = newTagValue.trim();
    if (!k) return;

    const validation = validateOsmTag(k, v);
    if (!validation.isValid) {
      newTagWarning = validation.warning;
      return;
    }

    if (onAddTag) {
      onAddTag(k, v);
    }
    newTagKey = '';
    newTagValue = '';
    newTagWarning = undefined;
  }

  function getStatusBadge(status: TagDiffStatus, isModified: boolean) {
    if (isModified) {
      return { text: 'Staged', class: 'badge-staged' };
    }
    switch (status) {
      case 'identical':
        return { text: 'Matches OSM', class: 'badge-identical' };
      case 'missing_in_osm':
        return { text: 'Missing in OSM', class: 'badge-missing' };
      case 'outdated_in_osm':
        return { text: 'Outdated', class: 'badge-outdated' };
      case 'new_in_page':
        return { text: 'New in Page', class: 'badge-new' };
      case 'conflict':
        return { text: 'Conflict', class: 'badge-conflict' };
      default:
        return { text: status, class: 'badge-default' };
    }
  }
</script>

<div class="tag-diff-container">
  <!-- Header Bar with Quick Filters and Bulk Actions -->
  <div class="diff-header">
    <div class="diff-title-row">
      <div class="diff-title-group">
        <h3 class="diff-title">Tag Comparison Matrix</h3>
        {#if modifiedCount > 0}
          <span class="staged-counter-pill" title="Staged tag modifications ready for commit">
            {modifiedCount} staged {modifiedCount === 1 ? 'change' : 'changes'}
          </span>
        {/if}
      </div>

      <div class="diff-bulk-actions">
        {#if suggestedCount > 0 && onApplyAllSuggested && !readOnly}
          <button
            type="button"
            class="btn-bulk btn-apply-all"
            onclick={onApplyAllSuggested}
            title="Copy all missing and updated tags from webpage to staged"
          >
            Apply All Suggested ({suggestedCount})
          </button>
        {/if}
        {#if modifiedCount > 0 && onResetAll && !readOnly}
          <button
            type="button"
            class="btn-bulk btn-reset-all"
            onclick={onResetAll}
            title="Reset all staged tags back to original OSM values"
          >
            Reset All
          </button>
        {/if}
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="diff-controls-row">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          bind:value={filterText}
          placeholder="Filter tags by key or value..."
          class="filter-input"
        />
        {#if filterText}
          <button
            type="button"
            class="btn-clear-search"
            onclick={() => (filterText = '')}
            title="Clear filter"
          >
            ✕
          </button>
        {/if}
      </div>

      <div class="category-tabs" role="tablist">
        <button
          type="button"
          class="tab-btn"
          class:active={filterCategory === 'all'}
          onclick={() => (filterCategory = 'all')}
        >
          All ({diffItems.length})
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={filterCategory === 'modified'}
          onclick={() => (filterCategory = 'modified')}
        >
          Modified ({modifiedCount})
        </button>
        <button
          type="button"
          class="tab-btn"
          class:active={filterCategory === 'missing'}
          onclick={() => (filterCategory = 'missing')}
        >
          Suggested ({suggestedCount})
        </button>
      </div>
    </div>
  </div>

  <!-- Tag Diff Table -->
  <div class="diff-table-wrapper">
    {#if filteredItems.length === 0}
      <div class="empty-diff-state">
        {#if filterText || filterCategory !== 'all'}
          <p>No tags match the active filter.</p>
        {:else}
          <p>No tags available for comparison. Select a place or enter tag data below.</p>
        {/if}
      </div>
    {:else}
      <table class="diff-table">
        <thead>
          <tr>
            <th class="th-key">OSM Tag Key</th>
            <th class="th-source">Webpage Source</th>
            <th class="th-osm">Live OSM Value</th>
            <th class="th-staged">Staged Value</th>
            <th class="th-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredItems as item (item.key)}
            {@const isModified = item.stagedValue !== (item.osmValue || '')}
            {@const badge = getStatusBadge(item.status, isModified)}
            {@const validation = validateOsmTag(item.key, item.stagedValue)}
            <tr class="diff-row" class:row-modified={isModified}>
              <!-- Column 1: Key -->
              <td class="td-key">
                <span class="tag-key-name">{item.key}</span>
                <span class="status-badge {badge.class}">{badge.text}</span>
              </td>

              <!-- Column 2: Webpage Source Value -->
              <td class="td-source">
                {#if item.sourceValue}
                  <div class="value-source-box" title={item.sourceValue}>
                    <span class="value-text">{item.sourceValue}</span>
                    {#if !readOnly && item.stagedValue !== item.sourceValue}
                      <button
                        type="button"
                        class="btn-inline-copy"
                        onclick={() => handleCopyFromSource(item)}
                        title="Copy webpage value to staged"
                      >
                        → Copy
                      </button>
                    {/if}
                  </div>
                {:else}
                  <span class="text-muted">—</span>
                {/if}
              </td>

              <!-- Column 3: Live OSM Value -->
              <td class="td-osm">
                {#if item.osmValue}
                  <div class="value-osm-box" title={item.osmValue}>
                    <span class="value-text">{item.osmValue}</span>
                    {#if !readOnly && isModified}
                      <button
                        type="button"
                        class="btn-inline-revert"
                        onclick={() => handleRevertToOsm(item)}
                        title="Revert staged value back to live OSM value"
                      >
                        ↺ Revert
                      </button>
                    {/if}
                  </div>
                {:else}
                  <span class="text-muted text-missing">Not in OSM</span>
                {/if}
              </td>

              <!-- Column 4: Staged Value (Editable) -->
              <td class="td-staged">
                {#if readOnly}
                  <span class="staged-readonly-text">{item.stagedValue || '(deleted)'}</span>
                {:else}
                  <div class="staged-input-wrapper">
                    <input
                      type="text"
                      value={item.stagedValue}
                      oninput={(e) => handleStagedChange(item.key, e.currentTarget.value)}
                      placeholder={item.osmValue ? '(clear to delete tag)' : 'Enter value...'}
                      class="staged-input"
                      class:input-has-warning={Boolean(validation.warning)}
                    />
                    {#if validation.warning}
                      <div class="tag-warning-hint" title={validation.warning}>
                        ⚠️ {validation.warning}
                      </div>
                    {/if}
                  </div>
                {/if}
              </td>

              <!-- Column 5: Row Actions -->
              <td class="td-actions">
                {#if !readOnly}
                  <div class="row-action-btns">
                    {#if item.stagedValue}
                      <button
                        type="button"
                        class="btn-icon-del"
                        onclick={() => handleStagedChange(item.key, '')}
                        title="Clear / Delete this tag"
                      >
                        🗑️
                      </button>
                    {/if}
                    <button
                      type="button"
                      class="btn-icon-remove"
                      onclick={() => handleDelete(item.key)}
                      title="Remove row from staging list"
                    >
                      ✕
                    </button>
                  </div>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Add Custom Tag Row -->
  {#if !readOnly}
    <div class="add-tag-panel">
      <h4 class="add-tag-title">Add Custom Tag</h4>
      <div class="add-tag-form">
        <div class="input-key-col">
          <input
            type="text"
            list="common-osm-keys"
            bind:value={newTagKey}
            placeholder="Key (e.g. wheelchair, operator)"
            class="tag-form-input"
          />
          <datalist id="common-osm-keys">
            {#each COMMON_OSM_TAG_KEYS as commonKey}
              <option value={commonKey}>{commonKey}</option>
            {/each}
          </datalist>
        </div>

        <div class="input-val-col">
          <input
            type="text"
            bind:value={newTagValue}
            placeholder="Value (e.g. yes, Italian)"
            class="tag-form-input"
            onkeydown={(e) => {
              if (e.key === 'Enter') handleAddNewTag();
            }}
          />
        </div>

        <button
          type="button"
          class="btn-add-tag"
          onclick={handleAddNewTag}
          disabled={!newTagKey.trim()}
        >
          + Add Tag
        </button>
      </div>

      {#if newTagWarning}
        <div class="add-tag-warning">
          ⚠️ {newTagWarning}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-diff-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--bg-card, #ffffff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  @media (prefers-color-scheme: dark) {
    .tag-diff-container {
      background: var(--bg-card, #1e1e1e);
      border-color: var(--border-color, #333333);
    }
  }

  .diff-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .diff-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .diff-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .diff-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary, #1a1a1a);
  }

  @media (prefers-color-scheme: dark) {
    .diff-title {
      color: var(--text-primary, #f0f0f0);
    }
  }

  .staged-counter-pill {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    background: #e3f2fd;
    color: #0d47a1;
    border: 1px solid #bbdefb;
  }

  @media (prefers-color-scheme: dark) {
    .staged-counter-pill {
      background: #102a43;
      color: #90caf9;
      border-color: #1e3a5f;
    }
  }

  .diff-bulk-actions {
    display: flex;
    gap: 8px;
  }

  .btn-bulk {
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn-apply-all {
    background: #e8f5e9;
    color: #1b5e20;
    border-color: #c8e6c9;
  }

  .btn-apply-all:hover {
    background: #c8e6c9;
  }

  @media (prefers-color-scheme: dark) {
    .btn-apply-all {
      background: #1b381e;
      color: #81c784;
      border-color: #2e5433;
    }
    .btn-apply-all:hover {
      background: #254d2a;
    }
  }

  .btn-reset-all {
    background: #f5f5f5;
    color: #424242;
    border-color: #e0e0e0;
  }

  .btn-reset-all:hover {
    background: #e0e0e0;
  }

  @media (prefers-color-scheme: dark) {
    .btn-reset-all {
      background: #2c2c2c;
      color: #cccccc;
      border-color: #444444;
    }
    .btn-reset-all:hover {
      background: #3a3a3a;
    }
  }

  .diff-controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    position: relative;
    flex: 1;
    min-width: 180px;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    font-size: 12px;
    opacity: 0.6;
    pointer-events: none;
  }

  .filter-input {
    width: 100%;
    padding: 5px 26px 5px 26px;
    font-size: 12px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-input, #fff);
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .filter-input {
      background: #282828;
      border-color: #444;
    }
  }

  .btn-clear-search {
    position: absolute;
    right: 6px;
    background: transparent;
    border: none;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.6;
  }

  .category-tabs {
    display: flex;
    background: #eee;
    border-radius: 4px;
    padding: 2px;
  }

  @media (prefers-color-scheme: dark) {
    .category-tabs {
      background: #2c2c2c;
    }
  }

  .tab-btn {
    border: none;
    background: transparent;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 3px;
    cursor: pointer;
    color: var(--text-secondary, #666);
    transition: background 0.15s ease;
  }

  @media (prefers-color-scheme: dark) {
    .tab-btn {
      color: #aaa;
    }
  }

  .tab-btn.active {
    background: #fff;
    color: #111;
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  @media (prefers-color-scheme: dark) {
    .tab-btn.active {
      background: #444;
      color: #fff;
    }
  }

  .diff-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    max-height: 380px;
    overflow-y: auto;
  }

  @media (prefers-color-scheme: dark) {
    .diff-table-wrapper {
      border-color: #333333;
    }
  }

  .diff-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .diff-table th {
    background: #f8f9fa;
    color: var(--text-secondary, #555);
    font-weight: 600;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    position: sticky;
    top: 0;
    z-index: 2;
  }

  @media (prefers-color-scheme: dark) {
    .diff-table th {
      background: #252525;
      color: #bbb;
      border-color: #333;
    }
  }

  .th-key {
    width: 20%;
  }
  .th-source {
    width: 25%;
  }
  .th-osm {
    width: 25%;
  }
  .th-staged {
    width: 25%;
  }
  .th-actions {
    width: 5%;
    text-align: center;
  }

  .diff-row {
    border-bottom: 1px solid var(--border-color, #f0f0f0);
    transition: background 0.1s ease;
  }

  .diff-row:hover {
    background: #fcfcfc;
  }

  @media (prefers-color-scheme: dark) {
    .diff-row {
      border-color: #2b2b2b;
    }
    .diff-row:hover {
      background: #222222;
    }
  }

  .row-modified {
    background: #f0f7ff;
  }

  @media (prefers-color-scheme: dark) {
    .row-modified {
      background: #132338;
    }
  }

  .diff-table td {
    padding: 8px 10px;
    vertical-align: top;
  }

  .td-key {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .tag-key-name {
    font-family: monospace;
    font-weight: 600;
    color: #2b6cb0;
  }

  @media (prefers-color-scheme: dark) {
    .tag-key-name {
      color: #63b3ed;
    }
  }

  .status-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .badge-identical {
    background: #e8f5e9;
    color: #2e7d32;
  }
  .badge-missing {
    background: #fff8e1;
    color: #f57f17;
  }
  .badge-outdated {
    background: #e1f5fe;
    color: #0288d1;
  }
  .badge-new {
    background: #e0f2f1;
    color: #00796b;
  }
  .badge-conflict {
    background: #f3e5f5;
    color: #7b1fa2;
  }
  .badge-staged {
    background: #e3f2fd;
    color: #1565c0;
    font-weight: bold;
  }

  @media (prefers-color-scheme: dark) {
    .badge-identical {
      background: #19381e;
      color: #81c784;
    }
    .badge-missing {
      background: #383015;
      color: #ffb74d;
    }
    .badge-outdated {
      background: #14334a;
      color: #4fc3f7;
    }
    .badge-new {
      background: #123631;
      color: #4db6ac;
    }
    .badge-conflict {
      background: #351c3a;
      color: #ba68c8;
    }
    .badge-staged {
      background: #122c4d;
      color: #64b5f6;
    }
  }

  .value-source-box,
  .value-osm-box {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    word-break: break-word;
  }

  .value-text {
    line-height: 1.3;
  }

  .btn-inline-copy {
    align-self: flex-start;
    font-size: 10px;
    padding: 2px 6px;
    background: #e8f5e9;
    color: #1b5e20;
    border: 1px solid #a5d6a7;
    border-radius: 3px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn-inline-copy:hover {
    background: #c8e6c9;
  }

  @media (prefers-color-scheme: dark) {
    .btn-inline-copy {
      background: #1b381e;
      color: #81c784;
      border-color: #2e5433;
    }
    .btn-inline-copy:hover {
      background: #254d2a;
    }
  }

  .btn-inline-revert {
    align-self: flex-start;
    font-size: 10px;
    padding: 2px 6px;
    background: #f5f5f5;
    color: #616161;
    border: 1px solid #e0e0e0;
    border-radius: 3px;
    cursor: pointer;
  }

  .btn-inline-revert:hover {
    background: #e0e0e0;
  }

  @media (prefers-color-scheme: dark) {
    .btn-inline-revert {
      background: #2d2d2d;
      color: #bbb;
      border-color: #444;
    }
    .btn-inline-revert:hover {
      background: #3d3d3d;
    }
  }

  .staged-input-wrapper {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .staged-input {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-input, #fff);
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .staged-input {
      background: #282828;
      border-color: #444;
    }
  }

  .staged-input:focus {
    outline: none;
    border-color: #3182ce;
    box-shadow: 0 0 0 1px #3182ce;
  }

  .input-has-warning {
    border-color: #f59e0b;
  }

  .tag-warning-hint {
    font-size: 10px;
    color: #d97706;
    line-height: 1.2;
  }

  @media (prefers-color-scheme: dark) {
    .tag-warning-hint {
      color: #fbbf24;
    }
  }

  .td-actions {
    text-align: center;
  }

  .row-action-btns {
    display: flex;
    justify-content: center;
    gap: 4px;
  }

  .btn-icon-del,
  .btn-icon-remove {
    background: transparent;
    border: none;
    font-size: 12px;
    cursor: pointer;
    opacity: 0.6;
    padding: 2px 4px;
    border-radius: 3px;
  }

  .btn-icon-del:hover,
  .btn-icon-remove:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.05);
  }

  @media (prefers-color-scheme: dark) {
    .btn-icon-del:hover,
    .btn-icon-remove:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .text-muted {
    color: var(--text-muted, #888888);
    font-style: italic;
  }

  .text-missing {
    color: #f59e0b;
  }

  .empty-diff-state {
    padding: 24px;
    text-align: center;
    color: var(--text-secondary, #666);
    font-size: 13px;
  }

  /* Add Custom Tag Panel */
  .add-tag-panel {
    border-top: 1px dashed var(--border-color, #e0e0e0);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  @media (prefers-color-scheme: dark) {
    .add-tag-panel {
      border-color: #333333;
    }
  }

  .add-tag-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #333);
  }

  @media (prefers-color-scheme: dark) {
    .add-tag-title {
      color: var(--text-primary, #eee);
    }
  }

  .add-tag-form {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .input-key-col {
    flex: 1;
    min-width: 140px;
  }

  .input-val-col {
    flex: 2;
    min-width: 180px;
  }

  .tag-form-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    background: var(--bg-input, #fff);
    color: inherit;
  }

  @media (prefers-color-scheme: dark) {
    .tag-form-input {
      background: #282828;
      border-color: #444;
    }
  }

  .btn-add-tag {
    padding: 6px 14px;
    background: #3182ce;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .btn-add-tag:hover:not(:disabled) {
    background: #2b6cb0;
  }

  .btn-add-tag:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-tag-warning {
    font-size: 11px;
    color: #d97706;
  }

  @media (prefers-color-scheme: dark) {
    .add-tag-warning {
      color: #fbbf24;
    }
  }
</style>
