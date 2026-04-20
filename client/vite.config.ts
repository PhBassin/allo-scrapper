import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_BASE_URL || 'http://localhost:3000/api'
  const proxyTarget = env.VITE_PROXY_TARGET || (apiBaseUrl.startsWith('http') ? new URL(apiBaseUrl).origin : 'http://localhost:3000')

  return {
    plugins: [react()],
    build: {
      sourcemap: false, // Disable source maps in production
      minify: 'esbuild', // Ensure minification is enabled
    },
    server: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/test': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
