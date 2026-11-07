// Пути армий по дорогам и местности: каждый отрезок похода (от точки к точке) прокладывается поиском пути (A*)
// по сетке карты, где дороги дешёвые, равнины — обычные, лес, холмы и пустыня — дороже, горы и снега — тяжёлые,
// переправа через реку — с задержкой, а море непроходимо. Армия идёт по тракту, если он есть, и обходит горы,
// если его нет. Если суши между точками нет (поход за море), путь остаётся прямым. Результат — waypoint.path.
// Запуск после всех скриптов, создающих походы (history-provinces и др.): node scripts/army-routes.mjs
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const WORLD = 'resources/default-world/world.json'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const wm = world.maps.find((m) => m.kind === 'world')
const CELL = 16 // единиц мира на клетку сетки
const GW = Math.ceil(wm.width / CELL), GH = Math.ceil(wm.height / CELL)

// ---------- цена клетки: местность ----------
const { data, info } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
const k = info.width / wm.width
const TERRAIN_COST = [Infinity, 1, 1.6, 2.1, 4.5, 6, 1.8] // море, равнины, лес, холмы, горы, снега, пустыня
const cost = new Float32Array(GW * GH)
const river = new Uint8Array(GW * GH)
for (let gy = 0; gy < GH; gy++)
  for (let gx = 0; gx < GW; gx++) {
    const px = Math.min(info.width - 1, Math.floor((gx + 0.5) * CELL * k)), py = Math.min(info.height - 1, Math.floor((gy + 0.5) * CELL * k))
    const i = (py * info.width + px) * info.channels
    const land = data[i + 3] >= 128
    cost[gy * GW + gx] = land ? TERRAIN_COST[Math.round(data[i + 1] / 40)] ?? 1.5 : Infinity
    if (land && data[i + 2] > 128) river[gy * GW + gx] = 1
  }
// ---------- дороги: тракт втрое дешевле равнины ----------
const ROAD_COST = { paved: 0.3, dirt: 0.45, trail: 0.75 }
const roads = JSON.parse(readFileSync('source-maps/roads.json', 'utf8'))
for (const r of roads) {
  const c = ROAD_COST[r.type] ?? 0.6
  for (let n = 1; n < r.pts.length; n++) {
    const [ax, ay] = r.pts[n - 1], [bx, by] = r.pts[n]
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (CELL / 2)) || 1
    for (let s = 0; s <= steps; s++) {
      const gx = Math.floor((ax + ((bx - ax) * s) / steps) / CELL), gy = Math.floor((ay + ((by - ay) * s) / steps) / CELL)
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue
      const i = gy * GW + gx
      if (cost[i] !== Infinity) { cost[i] = Math.min(cost[i], c); river[i] = 0 } // на дороге — мост
    }
  }
}

// ---------- A* ----------
const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))), Math.max(0, Math.min(GH - 1, Math.floor(y / CELL)))]
const nearestLand = (gx, gy) => {
  if (cost[gy * GW + gx] !== Infinity) return [gx, gy]
  for (let r = 1; r < 40; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = gx + dx, y = gy + dy
        if (x >= 0 && y >= 0 && x < GW && y < GH && cost[y * GW + x] !== Infinity) return [x, y]
      }
  return null
}
const g = new Float32Array(GW * GH)
const from = new Int32Array(GW * GH)
const seen = new Uint32Array(GW * GH)
let stamp = 0
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
function astar(a, b) {
  stamp++
  const [tx, ty] = b
  const target = ty * GW + tx
  // оценка остатка пути чуть выше «всё по тракту»: поиск идёт к цели, а не во все стороны (путь почти оптимальный)
  const h = (i) => Math.hypot((i % GW) - tx, Math.floor(i / GW) - ty) * 0.55
  const heap = [] // [f, i]
  const push = (f, i) => {
    heap.push([f, i])
    let c = heap.length - 1
    while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p }
  }
  const pop = () => {
    const top = heap[0], last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = c * 2 + 1, r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const start = a[1] * GW + a[0]
  seen[start] = stamp
  g[start] = 0
  from[start] = -1
  push(h(start), start)
  // цель за морем: посуху до неё не дойти — не перебирать весь материк, а сдаться (поход пойдёт напрямую, флотом)
  const limit = h(start) * 7 + 60
  let pops = 0
  while (heap.length) {
    const [f, i] = pop()
    if (i === target) break
    if (++pops > 4e6 || f > limit) return null
    if (f - h(i) > g[i] + 1e-6) continue
    const x = i % GW, y = (i / GW) | 0
    for (const [dx, dy, d] of DIRS) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue
      const j = ny * GW + nx
      const c = cost[j]
      if (c === Infinity) continue
      const ng = g[i] + d * (c + cost[i]) * 0.5 + (river[j] && !river[i] ? 3 : 0)
      if (seen[j] === stamp && ng >= g[j]) continue
      seen[j] = stamp
      g[j] = ng
      from[j] = i
      push(ng + h(j), j)
    }
  }
  if (seen[target] !== stamp) return null
  const cells = []
  for (let i = target; i !== -1; i = from[i]) cells.push(i)
  return cells.reverse().map((i) => [((i % GW) + 0.5) * CELL, (Math.floor(i / GW) + 0.5) * CELL])
}
// упрощение ломаной (Дуглас — Пекер)
function simplify(pts, eps) {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1]
  const L = Math.hypot(bx - ax, by - ay) || 1
  let best = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L
    if (d > best) (best = d), (at = i)
  }
  if (best <= eps) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)]
}

let routed = 0, straight = 0
const t0 = Date.now()
for (const army of world.armies ?? []) {
  if (army.mapId !== wm.id) continue
  const wp = army.waypoints
  for (let n = 1; n < wp.length; n++) {
    delete wp[n].path
    const a = nearestLand(...cellOf(wp[n - 1].x, wp[n - 1].y)), b = nearestLand(...cellOf(wp[n].x, wp[n].y))
    const cells = a && b ? astar(a, b) : null
    const direct = Math.hypot(wp[n].x - wp[n - 1].x, wp[n].y - wp[n - 1].y)
    // нет пути по суше или он втрое длиннее прямой (за морем) — идём напрямую: флот или переправа
    let len = 0
    if (cells) for (let i = 1; i < cells.length; i++) len += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1])
    if (!cells || (direct > 40 && len > direct * 3)) { straight++; continue }
    const pts = simplify([[wp[n - 1].x, wp[n - 1].y], ...cells.slice(1, -1), [wp[n].x, wp[n].y]], CELL * 0.6).map(([x, y]) => [Math.round(x), Math.round(y)])
    if (pts.length > 2) wp[n].path = pts
    routed++
  }
}
writeFileSync(process.env.OUT ?? WORLD, JSON.stringify(world, null, 1)) // OUT — пробный прогон в другой файл
console.log(`Походы: отрезков по дорогам и местности ${routed}, напрямую (за море) ${straight}, ${((Date.now() - t0) / 1000).toFixed(1)} с`)
