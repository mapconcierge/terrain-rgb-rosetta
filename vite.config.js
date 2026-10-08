import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const workerSrc = new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);

const maplibreWorker = () => ({
  name: 'maplibre-worker',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'vendor/maplibre-gl-worker.mjs', source: readFileSync(workerSrc) });
  },
});

export default defineConfig({
  base: './',
  plugins: [maplibreWorker()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
