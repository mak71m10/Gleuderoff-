// Города по странам для этапа 4 (docs/мастерская/8-как-строить-города.md, раздел 8). Только читает, ничего не пишет.
//   node scripts/city-countries.mjs                 — строка на страну: имя, id, городов, столиц / городов / городков / деревень
//   node scripts/city-countries.mjs <id или имя>    — slug'и страны по порядку: столица, города, городки, деревни
//   ключ --json — то же в JSON
// Ранг: столица — место из state.capitalId своей страны; остальное по типу поселения
// провинции: city → город; town, port, castra, temple → городок; village, fishing, castle, tower → деревня.
// «ручной» — у города свой grow или свой скрипт плана: ORGANIC в lore/cities.mjs, custom (hausser-plan.mjs, city-organic.mjs).
import { readFileSync } from 'node:fs'
import { CITY_MAPS, ORGANIC } from './lore/cities.mjs'
import { autoCities } from './lore/cities-auto.mjs'

const args = process.argv.slice(2)
const json = args.includes('--json')
const want = args.filter((a) => !a.startsWith('--')).join(' ').trim()

const world = JSON.parse(readFileSync('resources/default-world/world.json', 'utf8'))
const log = console.log
console.log = () => {} // autoCities может печатать своё — глушим
const CITIES = [...CITY_MAPS, ...(await autoCities(world, CITY_MAPS))]
console.log = log

const RANKS = ['столица', 'город', 'городок', 'деревня']
const RANK_OF = { city: 'город', town: 'городок', port: 'городок', castra: 'городок', temple: 'городок', village: 'деревня', fishing: 'деревня', castle: 'деревня', tower: 'деревня' }
const stateByName = new Map(world.states.map((s) => [s.base.name, s]))
const stateById = new Map(world.states.map((s) => [s.id, s]))

const rows = []
for (const c of CITIES) {
  const p = world.provinces.find((x) => x.name === c.province)
  const pl = c.place ? world.places.find((x) => x.id === c.place) : null
  const st = stateById.get(p?.owners?.at(-1)?.[1]) ?? stateById.get(pl?.base.stateId) ?? stateByName.get(c.state ?? 'Республика')
  // столица — место из state.capitalId своей страны: сам город (c.place) или провинция с тем же именем
  const cap = st?.base.capitalId ? world.places.find((x) => x.id === st.base.capitalId) : null
  const capital = !!cap && (pl?.id === cap.id || (cap.base.name === (c.province ?? c.name) && cap.base.type === 'capital'))
  const type = /кастра [IVX]+/.test(p?.description ?? '') ? 'castra' : p?.settlement?.type ?? pl?.base.type
  const rank = capital ? 'столица' : RANK_OF[type] ?? 'городок'
  const manual = !!(ORGANIC[c.slug] || (!c.auto && (c.custom || c.grow)))
  rows.push({ slug: c.slug, name: c.name, state: st?.base.name ?? '?', stateId: st?.id ?? '', rank, type, manual })
}
const byRank = (a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || a.slug.localeCompare(b.slug)

if (want) {
  const list = rows.filter((r) => r.stateId === want || r.state.toLowerCase() === want.toLowerCase()).sort(byRank)
  if (!list.length) { log(`нет страны «${want}» или у неё нет городов`); process.exit(1) }
  if (json) log(JSON.stringify(list.map(({ slug, rank, type, manual }) => ({ slug, rank, type, manual }))))
  else for (const r of list) log(`${r.slug} ${r.rank}${r.manual ? ' ручной' : ''}`)
} else {
  const by = new Map()
  for (const r of rows) {
    const k = r.stateId
    if (!by.has(k)) by.set(k, { name: r.state, id: r.stateId, total: 0, manual: 0, ...Object.fromEntries(RANKS.map((x) => [x, 0])) })
    const s = by.get(k)
    s.total++
    s[r.rank]++
    if (r.manual) s.manual++
  }
  const list = [...by.values()].sort((a, b) => a.total - b.total)
  if (json) log(JSON.stringify(list))
  else {
    for (const s of list) log(`${s.name} (${s.id}): ${s.total} — столиц ${s['столица']}, городов ${s['город']}, городков ${s['городок']}, деревень ${s['деревня']}${s.manual ? `, ручных ${s.manual}` : ''}`)
    log(`Всего: ${rows.length} городов в ${list.length} странах`)
  }
}
