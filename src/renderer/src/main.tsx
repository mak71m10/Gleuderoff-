import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-sc/600.css'
import '@fontsource/alegreya-sans/400.css'
import '@fontsource/alegreya-sans/500.css'
import '@fontsource/alegreya-sans/700.css'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import type { Api } from '../../preload'

declare global {
  interface Window {
    api: Api
  }
}

// Без Electron (просмотр интерфейса в обычном браузере): мир из resources, сохранение в localStorage
if (!window.api) {
  window.api = {
    // относительный путь — работает и с сервера разработки, и с опубликованной страницы (телефон)
    assetBase: 'default-world/',
    loadWorld: async () => {
      const def = await (await fetch('default-world/world.json')).json()
      let saved = null
      try {
        saved = JSON.parse(localStorage.getItem('gleuderoff.web.world') ?? 'null')
      } catch {
        saved = null
      }
      // сохранённая копия устарела (вышла новая версия мира) — берём новую
      const data = saved && (saved.version ?? 1) >= def.version ? saved : def
      return { dir: 'browser', data }
    },
    saveWorld: async (data) => {
      try {
        localStorage.setItem('gleuderoff.web.world', JSON.stringify(data))
      } catch {
        // в браузере телефона места может не хватить — правки живут до перезагрузки
      }
      return true
    },
    importImage: async () => null,
    openWorldFolder: async () => ''
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
