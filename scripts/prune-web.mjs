// Лёгкая сборка для телефона: плитки только до z=1 (16384 px) — страница укладывается в лимиты публикации,
// лишние файлы убираются, в копии мира уровень плиток понижается.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs'
import sharp from 'sharp'

const DIR = 'out-web/default-world'
for (const z of readdirSync(`${DIR}/maps/tiles`)) if (Number(z) > 1) rmSync(`${DIR}/maps/tiles/${z}`, { recursive: true, force: true })
rmSync(`${DIR}/maps/terrain.png`, { force: true })
// плитки открытого моря (почти пустые) на крупном масштабе не нужны: под ними видно превью карты — экономим файлы публикации
const { statSync } = await import('fs')
for (const f of readdirSync(`${DIR}/maps/tiles/1`)) if (statSync(`${DIR}/maps/tiles/1/${f}`).size < 4500) rmSync(`${DIR}/maps/tiles/1/${f}`)
const world = JSON.parse(readFileSync(`${DIR}/world.json`, 'utf8'))
const wm = world.maps.find((m) => m.id === 'world')
if (wm.tiles) wm.tiles.maxZoom = Math.min(wm.tiles.maxZoom, 1)
delete wm.terrainMap
// портреты депутатов: сотни отдельных файлов не влезают в лимит публикации — собираем листами 10×10,
// а в мире пишем «лист#колонка,строка» (PowerView рисует такой портрет фоном с нужным сдвигом)
const DEP = `${DIR}/portraits/dep`
if (existsSync(DEP)) {
  const files = readdirSync(DEP).filter((f) => f.endsWith('.webp')).sort()
  const at = new Map()
  const TW = 120, TH = 144, N = 10
  mkdirSync(`${DIR}/portraits/depsheet`, { recursive: true })
  for (let s = 0; s * N * N < files.length; s++) {
    const part = files.slice(s * N * N, (s + 1) * N * N)
    const tiles = await Promise.all(part.map((f) => sharp(`${DEP}/${f}`).resize(TW, TH, { fit: 'cover' }).toBuffer()))
    const name = `portraits/depsheet/${String(s).padStart(2, '0')}.webp`
    await sharp({ create: { width: TW * N, height: TH * N, channels: 3, background: '#222' } })
      .composite(tiles.map((input, i) => ({ input, left: (i % N) * TW, top: Math.floor(i / N) * TH })))
      .webp({ quality: 78 })
      .toFile(`${DIR}/${name}`)
    part.forEach((f, i) => at.set(`portraits/dep/${f}`, `${name}#${i % N},${Math.floor(i / N)}`))
  }
  for (const l of world.legislatures ?? []) for (const m of l.members) if (m.image && at.has(m.image)) m.image = at.get(m.image)
  rmSync(DEP, { recursive: true, force: true })
  console.log(`out-web: портреты депутатов (${files.length}) собраны в ${Math.ceil(files.length / (N * N))} листов`)
}
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
