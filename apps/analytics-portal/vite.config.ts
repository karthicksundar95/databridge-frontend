import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/analytics/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: {
      '/auth-api': {
        target: process.env.VITE_AUTH_API_TARGET ?? 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
      },
      '/api': {
        target: process.env.VITE_ANALYTICS_API_TARGET ?? 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/analytics-api': {
        target: process.env.VITE_ANALYTICS_API_TARGET ?? 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/analytics-api/, ''),
      },
      '/s3-upload': {
        target: process.env.VITE_S3_TARGET ?? 'http://localhost:9090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3-upload/, ''),
      },
    },
  },
  build: { outDir: '../../dist-analytics', emptyOutDir: true },
})
