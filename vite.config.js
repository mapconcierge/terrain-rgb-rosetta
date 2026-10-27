import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const workerSrc = new URL('./node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url);

const maplibreWorker = () => ({
  name: 'maplibre-worker',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'vendor/maplibre-gl-worker.mjs', source: readFileSync(workerSrc) });
  },
});

const injectVersion = () => ({
  name: 'inject-version',
  transformIndexHtml: (html) => html.replaceAll('__APP_VERSION__', version),
});

export default defineConfig({
  base: './',
  plugins: [maplibreWorker(), injectVersion()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
