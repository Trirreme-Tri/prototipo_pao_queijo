import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist', target: 'es2020' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
  },
});
