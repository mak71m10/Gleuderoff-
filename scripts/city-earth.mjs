// Дописывает в готовые планы городов (maps/cities/<slug>.plan.json) контур суши scene.earth — тот же,
// что рисует 2D-карта (всё вне него — море). Нужен 3D-виду, чтобы у приморских городов было море.
// Рамка и масштаб — как в renderCity из scripts/city-maps.mjs. Запуск: node scripts/city-earth.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'

const OUT = 'resources/default-world/maps/cities'
const W = 2048
let done = 0, sea = 0, skip = 0, bad = 0
for (const file of readdirSync(OUT).filter((f) => f.endsWith('.plan.json'))) {
  const slug = file.replace('.plan.json', '')
  const src = `source-maps/cities/${slug}.json`
  if (!existsSync(src)) { skip++; continue }
  const J = JSON.parse(readFileSync(src, 'utf8'))
  const f = (id) => J.features.find((x) => x.id === id)
  if (!f('earth')) { skip++; continue }
  const flip = (r) => r.map(([x, y]) => [x, -y])
  const polys = (id) => (f(id)?.coordinates ?? []).map((p) => flip(p[0]))
  const geoms = (id) => f(id)?.geometries ?? []
  const all = [...polys('buildings'), ...polys('prisms')]
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9
  const grow = (r) => { for (const [x, y] of r) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y)) }
  all.forEach(grow)
  geoms('walls').forEach((g) => grow(flip(g.coordinates[0])))
  const cx0 = (x0 + x1) / 2, cy0 = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2
  for (const w of polys('water')) {
    const near = w.filter(([x, y]) => Math.hypot(x - cx0, y - cy0) < rad * 1.9)
    if (near.length) grow(near)
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.22
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad
  const s = W / (x1 - x0)
  const T = ([x, y]) => [(x - x0) * s, (y - y0) * s]
  const plan = JSON.parse(readFileSync(`${OUT}/${file}`, 'utf8'))
  if (!plan.scene) { skip++; continue }
  // проверка: первый дом в плане должен совпасть с пересчитанным
  const b0 = all[0] && T(all[0][0]), p0 = plan.buildings[0]
  if (b0 && p0 && (Math.abs(b0[0] - p0[2]) > 2 || Math.abs(b0[1] - p0[3]) > 2)) { bad++; console.log('не совпала рамка:', slug); continue }
  const earth = flip(f('earth').coordinates[0]).map(T)
  // суша накрывает весь кадр — моря нет, контур не нужен
  const H = plan.h
  const ins = ([x, y]) => { let c = false; for (let i = 0, j = earth.length - 1; i < earth.length; j = i++) { const [xi, yi] = earth[i], [xj, yj] = earth[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c } return c }
  let out = 0
  for (let i = 0; i <= 20; i++) for (const [x, y] of [[(W * i) / 20, 0], [(W * i) / 20, H], [0, (H * i) / 20], [W, (H * i) / 20]]) if (!ins([x, y])) out++
  for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) if (!ins([(W * i) / 20, (H * j) / 20])) out++
  if (out) { plan.scene.earth = earth.flat().map((v) => Math.round(v)); sea++ } else delete plan.scene.earth
  writeFileSync(`${OUT}/${file}`, JSON.stringify(plan))
  done++
}
console.log({ done, sea, skip, bad })
