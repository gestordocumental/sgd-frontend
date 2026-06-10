import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

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
      return code.replace(
        /function __insertCSS\(code\) \{[\s\S]*?\n\}/,
        'function __insertCSS(_code) {}',
      );
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
          if (id.includes('xlsx') || id.includes('jszip')) return 'xlsx';
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
