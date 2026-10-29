// Генератор провинций в духе Paradox: тысячи провинций, вложенных в нынешние страны,
// с иерархией континент → регион → область → провинция, местностью, культурой и именами.
// Вход: source-maps/labels.bin (страны, из import-psd), source-maps/base-4096.png (местность).
// Выход: resources/default-world/maps/provinces.png (R·256+G = номер, B = местность), source-maps/provinces.bin,
//        world.json: provinces[], adminRegions[], карта мира получает provinceMap.
// Запуск: node --max-old-space-size=8192 scripts/provinces.mjs
import { readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { makeNamer, cultureOfState } from './lore/names.mjs'

const WORLD = 'resources/default-world/world.json'
const SCALE = 2
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const meta = JSON.parse(readFileSync('source-maps/labels.json', 'utf8'))
const W = meta.width, H = meta.height, N = W * H
const label = new Int16Array(readFileSync('source-maps/labels.bin').buffer.slice(0))
const stateIdByName = new Map(world.states.map((s) => [s.base.name, s.id]))
const t0 = Date.now()
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)

// ---------- местность ----------
// 1 равнины, 2 леса, 3 холмы, 4 горы, 5 снега, 6 пустыня
export const TERRAIN = ['море', 'равнины', 'леса', 'холмы', 'горы', 'снега', 'пустыня']
const baseImg = await sharp('source-maps/base-4096.png').removeAlpha().raw().toBuffer()
const C = 4
const CW = Math.ceil(W / C), CH = Math.ceil(H / C)
const coarse = new Uint8Array(CW * CH)
{
  const lum = new Float32Array(N)
  for (let i = 0; i < N; i++) lum[i] = 0.3 * baseImg[i * 3] + 0.59 * baseImg[i * 3 + 1] + 0.11 * baseImg[i * 3 + 2]
  for (let cy = 0; cy < CH; cy++)
    for (let cx = 0; cx < CW; cx++) {
      let r = 0, g = 0, b = 0, l = 0, l2 = 0, n = 0, land = 0
      for (let y = cy * C; y < Math.min(H, cy * C + C * 2); y++)
        for (let x = cx * C; x < Math.min(W, cx * C + C * 2); x++) {
          const i = y * W + x
          if (label[i] >= 0) land++
          r += baseImg[i * 3]; g += baseImg[i * 3 + 1]; b += baseImg[i * 3 + 2]
          l += lum[i]; l2 += lum[i] * lum[i]; n++
        }
      if (!land) continue
      r /= n; g /= n; b /= n; l /= n
      const sd = Math.sqrt(Math.max(0, l2 / n - l * l))
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
      const sat = mx ? (mx - mn) / mx : 0
      let t = 1
      const green = g > b + 6 && g >= r - 2
      if (l > 165 && sat < 0.2) t = 5
      else if (sd > 30 || (!green && b >= g - 2 && l < 100)) t = 4
      else if (r > g && r > b + 18 && l > 105 && sat > 0.22) t = 6
      else if ((green && l < 100) || (l < 80 && g >= b)) t = 2
      else if (sd > 20) t = 3
      coarse[cy * CW + cx] = t
    }
  // сглаживание: большинство в окне 3×3
  for (let pass = 0; pass < 2; pass++) {
    const copy = coarse.slice()
    for (let cy = 1; cy < CH - 1; cy++)
      for (let cx = 1; cx < CW - 1; cx++) {
        const i = cy * CW + cx
        if (!copy[i]) continue
        const cnt = new Uint8Array(7)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[copy[i + dy * CW + dx]]++
        let best = copy[i], bc = 0
        for (let k = 1; k < 7; k++) if (cnt[k] > bc) { bc = cnt[k]; best = k }
        coarse[i] = best
      }
  }
}
const terrainAt = (i) => coarse[Math.floor((i / W | 0) / C) * CW + Math.floor((i % W) / C)] || 1
log('местность')

// ---------- шум для извилистых границ ----------
function hash2(ix, iy, k) {
  let h = (ix * 374761393 + iy * 668265263 + k * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function noise(x, y, cell, k) {
  const gx = x / cell, gy = y / cell
  const ix = Math.floor(gx), iy = Math.floor(gy)
  const fx = gx - ix, fy = gy - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const v = (i, j) => hash2(ix + i, iy + j, k)
  return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy
}

// ---------- семена (Пуассоновский диск, плотность по местности) ----------
const RADIUS = [0, 22, 24, 27, 33, 46, 38]
let seed = 777
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
const seeds = [] // {x, y, s}
const HC = 64
const hash = new Map()
const hkey = (x, y) => (Math.floor(y / HC) * 1000 + Math.floor(x / HC))
function near(x, y, s, r) {
  for (let gy = Math.floor((y - r) / HC); gy <= Math.floor((y + r) / HC); gy++)
    for (let gx = Math.floor((x - r) / HC); gx <= Math.floor((x + r) / HC); gx++) {
      const arr = hash.get(gy * 1000 + gx)
      if (!arr) continue
      for (const q of arr) if (q.s === s && (q.x - x) ** 2 + (q.y - y) ** 2 < r * r) return true
    }
  return false
}
function addSeed(x, y, s) {
  const q = { x, y, s }
  seeds.push(q)
  const k = hkey(x, y)
  const arr = hash.get(k)
  if (arr) arr.push(q)
  else hash.set(k, [q])
}
{
  const cand = []
  for (let y = 1; y < H; y += 3) for (let x = 1; x < W; x += 3) if (label[y * W + x] >= 0) cand.push(y * W + x)
  for (let i = cand.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cand[i], cand[j]] = [cand[j], cand[i]]
  }
  for (const i of cand) {
    const x = i % W, y = (i / W) | 0, s = label[i]
    const r = RADIUS[terrainAt(i)]
    if (!near(x, y, s, r)) addSeed(x, y, s)
  }
  // каждый остров/анклав своей страны получает хотя бы одно семя
  const comp = new Int32Array(N).fill(-1)
  let cid = 0
  const q = new Int32Array(N)
  for (let st = 0; st < N; st++) {
    if (label[st] < 0 || comp[st] >= 0) continue
    let qh = 0, qt = 0, sx = 0, sy = 0
    q[qt++] = st; comp[st] = cid
    while (qh < qt) {
      const i = q[qh++]
      sx += i % W; sy += (i / W) | 0
      const x = i % W
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || comp[j] >= 0 || label[j] !== label[st]) continue
        comp[j] = cid; q[qt++] = j
      }
    }
    if (qt >= 12) {
      const cx = sx / qt, cy = sy / qt
      let has = false
      for (const s of seeds) if (s.s === label[st] && comp[s.y * W + s.x] === cid) { has = true; break }
      if (!has) {
        let best = st, bd = Infinity
        for (let k = 0; k < qt; k++) { const i = q[k]; const d = (i % W - cx) ** 2 + (((i / W) | 0) - cy) ** 2; if (d < bd) { bd = d; best = i } }
        addSeed(best % W, (best / W) | 0, label[st])
      }
    }
    cid++
  }
}
log(`семян: ${seeds.length}`)

// ---------- нарезка: кратчайшие пути с шумной ценой шага внутри своей страны ----------
const prov = new Int32Array(N).fill(-1)
{
  const dist = new Float32Array(N).fill(Infinity)
  let hk = new Float32Array(1 << 22), hv = new Int32Array(1 << 22), hn = 0
  const push = (k, v) => {
    if (hn >= hk.length) {
      const nk = new Float32Array(hk.length * 2); nk.set(hk); hk = nk
      const nv = new Int32Array(hv.length * 2); nv.set(hv); hv = nv
    }
    let i = hn++
    while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p }
    hk[i] = k; hv[i] = v
  }
  const pop = () => {
    const top = hv[0]
    const lk = hk[--hn], lv = hv[hn]
    let i = 0
    for (;;) {
      let c = 2 * i + 1
      if (c >= hn) break
      if (c + 1 < hn && hk[c + 1] < hk[c]) c++
      if (hk[c] >= lk) break
      hk[i] = hk[c]; hv[i] = hv[c]; i = c
    }
    hk[i] = lk; hv[i] = lv
    return top
  }
  const cost = (i) => {
    const x = i % W, y = (i / W) | 0
    return 1 + 1.4 * noise(x, y, 22, 5) + 0.6 * noise(x, y, 7, 9)
  }
  seeds.forEach((s, k) => { const i = s.y * W + s.x; dist[i] = 0; prov[i] = k; push(0, i) })
  while (hn) {
    const d0 = hk[0]
    const i = pop()
    if (d0 > dist[i]) continue
    const x = i % W
    const c = cost(i)
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || label[j] !== label[i]) continue
      const nd = d0 + c
      if (nd < dist[j]) { dist[j] = nd; prov[j] = prov[i]; push(nd, j) }
    }
  }
  // крошечные островки без семени — к ближайшей провинции через море
  const q = new Int32Array(N)
  let qh = 0, qt = 0
  const seen = new Uint8Array(N)
  for (let i = 0; i < N; i++) if (prov[i] >= 0) { q[qt++] = i; seen[i] = 1 }
  while (qh < qt) {
    const i = q[qh++]
    const x = i % W
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j < 0 || j >= N || seen[j]) continue
      seen[j] = 1
      if (label[j] >= 0) prov[j] = prov[i]
      q[qt++] = j
    }
  }
  for (let i = 0; i < N; i++) if (label[i] < 0) prov[i] = -1
}
log('нарезка')

// ---------- слияние крошек, перенумерация ----------
{
  for (let pass = 0; pass < 2; pass++) {
    const size = new Int32Array(seeds.length)
    for (let i = 0; i < N; i++) if (prov[i] >= 0) size[prov[i]]++
    const border = new Map() // мелкая -> Map(сосед -> длина)
    for (let i = 0; i < N; i++) {
      const p = prov[i]
      if (p < 0 || size[p] >= 70) continue
      const x = i % W
      for (const j of [x < W - 1 ? i + 1 : -1, i + W, x > 0 ? i - 1 : -1, i - W]) {
        if (j < 0 || j >= N) continue
        const q = prov[j]
        if (q < 0 || q === p || label[j] !== label[i]) continue
        let m = border.get(p)
        if (!m) border.set(p, (m = new Map()))
        m.set(q, (m.get(q) ?? 0) + 1)
      }
    }
    const to = new Int32Array(seeds.length).map((_, k) => k)
    for (const [p, m] of border) {
      let best = -1, bl = 0
      for (const [q, l] of m) if (l > bl && size[q] >= size[p]) { bl = l; best = q }
      if (best >= 0) to[p] = best
    }
    for (let i = 0; i < N; i++) if (prov[i] >= 0) prov[i] = to[prov[i]]
  }
}
const remap = new Map()
for (let i = 0; i < N; i++) if (prov[i] >= 0 && !remap.has(prov[i])) remap.set(prov[i], remap.size + 1)
for (let i = 0; i < N; i++) prov[i] = prov[i] >= 0 ? remap.get(prov[i]) : 0
const P = remap.size
log(`провинций: ${P}`)

// ---------- статистика провинций ----------
const px = new Int32Array(P + 1), sx = new Float64Array(P + 1), sy = new Float64Array(P + 1)
const terr = Array.from({ length: P + 1 }, () => new Int32Array(7))
const stateOf = new Int32Array(P + 1)
const neigh = Array.from({ length: P + 1 }, () => new Set())
for (let i = 0; i < N; i++) {
  const p = prov[i]
  if (!p) continue
  const x = i % W, y = (i / W) | 0
  px[p]++; sx[p] += x; sy[p] += y
  terr[p][terrainAt(i)]++
  stateOf[p] = label[i]
  if (x < W - 1 && prov[i + 1] && prov[i + 1] !== p) { neigh[p].add(prov[i + 1]); neigh[prov[i + 1]].add(p) }
  if (y < H - 1 && prov[i + W] && prov[i + W] !== p) { neigh[p].add(prov[i + W]); neigh[prov[i + W]].add(p) }
}
const terrainOf = (p) => { let b = 1, bc = -1; for (let k = 1; k < 7; k++) if (terr[p][k] > bc) { bc = terr[p][k]; b = k } return b }
const cx = (p) => sx[p] / px[p], cy = (p) => sy[p] / px[p]

// ---------- континенты ----------
const CONTINENTS = [
  ['c-lora', 'Лора', null],
  ['c-liza', 'Лиза', ['Джака', 'Кростфорд', 'Офир', 'Эль-Амур', 'Анастар', 'Кросчжас', 'Дзань Цинь', 'Ноксворд', 'Горы Века', 'Лангинат', 'Союз Северных Златайских Полисов', 'Златайское Княжество', 'Златайская Гетманщина', 'Содружество Златайских Общин', 'Дэодэсия', 'Орден Порядка', 'Углук', 'Королевство Норонадо', 'Дресфент', 'Симионы', 'Гидра', 'Хамелига', 'Южная Башня']],
  ['c-elza', 'Эльза', ['Орда', 'Хай-рок', 'Рогтер-зок', 'Крел-уру', 'Дрофтарруг', 'Рифлердер', 'Незерия', 'Кернуразог', "Клан Арк'ран", 'Клан Марф-Одр', 'Атьмук', 'Княжества Гротта', 'Азами Звездный Клюв', 'Алые Королевства', 'Империя Йота']],
  ['c-east', 'Восходные острова', ['Эльфборн', 'Сильвленд', "О'Ндар Хаэль", 'Великая Восточная Башня']],
  ['c-west', 'Закатные острова', ['Западная Яна', 'Восточная Яна', 'Лагоса', 'Одзукава', 'Ятаган']],
  ['c-holy', 'Святой архипелаг', ['Святая церковь', 'Пираты']],
  ['c-dark', 'Земли Тьмы', ['Пустошь Наллы', 'Церковь Тьмы']]
]
const continentOfState = new Map()
for (const [id, , list] of CONTINENTS) for (const n of list ?? []) continentOfState.set(n, id)
const contOf = (p) => continentOfState.get(meta.names[stateOf[p]]) ?? 'c-lora'
const cultureOf = (p) => cultureOfState(meta.names[stateOf[p]])

// ---------- области: ≈7 соседних провинций внутри страны ----------
const areaOf = new Int32Array(P + 1).fill(-1)
const areas = [] // {provinces: [], state}
{
  const byState = new Map()
  for (let p = 1; p <= P; p++) { const s = stateOf[p]; if (!byState.has(s)) byState.set(s, []); byState.get(s).push(p) }
  for (const [s, list] of byState) {
    const k = Math.max(1, Math.round(list.length / 7))
    // семена — дальние друг от друга провинции
    const centers = [list.reduce((a, b) => (px[a] > px[b] ? a : b))]
    while (centers.length < k) {
      let best = list[0], bd = -1
      for (const p of list) {
        const d = Math.min(...centers.map((c) => (cx(p) - cx(c)) ** 2 + (cy(p) - cy(c)) ** 2))
        if (d > bd) { bd = d; best = p }
      }
      centers.push(best)
    }
    const base = areas.length
    centers.forEach((c) => areas.push({ provinces: [], state: s }))
    // рост по соседству, чтобы области были цельными
    const queue = centers.map((c, i) => [c, base + i])
    for (const [c, a] of queue) areaOf[c] = a
    for (let qi = 0; qi < queue.length; qi++) {
      const [p, a] = queue[qi]
      for (const q of neigh[p]) if (stateOf[q] === s && areaOf[q] < 0) { areaOf[q] = a; queue.push([q, a]) }
    }
    for (const p of list)
      if (areaOf[p] < 0) {
        let best = 0, bd = Infinity
        centers.forEach((c, i) => { const d = (cx(p) - cx(c)) ** 2 + (cy(p) - cy(c)) ** 2; if (d < bd) { bd = d; best = i } })
        areaOf[p] = base + best
      }
    for (const p of list) areas[areaOf[p]].provinces.push(p)
  }
}
log(`областей: ${areas.length}`)

// ---------- регионы: ≈8 областей в пределах континента ----------
const regionOfArea = new Int32Array(areas.length).fill(-1)
const regions = [] // {areas: [], continent}
{
  const areaC = areas.map((a) => {
    let w = 0, x = 0, y = 0
    for (const p of a.provinces) { w += px[p]; x += sx[p]; y += sy[p] }
    return [x / w, y / w, contOf(a.provinces[0])]
  })
  for (const [cid] of CONTINENTS) {
    const list = areas.map((_, i) => i).filter((i) => areaC[i][2] === cid)
    if (!list.length) continue
    const k = Math.max(1, Math.round(list.length / 8))
    let centers = []
    centers.push([areaC[list[0]][0], areaC[list[0]][1]])
    while (centers.length < k) {
      let best = list[0], bd = -1
      for (const i of list) { const d = Math.min(...centers.map(([x, y]) => (areaC[i][0] - x) ** 2 + (areaC[i][1] - y) ** 2)); if (d > bd) { bd = d; best = i } }
      centers.push([areaC[best][0], areaC[best][1]])
    }
    const assign = new Map()
    for (let it = 0; it < 12; it++) {
      const sum = centers.map(() => [0, 0, 0])
      for (const i of list) {
        let b = 0, bd = Infinity
        centers.forEach(([x, y], c) => { const d = (areaC[i][0] - x) ** 2 + (areaC[i][1] - y) ** 2; if (d < bd) { bd = d; b = c } })
        assign.set(i, b)
        sum[b][0] += areaC[i][0]; sum[b][1] += areaC[i][1]; sum[b][2]++
      }
      centers = centers.map((c, i) => (sum[i][2] ? [sum[i][0] / sum[i][2], sum[i][1] / sum[i][2]] : c))
    }
    const base = regions.length
    centers.forEach(() => regions.push({ areas: [], continent: cid }))
    for (const i of list) { regionOfArea[i] = base + assign.get(i); regions[base + assign.get(i)].areas.push(i) }
  }
}
log(`регионов: ${regions.filter((r) => r.areas.length).length}`)

// ---------- имена ----------
const namer = makeNamer(20261029)
const provName = new Array(P + 1)
for (let p = 1; p <= P; p++) provName[p] = namer.province(cultureOf(p))
const adminRegions = CONTINENTS.map(([id, name]) => ({ id, level: 'continent', name, parentId: null }))
regions.forEach((r, i) => {
  if (!r.areas.length) return
  const cult = new Map()
  for (const a of r.areas) for (const p of areas[a].provinces) cult.set(cultureOf(p), (cult.get(cultureOf(p)) ?? 0) + px[p])
  const main = [...cult.entries()].sort((a, b) => b[1] - a[1])[0][0]
  adminRegions.push({ id: `r-${i}`, level: 'region', name: namer.region(main), parentId: r.continent, culture: main })
})
areas.forEach((a, i) => {
  const big = a.provinces.reduce((x, y) => (px[x] > px[y] ? x : y))
  adminRegions.push({ id: `a-${i}`, level: 'area', name: namer.area(cultureOf(big), provName[big]), parentId: `r-${regionOfArea[i]}`, culture: cultureOf(big) })
})

// ---------- запись ----------
const provinces = []
for (let p = 1; p <= P; p++) {
  const stName = meta.names[stateOf[p]]
  provinces.push({
    id: p,
    name: provName[p],
    px: px[p],
    x: Math.round(cx(p) * SCALE),
    y: Math.round(cy(p) * SCALE),
    state: stateIdByName.get(stName) ?? null,
    culture: cultureOf(p),
    terrain: terrainOf(p),
    areaId: `a-${areaOf[p]}`,
    neighbors: [...neigh[p]],
    owners: [[null, stateIdByName.get(stName) ?? null]]
  })
}
world.provinces = provinces
world.adminRegions = adminRegions
const wm = world.maps.find((m) => m.id === 'world')
wm.provinceMap = 'maps/provinces.png'
writeFileSync(WORLD, JSON.stringify(world, null, 1))
writeFileSync('source-maps/provinces.bin', Buffer.from(new Uint16Array(prov).buffer))

const img = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  const p = prov[i]
  if (!p) continue
  img[i * 4] = p >> 8
  img[i * 4 + 1] = p & 255
  img[i * 4 + 2] = terrainAt(i)
  img[i * 4 + 3] = 255
}
await sharp(img, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile('resources/default-world/maps/provinces.png')
log(`готово: ${P} провинций, ${areas.length} областей, ${regions.filter((r) => r.areas.length).length} регионов, ${CONTINENTS.length} континентов`)
