import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['legacy/**', 'node_modules/**'],
    setupFiles: ['./vitest.setup.js']
  }
});
