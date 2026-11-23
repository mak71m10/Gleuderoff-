// Флоты всех приморских стран (docs/впи-армия.md § 7): эскадры по лору (lore/navy.mjs) или береговая стража по культуре.
// Пишет states[].base.military.navy. Запуск после military-seed: node scripts/navy-seed.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { NAMES, CMD_TRAITS } from './lore/military.mjs'
import { NAVY_STATE, NAVY_CULT } from './lore/navy.mjs'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
let seed = 1
const rnd = () => ((seed = (Math.imul(seed, 48271) >>> 0) % 2147483647) / 2147483647)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const owner = (p) => p.owners?.at(-1)?.[1]
const provsOf = new Map(); for (const p of W.provinces) { const o = owner(p); if (o) (provsOf.get(o) ?? provsOf.set(o, []).get(o)).push(p) }
const wm = W.maps.find((m) => m.kind === 'world')
const places = W.places.filter((pl) => pl.mapId === wm?.id && pl.base?.name)
const stem = (s) => s.toLowerCase().slice(0, Math.max(4, s.length - 2))
const RANK = { port: 6, capital: 5, city: 4, town: 3, castle: 3, fishing: 2, village: 1 }

let states = 0, ships = 0
for (const st of W.states) {
  const b = st.base
  if (!b.military) continue
  const provs = provsOf.get(st.id) ?? []
  const coast = provs.filter((p) => p.coastal)
  delete b.military.navy
  const lore = NAVY_STATE[b.name]
  if (!lore && coast.length < 3) continue
  seed = hash(st.id + 'navy') || 1
  const cc = {}; for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'imperial'
  const [firsts, lasts] = NAMES[cult] ?? NAMES.imperial
  const cmd = (name) => ({ name: name ?? `${pick(firsts)} ${pick(lasts)}`, trait: pick(CMD_TRAITS) })
  const her = b.heraldry?.colors ?? [b.color, '#d8c48a']
  const colors = () => [her[0] ?? b.color, rnd() < 0.5 ? her[1] ?? '#d8c48a' : pick(['#e8e2d0', '#1c1c1c', '#284a7a'])]
  // порты по важности: настоящие порты, потом приморские города
  const ports = coast.slice().sort((x, y) => (RANK[y.settlement?.type] ?? 0) - (RANK[x.settlement?.type] ?? 0))
  if (!ports.length && provs.length) ports.push(provs.slice().sort((x, y) => (RANK[y.settlement?.type] ?? 0) - (RANK[x.settlement?.type] ?? 0))[0])
  let pi = 0
  const portFor = (hint) => {
    if (hint) {
      const p = provs.find((x) => x.name.toLowerCase().includes(stem(hint)))
      if (p) return p.id
      // город или порт с таким именем — область, где он стоит
      const pl = places.find((x) => x.base.name.toLowerCase().includes(stem(hint)))
      if (pl && provs.length) return provs.reduce((best, q) => ((q.x - pl.x) ** 2 + (q.y - pl.y) ** 2 < (best.x - pl.x) ** 2 + (best.y - pl.y) ** 2 ? q : best), provs[0]).id
    }
    const p = ports[pi++ % Math.max(1, ports.length)]
    return p?.id
  }
  const plan = lore ?? (() => {
    const [ship, arm, k] = NAVY_CULT[cult] ?? NAVY_CULT.imperial
    const n = Math.max(1, Math.round((coast.length / 8) * k))
    return [{ name: 'Береговая стража', port: '', sq: [{ name: 'Сторожевые корабли', ship, count: n, arm, crew: 'common', merchant: false }] }]
  })()
  const fleets = [], squadrons = []
  let sn = 0, fnum = 0
  for (const f of plan) {
    const base = portFor(f.port)
    const fl = { id: `n${++fnum}`, name: f.name, squadrons: [], base, cmd: cmd(f.cmd), ...(f.note ? { note: f.note } : {}) }
    f.sq.forEach((q, i) => {
      // крупный флот без подсказки порта — эскадры по разным гаваням
      // имя эскадры может назвать свою гавань («Когги Саренто», «Крепости Дрогенмау»)
      const named = [...provs, ...places.filter((pl) => provs.some((q) => Math.hypot(q.x - pl.x, q.y - pl.y) < 400))].map((x) => x.name ?? x.base.name).find((nm) => nm && nm.length > 4 && q.name.toLowerCase().includes(stem(nm)))
      const sb = named ? portFor(named) : i === 0 || f.port ? base : portFor('')
      const s = { id: `s${++sn}`, name: q.name, ship: q.ship, count: q.count, arm: q.arm, crew: q.crew, base: sb, cmd: cmd(), colors: colors(), ...(q.merchant ? { merchant: true } : {}) }
      squadrons.push(s); fl.squadrons.push(s.id); ships += q.count
    })
    fleets.push(fl)
  }
  b.military.navy = { fleets, squadrons }
  states++
}
W.version = Math.max(W.version ?? 0, 66)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
console.log(`флот: стран ${states}, кораблей ${ships}`)
