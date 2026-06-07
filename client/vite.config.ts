import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // Disable source maps in production
    minify: 'esbuild', // Ensure minification is enabled
  },
  // Disable crossorigin on <script> tags — the Express static server doesn't
  // return CORS headers, and browsers block crossorigin module scripts when
  // loading from a real hostname (vps.opelkad.com vs localhost).
  html: {
    crossorigin: false,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
