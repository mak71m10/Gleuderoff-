// Просмотр интерфейса в обычном браузере, без Electron: разработка (npm run web)
// и сборка для телефона (npm run build:web → out-web, публикуется страницей)
import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  publicDir: resolve('resources'),
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  plugins: [react()],
  base: './',
  build: { outDir: resolve('out-web'), emptyOutDir: true },
  server: { port: 5199 }
})
