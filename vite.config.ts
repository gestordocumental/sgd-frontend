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
