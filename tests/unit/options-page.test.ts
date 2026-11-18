import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Options from '@/entrypoints/options/Options.svelte';
import SettingsModal from '@/components/SettingsModal.svelte';
import { settingsStore } from '@/stores/settings.svelte';
import { authStore } from '@/stores/auth.svelte';

describe('Options Page & SettingsModal Components', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // @ts-ignore
    globalThis.browser = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
      runtime: {
        openOptionsPage: vi.fn(),
        getURL: vi.fn((path?: string) => `chrome-extension://test/${path || ''}`),
      },
      identity: {
        launchWebAuthFlow: vi.fn(),
        getRedirectURL: vi.fn().mockReturnValue('https://extension/osm-auth'),
      },
    };

    await settingsStore.resetToDefaults();
    await authStore.init();
  });

  describe('Options.svelte', () => {
    it('renders all configuration sections and default settings', async () => {
      render(Options);

      expect(screen.getByTestId('options-page')).toBeInTheDocument();
      expect(screen.getByText('1. Developer Mode & Safe Sandbox Routing')).toBeInTheDocument();
      expect(screen.getByText('2. Target Backend Environment')).toBeInTheDocument();
      expect(screen.getByText('3. Account & Authentication Manager')).toBeInTheDocument();
      expect(screen.getByText('4. Mapping Preferences')).toBeInTheDocument();

      // Check default radio states
      const disabledRadio = screen.getByTestId('devmode-disabled-radio') as HTMLInputElement;
      expect(disabledRadio.checked).toBe(true);

      const osmProdRadio = screen.getByTestId('preset-osm-prod-radio') as HTMLInputElement;
      expect(osmProdRadio.checked).toBe(true);
    });

    it('updates developer mode routing when clicking radio options', async () => {
      render(Options);

      const writesOnlyRadio = screen.getByTestId('devmode-writes-only-radio');
      await fireEvent.click(writesOnlyRadio);

      await waitFor(() => {
        expect(settingsStore.devModeRouting).toBe('writes_only');
        expect(screen.getByTestId('options-header-badge')).toHaveTextContent('DEV: WRITES ONLY');
      });

      const fullDevRadio = screen.getByTestId('devmode-full-radio');
      await fireEvent.click(fullDevRadio);

      await waitFor(() => {
        expect(settingsStore.devModeRouting).toBe('reads_and_writes');
        expect(screen.getByTestId('options-header-badge')).toHaveTextContent('DEV: FULL');
      });
    });

    it('switches active endpoint preset', async () => {
      render(Options);

      const ohmRadio = screen.getByTestId('preset-ohm-radio');
      await fireEvent.click(ohmRadio);

      await waitFor(() => {
        expect(settingsStore.activeEndpointId).toBe('openhistoricalmap');
      });
    });

    it('displays custom endpoint form and saves valid configuration', async () => {
      render(Options);

      const customRadio = screen.getByTestId('preset-custom-radio');
      await fireEvent.click(customRadio);

      await waitFor(() => {
        expect(screen.getByTestId('custom-endpoint-form')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('Server Name');
      const apiInput = screen.getByLabelText('API 0.6 Base URL');
      const authInput = screen.getByLabelText('OAuth Authorize URL');
      const tokenInput = screen.getByLabelText('OAuth Token URL');

      await fireEvent.input(nameInput, { target: { value: 'Regional Staging Server' } });
      await fireEvent.input(apiInput, { target: { value: 'https://staging.osm.example.org/api/0.6' } });
      await fireEvent.input(authInput, { target: { value: 'https://staging.osm.example.org/oauth2/authorize' } });
      await fireEvent.input(tokenInput, { target: { value: 'https://staging.osm.example.org/oauth2/token' } });

      const saveBtn = screen.getByTestId('save-custom-btn');
      await fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(settingsStore.customEndpoint?.name).toBe('Regional Staging Server');
        expect(settingsStore.customEndpoint?.apiBaseUrl).toBe('https://staging.osm.example.org/api/0.6');
      });
    });
  });

  describe('SettingsModal.svelte', () => {
    it('renders when isOpen is true and allows quick switching', async () => {
      const handleClose = vi.fn();
      render(SettingsModal, {
        props: {
          isOpen: true,
          onClose: handleClose,
        },
      });

      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();

      // Test switching devmode in quick modal
      const writesOnlyQuick = screen.getByTestId('quick-devmode-writes-only');
      await fireEvent.click(writesOnlyQuick);

      await waitFor(() => {
        expect(settingsStore.devModeRouting).toBe('writes_only');
      });

      // Test Done button closes modal
      const doneBtn = screen.getByTestId('done-quick-settings-btn');
      await fireEvent.click(doneBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('opens full options page when link is clicked', async () => {
      const handleClose = vi.fn();
      render(SettingsModal, {
        props: {
          isOpen: true,
          onClose: handleClose,
        },
      });

      const openFullBtn = screen.getByTestId('open-full-options-btn');
      await fireEvent.click(openFullBtn);

      expect(browser.runtime.openOptionsPage).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
