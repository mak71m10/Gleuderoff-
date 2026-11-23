// Связи соседних провинций для калькулятора походов (marches.ts): дорога между ними (мощёный тракт, грунтовка, тропа)
// и река на границе без моста (малая, средняя, большая). Пишет provinces[].links = { [соседId]: 'p'|'d'|'t'|'r1'|'r2'|'r3' }.
// Вход: source-maps/provinces.bin (номер провинции на клетку 4096×2336, мир = клетка × 2), roads.json (мир), rivers.json (клетки).
// Запуск: node scripts/province-links.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
const GW = 4096, GH = 2336, SCALE = 2
const prov = new Uint16Array(readFileSync('source-maps/provinces.bin').buffer.slice(0))
const at = (gx, gy) => (gx < 0 || gy < 0 || gx >= GW || gy >= GH ? 0 : prov[Math.floor(gy) * GW + Math.floor(gx)])
const byId = new Map(W.provinces.map((p) => [p.id, p]))
const isNb = (a, b) => byId.get(a)?.neighbors?.includes(b)
const links = new Map() // id → Map(соседId → код)
const put = (a, b, code, better) => {
  for (const [x, y] of [[a, b], [b, a]]) {
    const m = links.get(x) ?? links.set(x, new Map()).get(x)
    const cur = m.get(y)
    if (!cur || better(code, cur)) m.set(y, code)
  }
}
const ROAD_RANK = { p: 3, d: 2, t: 1 }
const roadBetter = (c, cur) => (ROAD_RANK[c] ?? 0) > (ROAD_RANK[cur] ?? 0)

// ---- дороги: идём по линии, смена провинции между соседями — дорога между ними ----
const CODE = { paved: 'p', dirt: 'd', trail: 't' }
let nRoad = 0
for (const r of JSON.parse(readFileSync('source-maps/roads.json', 'utf8'))) {
  const code = CODE[r.type] ?? 'd'
  let prev = 0
  for (let n = 1; n < r.pts.length; n++) {
    const [ax, ay] = r.pts[n - 1], [bx, by] = r.pts[n]
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5))
    for (let s = 0; s <= steps; s++) {
      const id = at((ax + ((bx - ax) * s) / steps) / SCALE, (ay + ((by - ay) * s) / steps) / SCALE)
      if (!id) continue
      if (prev && id !== prev && isNb(prev, id)) { put(prev, id, code, roadBetter); nRoad++ }
      prev = id
    }
  }
}

// ---- реки: у каждой точки реки — провинции в окне 5×5; соседние пары по разные берега разделены рекой ----
const riverBetter = (c, cur) => !ROAD_RANK[cur] && c > cur
const rivers = JSON.parse(readFileSync('source-maps/rivers.json', 'utf8'))
let nRiver = 0
for (const l of rivers.lines) {
  for (let i = 0; i + 2 < l.length; i += 3) {
    const x = l[i], y = l[i + 1], w = l[i + 2]
    if (w < 0.25) continue // ручьи не мешают
    const size = w >= 0.75 ? 3 : w >= 0.45 ? 2 : 1
    const ids = new Set()
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const id = at(x + dx, y + dy); if (id) ids.add(id) }
    if (ids.size < 2) continue
    const arr = [...ids]
    for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) {
      if (!isNb(arr[a], arr[b])) continue
      // река только там, где нет дороги (на дороге — мост или брод)
      const cur = links.get(arr[a])?.get(arr[b])
      if (cur && ROAD_RANK[cur]) continue
      put(arr[a], arr[b], `r${size}`, riverBetter); nRiver++
    }
  }
}

let withLinks = 0
for (const p of W.provinces) {
  const m = links.get(p.id)
  if (m?.size) { p.links = Object.fromEntries(m); withLinks++ } else delete p.links
}
W.version = Math.max(W.version ?? 0, 66)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
const all = [...links.values()].flatMap((m) => [...m.values()])
const cnt = (re) => all.filter((c) => re.test(c)).length / 2
console.log(`связи: провинций ${withLinks}; тракт ${cnt(/^p$/)}, грунтовка ${cnt(/^d$/)}, тропа ${cnt(/^t$/)}, реки ${cnt(/^r/)} (больших ${cnt(/^r3$/)})`)
