import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the built game work from any sub-folder (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
});
