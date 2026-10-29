// Данные рельефа для шейдера: R — высота, G — класс местности ×40, B — реки, A — суша.
// И поселения: у каждой провинции — своё поселение-столица в удобной точке (порт — у берега).
// Запуск после provinces.mjs: node --max-old-space-size=8192 scripts/terrain.mjs
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const WORLD = 'resources/default-world/world.json'
const SCALE = 2
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const { data: pimg, info } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, N = W * H
const prov = new Uint16Array(N)
const cls = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  if (!pimg[i * 4 + 3]) continue
  prov[i] = (pimg[i * 4] << 8) | pimg[i * 4 + 1]
  cls[i] = pimg[i * 4 + 2]
}
const base = await sharp('source-maps/base-4096.png').removeAlpha().raw().toBuffer()
const t0 = Date.now()
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)

// ---------- высоты ----------
const CLASS_H = [0, 40, 52, 95, 175, 215, 44]
const lum = new Float32Array(N)
for (let i = 0; i < N; i++) lum[i] = 0.3 * base[i * 3] + 0.59 * base[i * 3 + 1] + 0.11 * base[i * 3 + 2]
const coarseH = new Float32Array(N)
for (let i = 0; i < N; i++) coarseH[i] = prov[i] ? CLASS_H[cls[i]] : -20
async function blur(arr, sigma) {
  // sharp размывает 16-битные изображения — переводим высоты в 16 бит и обратно
  const u16 = new Uint16Array(N)
  let mn = Infinity, mx = -Infinity
  for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v }
  for (let i = 0; i < N; i++) u16[i] = Math.round(((arr[i] - mn) / (mx - mn || 1)) * 65535)
  const res = await sharp(Buffer.from(u16.buffer), { raw: { width: W, height: H, channels: 1 } }).toColourspace('grey16').blur(sigma).raw({ depth: 'ushort' }).toBuffer()
  const r = new Uint16Array(res.buffer, res.byteOffset, N)
  const o = new Float32Array(N)
  for (let i = 0; i < N; i++) o[i] = mn + (r[i] / 65535) * (mx - mn)
  return o
}
const smooth = await blur(coarseH, 14)
const lumBlur = await blur(lum, 4)
const height = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  if (!prov[i]) continue
  const rugged = cls[i] === 4 || cls[i] === 5 ? 0.9 : cls[i] === 3 ? 0.5 : 0.18
  const h = smooth[i] + (lum[i] - lumBlur[i]) * rugged
  height[i] = Math.max(1, Math.min(255, Math.round(h)))
}
log('высоты')

// ---------- реки: светло-голубые линии на суше ----------
const river = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  if (!prov[i]) continue
  const r = base[i * 3], g = base[i * 3 + 1], b = base[i * 3 + 2]
  if (b > r + 22 && g > r + 8 && lum[i] > 95 && b > 110) river[i] = 255
}
{
  // убрать одиночные точки
  const copy = river.slice()
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      if (!copy[i]) continue
      let n = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (copy[i + dy * W + dx]) n++
      if (n < 3) river[i] = 0
    }
}
log('реки')

const out = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  out[i * 4] = height[i]
  out[i * 4 + 1] = prov[i] ? cls[i] * 40 : 0
  out[i * 4 + 2] = river[i]
  out[i * 4 + 3] = prov[i] ? 255 : 0
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile('resources/default-world/maps/terrain.png')
log('terrain.png')

// ---------- поселения ----------
// расстояние до края провинции (до чужого пикселя или моря) — поселение ставим в самую «глубокую» точку
const depth = new Int32Array(N).fill(-1)
const q = new Int32Array(N)
let qh = 0, qt = 0
const coastal = new Uint8Array(65536)
for (let i = 0; i < N; i++) {
  if (!prov[i]) continue
  const x = i % W
  let edge = false
  for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
    if (j < 0 || j >= N) continue
    if (prov[j] !== prov[i]) edge = true
    if (!prov[j]) coastal[prov[i]] = 1
  }
  if (edge) { depth[i] = 0; q[qt++] = i }
}
while (qh < qt) {
  const i = q[qh++]
  const x = i % W
  for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
    if (j < 0 || j >= N || !prov[j] || depth[j] >= 0 || prov[j] !== prov[i]) continue
    depth[j] = depth[i] + 1
    q[qt++] = j
  }
}
const P = world.provinces.length
const best = new Int32Array(P + 1).fill(-1)
const bestScore = new Float32Array(P + 1).fill(-Infinity)
const coastBest = new Int32Array(P + 1).fill(-1)
const coastScore = new Float32Array(P + 1).fill(-Infinity)
const byId = new Map(world.provinces.map((p) => [p.id, p]))
for (let i = 0; i < N; i++) {
  const id = prov[i]
  if (!id) continue
  const p = byId.get(id)
  const x = i % W, y = (i / W) | 0
  const dc = Math.hypot(x - p.x / SCALE, y - p.y / SCALE)
  const s = depth[i] * 2 - dc * 0.15
  if (s > bestScore[id]) { bestScore[id] = s; best[id] = i }
  // для порта: точка в 3–5 пикселях от моря, поближе к центру
  if (coastal[id] && depth[i] >= 3 && depth[i] <= 6) {
    let nearSea = false
    for (let d = 1; d <= 6 && !nearSea; d++)
      for (const j of [i - d, i + d, i - d * W, i + d * W]) if (j >= 0 && j < N && !prov[j]) nearSea = true
    if (nearSea) {
      const cs = -dc
      if (cs > coastScore[id]) { coastScore[id] = cs; coastBest[id] = i }
    }
  }
}

let seed = 4242
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const areaCap = new Map()
const regionCap = new Map()
const areaParent = new Map(world.adminRegions.filter((a) => a.level === 'area').map((a) => [a.id, a.parentId]))
for (const p of world.provinces) {
  const a = areaCap.get(p.areaId)
  if (!a || p.px > a.px) areaCap.set(p.areaId, p)
  const r = areaParent.get(p.areaId)
  const rc = regionCap.get(r)
  if (!rc || p.px > rc.px) regionCap.set(r, p)
}
const userPlaces = world.places.filter((pl) => pl.mapId === 'world')
const counts = {}
for (const p of world.provinces) {
  const isRegionCap = regionCap.get(areaParent.get(p.areaId)) === p
  const isAreaCap = areaCap.get(p.areaId) === p
  const coast = coastal[p.id] && coastBest[p.id] >= 0
  let type = 'village'
  if (isRegionCap) type = coast && rnd() < 0.5 ? 'port' : 'city'
  else if (isAreaCap) type = coast && rnd() < 0.55 ? 'port' : p.terrain === 3 || p.terrain === 4 ? 'castle' : 'town'
  else {
    const r = rnd()
    if (coast && r < 0.35) type = 'fishing'
    else if ((p.terrain === 4 || p.terrain === 5) && r < 0.25) type = 'castle'
    else if (r < 0.03) type = 'temple'
    else if (r < 0.045) type = 'ruins'
    else if (r < 0.055) type = 'tower'
  }
  const at = type === 'port' || type === 'fishing' ? coastBest[p.id] : best[p.id]
  const i = at >= 0 ? at : best[p.id]
  const sx = ((i % W) + 0.5) * SCALE
  const sy = (((i / W) | 0) + 0.5) * SCALE
  // важные места автора уже стоят в этой провинции — своё поселение не дублируем
  const dup = userPlaces.some((pl) => Math.hypot(pl.x - sx, pl.y - sy) < 90)
  p.settlement = dup ? null : { type, x: Math.round(sx), y: Math.round(sy) }
  p.coastal = Boolean(coastal[p.id])
  counts[type] = (counts[type] ?? 0) + 1
}
const wm = world.maps.find((m) => m.id === 'world')
// terrain.png теперь нужен только для render-map.mjs (маска рек)
writeFileSync(WORLD, JSON.stringify(world, null, 1))
log(`поселения: ${JSON.stringify(counts)}`)
