// Карты городов. Одной командой: node scripts/city-maps.mjs gen [slug …] — по карте рельефа смотрит, где у
// города вода, генератор Watabou в скрытом окне (scripts/city-gen.cjs) строит план и кладёт его
// в source-maps/cities/<slug>.json; затем план → наша карта в стиле
// Gleuderoff (maps/cities/<slug>.webp), контуры зданий для приложения (maps/cities/<slug>.plan.json),
// карта города в world.maps, примечательные здания — метками на ней. Параметры городов — lore/cities.mjs.
import sharp from 'sharp'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { CITY_MAPS } from './lore/cities.mjs'
import { autoCities } from './lore/cities-auto.mjs'

const WORLD = 'resources/default-world/world.json'
const OUT = 'resources/default-world/maps/cities'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const worldMap = world.maps.find((m) => m.kind === 'world')
// города, описанные вручную (cities.mjs), и все остальные города, городки, порты и кастры — по описаниям из мира
const CITIES = [...CITY_MAPS, ...(await autoCities(world, CITY_MAPS))]
const seedOf = (s) => ([...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 2000000000) + 1

/** Где город на карте мира: поселение провинции или место-столица */
const anchor = (c) => {
  const p = world.provinces.find((x) => x.name === c.province)
  if (c.place) {
    const pl = world.places.find((x) => x.id === c.place)
    return { p, x: pl.x, y: pl.y, place: pl }
  }
  return { p, x: p.settlement.x, y: p.settlement.y }
}

/** Сторона моря по карте рельефа (альфа = суша): угол генератора sea — доля π против часовой от востока */
async function seaOf(x, y) {
  const img = sharp('resources/default-world/maps/terrain.png')
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const k = info.width / worldMap.width
  let sx = 0
  let sy = 0
  let n = 0
  for (let r = 4; r <= 40; r += 4)
    for (let a = 0; a < 360; a += 10) {
      const px = Math.round((x + r * Math.cos((a * Math.PI) / 180)) * k)
      const py = Math.round((y + r * Math.sin((a * Math.PI) / 180)) * k)
      if (data[(py * info.width + px) * info.channels + 3] < 128) (sx += Math.cos((a * Math.PI) / 180), (sy += Math.sin((a * Math.PI) / 180)), n++)
    }
  if (!n) return null
  const up = (-Math.atan2(sy, sx) * 180) / Math.PI // в генераторе ось y смотрит вверх
  return +((((up + 360) % 360) / 180).toFixed(2))
}

export async function genUrls() {
  const out = []
  for (const c of CITIES.filter((c) => !c.custom)) {
    const a = anchor(c)
    const sea = c.gen.coast ? (c.sea ?? (await seaOf(a.x, a.y)) ?? 0) : 0
    const q = new URLSearchParams({ seed: String(c.seed ?? seedOf(c.slug)), ...Object.fromEntries(Object.entries(c.gen).map(([k, v]) => [k, String(v)])), sea: String(sea), export: 'json' })
    out.push({ slug: c.slug, query: String(q) })
  }
  return out
}

if (process.argv[2] === 'urls') {
  for (const u of await genUrls()) console.log(`http://127.0.0.1:5310/gen?name=${u.slug}&${u.query}`)
  process.exit(0)
}

// gen [slug …]: планы от генератора Watabou в скрытом окне Electron (scripts/city-gen.cjs), затем отрисовка;
// без списка — только города, у которых плана ещё нет (готовые не трогаются)
let generated = []
if (process.argv[2] === 'gen') {
  const want = process.argv.slice(3).filter((a) => a !== 'force')
  const jobs = (await genUrls()).filter((u) => (want.length ? want.includes(u.slug) : !existsSync(`source-maps/cities/${u.slug}.json`)))
  generated = jobs.map((u) => u.slug)
  const { execFileSync } = await import('child_process')
  const electron = (await import('electron')).default
  execFileSync(electron, ['scripts/city-gen.cjs', ...jobs.map((u) => `${u.slug}=${u.query}`)], { stdio: 'inherit' })
}

// ================= рендер плана =================
const W = 2048 // логическая ширина карты города (картинка — вдвое больше)
const PX = 2
const rnd = (seed) => () => (seed = (Math.imul(seed, 48271) >>> 0) % 2147483647) / 2147483647
const area = (r) => Math.abs(r.reduce((s, [x, y], i) => { const [u, v] = r[(i + 1) % r.length]; return s + x * v - u * y }, 0) / 2)
const centroid = (r) => { let x = 0, y = 0; for (const p of r) (x += p[0]), (y += p[1]); return [x / r.length, y / r.length] }
const inside = ([x, y], r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c } return c }
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')

function renderCity(c, J) {
  const f = (id) => J.features.find((x) => x.id === id)
  const vals = f('values')
  // генератор: ось y вверх; у нас — вниз
  const flip = (r) => r.map(([x, y]) => [x, -y])
  const polys = (id) => (f(id)?.coordinates ?? []).map((p) => flip(p[0]))
  const geoms = (id) => f(id)?.geometries ?? []
  const buildings = polys('buildings')
  const prisms = polys('prisms')
  const all = [...buildings.map((r) => ({ r, special: false })), ...prisms.map((r) => ({ r, special: true }))]
  // рамка: здания и стены с запасом под поля и лес
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const grow = (r) => { for (const [x, y] of r) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)) }
  all.forEach((b) => grow(b.r))
  geoms('walls').forEach((g) => grow(flip(g.coordinates[0])))
  // у приморского города в кадр попадает ближайший берег, даже если дома стоят поодаль
  const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2
  for (const w of polys('water')) {
    const near = w.filter(([x, y]) => Math.hypot(x - cx0, y - cy0) < rad * 1.9)
    if (near.length) grow(near)
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.22
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad
  const s = W / (x1 - x0)
  const H = Math.round((y1 - y0) * s)
  const T = ([x, y]) => [+((x - x0) * s).toFixed(1), +((y - y0) * s).toFixed(1)]
  const P = (r) => r.map(T)
  const d = (r, close = true) => 'M' + r.map(([x, y]) => `${x} ${y}`).join('L') + (close ? 'Z' : '')
  const R = rnd(seedOf(c.slug) + 11)

  const earth = P(flip(f('earth').coordinates[0]))
  const water = polys('water').map(P)
  const fields = polys('fields').map(P)
  const greens = polys('greens').map(P)
  const squares = polys('squares').map(P)
  const B = all.map((b) => ({ ...b, r: P(b.r) }))
  const walls = geoms('walls').map((g) => ({ r: P(flip(g.coordinates[0])), w: (g.width ?? vals.wallThickness) * s }))
  const roads = geoms('roads').map((g) => ({ r: P(flip(g.coordinates)), w: (g.width ?? vals.roadWidth) * s }))
  const rivers = geoms('rivers').map((g) => ({ r: P(flip(g.coordinates)), w: (g.width ?? vals.riverWidth) * s }))
  const planks = geoms('planks').map((g) => ({ r: P(flip(g.coordinates)), w: (g.width ?? 4) * s }))
  // у своих планов (Хауссер) кварталы приходят уже с русским именем, цветом крыш и подложки
  const districts = geoms('districts').map((g) => ({ r: P(flip(g.coordinates[0])), en: g.name, name: g.ru, roof: g.roof, fill: g.fill }))
  // какая стена что значит: из двух меньшая — цитадель; если одна — по параметрам города
  const wallSorted = [...walls].sort((a, b) => area(b.r) - area(a.r))
  const citadel = c.gen.citadel ? (c.gen.walls ? wallSorted[1] : wallSorted[0]) : null
  // квартал внутри цитадели получает своё имя, остальные — по убыванию площади
  // «водные» названия (с «~») — кварталам, ближайшим к реке или морю, прочие — по убыванию площади
  districts.sort((a, b) => area(b.r) - area(a.r))
  const wet = [...water, ...rivers.map((q) => q.r)]
  const wdist = (q) => (wet.length ? Math.min(...q.r.flatMap((p) => wet.flatMap((r) => r.map((w) => Math.hypot(w[0] - p[0], w[1] - p[1]))))) : 1e9)
  const open = districts.filter((q) => !(citadel && inside(centroid(q.r), citadel.r)))
  districts.filter((q) => !open.includes(q)).forEach((q) => (q.name ??= c.citadelName ?? 'Цитадель'))
  const wetNames = c.districts.filter((n) => n.startsWith('~')).map((n) => n.slice(1))
  const dryNames = c.districts.filter((n) => !n.startsWith('~'))
  const byWet = [...open].sort((a, b) => wdist(a) - wdist(b))
  // «водные» имена — только кварталам, что выходят к воде (иначе «Причалы» оказываются посреди города)
  for (const q of byWet.filter((q) => !q.name && wdist(q) < 20).slice(0, wet.length ? wetNames.length : 0)) q.name = wetNames.shift()
  let k = 0
  for (const q of open) if (!q.name) q.name = dryNames.shift() ?? `Слобода ${++k}`

  // занятые клетки — чтобы лес и камни не лезли на дома, поля, дороги и воду
  const G = 10
  const gw = Math.ceil(W / G), gh = Math.ceil(H / G)
  const busy = new Uint8Array(gw * gh)
  const mark = (r, padC = 0) => {
    let a = 1e9, b = -1e9, e = 1e9, g = -1e9
    for (const [x, y] of r) (a = Math.min(a, x)), (b = Math.max(b, x)), (e = Math.min(e, y)), (g = Math.max(g, y))
    for (let gy = Math.max(0, Math.floor(e / G) - padC); gy <= Math.min(gh - 1, Math.floor(g / G) + padC); gy++)
      for (let gx = Math.max(0, Math.floor(a / G) - padC); gx <= Math.min(gw - 1, Math.floor(b / G) + padC); gx++) busy[gy * gw + gx] = 1
  }
  B.forEach((b) => mark(b.r, 1)); fields.forEach((r) => mark(r)); squares.forEach((r) => mark(r)); districts.forEach((q) => mark(q.r)); walls.forEach((w) => mark(w.r, 2))
  const markLine = (r, wd) => {
    for (let i = 1; i < r.length; i++) {
      const [ax, ay] = r[i - 1], [bx, by] = r[i]
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (G / 2))
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n
        const rr = Math.ceil(wd / G / 2) + 1
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
          const gx = Math.floor(x / G) + dx, gy = Math.floor(y / G) + dy
          if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) busy[gy * gw + gx] = 1
        }
      }
    }
  }
  roads.forEach((q) => markLine(q.r, q.w)); rivers.forEach((q) => markLine(q.r, q.w)); planks.forEach((q) => markLine(q.r, q.w))
  const free = (x, y) => { const gx = Math.floor(x / G), gy = Math.floor(y / G); return gx >= 0 && gy >= 0 && gx < gw && gy < gh && !busy[gy * gw + gx] && inside([x, y], earth) && !water.some((w) => inside([x, y], w)) }

  // местность вокруг: лес гуще к краям, в горах — камни
  const land = c.rocky ? '#b3ab93' : c.hills ? '#bdb487' : '#b8b58c'
  const trees = []
  const rocks = []
  const forest = c.forest ?? 0.1
  for (let i = 0; i < 9000; i++) {
    const x = R() * W, y = R() * H
    if (!free(x, y)) continue
    const edge = 1 - Math.min(x, y, W - x, H - y) / (Math.min(W, H) * 0.5)
    if (R() < forest * (0.3 + edge * 2)) trees.push([x, y, 5 + R() * 6])
    else if ((c.rocky || c.hills) && R() < (c.rocky ? 0.1 : 0.05)) rocks.push([x, y, 5 + R() * 8])
  }

  const roof = ['#8f5e48', '#9a6a4f', '#865640', '#a07258', '#7d5a46']
  // крыши — по цвету квартала, если он задан (Хауссер), иначе общие
  const dOf = (b) => { const ce = centroid(b.r); return districts.findIndex((q) => inside(ce, q.r)) }
  B.forEach((b) => (b.d = dOf(b)))
  const bAttr = (b, i) => {
    if (b.special) return 'fill="#7b3b33" stroke="#e8cd8e" stroke-width="1.6"'
    const pal = districts[b.d]?.roof ?? roof
    return `fill="${pal[(i * 7) % pal.length]}" stroke="#3a2a20" stroke-width="0.8"`
  }
  const towers = (w) => w.r.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${(vals.towerRadius * s).toFixed(1)}" fill="#3b342d" stroke="#1c1814" stroke-width="1"/>`).join('')
  const text = (x, y, t, size, fill = '#2e2318', extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" stroke="#efe4c6" stroke-width="${(size / 5).toFixed(1)}" paint-order="stroke" stroke-linejoin="round" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" ${extra}>${esc(t)}</text>`
  const ang = [0, 45, 90, 135]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * PX}" height="${H * PX}" viewBox="0 0 ${W} ${H}">
<defs>
  ${ang.map((a) => `<pattern id="furrow${a}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(${a})"><rect width="7" height="7" fill="#b9b06e"/><line x1="0" y1="0" x2="0" y2="7" stroke="#9e9558" stroke-width="2.2"/></pattern>`).join('')}
  <pattern id="vines" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="9" height="9" fill="#8f9a5a"/><circle cx="4.5" cy="4.5" r="2" fill="#5f6e3a"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="#3f6f86"/>
<path d="${d(earth)}" fill="${land}"/>
${water.map((r) => `<path d="${d(r)}" fill="#3f6f86" stroke="#9fc2cc" stroke-width="5" stroke-opacity="0.6"/><path d="${d(r)}" fill="none" stroke="#2c5367" stroke-width="16" stroke-opacity="0.25" stroke-dasharray="2 14"/>`).join('')}
${fields.map((r, i) => `<path d="${d(r)}" fill="url(#furrow${ang[i % 4]})" stroke="#8a8150" stroke-width="1.2"/>`).join('')}
${greens.map((r) => `<path d="${d(r)}" fill="${c.slug === 'erin' ? 'url(#vines)' : '#7f9156'}" stroke="#5c6b3c" stroke-width="1"/>`).join('')}
${rocks.map(([x, y, r]) => `<path d="M${(x - r).toFixed(1)} ${(y + r * 0.5).toFixed(1)}L${x.toFixed(1)} ${(y - r * 0.7).toFixed(1)}L${(x + r).toFixed(1)} ${(y + r * 0.5).toFixed(1)}Z" fill="#8f877a" stroke="#5a544c" stroke-width="1"/>`).join('')}
${rivers.map((q) => `<path d="${d(q.r, false)}" fill="none" stroke="#9fc2cc" stroke-width="${(q.w + 6).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.7"/><path d="${d(q.r, false)}" fill="none" stroke="#3f6f86" stroke-width="${q.w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${roads.map((q) => `<path d="${d(q.r, false)}" fill="none" stroke="#8a7a58" stroke-width="${(q.w + 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d(q.r, false)}" fill="none" stroke="#ddd2b0" stroke-width="${q.w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${districts.map((q) => `<path d="${d(q.r)}" fill="${q.fill ?? '#d6c9a2'}" fill-opacity="${q.fill ? 0.85 : 0.55}"/>`).join('')}
${squares.map((r) => `<path d="${d(r)}" fill="#e6dcbc" stroke="#a8966c" stroke-width="1.4"/>`).join('')}
${rivers.map((q) => `<path d="${d(q.r, false)}" fill="none" stroke="#3f6f86" stroke-width="${q.w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${planks.map((q) => `<path d="${d(q.r, false)}" fill="none" stroke="#6b4f33" stroke-width="${Math.max(3, q.w).toFixed(1)}" stroke-linecap="butt"/>`).join('')}
<g opacity="0.3" transform="translate(2.5 2.5)">${B.map((b) => `<path d="${d(b.r)}" fill="#1c140e"/>`).join('')}</g>
${B.map((b, i) => `<path d="${d(b.r)}" ${bAttr(b, i)}/>`).join('')}
${walls.map((w) => `<path d="${d(w.r)}" fill="none" stroke="#3b342d" stroke-width="${w.w.toFixed(1)}" stroke-linejoin="round"/>${towers(w)}`).join('')}
${trees.map(([x, y, r]) => `<circle cx="${(x + 2).toFixed(1)}" cy="${(y + 2).toFixed(1)}" r="${r.toFixed(1)}" fill="#1f2a14" opacity="0.35"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#4f6b34" stroke="#2c3d1c" stroke-width="1"/>`).join('')}
${districts.map((q) => { const [x, y] = centroid(q.r); const sz = Math.max(13, Math.min(32, Math.sqrt(area(q.r)) / 11)); return text(x.toFixed(1), y.toFixed(1), q.name.toUpperCase(), sz.toFixed(1), '#3a2a1c', `letter-spacing="${(sz / 6).toFixed(1)}" font-weight="bold" opacity="0.85"`) }).join('')}
${text(W / 2, 64, c.name, 58, '#2a1d12', 'font-weight="bold" letter-spacing="6"')}
<g transform="translate(${W - 90} ${H - 100})"><circle r="44" fill="#efe4c6" opacity="0.6"/><path d="M0 -40L9 0L0 40L-9 0Z" fill="#3a2a1c"/><path d="M0 -40L9 0L-9 0Z" fill="#a8323a"/><path d="M-40 0L0 7L40 0L0 -7Z" fill="#3a2a1c" opacity="0.6"/>${text(0, -50, 'С', 22, '#2a1d12', 'font-weight="bold"')}</g>
</svg>`

  // здания для приложения: [квартал, особое, x,y,x,y…]
  const plan = {
    w: W, h: H,
    districts: districts.map((q) => { const [x, y] = centroid(q.r); return { name: q.name, x: +x.toFixed(1), y: +y.toFixed(1) } }),
    buildings: B.map((b) => [b.d, b.special ? 1 : 0, ...b.r.flat().map((v) => Math.round(v))])
  }

  // примечательные здания по правилам из lore/cities.mjs
  const used = new Set()
  const ce = centroid(B.flatMap((b) => b.r))
  const info = B.map((b, i) => ({ i, c: centroid(b.r), a: area(b.r), special: b.special, d: districts[b.d]?.name }))
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
  const biggest = (list) => list.reduce((a, b) => (b.a > a.a ? b : a), list[0])
  const minDist = (pt, rings) => Math.min(...rings.flatMap((r) => r.map((q) => dist(q, pt))))
  const pick = (rule) => {
    // in:Квартал — самое большое обычное здание квартала; castle:Квартал — самое большое особое
    const [kind, dn] = rule.split(':')
    if (dn) return biggest(info.filter((b) => !used.has(b.i) && b.d === dn && b.special === (kind === 'castle')))
    const pool = info.filter((b) => !used.has(b.i) && !b.special)
    const by = (fn, n) => [...pool].sort((a, b) => fn(a) - fn(b)).slice(0, n)
    if (rule === 'temple') return info.find((b) => b.special && !used.has(b.i)) ?? biggest(by((b) => dist(b.c, ce), 10))
    if (rule === 'plaza' && squares.length) return biggest(by((b) => dist(b.c, centroid(squares[0])), 12))
    if (rule === 'citadel' && citadel) { const inC = pool.filter((b) => inside(b.c, citadel.r)); if (inC.length) return biggest(inC) }
    if (rule === 'water' && water.length) return biggest(by((b) => minDist(b.c, water), 25))
    if (rule === 'river' && rivers.length) return biggest(by((b) => minDist(b.c, rivers.map((q) => q.r)), 15))
    if (rule === 'gate' && roads.length) return biggest(by((b) => dist(b.c, roads[0].r[0]), 10))
    if (rule === 'edge') return biggest(by((b) => -dist(b.c, ce), Math.max(10, pool.length >> 3)))
    if (rule === 'center') return biggest(by((b) => dist(b.c, ce), 20))
    return biggest(pool)
  }
  const marks = []
  for (const [name, type, rule, txt] of c.landmarks) {
    if (rule === 'plaza2') {
      if (!squares.length) continue
      const [x, y] = centroid(squares[0])
      marks.push({ name, type, x: +(x + 12).toFixed(1), y: +(y + 12).toFixed(1), b: -1, text: txt })
      continue
    }
    const b = pick(rule)
    if (!b) continue
    used.add(b.i)
    marks.push({ name, type, x: +b.c[0].toFixed(1), y: +b.c[1].toFixed(1), b: b.i, text: txt })
  }
  return { svg, plan, H, marks }
}

mkdirSync(OUT, { recursive: true })
const made = []
const toRender = []
// без аргументов — все города; slug … — только эти; force или gen — перерисовать картинку заново
const only = process.argv[2] === 'gen' ? generated : process.argv.slice(2).filter((a) => a !== 'force')
const FORCE = process.argv.includes('force') || process.argv[2] === 'gen'
for (const c of CITIES) {
  if (only.length && !only.includes(c.slug)) continue
  const src = `source-maps/cities/${c.slug}.json`
  // свой план вместо генератора Watabou (Хауссер): собирается скриптом из c.custom при каждом запуске
  if (c.custom) {
    const a = anchor(c)
    const J = (await import(`./${c.custom}`)).default(c, c.sea ?? (await seaOf(a.x, a.y)))
    const old = existsSync(src) ? readFileSync(src, 'utf8') : ''
    if (JSON.stringify(J) !== old) writeFileSync(src, JSON.stringify(J))
  }
  if (!existsSync(src)) {
    console.log(`${c.name}: нет плана ${src} — сначала сгенерируйте (urls)`)
    continue
  }
  const { svg, plan, H, marks } = renderCity(c, JSON.parse(readFileSync(src, 'utf8')))
  writeFileSync(`source-maps/cities/${c.slug}.svg`, svg)
  // картинку перерисовываем, только если план новее неё (или просили явно)
  const img = `${OUT}/${c.slug}.webp`
  const fresh = existsSync(img) && statSync(img).size > 0 && statSync(img).mtimeMs > statSync(src).mtimeMs && statSync(img).mtimeMs > statSync('scripts/city-maps.mjs').mtimeMs
  if (fresh && !FORCE) {
    plan.landmarks = marks.filter((m) => m.b >= 0).map((m) => ({ b: m.b, name: m.name }))
    writeFileSync(`${OUT}/${c.slug}.plan.json`, JSON.stringify(plan))
    made.push({ c, H, marks })
    console.log(`${c.name}: картинка свежая, только план и метки`)
    continue
  }
  toRender.push({ c, H })
  plan.landmarks = marks.filter((m) => m.b >= 0).map((m) => ({ b: m.b, name: m.name }))
  writeFileSync(`${OUT}/${c.slug}.plan.json`, JSON.stringify(plan))
  made.push({ c, H, marks })
  console.log(`${c.name}: ${plan.buildings.length} зданий, ${plan.districts.length} кварталов, ${marks.length} примечательных мест`)
}

// SVG → PNG движком Chromium (scripts/city-gen.cjs; librsvg в sharp рисовал одну карту до 2,5 минут), затем
// бумажная фактура: мелкий шум, растянутый на всю карту и наложенный умножением
if (toRender.length) {
  const { execFileSync } = await import('child_process')
  const electron = (await import('electron')).default
  execFileSync(electron, ['scripts/city-gen.cjs', ...toRender.map(({ c }) => `--render=source-maps/cities/${c.slug}.svg`)], { stdio: 'inherit' })
  for (const { c, H } of toRender) {
    const nw = 256, nh = Math.round((256 * H) / W)
    const R2 = rnd(seedOf(c.slug) + 5)
    const noise = Buffer.alloc(nw * nh * 3)
    for (let i = 0; i < nw * nh; i++) { const v = 215 + Math.round(R2() * 40); noise[i * 3] = v; noise[i * 3 + 1] = v - 6; noise[i * 3 + 2] = v - 18 }
    const paper = await sharp(noise, { raw: { width: nw, height: nh, channels: 3 } }).resize(W * PX, H * PX, { kernel: 'cubic' }).blur(3).png().toBuffer()
    await sharp(`source-maps/cities/${c.slug}.png`, { limitInputPixels: false }).composite([{ input: paper, blend: 'multiply' }]).webp({ quality: 84 }).toFile(`${OUT}/${c.slug}.webp`)
    rmSync(`source-maps/cities/${c.slug}.png`)
  }
}

// ---- в мир: карта города, метки примечательных зданий, ссылка из места или провинции ----
for (const { c, H, marks } of made) {
  const state = world.states.find((s) => s.base.name === (c.state ?? 'Республика'))
  const id = `map-city-${c.slug}`
  const a = anchor(c)
  const def = { id, name: `${c.name} — план города`, kind: 'city', image: `maps/cities/${c.slug}.webp`, width: W, height: H, plan: `maps/cities/${c.slug}.plan.json` }
  if (a.place) def.placeId = a.place.id
  const i = world.maps.findIndex((m) => m.id === id)
  if (i >= 0) world.maps[i] = def
  else world.maps.push(def)
  if (a.place) a.place.innerMapId = id
  if (a.p) a.p.cityMapId = id
  world.places = world.places.filter((p) => !p.id.startsWith(`city-${c.slug}-`))
  marks.forEach((m, k) =>
    world.places.push({
      id: `city-${c.slug}-${k}`, mapId: id, x: m.x, y: m.y, ...(m.b >= 0 ? { building: m.b } : {}),
      base: { name: m.name, type: m.type, stateId: state?.id ?? '', population: '', ruler: '', description: `${m.text}${m.text ? '\n\n' : ''}_черновик_`, image: '' },
      history: [], from: null, to: null
    })
  )
}
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log('Карты городов в мире:', made.map((m) => m.c.name).join(', '))
