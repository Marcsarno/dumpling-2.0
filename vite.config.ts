import {defineConfig} from 'vite';

export default defineConfig({
  // Relative URLs let the same build run from any static host or sub-path.
  base: './',
  server: {
    watch: {ignored: ['**/.pnpm-store/**', '**/artifacts/**', '**/baseline/**', '**/dist/**']},
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {input: {main: 'index.html', lab: 'lab.html'}},
  },
});
