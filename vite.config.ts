import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [vue(), crx({ manifest })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      input: {
        newtab: 'src/newtab/index.html',
        options: 'src/options/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // @crxjs v2 beta workaround: SW dev HMR fails CORS without these.
    // If still broken, fall back to `pnpm build` + load dist/ (no HMR but SW works).
    cors: {
      origin: [/chrome-extension:\/\//, /^http:\/\/localhost:5173$/],
      credentials: true,
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
