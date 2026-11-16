// Печать авто-grow (scripts/lore/city-grow.mjs) для списка городов — ничего не пишет.
//   node scripts/city-grow.mjs slug1 slug2 …   — строка на город: тип, ось, дома; что видно на карте; ручной grow, если есть
//   node scripts/city-grow.mjs --json slug…    — одна строка JSON для GROW_TEST='…' node scripts/city-maps.mjs slug…
import { readFileSync } from 'node:fs'
import { CITY_MAPS, ORGANIC } from './lore/cities.mjs'
import { autoCities } from './lore/cities-auto.mjs'
import { growFor, loadGrowMaps } from './lore/city-grow.mjs'

const args = process.argv.slice(2)
const json = args.includes('--json')
const slugs = args.filter((a) => !a.startsWith('--'))
if (!slugs.length) { console.log('node scripts/city-grow.mjs [--json] slug…'); process.exit(1) }
const world = JSON.parse(readFileSync('resources/default-world/world.json', 'utf8'))
const wm = world.maps.find((m) => m.kind === 'world')
const maps = await loadGrowMaps(wm.width)
const CITIES = [...CITY_MAPS, ...(await autoCities(world, CITY_MAPS))]
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const out = {}
for (const slug of slugs) {
  const c = CITIES.find((x) => x.slug === slug)
  if (!c) { console.log(`${slug}: нет такого города`); continue }
  const pl0 = c.place ? world.places.find((x) => x.id === c.place) : null
  // город без провинции (место-столица): провинция с ближайшим поселением
  const p = world.provinces.find((x) => x.name === c.province) ?? (pl0 ? world.provinces.filter((x) => x.settlement).sort((a, b) => Math.hypot(a.settlement.x - pl0.x, a.settlement.y - pl0.y) - Math.hypot(b.settlement.x - pl0.x, b.settlement.y - pl0.y))[0] : null)
  const pl = pl0
  const s = p?.settlement ?? {}
  const type = /кастра [IVX]+/.test(p?.description ?? '') ? 'castra' : s.type
  const capital = !!pl // place у городов ставится только столицам
  const { grow, why } = growFor(maps, { x: pl ? pl.x : s.x, y: pl ? pl.y : s.y, type }, { capital, text: p?.description, terrain: p?.terrain, coastal: p?.coastal, seed: hash(slug) })
  const hand = ORGANIC[slug] ?? (c.auto ? null : c.grow)
  out[slug] = grow
  if (!json) {
    const g = (x) => `${x.type} ось ${x.axis ?? '—'} домов ${x.houses}${x.dirs ? ` dirs ${x.dirs.join(',')}` : ''}${x.water ? ` вода ${x.water}` : ''}`
    console.log(`${slug} (${p?.name ?? c.province}, ${type}${capital ? ', столица' : ''}): авто ${g(grow)} | ${why}${hand ? ` | ручной ${g(hand)}` : ''}`)
  }
}
if (json) console.log(JSON.stringify(out))
