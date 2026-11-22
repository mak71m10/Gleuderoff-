// Сканер мира: ищет ошибки, которые видно на карте и в планах городов.
//   node --max-old-space-size=6144 scripts/scan-world.mjs [--json out.json]
// 1) поселения и места, стоящие в воде (море, озеро);
// 2) планы городов с морем/портом, хотя на карте рядом нет моря или озера (Империум посреди поля);
// 3) планы речных городов без реки рядом;
// 4) дороги, проходящие через озёра и море (кроме мостов через реки);
// 5) поселения в лесу/горах — для сведения (поляна под городом должна быть).
// Координаты мира — логические единицы; пиксель масок = логическая / 2.
import { readFileSync, existsSync, writeFileSync } from 'fs'
import sharp from 'sharp'

const W = JSON.parse(readFileSync('resources/default-world/world.json', 'utf8'))
const { data: P, info } = await sharp('resources/default-world/maps/provinces.png').raw().toBuffer({ resolveWithObject: true })
const { data: T } = await sharp('resources/default-world/maps/terrain.png').raw().toBuffer({ resolveWithObject: true })
const LK = (await (async () => { const src = await sharp('source-maps/lakes.png').greyscale().raw().toBuffer(), out = new Uint8Array(src.length), w = info.width, h = src.length / w; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && src[Y * w + X]) { v = 255; break } } out[y * w + x] = v } return out })()) // маска озёр рваная — расширена на пиксель
const SW = info.width, SH = info.height
const px = (x, y) => [Math.round(x / 2), Math.round(y / 2)]
const inb = (x, y) => x >= 0 && y >= 0 && x < SW && y < SH
const sea = (x, y) => inb(x, y) && !(P[(y * SW + x) * 4 + 3] && P[(y * SW + x) * 4 + 2]) // нет суши или класс 0
const lake = (x, y) => inb(x, y) && LK[y * SW + x] > 0
// реки — видимые на карте векторные линии (rivers.json, те же пиксели), сетка 8×8 для быстрого поиска
const RV = JSON.parse(readFileSync('source-maps/rivers.json', 'utf8')), RG = new Map()
for (const l of RV.lines) for (let i = 0; i < l.length; i += 3) if (l[i + 2] >= 0.12) { const key = (Math.floor(l[i + 1] / 8) << 16) | Math.floor(l[i] / 8); RG.set(key, true) }
const river = (x, y) => RG.has((Math.floor(y / 8) << 16) | Math.floor(x / 8))
const cls = (x, y) => (inb(x, y) && P[(y * SW + x) * 4 + 3] ? P[(y * SW + x) * 4 + 2] : 0)
const near = (x, y, r, f) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && f(x + dx, y + dy)) return true; return false }
const CLS = ['вода', 'равнина', 'лес', 'холмы', 'горы', 'снега', 'пустыня']
const stateName = new Map(W.states.map((s) => [s.id, s.base.name]))

const out = { inWater: [], fakeSea: [], noRiver: [], roads: [], forest: 0, mountain: 0 }

// поселения и их планы
const pts = []
for (const p of W.provinces) if (p.settlement) pts.push({ name: p.name, kind: p.settlement.type, x: p.settlement.x, y: p.settlement.y, map: p.cityMapId, state: stateName.get(p.owners?.at(-1)?.[1]) ?? '' })
for (const pl of W.places) if (pl.mapId === 'world' && pl.base?.type !== 'ruins') pts.push({ name: pl.base?.name, kind: pl.base?.type, x: pl.x, y: pl.y, map: pl.innerMapId, state: stateName.get(pl.base?.stateId) ?? '' })
const mapById = new Map(W.maps.map((m) => [m.id, m]))
const seen = new Set()
for (const s of pts) {
  const [x, y] = px(s.x, s.y)
  if (sea(x, y) || lake(x, y)) out.inWater.push(`${s.state} · ${s.name} (${s.kind}) — ${lake(x, y) ? 'в озере' : 'в море'}`)
  const c = cls(x, y)
  if (c === 2) out.forest++
  if (c >= 4 && c <= 5) out.mountain++
  const m = s.map && mapById.get(s.map)
  if (!m?.plan || seen.has(m.id) || !existsSync(`resources/default-world/${m.plan}`)) continue
  seen.add(m.id)
  const plan = JSON.parse(readFileSync(`resources/default-world/${m.plan}`, 'utf8'))
  const water = plan.scene?.water?.length > 0, riverPlan = plan.scene?.rivers?.length > 0
  const coast = near(x, y, 14, (a, b) => sea(a, b) || lake(a, b))
  if (water && !coast) out.fakeSea.push(`${s.state} · ${s.name} — в плане море/озеро, на карте до воды > 28 ед.`)
  if (riverPlan && !near(x, y, 10, river) && !coast) out.noRiver.push(`${s.state} · ${s.name} — в плане река, на карте реки рядом нет`)
}

// дороги через воду
if (existsSync('source-maps/roads.json')) {
  const roads = JSON.parse(readFileSync('source-maps/roads.json', 'utf8'))
  let bad = 0, total = 0
  for (const r of roads) {
    let wet = 0
    for (const [lx, ly] of r.pts) { const [x, y] = px(lx, ly); if ((lake(x, y) || sea(x, y)) && !river(x, y)) wet++ }
    total++
    if (wet >= 3) { bad++; if (out.roads.length < 400) out.roads.push(`${r.type} у (${Math.round(r.pts[0][0])}, ${Math.round(r.pts[0][1])}) — ${wet} точек в воде`) }
  }
  out.roadsBad = bad; out.roadsTotal = total
}

console.log(`Поселений и мест: ${pts.length}; в лесу ${out.forest}, в горах ${out.mountain}`)
console.log(`\nВ воде: ${out.inWater.length}`); for (const l of out.inWater.slice(0, 40)) console.log('  ' + l)
console.log(`\nМоре в плане без моря на карте: ${out.fakeSea.length}`); for (const l of out.fakeSea.slice(0, 60)) console.log('  ' + l)
console.log(`\nРека в плане без реки на карте: ${out.noRiver.length}`); for (const l of out.noRiver.slice(0, 30)) console.log('  ' + l)
console.log(`\nДороги через воду: ${out.roadsBad ?? '?'} из ${out.roadsTotal ?? '?'}`)
const ji = process.argv.indexOf('--json'); if (ji > 0) writeFileSync(process.argv[ji + 1], JSON.stringify(out, null, 1))
