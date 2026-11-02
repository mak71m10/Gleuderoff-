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
// портреты персонажей: листы 5×4 в SVG со встроенной картинкой; в мире — «лист.svg#svgView(viewBox(…))»,
// браузер сам вырезает нужный кусок в обычном <img>, так что интерфейс менять не нужно. Двести файлов → десяток
{
  const files = readdirSync(`${DIR}/portraits`).filter((f) => f.endsWith('.webp')).sort()
  const at = new Map()
  const TW = 320, TH = 400, C = 5, R = 4
  mkdirSync(`${DIR}/portraits/sheet`, { recursive: true })
  for (let s = 0; s * C * R < files.length; s++) {
    const part = files.slice(s * C * R, (s + 1) * C * R)
    const tiles = await Promise.all(part.map((f) => sharp(`${DIR}/portraits/${f}`).resize(TW, TH, { fit: 'cover', position: 'top' }).toBuffer()))
    const rows = Math.ceil(part.length / C)
    const img = await sharp({ create: { width: TW * C, height: TH * rows, channels: 3, background: '#222' } })
      .composite(tiles.map((input, i) => ({ input, left: (i % C) * TW, top: Math.floor(i / C) * TH })))
      .webp({ quality: 80 })
      .toBuffer()
    const name = `portraits/sheet/${String(s).padStart(2, '0')}.svg`
    writeFileSync(`${DIR}/${name}`, `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TW * C}" height="${TH * rows}" viewBox="0 0 ${TW * C} ${TH * rows}"><image width="${TW * C}" height="${TH * rows}" xlink:href="data:image/webp;base64,${img.toString('base64')}"/></svg>`)
    part.forEach((f, i) => at.set(`portraits/${f}`, `${name}#svgView(viewBox(${(i % C) * TW},${Math.floor(i / C) * TH},${TW},${TH}))`))
    part.forEach((f) => rmSync(`${DIR}/portraits/${f}`))
  }
  const swap = (o) => {
    if (Array.isArray(o)) o.forEach((v, i) => (typeof v === 'string' && at.has(v) ? (o[i] = at.get(v)) : v && typeof v === 'object' && swap(v)))
    else for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string' && at.has(v)) o[k] = at.get(v); else if (v && typeof v === 'object') swap(v) }
  }
  swap(world)
  console.log(`out-web: портреты персонажей (${files.length}) собраны в ${Math.ceil(files.length / (C * R))} листов`)
}
// планы городов: картинки вдвое меньше (на телефоне хватает), контуры зданий — одним файлом plans.json
{
  const CD = `${DIR}/maps/cities`
  const plans = {}
  for (const m of world.maps.filter((m) => m.kind === 'city')) {
    const slug = m.id.replace(/^map-city-/, '')
    if (m.plan && existsSync(`${DIR}/${m.plan}`)) {
      plans[slug] = JSON.parse(readFileSync(`${DIR}/${m.plan}`, 'utf8'))
      rmSync(`${DIR}/${m.plan}`)
      m.plan = `maps/cities/plans.json#${slug}`
    }
    if (existsSync(`${DIR}/${m.image}`)) {
      const buf = await sharp(readFileSync(`${DIR}/${m.image}`), { limitInputPixels: false }).resize({ width: 2048 }).webp({ quality: 80 }).toBuffer()
      writeFileSync(`${DIR}/${m.image}`, buf)
    }
  }
  writeFileSync(`${CD}/plans.json`, JSON.stringify(plans))
  console.log(`out-web: планы городов (${Object.keys(plans).length}) — одним файлом, картинки 2048 px`)
}
// метка сборки: телефон выбрасывает свою сохранённую копию мира, если вышла новая сборка
world.build = Date.now()
writeFileSync(`${DIR}/world.json`, JSON.stringify(world))
console.log('out-web: плитки до z=1, мир сжат')

// страница для публикации: без своего <html>/<head> (обёртку добавляет площадка), без CSP Electron
const { unlinkSync } = await import('fs')
for (const f of readdirSync('out-web/assets')) if (f.endsWith('.woff')) unlinkSync(`out-web/assets/${f}`)
// наборы шрифтов для алфавитов, которых в мире нет (браузер их и не запросит) — меньше файлов в публикации
for (const f of readdirSync('out-web/assets')) if (/-(greek|greek-ext|vietnamese|devanagari|math)-\d+-/.test(f)) unlinkSync(`out-web/assets/${f}`)
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
