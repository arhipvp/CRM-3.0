import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: rootDir,
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // HMR disabled for development - use page reload instead
    hmr: false,
    // Важно: не использовать proxy в Docker, так как nginx уже проксирует запросы
    // proxy: {
    //   '/api': {
    //     target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
    //     changeOrigin: true,
    //   },
    // },
    middlewareMode: false,
  },
  // Убеждаемся, что base path правильный
  base: '/',
});
