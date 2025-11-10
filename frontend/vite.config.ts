import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const devHost = process.env.VITE_DEV_HOST ?? '::'; // IPv6 wildcard also listens on IPv4

export default defineConfig({
  root: rootDir,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  server: {
    host: devHost,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
});
