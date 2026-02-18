import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages - update this to match your repo name
  base: '/quotespark-web/',
  build: {
    outDir: 'dist'
  }
})
