import { defineConfig } from 'wxt';
import { generateManifest } from './src/config/manifest';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: generateManifest,
});
