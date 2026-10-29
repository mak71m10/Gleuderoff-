// Лёгкая сборка для телефона: плитки только до z=1 (16384 px) — страница укладывается в лимиты публикации,
// лишние файлы убираются, в копии мира уровень плиток понижается.
import { readFileSync, rmSync, writeFileSync, readdirSync } from 'fs'

const DIR = 'out-web/default-world'
for (const z of readdirSync(`${DIR}/maps/tiles`)) if (Number(z) > 1) rmSync(`${DIR}/maps/tiles/${z}`, { recursive: true, force: true })
rmSync(`${DIR}/maps/terrain.png`, { force: true })
const world = JSON.parse(readFileSync(`${DIR}/world.json`, 'utf8'))
const wm = world.maps.find((m) => m.id === 'world')
if (wm.tiles) wm.tiles.maxZoom = Math.min(wm.tiles.maxZoom, 1)
delete wm.terrainMap
writeFileSync(`${DIR}/world.json`, JSON.stringify(world))
console.log('out-web: плитки до z=1, мир сжат')

// страница для публикации: без своего <html>/<head> (обёртку добавляет площадка), без CSP Electron
const { unlinkSync } = await import('fs')
for (const f of readdirSync('out-web/assets')) if (f.endsWith('.woff')) unlinkSync(`out-web/assets/${f}`)
const html = readFileSync('out-web/index.html', 'utf8')
const js = html.match(/src="(\.\/assets\/[^"]+\.js)"/)[1]
const css = html.match(/href="(\.\/assets\/[^"]+\.css)"/)[1]
writeFileSync(
  'out-web/gleuderoff.html',
  `<title>Gleuderoff</title>
<link rel="stylesheet" href="${css}">
<div id="root"></div>
<script type="module" src="${js}"></script>
`
)
console.log('out-web/gleuderoff.html готова к публикации')
