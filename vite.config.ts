import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Canonical nightly-mvp Vite config.
// - base: './'   → relative asset paths so the build works under /YYYY-MM-DD-slug/
// - outDir: 'out' → canonical output dir used by generate-caddyfile.sh
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'out', emptyOutDir: true },
});
