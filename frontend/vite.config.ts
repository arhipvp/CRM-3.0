import { defineConfig, type UserConfigExport } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

const config: UserConfigExport & { test?: VitestUserConfig } = {
  root: rootDir,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['zoom78.com', 'www.zoom78.com'],
    // HMR disabled for development - use page reload instead
    hmr: false,
    // Важно: не использовать proxy в Docker, так как nginx уже проксирует запросы
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    middlewareMode: false,
  },
  // Убеждаемся, что base path правильный
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          if (id.includes('react-router')) {
            return 'router-vendor';
          }
          if (id.includes('react-dom') || id.includes('/node_modules/react/')) {
            return 'react-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: fileURLToPath(new URL('./src/setupTests.ts', import.meta.url)),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    pool: 'threads',
    maxWorkers: process.env.CI ? 4 : undefined,
  },
};

export default defineConfig(config);
