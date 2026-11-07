import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/sber-three-react/',
  build: {
    rollupOptions: {
      output: {
        // three.js редко меняется — отдельный чанк лучше кэшируется браузером
        manualChunks: { three: ['three'] },
      },
    },
    chunkSizeWarningLimit: 700,
  },
})
