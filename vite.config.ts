import { defineConfig } from 'vitest/config';

// No GitHub Pages o site fica em https://<org>.github.io/<repo>/, então o build
// precisa saber esse caminho. Localmente continua '/'. Ex.: BASE_PATH=/prototipo_pao_queijo/
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: { outDir: 'dist', target: 'es2020' },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
  },
});
