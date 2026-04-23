import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 确保 Electron file:// 协议下资源路径正确
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5678',
      '/socket.io': {
        target: 'http://localhost:5678',
        ws: true,
      },
      '/download': 'http://localhost:5678',
    },
  },
})
