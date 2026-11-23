import path from 'path';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const staticRewrites = {
  name: 'dons-place-static-rewrites',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string; headers: { accept?: string } }, res: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const u = req.url || '';
      if (/^\/sitemap\.xml(\?.*)?$/.test(u)) {
        const r = res as { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void };
        r.statusCode = 307;
        r.setHeader('Location', '/api/sitemap.xml');
        r.end();
        return;
      }
      if (/^\/admin\/?(\?.*)?$/.test(u)) req.url = '/admin/index.html' + (u.includes('?') ? u.slice(u.indexOf('?')) : '');
      const pathname = u.split('?')[0];
      const knownPage = /^\/(?:|index\.html|apartments\.html|apartment\.html|gallery\.html|contact\.html|terms\.html|404\.html|admin\/?|admin\/index\.html)$/.test(pathname);
      if (!knownPage && req.headers.accept?.includes('text/html') && !/^\/(?:@|src\/|node_modules\/|__)/.test(pathname)) {
        const r = res as { statusCode: number; setHeader: (k: string, v: string) => void; end: (html: string) => void };
        r.statusCode = 404;
        r.setHeader('Content-Type', 'text/html; charset=utf-8');
        r.end(readFileSync(path.resolve(import.meta.dirname, 'public/404.html'), 'utf8'));
        return;
      }
      next();
    });
  },
};

export default defineConfig({
  base: basePath,
  publicDir: path.resolve(import.meta.dirname, 'public'),
  plugins: [
    staticRewrites,
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
