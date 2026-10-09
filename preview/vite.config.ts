// Builds the whole app into ONE self-contained HTML file for a hosted web preview.
// Differences from the Android build: sample data on first open, SQLite's
// plain-JavaScript build instead of WebAssembly (no extra file to fetch), and fonts
// embedded in the page.

import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from '../package.json' with { type: 'json' };

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('..'),
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __PREVIEW__: 'true' },
  resolve: {
    alias: [
      { find: 'sql.js/dist/sql-wasm-browser.wasm?url', replacement: here('./empty-url.ts') },
      { find: /^sql\.js$/, replacement: here('../node_modules/sql.js/dist/sql-asm.js') },
    ],
  },
  build: {
    outDir: here('../dist-preview'),
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: here('./index.html') },
  },
});
