import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
