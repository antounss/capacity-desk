import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative paths, so the build works from the Android app's local web server.
  base: './',
  // The version shown in Settings comes from package.json, the one place it is set.
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __PREVIEW__: 'false' },
  build: { outDir: 'dist', target: 'es2022' },
});
