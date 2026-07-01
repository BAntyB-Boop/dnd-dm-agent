import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/',
  // Serve the existing static assets (video, audio, character art, folio images)
  // straight from the legacy public folder so /assets/... keeps resolving.
  publicDir: path.resolve(__dirname, '../public'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Allow ?raw imports of the legacy folio HTML / shared.css that live in ../public.
    fs: { allow: ['..'] },
  },
});
