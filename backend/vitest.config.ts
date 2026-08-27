import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';

// Load .env file before running tests
loadEnv();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    exclude: ['dist/**', '**/dist/**', 'node_modules/**', '**/node_modules/**'],
  },
});
