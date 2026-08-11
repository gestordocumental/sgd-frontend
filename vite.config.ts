import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';
import { rmSync } from 'fs';

// Sonner v2 unconditionally calls document.createElement('style') at module
// load time, which requires CSP 'unsafe-inline' for style-src.  This plugin
// replaces that function with a no-op so we can ship a strict CSP; the same
// CSS is imported statically via src/index.css → 'sonner/dist/styles.css'.
function sonnerNoInjectCSS(): Plugin {
  return {
    name: 'sonner-no-inject-css',
    transform(code, id) {
      if (!id.includes('node_modules/sonner/') && !id.includes('node_modules\\sonner\\')) return;
      if (!id.endsWith('index.js') && !id.endsWith('index.mjs')) return;
      const pattern = /function __insertCSS\(code\) \{[\s\S]*?\n\}/;
      if (!pattern.test(code)) {
        throw new Error('sonner-no-inject-css: __insertCSS not found; check sonner version');
      }
      return code.replace(pattern, 'function __insertCSS(_code) {}');
    },
  };
}

// MSW's mockServiceWorker.js must live in public/ so the browser can register
// the service worker, but it must NOT ship to production — it leaks internal
// tooling details and adds dead weight to the CDN.
// closeBundle runs after every `vite build`; the try/catch is a no-op when the
// file is already absent (e.g. excluded by .vercelignore in the CI environment).
function removeMockServiceWorker(): Plugin {
  return {
    name: 'remove-mock-service-worker',
    apply: 'build',
    closeBundle() {
      rmSync(path.resolve(__dirname, 'dist/mockServiceWorker.js'), { force: true });
    },
  };
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      routeFileIgnorePattern: '__tests__',
    }),
    react(),
    tailwindcss(),
    sonnerNoInjectCSS(),
    removeMockServiceWorker(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          // react/react-dom/scheduler must be their own chunk, checked before
          // every other bucket below. Every other bucket (tanstack, ui,
          // spreadsheet, vendor, ...) imports React, and the old catch-all
          // dropped react into 'vendor' alongside code that 'vendor' itself
          // pulled in from those buckets — a real circular chunk dependency
          // (Rollup warned "Circular chunk: vendor -> tanstack -> vendor" /
          // "spreadsheet -> vendor -> spreadsheet"). With circular ESM
          // chunks, load order isn't guaranteed, so a chunk could run
          // React.useLayoutEffect() before the 'vendor' chunk had finished
          // initializing its React export — crashing the entire app with
          // "Cannot read properties of undefined (reading 'useLayoutEffect')"
          // on first paint. Giving React its own chunk with no back-edge to
          // any of the others breaks the cycle.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            // @tanstack/react-store's dependency — without this it fell into
            // the 'vendor' catch-all, and since 'tanstack' imports it from
            // there, that was the other half of the vendor<->tanstack cycle
            // (the "Circular chunk: tanstack -> vendor -> tanstack" warning
            // that survived the react/react-dom/scheduler split above).
            id.includes('node_modules/use-sync-external-store/')
          )
            return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
          if (id.includes('@sentry')) return 'monitoring';
          if (id.includes('exceljs') || id.includes('jszip') || id.includes('/ssf/'))
            return 'spreadsheet';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('@base-ui')) return 'ui';
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // SSE (Server-Sent Events) needs the connection to stay open and the
        // response to be flushed immediately, not buffered.
        // http-proxy buffers by default; configure() patches the proxyRes
        // to disable buffering for text/event-stream responses.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              proxyRes.headers['x-accel-buffering'] = 'no';
              proxyRes.headers['cache-control'] = 'no-cache';
            }
          });
        },
      },
      '/uploads': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
