// Сеть дорог между поселениями: кратчайший по трудности путь (A*) по местности.
// Равнина — легко, лес и холмы — труднее, горы и снега — очень трудно, вода — нельзя, брод через реку — мост.
// Уже проложенные дороги дешевле — новые пути сливаются в общую сеть, как настоящие тракты.
// Виды: paved — мощёный тракт (имперцы, южане, церковь, элеоны, златайцы, цинь, юты; у дварфов — и в горах),
//       dirt — грунтовая дорога, trail — горная тропа и тропинки к деревням.
// Запуск после terrain.mjs: node --max-old-space-size=8192 scripts/roads.mjs → source-maps/roads.json
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const t0 = Date.now()
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)
const world = JSON.parse(readFileSync('resources/default-world/world.json', 'utf8'))
const { data: pimg, info } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
const { data: timg } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
const SW = info.width, SH = info.height
// сетка дорог — вдвое мельче растра провинций: клетка = 4 логические единицы
const D = 2
const GW = SW / D, GH = SH / D, GN = GW * GH
const L = 4 // логических единиц в клетке

function hash2(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

// трудность клетки
const STEP = [Infinity, 1, 1.9, 2.6, 6.5, 14, 1.7] // вода, равнины, лес, холмы, горы, снега, пустыня
const cost = new Float32Array(GN)
const cls = new Uint8Array(GN)
const river = new Uint8Array(GN)
const prov = new Uint16Array(GN)
for (let gy = 0; gy < GH; gy++)
  for (let gx = 0; gx < GW; gx++) {
    const cnt = [0, 0, 0, 0, 0, 0, 0]
    let rv = 0, pid = 0
    for (let dy = 0; dy < D; dy++)
      for (let dx = 0; dx < D; dx++) {
        const i = (gy * D + dy) * SW + gx * D + dx
        const c = pimg[i * 4 + 3] ? pimg[i * 4 + 2] : 0
        cnt[c]++
        if (timg[i * 4 + 2]) rv++
        if (pimg[i * 4 + 3]) pid = (pimg[i * 4] << 8) | pimg[i * 4 + 1]
      }
    let best = 0
    for (let c = 1; c < 7; c++) if (cnt[c] > cnt[best]) best = c
    if (cnt[0] >= 3) best = 0
    const g = gy * GW + gx
    cls[g] = best
    prov[g] = pid
    river[g] = rv ? 1 : 0
    // плавный шум трудности: дороги петляют, обходят бугры и болотца, а не идут по линейке
    const n = vnoise(gx / 7, gy / 7) * 0.6 + vnoise(gx / 2.5 + 40, gy / 2.5) * 0.4
    cost[g] = (STEP[best] + (rv ? 6 : 0)) * (0.55 + n * 0.9) // мост дорог: переходить реку стоит
  }
log('сетка трудности')

const provById = new Map(world.provinces.map((p) => [p.id, p]))
const PAVED = new Set(['imperial', 'church', 'romance', 'eleon', 'zlatay', 'cin', 'yut', 'dwarven'])
const RANK = { capital: 5, city: 4, port: 3, town: 3, castle: 2, temple: 1, tower: 1, village: 0, fishing: 0, ruins: -1 }

// узлы: поселения провинций и места автора
const nodes = []
for (const p of world.provinces) {
  const s = p.settlement
  if (!s || RANK[s.type] < 0) continue
  nodes.push({ x: s.x, y: s.y, rank: RANK[s.type], culture: p.culture })
}
for (const pl of world.places) {
  if (pl.mapId !== 'world') continue
  const r = RANK[pl.base.type] ?? -1
  if (r < 0) continue
  const g = cellOf(pl.x, pl.y)
  nodes.push({ x: pl.x, y: pl.y, rank: r, culture: provById.get(prov[g])?.culture ?? 'imperial' })
}
function cellOf(x, y) {
  return Math.min(GH - 1, Math.max(0, Math.floor(y / L))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(x / L)))
}
for (const n of nodes) n.cell = cellOf(n.x, n.y)
log(`узлов: ${nodes.length}`)

// пары: крупные — с 3–4 ближайшими крупными, замки и храмы — с ближайшим крупным, деревни — тропинкой к ближайшему соседу
const major = nodes.filter((n) => n.rank >= 3)
const edges = []
const seen = new Set()
const addEdge = (a, b, kind) => {
  const k = a < b ? `${a}|${b}` : `${b}|${a}`
  if (seen.has(k)) return
  seen.add(k)
  edges.push({ a, b, kind, d: Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) })
}
const idx = new Map(nodes.map((n, i) => [n, i]))
for (const n of major) {
  const near = major.filter((m) => m !== n).map((m) => [m, Math.hypot(m.x - n.x, m.y - n.y)]).filter(([, d]) => d < 330).sort((a, b) => a[1] - b[1])
  for (const [m] of near.slice(0, n.rank >= 4 ? 4 : 3)) addEdge(idx.get(n), idx.get(m), 'road')
}
for (const n of nodes) {
  if (n.rank >= 3) continue
  const pool = n.rank >= 1 ? major : nodes.filter((m) => m !== n)
  let best = null, bd = n.rank >= 1 ? 200 : 90
  for (const m of pool) {
    if (m === n) continue
    const d = Math.hypot(m.x - n.x, m.y - n.y)
    if (d < bd) { bd = d; best = m }
  }
  if (best) addEdge(idx.get(n), idx.get(best), n.rank >= 1 ? 'road' : 'path')
}
edges.sort((e1, e2) => (e1.kind === e2.kind ? e1.d - e2.d : e1.kind === 'road' ? -1 : 1))
log(`пар: ${edges.length}`)

// A* на клетках с двоичной кучей
const gScore = new Float32Array(GN)
const came = new Int32Array(GN)
const stamp = new Int32Array(GN)
const roadCell = new Uint8Array(GN) // 0 — нет дороги, 1 — тропа, 2 — дорога
const heap = new Int32Array(GN * 2)
const fh = new Float32Array(GN * 2)
let run = 0
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
function astar(s, t, maxExp) {
  run++
  let hn = 0
  const tx = t % GW, ty = (t / GW) | 0
  const hOf = (c) => Math.hypot((c % GW) - tx, ((c / GW) | 0) - ty) * 0.3
  const push = (c, f) => {
    let i = hn++
    while (i > 0) {
      const p = (i - 1) >> 1
      if (fh[p] <= f) break
      heap[i] = heap[p]; fh[i] = fh[p]; i = p
    }
    heap[i] = c; fh[i] = f
  }
  const pop = () => {
    const top = heap[0]
    const lc = heap[--hn], lf = fh[hn]
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= hn) break
      if (c + 1 < hn && fh[c + 1] < fh[c]) c++
      if (fh[c] >= lf) break
      heap[i] = heap[c]; fh[i] = fh[c]; i = c
    }
    heap[i] = lc; fh[i] = lf
    return top
  }
  stamp[s] = run; gScore[s] = 0; came[s] = -1
  push(s, hOf(s))
  let exp = 0
  while (hn) {
    const c = pop()
    if (c === t) break
    if (++exp > maxExp) return null
    const cx = c % GW, cy = (c / GW) | 0
    const gc = gScore[c]
    for (const [dx, dy, w] of NB) {
      const nx = cx + dx, ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue
      const n = ny * GW + nx
      let k = cost[n]
      if (k === Infinity) continue
      if (roadCell[n]) k *= roadCell[n] === 2 ? 0.3 : 0.55 // по готовой дороге идти легче
      const g = gc + k * w
      if (stamp[n] === run && g >= gScore[n]) continue
      stamp[n] = run; gScore[n] = g; came[n] = c
      push(n, g + hOf(n))
    }
  }
  if (stamp[t] !== run) return null
  const path = []
  for (let c = t; c !== -1; c = came[c]) path.push(c)
  return path.reverse()
}

// сглаживание: прореживание + Чайкин
function smooth(cells) {
  let pts = cells.map((c) => [((c % GW) + 0.5) * L, (((c / GW) | 0) + 0.5) * L])
  if (pts.length > 6) pts = pts.filter((_, i) => i === 0 || i === pts.length - 1 || i % 4 === 0)
  for (let it = 0; it < 3; it++) {
    const o = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
      o.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75])
    }
    o.push(pts[pts.length - 1])
    pts = o
  }
  return pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])
}

const roads = []
let done = 0, fail = 0
for (const e of edges) {
  const A = nodes[e.a], B = nodes[e.b]
  const path = astar(A.cell, B.cell, e.kind === 'road' ? 400000 : 40000)
  if (!path || path.length < 2) { fail++; continue }
  // доля гор на пути: перевал — тропа, если строители не дварфы
  let mtn = 0
  for (const c of path) if (cls[c] === 4 || cls[c] === 5) mtn++
  const pass = mtn / path.length > 0.35
  const paved = PAVED.has(A.culture) && PAVED.has(B.culture)
  let type = e.kind === 'path' ? 'trail' : paved && (!pass || (A.culture === 'dwarven' && B.culture === 'dwarven')) ? 'paved' : pass ? 'trail' : 'dirt'
  // клетки, уже лежащие на дороге, не рисуем второй раз — разбиваем путь на новые куски
  const level = type === 'trail' ? 1 : 2
  let seg = []
  const flush = () => {
    if (seg.length >= 2) roads.push({ type, pts: smooth(seg) })
    seg = []
  }
  for (let i = 0; i < path.length; i++) {
    const c = path[i]
    const fresh = roadCell[c] < level
    if (fresh) {
      if (!seg.length && i > 0) seg.push(path[i - 1]) // стык с существующей дорогой
      seg.push(c)
    } else if (seg.length) {
      seg.push(c)
      flush()
    }
  }
  flush()
  for (const c of path) roadCell[c] = Math.max(roadCell[c], level)
  if (++done % 500 === 0) log(`проложено ${done}`)
}
writeFileSync('source-maps/roads.json', JSON.stringify(roads))
const by = {}
for (const r of roads) by[r.type] = (by[r.type] ?? 0) + 1
log(`дороги: ${JSON.stringify(by)}, не проложено ${fail}`)
