import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;
const port = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 3000;

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@guardio/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host: host,
          port: 1421,
        }
      : undefined,
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    cssMinify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet'],
        },
      },
    },
  },
});
