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
    watch: {
      // ── Critical perf fix: ignore heavy dirs that Vite doesn't need ──
      // Without this, chokidar watches 90K+ files and kills CPU on Windows
      ignored: [
        '**/target/**',           // Rust build output (69K files!)
        '**/node_modules/**',     // Dependencies (19K files)
        '**/api-server/**',       // Backend Rust server
        '**/backend/**',          // Backend code
        '**/blockchain/**',       // Blockchain modules
        '**/blockchain-service/**',
        '**/mock-api/**',
        '**/shared/**',
        '**/.git/**',
        '**/dist/**',
        '**/.cargo/**',
      ],
      usePolling: false,          // native FS events, not CPU-heavy polling
    },
    proxy: {
      '/api/v1': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
      '/health': {
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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Leaflet — heavy mapping library
          if (id.includes('leaflet')) return 'leaflet';
          // Solid.js core — shared runtime
          if (id.includes('solid-js')) return 'solid';
          // Elina AI — assistant engine + UI
          if (id.includes('elina-ui') || id.includes('/elina/') || id.includes('elina.ts')) return 'elina';
          // UI components — Icons + shared widgets (116KB)
          if (id.includes('/ui.tsx') || id.includes('/ui.ts')) return 'ui';
          // Data modules — departments catalog (61KB) + english lessons (52KB)
          if (id.includes('departments.ts') || id.includes('departments/')) return 'data-departments';
          if (id.includes('english_learn')) return 'data-english';
          // Blockchain screen (components directory, 187KB)
          if (id.includes('/components/') || id.includes('/components.tsx')) return 'blockchain';
          // Services — payments + notifications
          if (id.includes('payments.ts') || id.includes('notifications.ts')) return 'services';
        },
      },
    },
  },
});
