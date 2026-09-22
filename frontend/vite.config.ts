import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import PinyVite from '@pinegrow/piny-vite'

// Read port configuration from environment variables with defaults
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || '3001'
const CDP_PORT = process.env.VITE_CDP_PORT || '9222'

// Обробник помилок для WebSocket proxy, який пригнічує шумні та очікувані розриви зв'язку клієнта (F5, закриття вкладки)
const handleWsProxy = (proxy: any) => {
  proxy.on('error', (err: any) => {
    if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err?.code)) return;
    console.warn('[vite ws proxy warning]', err.message || err);
  });
  proxy.on('proxyReqWs', (_proxyReq: any, _req: any, socket: any) => {
    socket.on('error', (err: any) => {
      if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err?.code)) return;
      console.warn('[vite ws client socket warning]', err.message || err);
    });
  });
  proxy.on('open', (proxySocket: any) => {
    proxySocket.on('error', (err: any) => {
      if (['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT'].includes(err?.code)) return;
      console.warn('[vite ws target socket warning]', err.message || err);
    });
  });
}

// Посилання на офіційну документацію конфігурації Vite
export default defineConfig({
  plugins: [
    react(),
    PinyVite()
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // Доступ з локальної мережі (телефон)
    port: 5173,
    allowedHosts: true, // Дозволяємо підключення через тунелі
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
        configure: (proxy: any) => {
          proxy.on('error', (err: any) => {
            if (['ECONNABORTED', 'ECONNRESET', 'EPIPE'].includes(err?.code)) return;
            console.warn('[vite api proxy warning]', err.message || err);
          });
        },
      },
      '/ws': {
        target: `http://localhost:${BACKEND_PORT}`,
        ws: true,
        configure: handleWsProxy,
      },
      '/json': {
        target: `http://localhost:${CDP_PORT}`,
        changeOrigin: true,
      },
      '/devtools': {
        target: `http://localhost:${CDP_PORT}`,
        changeOrigin: true,
        ws: true,
        configure: handleWsProxy,
      },
    },
  },
})
