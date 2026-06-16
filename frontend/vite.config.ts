import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backendProxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData:
          '@use "@/styles/abstracts/variables" as *; @use "@/styles/abstracts/mixins" as *;',
      },
    },
  },
})
