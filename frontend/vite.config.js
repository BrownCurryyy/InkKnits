import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    host: '0.0.0.0',
    allowedHosts: ['inkknits.trustium.tech'],
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/organizations': 'http://127.0.0.1:8000',
      '/projects': 'http://127.0.0.1:8000',
      '/stations': 'http://127.0.0.1:8000',
      '/assets': 'http://127.0.0.1:8000',
      '/versions': 'http://127.0.0.1:8000',
      '/activities': 'http://127.0.0.1:8000',
      '/approvals': 'http://127.0.0.1:8000',
      '/rbac': 'http://127.0.0.1:8000',
      '/ai': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['inkknits.trustium.tech'],
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/organizations': 'http://127.0.0.1:8000',
      '/projects': 'http://127.0.0.1:8000',
      '/stations': 'http://127.0.0.1:8000',
      '/assets': 'http://127.0.0.1:8000',
      '/versions': 'http://127.0.0.1:8000',
      '/activities': 'http://127.0.0.1:8000',
      '/approvals': 'http://127.0.0.1:8000',
      '/rbac': 'http://127.0.0.1:8000',
      '/ai': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
