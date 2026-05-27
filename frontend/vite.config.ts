import path from "path" // Імпортуємо модуль path для роботи зі шляхами до файлів та папок
import { defineConfig } from 'vite' // Імпортуємо функцію defineConfig для створення типізованої конфігурації Vite
import react from '@vitejs/plugin-react' // Імпортуємо офіційний плагін React для збірки JSX та швидкого перезавантаження
import PinyVite from '@pinegrow/piny-vite' // Імпортуємо плагін PinyVite для підтримки візуального вибору та редагування елементів у режимі реального часу

// Read port configuration from environment variables with defaults
const BACKEND_PORT = process.env.VITE_BACKEND_PORT || '3001'
const CDP_PORT = process.env.VITE_CDP_PORT || '9222'

// Посилання на офіційну документацію конфігурації Vite
export default defineConfig({ // Визначаємо та експортуємо конфігурацію нашого проекту Vite
  plugins: [ // Масив плагінів, що використовуються у процесі збірки проекту
    react(), // Підключаємо плагін React для транспіляції та оптимізації React компонентів
    PinyVite() // Додаємо плагін PinyVite для інтеграції з інструментом візуального редагування
  ], // Кінець масиву плагінів
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
      },
      '/ws': {
        target: `http://localhost:${BACKEND_PORT}`,
        ws: true,
      },
      '/json': {
        target: `http://localhost:${CDP_PORT}`,
        changeOrigin: true,
      },
      '/devtools': {
        target: `http://localhost:${CDP_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
