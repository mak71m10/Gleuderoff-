// Реки как на настоящих картах: векторные линии вместо «сарделек».
// Та же гидрология (scripts/hydro.mjs), но русло — плавная линия по стоку:
// у истока толщиной в волос, к устью шире (ширина ~ логарифм водосбора), без каймы.
// Пишет source-maps/rivers.json ({ T, lines: [[x,y,hw, x,y,hw, ...], ...] } в пикселях 4096×2336)
// и source-maps/lakes.png (маска озёр). Их читает scripts/render-map.mjs.
// Запуск: node --max-old-space-size=8192 scripts/rivers-vector.mjs
import { writeFileSync } from 'fs'
import sharp from 'sharp'
import { hydro } from './hydro.mjs'

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
const CLASS_H = [0, 40, 52, 95, 175, 215, 44]
const lum = new Float32Array(N)
for (let i = 0; i < N; i++) lum[i] = 0.3 * base[i * 3] + 0.59 * base[i * 3 + 1] + 0.11 * base[i * 3 + 2]
const coarseH = new Float32Array(N)
for (let i = 0; i < N; i++) coarseH[i] = prov[i] ? CLASS_H[cls[i]] : -20
async function blur(arr, sigma) {
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
const guide = new Uint8Array(N)
for (let i = 0; i < N; i++) {
  if (!prov[i]) continue
  const r = base[i * 3], g = base[i * 3 + 1], b = base[i * 3 + 2]
  if ((b > r + 22 && g > r + 8 && lum[i] > 95 && b > 110) || (g > r + 15 && b > r + 8 && g > 70 && b > 100)) guide[i] = 1
}
const hy = hydro({ W, H, prov, cls, smooth, guide })
const { flow, acc, lake } = hy
const T = 4000

// ---------- граф русел ----------
const isR = (i) => i >= 0 && prov[i] && acc[i] >= T
const up = new Int32Array(N).fill(-1) // главный приток (с самым большим водосбором)
const nUp = new Uint8Array(N)
const accs = []
for (let i = 0; i < N; i++) {
  if (!isR(i)) continue
  accs.push(acc[i])
  const d = flow[i]
  if (d >= 0 && isR(d)) { nUp[d]++; if (up[d] < 0 || acc[i] > acc[up[d]]) up[d] = i }
}
accs.sort((a, b) => a - b)
const pc = (p) => Math.round(accs[Math.min(accs.length - 1, Math.floor(p * accs.length))])
console.log('клеток русел', accs.length, 'acc p50', pc(0.5), 'p90', pc(0.9), 'p99', pc(0.99), 'max', pc(1))

// ширина (полуширина в пикселях исходника): у истока ~0.1, крупное устье ~1.6
const hwOf = (a) => Math.min(1.7, 0.1 + 0.16 * Math.log2(Math.max(1, a / T)))

// линии: от каждого истока или от каждого «бокового» притока вниз, пока остаёмся главным притоком
const raw = []
for (let i = 0; i < N; i++) {
  if (!isR(i)) continue
  if (nUp[i] !== 0) continue // линия начинается у истока; боковой приток — исток своей линии
  const pts = []
  let c = i
  for (;;) {
    pts.push(c)
    const d = flow[c]
    if (d < 0 || !isR(d)) break // море
    if (up[d] !== c) { pts.push(d); break } // впадает в более крупную реку
    c = d
  }
  raw.push(pts)
}
{
  const cov = new Uint8Array(N)
  for (const l of raw) for (const c of l) cov[c] = 1
  let miss = 0
  for (let i = 0; i < N; i++) if (isR(i) && !cov[i]) miss++
  console.log('линий', raw.length, 'непокрытых клеток', miss)
}

// ---------- сглаживание ----------
function hash(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x, y, cell, s) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell)
  const fx = x / cell - gx, fy = y / cell - gy
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy)
  const a = hash(gx, gy, s), b = hash(gx + 1, gy, s), c = hash(gx, gy + 1, s), d = hash(gx + 1, gy + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
// общее для всех линий поле смещений — места слияния смещаются одинаково и не расходятся
const warp = (x, y) => [
  (vnoise(x, y, 40, 11) - 0.5) * 5 + (vnoise(x, y, 13, 12) - 0.5) * 2,
  (vnoise(x, y, 40, 21) - 0.5) * 5 + (vnoise(x, y, 13, 22) - 0.5) * 2,
]
function chaikin(p, n) {
  for (let it = 0; it < n; it++) {
    if (p.length < 3) return p
    const q = [p[0]]
    for (let k = 0; k < p.length - 1; k++) {
      const a = p[k], b = p[k + 1]
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25])
      q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75])
    }
    q.push(p[p.length - 1])
    p = q
  }
  return p
}
const STEP = 3
const lines = raw.map((cells) => {
  const sel = []
  for (let k = 0; k < cells.length; k += STEP) sel.push(cells[k])
  if (sel[sel.length - 1] !== cells[cells.length - 1]) sel.push(cells[cells.length - 1])
  let p = sel.map((c) => {
    const x = c % W, y = (c / W) | 0
    const [wx, wy] = warp(x, y)
    return [x + wx, y + wy, hwOf(acc[c])]
  })
  p = chaikin(p, 3)
  // исток — сходит на нет
  if (p.length > 2) p[0][2] = 0
  return p
})
// устье притока — точно на линию реки, в которую он впадает
{
  const owner = new Int32Array(N).fill(-1)
  const isJ = (cells) => cells.length >= 2 && up[cells[cells.length - 1]] !== cells[cells.length - 2]
  raw.forEach((cells, li) => { const n = cells.length - (isJ(cells) ? 1 : 0); for (let k = 0; k < n; k++) owner[cells[k]] = li })
  raw.forEach((cells, li) => {
    if (!isJ(cells)) return
    const pl = owner[cells[cells.length - 1]]
    if (pl < 0 || pl === li) return
    const p = lines[li], q = lines[pl]
    const e = p[p.length - 1]
    let best = Infinity, bi = 0
    for (let k = 0; k < q.length; k++) { const dx = q[k][0] - e[0], dy = q[k][1] - e[1], d = dx * dx + dy * dy; if (d < best) { best = d; bi = k } }
    p[p.length - 1] = [q[bi][0], q[bi][1], Math.min(e[2], q[bi][2])]
  })
}
const out = lines.filter((p) => p.length >= 2).map((p) => p.flatMap((v) => [+v[0].toFixed(2), +v[1].toFixed(2), +v[2].toFixed(3)]))
writeFileSync('source-maps/rivers.json', JSON.stringify({ W, H, T, lines: out }))
const lk = Buffer.alloc(N)
for (let i = 0; i < N; i++) lk[i] = lake[i] ? 255 : 0
await sharp(lk, { raw: { width: W, height: H, channels: 1 } }).png().toFile('source-maps/lakes.png')
let np = 0; for (const l of out) np += l.length / 3
console.log('записано линий', out.length, 'точек', np)
