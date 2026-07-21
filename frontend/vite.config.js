import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
    return 'motion'
  }
  if (id.includes('@fullcalendar')) return 'calendar'
  if (id.includes('@dnd-kit')) return 'dnd'
  if (id.includes('socket.io')) return 'socket'
  if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('redux')) return 'redux'
  if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) return 'query'
  if (id.includes('@tanstack/react-table') || id.includes('@tanstack/react-virtual')) return 'table'
  if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
    return 'vendor'
  }
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5000', ws: true, changeOrigin: true },
    },
  },
})
