import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the built site work from any sub-path (e.g. GitHub Pages
// project sites served from /<repo>/), as well as from the domain root.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
