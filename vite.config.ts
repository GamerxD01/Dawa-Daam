import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// BASE lets the same build work at / (local) and /Dawa-Daam/ (GitHub Pages).
export default defineConfig({
  base: process.env.BASE ?? './',
  plugins: [preact()],
  // Phone on the same Wi-Fi opens http://<laptop-ip>:5173 — /gemma is proxied to the local Gemma bridge.
  server: { proxy: { '/gemma': { target: 'http://localhost:8000', rewrite: (p: string) => p.replace(/^\/gemma/, '') } } },
  preview: { proxy: { '/gemma': { target: 'http://localhost:8000', rewrite: (p: string) => p.replace(/^\/gemma/, '') } } },
  build: { target: 'es2019', assetsInlineLimit: 0 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.mjs', 'scripts/**/*.test.mjs'], exclude: ['node_modules/**'] },
} as any);
