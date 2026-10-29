// Импорт карты из PSD: подложка (слой «Слой 0»), государства (слои группы «Политика/Цвета»)
// и подписи (текстовые слои группы «Название») -> resources/default-world.
// Использование: node scripts/import-psd.mjs [путь.psd] [--debug отладка.png]
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import { readPsd, initializeCanvas } from 'ag-psd'

// Холст не нужен: ag-psd создаёт ImageData через «холст», подсовываем минимальную заглушку
const imageData = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) })
initializeCanvas(() => ({ getContext: () => ({ createImageData: imageData }) }))

const PSD_PATH = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'source-maps/political.psd'
const WORLD = 'resources/default-world/world.json'
const BASE_SRC = 'source-maps/base-4096.png'
// Логические координаты карты мира = пиксели PSD × 2
const SCALE = 2
const SIMPLIFY = 0.9 // допуск упрощения границ, в пикселях PSD
const MIN_PIXELS = 25

const debugIdx = process.argv.indexOf('--debug')
const debugOut = debugIdx > 0 ? process.argv[debugIdx + 1] : null

const psd = readPsd(readFileSync(PSD_PATH), { useImageData: true, skipCompositeImageData: true, skipThumbnail: true })
const W = psd.width
const H = psd.height
const N = W * H
const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim()
const find = (layers, name) => layers?.find((l) => norm(l.name) === name)

// ---------- подложка ----------
const baseLayer = find(psd.children, 'Слой 0')
{
  const d = baseLayer.imageData
  await sharp(Buffer.from(d.data.buffer), { raw: { width: d.width, height: d.height, channels: 4 } })
    .removeAlpha()
    .png()
    .toFile(BASE_SRC)
  console.log(`Подложка: ${BASE_SRC} (${d.width}×${d.height})`)
}

// ---------- государства ----------
const politics = find(psd.children, 'Политика')
const colors = find(politics.children, 'Цвета')
// Безымянные слои и опечатки в именах слоёв -> правильные названия
const RENAME = {
  'Слой 5': 'Семья Каяя',
  'Королевство': 'Королевство Болетария',
  'Кальтранская': 'Кальтранская Республика',
  'Орден': 'Орден Порядка',
  'Имперсике Изгнаники': 'Имперские Изгнанники',
  'Королество Темерия': 'Королевство Темерия',
  'Алое Королевства': 'Алые Королевства',
  'Великая Востояная Башня': 'Великая Восточная Башня',
  'Содружество Злайтайских Общин': 'Содружество Златайских Общин',
  'Клан Арк"ран': "Клан Арк'ран",
  'Империя Кагай': 'Империя Кагия'
}
// Слои, внутри которых другим цветом нарисована отдельная страна
const SPLIT = { 'Княжества Гротта': { rgb: [216, 200, 8], name: 'Клан Марф-Одр' } }
// Страны без закрашенного слоя: выделяем сушу острова под подписью (точка в пикселях PSD)
const ISLANDS = { 'Братство Бездны': [2006, 112] }

// Прежние id стран (по старому и новому имени), чтобы не ломать ссылки в мирах пользователей
const prevWorld = JSON.parse(readFileSync(WORLD, 'utf8'))
const prevIds = new Map(prevWorld.states.map((st) => [st.base.name, st.id]))
const prevRegionIds = new Map(prevWorld.regions.map((r) => [r.name, r.id]))

const label = new Int16Array(N).fill(-1)
const states = []
const addState = (name, oldName, box) => {
  states.push({ name, oldName, sum: [0, 0, 0, 0], box })
  return states.length - 1
}
for (const layer of colors.children) {
  const d = layer.imageData
  if (!d || layer.right - layer.left < 2) continue
  const raw = norm(layer.name)
  const s = addState(RENAME[raw] ?? raw, raw, [layer.left, layer.top, layer.right, layer.bottom])
  const split = SPLIT[raw]
  const s2 = split ? addState(split.name, split.name, [layer.left, layer.top, layer.right, layer.bottom]) : -1
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const k = (y * d.width + x) * 4
      if (d.data[k + 3] < 128) continue
      const X = x + layer.left, Y = y + layer.top
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      const own =
        split && Math.abs(d.data[k] - split.rgb[0]) + Math.abs(d.data[k + 1] - split.rgb[1]) + Math.abs(d.data[k + 2] - split.rgb[2]) < 60 ? s2 : s
      label[Y * W + X] = own // верхние слои перекрывают нижние
      const sum = states[own].sum
      sum[0] += d.data[k]; sum[1] += d.data[k + 1]; sum[2] += d.data[k + 2]; sum[3]++
    }
}
{
  const bd = baseLayer.imageData
  for (const [name, [sx, sy]] of Object.entries(ISLANDS)) {
    const s = addState(name, name, [sx - 200, sy - 120, sx + 200, sy + 120])
    const isLand = (x, y) => {
      const k = (y * bd.width + x) * 4
      return bd.data[k] > bd.data[k + 1] && bd.data[k] > bd.data[k + 2] + 12
    }
    const stack = [[sx, sy]]
    const seen = new Set([sy * W + sx])
    while (stack.length) {
      const [x, y] = stack.pop()
      if (label[y * W + x] === -1) label[y * W + x] = s
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (Math.abs(nx - sx) > 200 || Math.abs(ny - sy) > 120 || nx < 0 || ny < 0) continue
        const key = ny * W + nx
        if (seen.has(key) || !isLand(nx, ny)) continue
        seen.add(key)
        stack.push([nx, ny])
      }
    }
    states[s].sum = [140, 60, 70, 1] // тёмно-бордовый для Братства Бездны
  }
}
for (const st of states) st.color = st.sum[3] ? [st.sum[0] / st.sum[3], st.sum[1] / st.sum[3], st.sum[2] / st.sum[3]] : [128, 128, 128]

const nb4 = (i) => {
  const x = i % W
  return [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W >= 0 ? i - W : -1, i + W < N ? i + W : -1]
}

// закрываем щели сглаживания между соседними слоями: 2 прохода наращивания
for (let pass = 0; pass < 2; pass++) {
  const next = label.slice()
  for (let i = 0; i < N; i++) {
    if (label[i] !== -1) continue
    const votes = new Map()
    for (const j of nb4(i)) if (j >= 0 && label[j] >= 0) votes.set(label[j], (votes.get(label[j]) ?? 0) + 1)
    let best = -1, bc = 0
    for (const [k, c] of votes) if (c > bc) { best = k; bc = c }
    if (bc >= 2) next[i] = best
  }
  label.set(next)
}

// убираем мелкие крошки (обрывки кисти) — отдаём соседу или морю
{
  const seen = new Uint8Array(N)
  for (let start = 0; start < N; start++) {
    if (seen[start] || label[start] < 0) continue
    const s = label[start]
    const comp = [start]
    seen[start] = 1
    for (let k = 0; k < comp.length; k++)
      for (const j of nb4(comp[k])) if (j >= 0 && !seen[j] && label[j] === s) { seen[j] = 1; comp.push(j) }
    if (comp.length >= MIN_PIXELS) continue
    const around = new Map()
    for (const i of comp) for (const j of nb4(i)) if (j >= 0 && label[j] >= 0 && label[j] !== s) around.set(label[j], (around.get(label[j]) ?? 0) + 1)
    let best = -1, bc = 0
    for (const [k, c] of around) if (c > bc) { best = k; bc = c }
    for (const i of comp) label[i] = best
  }
}

// растровая раскладка стран — для расчёта исторических границ (scripts/history-borders.mjs)
writeFileSync('source-maps/labels.bin', Buffer.from(label.buffer))
writeFileSync('source-maps/labels.json', JSON.stringify({ width: W, height: H, names: states.map((s) => s.name) }))

// ---------- обход границ по рёбрам пикселей ----------
const lab = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : label[y * W + x])

function isJunction(x, y) {
  const a = lab(x - 1, y - 1), b = lab(x, y - 1), c = lab(x - 1, y), d = lab(x, y)
  const set = new Set([a, b, c, d])
  if (set.size >= 3) return true
  return set.size === 2 && a === d && b === c
}

function traceLabel(s, [x0, y0, x1, y1]) {
  const out = new Map()
  const add = (ax, ay, bx, by) => {
    const k = ax * 100000 + ay
    const arr = out.get(k)
    if (arr) arr.push([bx, by])
    else out.set(k, [[bx, by]])
  }
  for (let y = Math.max(0, y0 - 4); y < Math.min(H, y1 + 4); y++)
    for (let x = Math.max(0, x0 - 4); x < Math.min(W, x1 + 4); x++) {
      if (label[y * W + x] !== s) continue
      if (lab(x, y - 1) !== s) add(x + 1, y, x, y)
      if (lab(x, y + 1) !== s) add(x, y + 1, x + 1, y + 1)
      if (lab(x - 1, y) !== s) add(x, y, x, y + 1)
      if (lab(x + 1, y) !== s) add(x + 1, y + 1, x + 1, y)
    }
  const loops = []
  for (const [startKey] of out) {
    while (out.get(startKey)?.length) {
      const sx = Math.floor(startKey / 100000), sy = startKey % 100000
      const loop = [[sx, sy]]
      let px = sx, py = sy
      let prev = null
      for (;;) {
        const arr = out.get(px * 100000 + py)
        if (!arr || !arr.length) break
        let idx = 0
        if (arr.length > 1 && prev) {
          const left = [-prev[1], prev[0]]
          const li = arr.findIndex(([nx, ny]) => nx - px === left[0] && ny - py === left[1])
          if (li >= 0) idx = li
        }
        const [nx, ny] = arr.splice(idx, 1)[0]
        prev = [nx - px, ny - py]
        px = nx; py = ny
        if (px === sx && py === sy) break
        loop.push([px, py])
      }
      if (loop.length >= 4) loops.push(loop)
    }
  }
  return loops
}

function signedArea(r) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1])
  return a / 2
}

function dp(points, eps) {
  if (points.length <= 2) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a], [bx, by] = points[b]
    const dx = bx - ax, dy = by - ay
    const len = Math.hypot(dx, dy) || 1
    let best = -1, bi = -1
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + bx * ay - by * ax) / len
      if (d > best) { best = d; bi = i }
    }
    if (best > eps) {
      keep[bi] = 1
      stack.push([a, bi], [bi, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

// Упрощаем по отрезкам между «развилками», чтобы общая граница двух стран совпадала
function simplifyRing(ring) {
  const n = ring.length
  const fixed = []
  for (let i = 0; i < n; i++) if (isJunction(ring[i][0], ring[i][1])) fixed.push(i)
  if (fixed.length < 2) {
    const half = Math.floor(n / 2)
    return [...dp(ring.slice(0, half + 1), SIMPLIFY).slice(0, -1), ...dp([...ring.slice(half), ring[0]], SIMPLIFY).slice(0, -1)]
  }
  const res = []
  for (let k = 0; k < fixed.length; k++) {
    const a = fixed[k], b = fixed[(k + 1) % fixed.length]
    const seg = b > a ? ring.slice(a, b + 1) : [...ring.slice(a), ...ring.slice(0, b + 1)]
    res.push(...dp(seg, SIMPLIFY).slice(0, -1))
  }
  return res
}

// ---------- подписи из текстовых слоёв ----------
const names = find(psd.children, 'Название')
const labels = new Map()
for (const t of names?.children ?? []) {
  const name = norm(t.name)
  const tr = t.text?.transform ?? [1, 0, 0, 1, 0, 0]
  const scale = Math.hypot(tr[0], tr[1])
  const angle = (Math.atan2(tr[1], tr[0]) * 180) / Math.PI
  const fontSize = (t.text?.style?.fontSize ?? 24) * scale
  labels.set(name, {
    x: ((t.left + t.right) / 2) * SCALE,
    y: ((t.top + t.bottom) / 2) * SCALE,
    angle: Math.round(angle * 10) / 10,
    size: Math.round(fontSize * SCALE * 10) / 10,
    text: norm(t.text?.text ?? name).replace(/\r/g, ' '),
    box: [t.left, t.top, t.right, t.bottom]
  })
}

// ---------- сборка мира ----------
const world = prevWorld
const hex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
const outStates = []
const outRegions = []
const unmatched = new Set(labels.keys())
states.forEach((st, s) => {
  const loops = traceLabel(s, st.box)
  if (!loops.length) return
  const sorted = loops.map((l) => ({ l, a: signedArea(l) })).sort((a, b) => Math.abs(b.a) - Math.abs(a.a))
  const outerSign = Math.sign(sorted[0].a)
  const rings = sorted
    .filter((x) => Math.sign(x.a) === outerSign && Math.abs(x.a) >= MIN_PIXELS)
    .map((x) => simplifyRing(x.l).map(([px, py]) => [px * SCALE, py * SCALE]))
    .filter((r) => r.length >= 3)
  if (!rings.length) return
  // подпись: по имени, иначе — текстовый слой, центр которого внутри страны
  let lb = labels.get(st.name) ?? labels.get(st.oldName)
  if (!lb) {
    for (const [n, l] of labels) {
      const cx = Math.round((l.box[0] + l.box[2]) / 2), cy = Math.round((l.box[1] + l.box[3]) / 2)
      if (lab(cx, cy) === s && unmatched.has(n)) { lb = l; break }
    }
  }
  if (lb) for (const [n, l] of labels) if (l === lb) unmatched.delete(n)
  const id = prevIds.get(st.name) ?? prevIds.get(st.oldName) ?? randomUUID().slice(0, 10)
  const name = st.name
  outStates.push({
    id,
    base: {
      name, fullName: '', color: `#${hex(st.color[0])}${hex(st.color[1])}${hex(st.color[2])}`, flag: '', motto: '', ruler: '', rulerTitle: '',
      rulerId: '', government: '', ideology: '', religion: '', religionId: '', capitalId: '', population: '', army: '', navy: '', economy: '',
      treasury: '', laws: '', culture: '', languages: '', stability: 50, description: '', dynastyId: '', overlordId: '', diplomacy: '', customFields: []
    },
    history: [],
    factions: [],
    from: null,
    to: null,
    label: lb ? { x: lb.x, y: lb.y, angle: lb.angle, size: lb.size } : undefined
  })
  outRegions.push({ id: prevRegionIds.get(name) ?? prevRegionIds.get(st.oldName) ?? randomUUID().slice(0, 10), mapId: 'world', name, rings, owners: [{ date: null, stateId: id }], from: null, to: null })
  console.log(`${name.padEnd(36)} точек: ${String(rings.reduce((a, r) => a + r.length, 0)).padStart(5)}  подпись: ${lb ? `${lb.angle}° ${lb.size}` : '—'}`)
})

const worldMap = world.maps.find((m) => m.id === 'world')
Object.assign(worldMap, { image: 'maps/base.webp', width: W * SCALE, height: H * SCALE })
world.states = outStates
world.regions = outRegions
writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Записано: ${outStates.length} государств. Подписи без страны: ${[...unmatched].join(', ') || 'нет'}`)

if (debugOut) {
  const img = Buffer.alloc(N * 3)
  for (let i = 0; i < N; i++) {
    const s = label[i]
    if (s < 0) { img[i * 3 + 2] = 40; continue }
    const c = states[s].color
    img[i * 3] = c[0]; img[i * 3 + 1] = c[1]; img[i * 3 + 2] = c[2]
  }
  mkdirSync('source-maps', { recursive: true })
  await sharp(img, { raw: { width: W, height: H, channels: 3 } }).resize(2048).png().toFile(debugOut)
}
