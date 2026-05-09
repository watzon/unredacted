import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['bigboi.local', '192.168.1.191', 'localhost'],
  },
  build: {
    emptyOutDir: true,
  },
})
