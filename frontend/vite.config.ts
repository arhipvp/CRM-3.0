import { defineConfig, type UserConfigExport } from 'vite';
import type { UserConfig as VitestUserConfig } from 'vitest';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = fileURLToPath(new URL('./public', import.meta.url));

const DEV_SERVER_PORT = Number(process.env.VITE_DEV_SERVER_PORT ?? 5173);
const HMR_PROTOCOL = (process.env.VITE_HMR_PROTOCOL as 'ws' | 'wss' | undefined) ?? 'ws';
const HMR_HOST = process.env.VITE_HMR_HOST ?? 'localhost';
const HMR_PORT = Number(process.env.VITE_HMR_PORT ?? DEV_SERVER_PORT);
const HMR_CLIENT_PORT = Number(process.env.VITE_HMR_CLIENT_PORT ?? DEV_SERVER_PORT);

const config: UserConfigExport & { test?: VitestUserConfig } = {
  root: rootDir,
  publicDir,
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: DEV_SERVER_PORT,
    strictPort: true,
    hmr: {
      protocol: HMR_PROTOCOL,
      host: HMR_HOST,
      port: HMR_PORT,
      clientPort: HMR_CLIENT_PORT,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    middlewareMode: false,
  },
  base: '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: fileURLToPath(new URL('./src/setupTests.ts', import.meta.url)),
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
};

export default defineConfig(config);
