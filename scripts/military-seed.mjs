// Стартовые войска всех стран ВПИ (docs/впи-армия.md, этап 1): лестница, закон призыва, уставы рот (общие по культуре +
// свои рода войск страны), и всё войско деревом армия → корпус → полк → батальон → рота.
// Войсковые организации лора (легионы, полки, стража; links.overlord — подчинение) становятся полками и армиями с их именами
// и численностью; недостающее добирается полками с номерами и прозвищами. Каждая рота — своя: народ и край набора из её области,
// качество снаряжения по технологиям, черты, командир, цвета. Пишет states[].base.military.
// node scripts/military-seed.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { ARMY_LORE } from './lore/army-lore.mjs'
import { LADDER, LADDER_STATE, LAW, LAW_STATE, BASIC, UNIQUE, NAMES, CMD_TRAITS, ORDINAL, EPITHETS, TEMPLATE_RACE, GRAFT, GRAFT_STATE, EXTRA_FORCE } from './lore/military.mjs'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
const LEVELS = ['company', 'battalion', 'regiment', 'corps', 'army']
const GOOD_TRAITS = ['stone', 'swift', 'night', 'horsebane', 'sharp', 'iron', 'favor', 'sappers', 'scouts', 'siege', 'pious', 'lucky', 'oath', 'brothers', 'drillers', 'fearless', 'vets', 'thrifty', 'foragers', 'craft', 'rangers', 'pikewall', 'shock', 'tireless', 'silent', 'beloved']
const BAD_TRAITS = ['mixed', 'drunk', 'looters', 'green', 'cowards', 'slow', 'grudge', 'cursed', 'sick', 'rivals', 'rusty', 'hungry', 'deserters', 'pressed', 'foreign', 'reckless', 'rigid', 'superstition', 'hatemagic', 'noble', 'greed', 'lazy', 'homesick', 'loud', 'oldarms', 'thin', 'spoiled', 'debt']
const ARM_MEN = { line: 150, light: 120, archers: 120, xbow: 120, guns: 120, heavycav: 60, lightcav: 80, horsearch: 80, siege: 60, cannon: 50, mages: 12, templars: 80, beasts: 50, scouts: 40, sappers: 100, marines: 100 }
const ROLE_OF = { line: 'line', light: 'line', marines: 'line', templars: 'line', archers: 'missile', xbow: 'missile', guns: 'missile', heavycav: 'horse', lightcav: 'horse', horsearch: 'horse', beasts: 'horse', siege: 'support', cannon: 'support', mages: 'support', scouts: 'support', sappers: 'support' }

const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
let seed = 1
const rnd = () => ((seed = (Math.imul(seed, 48271) >>> 0) % 2147483647) / 2147483647)
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const wpick = (pairs) => { const t = pairs.reduce((s, [, w]) => s + w, 0); let r = rnd() * t; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v } return pairs[0][0] }
const sizeOf = (txt) => { const t = String(txt ?? ''); const m = t.match(/(\d+)\s*[–-]\s*(\d+)\s*тыс/); if (m) return ((+m[1] + +m[2]) / 2) * 1000; const b = t.match(/(\d+(?:[.,]\d+)?)\s*тыс/); if (b) return parseFloat(b[1].replace(',', '.')) * 1000; const n = t.replace(/(\d)\s(\d{3})/g, '$1$2').match(/\d{2,}/); return n ? +n[0] : 0 }
const armySize = (t) => { const s = String(t ?? ''); const big = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(тыс|млн)/gi)].map((m) => parseFloat(m[1].replace(',', '.')) * (/млн/i.test(m[2]) ? 1e6 : 1e3)); return big.length ? Math.round(Math.max(...big)) : 0 }

const owner = (p) => p.owners?.at(-1)?.[1]
const provsOf = new Map(); for (const p of W.provinces) { const o = owner(p); if (o) (provsOf.get(o) ?? provsOf.set(o, []).get(o)).push(p) }
const areaById = new Map(W.adminRegions.map((a) => [a.id, a]))
const MIL_RE = /войск|армия|легион|полк|дружин|гвард|стража|ополчен|хирд|кондот/i
const orgs = W.entries.filter((e) => e.kind === 'organization' && MIL_RE.test(e.base.props?.type ?? ''))

let totalCompanies = 0, totalMen = 0
for (const st of W.states) {
  const provs = provsOf.get(st.id)
  if (!provs?.length) { delete st.base.military; continue }
  seed = hash(st.id) || 1
  const b = st.base, name = b.name
  const cc = {}; for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((x, y) => y[1] - x[1])[0][0]
  const AL = ARMY_LORE[name]
  const ladderArr = AL?.ladder ?? LADDER_STATE[name] ?? LADDER[cult] ?? LADDER.imperial
  const ladder = Object.fromEntries(LEVELS.map((l, i) => [l, ladderArr[i]]))
  const law = { ...(LAW_STATE[name] ?? LAW[cult] ?? LAW.imperial), level: b.military?.law?.level ?? 'мир' }
  // место базирования армий — область у столицы
  const capPlace = W.places.find((p) => p.id === b.capitalId)
  const capProv = capPlace ? provs.reduce((best, p) => ((p.x - capPlace.x) ** 2 + (p.y - capPlace.y) ** 2 < (best.x - capPlace.x) ** 2 + (best.y - capPlace.y) ** 2 ? p : best), provs[0]) : null
  const tech = b.tech?.levels ?? {}
  const ok = (t) => { const req = { guns: { powder: 3 }, cannon: { powder: 3 }, mages: { magic: 3 }, templars: { magic: 2 } }[t.arm] ?? {}; return Object.entries(req).every(([k, v]) => (tech[k] ?? 0) >= v) }
  const basicSet = cult === 'imperial' && !['Империя', 'Ноксворд', 'Ятаган'].includes(name) ? 'feudal' : cult
  const basic = (BASIC[basicSet] ?? BASIC.imperial).filter(ok)
  const unique = (UNIQUE[name] ?? []).filter((t) => ok(t) || t.unique)
  const templates = [...basic, ...unique].map((t) => ({ ...t, id: `${t.id}` }))
  const tById = new Map(templates.map((t) => [t.id, t]))

  // народ и край набора — из областей страны (по жителям)
  const areas = [...new Set(provs.map((p) => p.areaId))].map((id) => areaById.get(id)).filter((a) => a?.econ)
  const areaW = areas.map((a) => [a, provs.filter((p) => p.areaId === a.id).reduce((s, p) => s + (p.pop ?? 0), 0)])
  const kindOf = (a) => {
    const ap = provs.filter((p) => p.areaId === a.id), f = (fn) => ap.filter(fn).length / Math.max(1, ap.length)
    if (f((p) => p.terrain === 5) > 0.4) return 'north'
    if (f((p) => p.terrain === 4) > 0.45) return 'mountain'
    if (f((p) => p.terrain === 2) > 0.5) return 'forest'
    if (f((p) => p.terrain === 6) > 0.4) return 'desert'
    if (f((p) => ['city', 'capital'].includes(p.settlement?.type)) > 0.25) return 'city'
    if (f((p) => p.coastal) > 0.5) return 'coast'
    if (['zlatay', 'orcish', 'desert'].includes(cult)) return 'steppe'
    return cult === 'nordic' ? 'north' : 'plain'
  }
  const raceOf = (a) => { const rows = Object.entries(a.econ.pop).map(([r, row]) => [r, Object.values(row).reduce((s, v) => s + v, 0)]); return wpick(rows.length ? rows : [['Люди', 1]]) }
  const quality = (t) => {
    if (t.parts.training === 'levy') return rnd() < 0.6 ? 'poor' : 'common'
    if (cult === 'dwarven') return (tech.magic ?? 0) >= 2 && rnd() < 0.3 ? 'rune' : rnd() < 0.6 ? 'dwarfsteel' : 'master'
    if (name === 'Фарвольская лига' || (tech.gear ?? 0) >= 4) return rnd() < 0.5 ? 'gnome' : 'master'
    const g = (tech.gear ?? 1) + (tech.money ?? 1)
    return g >= 6 ? (rnd() < 0.5 ? 'master' : 'good') : g >= 4 ? (rnd() < 0.6 ? 'good' : 'common') : rnd() < 0.3 ? 'poor' : 'common'
  }
  const [firsts, lasts] = NAMES[cult] ?? NAMES.imperial
  const cmd = () => ({ name: `${pick(firsts)} ${pick(lasts)}`, trait: pick(CMD_TRAITS) })
  const her = b.heraldry?.colors ?? [b.color, '#d8c48a']
  const colors = () => [her[0] ?? b.color, rnd() < 0.5 ? her[1] ?? '#d8c48a' : pick(['#e8e2d0', '#1c1c1c', '#c8a040', '#7a1a1a', '#284a7a'])]

  const companies = [], formations = []
  let cn = 0, fn = 0
  const newCompany = (t) => {
    const [a] = wpick(areaW.length ? areaW.map((x) => [x, x[1]]) : [[[null, 1], 1]])
    const region = a ? kindOf(a) : 'plain'
    const traits = []
    if (rnd() < 0.7) traits.push(pick(GOOD_TRAITS))
    if (rnd() < 0.45) traits.push(pick(BAD_TRAITS))
    if (t.parts.training === 'levy' && rnd() < 0.5) traits.push('green')
    if (t.unique && rnd() < 0.5) traits.push(pick(['fearless', 'stone', 'vets', 'heroes', 'oath']))
    const men = Math.round((ARM_MEN[t.arm] ?? 120) * (0.8 + rnd() * 0.5))
    const c = { id: `c${++cn}`, name: '', t: t.id, race: TEMPLATE_RACE[t.id] ?? (a ? raceOf(a) : 'Люди'), area: a?.id, region, quality: quality(t), traits: [...new Set(traits)], cmd: cmd(), men, xp: Math.round(rnd() * (t.parts.training === 'veteran' || t.parts.training === 'guard' ? 35 : 15)), colors: colors() }
    companies.push(c); totalCompanies++; totalMen += men
    return c
  }
  const SLOT_BY_ROLE = { line: ['center', 'left', 'right'], missile: ['van'], horse: ['left', 'right'], support: ['reserve', 'train'] }
  /** батальон из 3–6 рот одного-двух уставов */
  const battalion = (mix, idx, cap = 6) => {
    const n = Math.max(1, Math.min(cap, 3 + Math.floor(rnd() * 4)))
    const comps = []
    for (let i = 0; i < n; i++) { const t = wpick(mix); const c = newCompany(t); c.name = `${ladder.company[0].toUpperCase()}${ladder.company.slice(1)} №${i + 1}`; comps.push(c) }
    const slots = {}
    const used = {}
    for (const c of comps) { const role = ROLE_OF[tById.get(c.t).arm] ?? 'line'; const opts = SLOT_BY_ROLE[role]; const k = (used[role] = (used[role] ?? -1) + 1); slots[c.id] = opts[k % opts.length] }
    const f = { id: `f${++fn}`, level: 'battalion', name: `${ORDINAL[idx % ORDINAL.length]} ${ladder.battalion}`, children: [], companies: comps.map((c) => c.id), slots, cmd: cmd(), colors: colors() }
    formations.push(f)
    return f
  }
  /** смесь уставов для полка: основа — пехота, немного стрелков и конницы; гвардейский полк — свои рода войск */
  const mixFor = (kind) => {
    const pairs = []
    for (const t of templates) {
      const role = ROLE_OF[t.arm] ?? 'line'
      let w = { line: 6, missile: 2.5, horse: 1.5, support: 0.6 }[role]
      if (t.unique) w = kind === 'guard' ? 6 : 0.7
      else if (kind === 'guard') w *= 0.2
      if (t.parts.training === 'levy') w = kind === 'levy' ? 8 : 0.8
      else if (kind === 'levy') w *= 0.08
      pairs.push([t, w])
    }
    return pairs
  }
  const regiment = (title, men, kind, lore) => {
    const companySize = 130
    const nb = Math.max(1, Math.min(14, Math.round(men / (companySize * 4.5))))
    const bats = []
    const cap = Math.max(1, Math.round(men / (nb * companySize)))
    for (let i = 0; i < nb; i++) bats.push(battalion(mixFor(kind), i, cap < 3 ? cap : 6))
    const f = { id: `f${++fn}`, level: 'regiment', name: title, children: bats.map((x) => x.id), cmd: cmd(), lore, colors: colors(), base: null, kind }
    formations.push(f)
    return f
  }
  const genericName = (i) => `${ORDINAL[i % ORDINAL.length]} ${ladder.regiment} «${EPITHETS[hash(st.id + i) % EPITHETS.length]}»`

  // войсковые организации лора этой страны
  const mine = orgs.filter((e) => (e.base.tags ?? []).includes(name))
  const byId = new Map(mine.map((e) => [e.id, e]))
  const childrenOf = (id) => mine.filter((e) => e.base.links?.overlord === id)
  const regiments = [], roots = []
  let loreMen = 0
  for (const e of mine) {
    if (childrenOf(e.id).length) continue // зонтик — ниже
    const men = Math.min(14000, sizeOf(e.base.props?.members) || 1500)
    const kind = /гвард|стража|орден|братств/i.test(`${e.base.props?.type} ${e.base.name}`) ? 'guard' : /ополчен/i.test(e.base.name) ? 'levy' : 'line'
    const parent = e.base.links?.overlord && byId.has(e.base.links.overlord) ? e.base.links.overlord : null
    const parts = AL?.split?.[e.base.name]
    if (parts?.length) {
      const per = Math.round(men / parts.length)
      for (const nm of parts) {
        const k2 = /стража|гвард/i.test(nm) ? 'guard' : /ополчен|дымы|сотни/i.test(nm) ? 'levy' : kind === 'guard' && parts.length > 1 ? 'line' : kind
        const r = regiment(nm, per, k2, e.id); r.parent = parent; if (parts.length > 1) r.group = e.base.name; regiments.push(r)
      }
      loreMen += men
      continue
    }
    const r = regiment(e.base.name, men, kind, e.id)
    r.parent = parent
    regiments.push(r); loreMen += men
  }
  // полки из лора страны (дома, этты, кланы, Очаги, ополчения — ARMY_LORE.units)
  for (const u of AL?.units ?? []) {
    if (regiments.some((r) => r.name === u.name)) continue
    const r = regiment(u.name, u.men, u.kind, undefined); r.parent = null; regiments.push(r); loreMen += u.men
  }
  // страны без войска в лоре: стража и ополчение по их устройству (EXTRA_FORCE)
  if (!regiments.length) for (const x of EXTRA_FORCE[name] ?? []) { const r = regiment(x.name, x.men, x.kind, undefined); r.parent = null; regiments.push(r); loreMen += x.men }
  // общая численность: текст армии, зонтики лора или оценка по населению
  const pop = provs.reduce((s, p) => s + (p.pop ?? 0), 0)
  const umbrella = mine.filter((e) => childrenOf(e.id).length).reduce((s, e) => s + sizeOf(e.base.props?.members), 0)
  const RATE = { orcish: 0.07, nordic: 0.02, dark: 0.03, church: 0.004, zlatay: 0.012 }
  // если в лоре есть общее войско (зонтик) — его численность главнее текста армии (там бывает и запас)
  const target = AL?.exact ? loreMen : Math.min(150000, umbrella ? Math.max(umbrella, loreMen) : Math.max(armySize(b.army), loreMen, Math.round(pop * (RATE[cult] ?? 0.006))))
  const mainUmbrella = mine.filter((e) => childrenOf(e.id).length).sort((x, y) => sizeOf(y.base.props?.members) - sizeOf(x.base.props?.members))[0]
  // добор полками: в большой стране полков больше, чтобы стоять по разным городам
  const want = Math.max(1, Math.min(8, Math.round(provs.length / 12)))
  const size = Math.max(450, Math.min(3500, Math.ceil((target - loreMen) / want)))
  let gi = 0
  for (let men = loreMen; men < target - 300 && gi < 40; gi++) { const m = Math.max(300, Math.min(size, target - men)); const r = regiment(genericName(gi), m, gi % 5 === 4 ? 'levy' : 'line'); r.parent = mainUmbrella?.id ?? null; regiments.push(r); men += m }
  if (!regiments.length) { const r = regiment(genericName(0), Math.max(400, target), 'line'); r.parent = null; regiments.push(r) }

  // каждый свой род войск страны набран хотя бы в одну роту: заменяем роту подходящего полка (гвардия — первой)
  const usedT = new Set(companies.map((c) => c.t))
  const byRegiment = regiments.slice().sort((x, y) => (y.kind === 'guard') - (x.kind === 'guard'))
  for (const t of templates.filter((x) => x.unique && !usedT.has(x.id))) {
    const role = ROLE_OF[t.arm] ?? 'line'
    let target = null
    for (const r of byRegiment) {
      for (const bid of r.children) {
        const bf = formations.find((f) => f.id === bid)
        const c = bf?.companies?.map((id) => companies.find((x) => x.id === id)).find((x) => x && !tById.get(x.t)?.unique && (ROLE_OF[tById.get(x.t)?.arm] ?? 'line') === role)
          ?? bf?.companies?.map((id) => companies.find((x) => x.id === id)).find((x) => x && !tById.get(x.t)?.unique)
          ?? bf?.companies?.map((id) => companies.find((x) => x.id === id)).find((x) => x && companies.filter((y) => y.t === x.t).length > 1)
        if (c) { target = c; break }
      }
      if (target) break
    }
    if (!target) continue
    const men = Math.round((ARM_MEN[t.arm] ?? 120) * (0.8 + rnd() * 0.5))
    totalMen += men - target.men
    target.t = t.id; target.men = men
    if (TEMPLATE_RACE[t.id]) target.race = TEMPLATE_RACE[t.id]
    if (rnd() < 0.5) target.traits = [...new Set([...target.traits, pick(['fearless', 'stone', 'vets', 'oath'])])]
    usedT.add(t.id)
  }

  // ---- места базирования: гвардия у столицы, строевые — в городах и крепостях у границ, ополчение — в глубине ----
  const RANK = { capital: 6, city: 5, castle: 4, port: 4, town: 3, temple: 2, tower: 2, fishing: 1, village: 1 }
  const own = new Set(provs.map((p) => p.id))
  const isBorder = (p) => (p.neighbors ?? []).some((n) => !own.has(n))
  const rank = (p) => RANK[p.settlement?.type] ?? 0
  const used = new Map()
  const capP = capProv ?? provs.slice().sort((x, y) => rank(y) - rank(x))[0]
  const spanAll = Math.max(1, ...provs.map((p) => Math.hypot(p.x - (capP?.x ?? 0), p.y - (capP?.y ?? 0))))
  const DIRS = [[/север/i, 0, -1], [/юж/i, 0, 1], [/восто/i, 1, 0], [/запад/i, -1, 0]]
  const place = (kind, title = '') => {
    let best = null, bs = -Infinity
    const dir = DIRS.filter(([re]) => re.test(title))
    for (const p of provs) {
      const r = rank(p)
      if (r < 1 && p.id !== capP?.id) continue
      let s = r * 2 + rnd() * 0.8 - (used.get(p.id) ?? 0) * 9
      // название полка подсказывает место: «Северный легион» — на севере, «Морской» — в порту, «Лесной», «Горный»
      for (const [, dx, dy] of dir) s += (12 * ((p.x - capP.x) * dx + (p.y - capP.y) * dy)) / spanAll
      if (/морск|флот|эскадр|берегов/i.test(title)) s += p.settlement?.type === 'port' ? 10 : p.coastal ? 5 : -3
      if (/лесн|бортн/i.test(title)) s += p.terrain === 2 ? 6 : 0
      if (/горн|высот|чертог/i.test(title)) s += p.terrain === 4 ? 6 : 0
      if (kind === 'guard') s += p.id === capP?.id ? 40 : 0
      else if (kind === 'levy') s += isBorder(p) ? -2 : 2
      else s += isBorder(p) ? 4 : 0
      if (s > bs) { bs = s; best = p }
    }
    best = best ?? pick(provs)
    used.set(best.id, (used.get(best.id) ?? 0) + 1)
    return best.id
  }
  for (const r of regiments) r.base = place(r.kind, r.name)
  // гарнизоны: если городов больше, чем полков, батальоны (кроме первого) расходятся по ближним свободным городам
  const provById = new Map(provs.map((p) => [p.id, p]))
  const spare = provs.filter((p) => rank(p) >= 3 && !used.has(p.id))
  for (const r of regiments) {
    if (!spare.length) break
    const home = provById.get(r.base)
    for (const bid of r.children.slice(1)) {
      if (!spare.length) break
      spare.sort((x, y) => (x.x - home.x) ** 2 + (x.y - home.y) ** 2 - ((y.x - home.x) ** 2 + (y.y - home.y) ** 2))
      const p = spare.shift()
      const bf = formations.find((f) => f.id === bid)
      bf.base = p.id; used.set(p.id, 1)
    }
  }

  // войска по всей земле страны (как у Империи): крупные батальоны делятся, половина рот уходит гарнизоном в ближний свободный город;
  // цель — около каждой шестой области, но не больше, чем есть городов и крепостей
  {
    const places = new Set(formations.map((f) => f.base).filter((x) => x != null))
    const towns = provs.filter((p) => rank(p) >= 2)
    const want = Math.min(towns.length, Math.max(3, Math.round(provs.length / 6)))
    const parentOf = (id) => formations.find((f) => f.children.includes(id))
    let guard = 0
    while (places.size < want && guard++ < 200) {
      const free = towns.filter((p) => !places.has(p.id))
      if (!free.length) break
      const bat = formations.filter((f) => f.level === 'battalion' && (f.companies?.length ?? 0) >= 2).sort((a, b) => b.companies.length - a.companies.length)[0]
      if (!bat) break
      const parent = parentOf(bat.id)
      const home = provById.get(bat.base ?? parent?.base) ?? capP
      free.sort((x, y) => (x.x - home.x) ** 2 + (x.y - home.y) ** 2 - ((y.x - home.x) ** 2 + (y.y - home.y) ** 2))
      const to = free[0]
      const moved = bat.companies.splice(Math.ceil(bat.companies.length / 2))
      const slots = {}
      for (const id of moved) { if (bat.slots?.[id]) slots[id] = bat.slots[id]; delete bat.slots?.[id] }
      if (bat.base == null) bat.base = home.id
      const nb = { id: `f${++fn}`, level: 'battalion', name: `${ORDINAL[(parent?.children.length ?? 0) % ORDINAL.length]} ${ladder.battalion}`, children: [], companies: moved, slots, cmd: cmd(), colors: colors(), base: to.id }
      formations.push(nb)
      parent?.children.push(nb.id)
      places.add(to.id); places.add(bat.base)
    }
  }

  // разделённые организации лора: их полки — в корпус с именем организации
  const wrap = (list) => {
    const out = [], seen = new Map()
    for (const r of list) {
      if (!r.group) { out.push(r); continue }
      let c = seen.get(r.group)
      if (!c) { c = { id: `f${++fn}`, level: 'corps', name: r.group, children: [], cmd: cmd(), lore: r.lore, colors: colors(), base: r.base }; formations.push(c); seen.set(r.group, c); out.push(c) }
      c.children.push(r.id)
      const b = provById.get(r.base), cb = provById.get(c.base)
      if (b && (!cb || rank(b) > rank(cb))) c.base = b.id
    }
    return out
  }

  // корпуса и армии: зонтики лора — армии со своими полками (база — столица);
  // остальные полки — корпуса по сторонам света от столицы
  for (const e of mine.filter((x) => childrenOf(x.id).length)) {
    const kids = regiments.filter((r) => r.parent === e.id)
    const a = { id: `f${++fn}`, level: 'army', name: e.base.name, children: wrap(kids).map((r) => r.id), cmd: cmd(), lore: e.id, colors: colors(), base: capProv?.id ?? pick(provs).id }
    formations.push(a); roots.push(a.id)
    for (const r of kids) r.parent = 'done'
  }
  const units = wrap(regiments.filter((r) => r.parent !== 'done'))
  const gcorps = units.filter((u) => u.level === 'corps')
  const free = units.filter((u) => u.level === 'regiment')
  if (units.length > 3) {
    let corps = free
    if (free.length > 3) {
    corps = []
    const word = ladder.corps.split(' ')[0]
    const g = /[оеё]$/.test(word) ? 'ое' : /[ая]$/.test(word) ? 'ая' : 'ый'
    const adj = (stem) => stem + (g === 'ый' && /(Южн|Восточн|Северн|Западн|Столичн)$/.test(stem) ? 'ый' : g)
    const span = Math.max(1, ...provs.map((p) => Math.hypot(p.x - capP.x, p.y - capP.y)))
    const D8 = ['Восточн', 'Юго-восточн', 'Южн', 'Юго-западн', 'Западн', 'Северо-западн', 'Северн', 'Северо-восточн']
    const posOf = (r) => provById.get(r.base) ?? capP
    // k скоплений по 3–5 полков: начальные центры — самые далёкие друг от друга полки
    const k = Math.max(1, Math.min(6, Math.round(free.length / 4)))
    const cent = [posOf(free[0])]
    while (cent.length < k) { let far = null, fd = -1; for (const r of free) { const p = posOf(r); const d = Math.min(...cent.map((c) => Math.hypot(c.x - p.x, c.y - p.y))); if (d > fd) { fd = d; far = p } } cent.push({ x: far.x, y: far.y }) }
    let groupsArr = []
    for (let it = 0; it < 8; it++) {
      groupsArr = cent.map(() => [])
      for (const r of free) { const p = posOf(r); let bi = 0, bd = Infinity; cent.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; bi = i } }); groupsArr[bi].push(r) }
      groupsArr.forEach((g, i) => { if (g.length) { cent[i] = { x: g.reduce((s, r) => s + posOf(r).x, 0) / g.length, y: g.reduce((s, r) => s + posOf(r).y, 0) / g.length } } })
    }
    const sectorOfC = (c) => {
      const dx = c.x - capP.x, dy = c.y - capP.y
      if (Math.hypot(dx, dy) < span * 0.2) return 'Столичн'
      const ang = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI)
      return D8[Math.round(ang / (Math.PI / 4)) % 8]
    }
    const groups = new Map()
    // одиночные полки — к ближайшему скоплению
    for (let i = 0; i < groupsArr.length; i++) {
      if (groupsArr[i].length !== 1 || groupsArr.filter((g) => g.length).length < 2) continue
      const p = posOf(groupsArr[i][0]); let bj = -1, bd = Infinity
      groupsArr.forEach((g, j) => { if (j === i || !g.length) return; const d = Math.hypot(cent[j].x - p.x, cent[j].y - p.y); if (d < bd) { bd = d; bj = j } })
      groupsArr[bj].push(groupsArr[i][0]); groupsArr[i] = []
    }
    groupsArr.forEach((g, i) => { if (!g.length) return; const key = sectorOfC(cent[i]); (groups.get(key) ?? groups.set(key, []).get(key)).push(...g) })
    for (const [k, list] of groups) {
      const parts = []
      const step = Math.ceil(list.length / Math.ceil(list.length / 5))
      for (let i = 0; i < list.length; i += step) parts.push(list.slice(i, i + step))
      parts.forEach((part, i) => {
        const bestBase = part.map((r) => provById.get(r.base)).filter(Boolean).sort((x, y) => rank(y) - rank(x))[0]
        const nm = `${parts.length > 1 ? `${ORDINAL[i]} ` : ''}${adj(k)} ${ladder.corps}`
        const c = { id: `f${++fn}`, level: 'corps', name: nm, children: part.map((r) => r.id), cmd: cmd(), colors: colors(), base: bestBase?.id ?? capP.id }
        formations.push(c); corps.push(c)
      })
    }
    }
    const a = { id: `f${++fn}`, level: 'army', name: AL?.armyName ?? `${ladder.army[0].toUpperCase()}${ladder.army.slice(1)} — ${name}`, children: [...gcorps, ...corps].map((c) => c.id), cmd: cmd(), colors: colors(), base: capProv?.id ?? pick(provs).id }
    formations.push(a); roots.push(a.id)
  } else roots.push(...units.map((r) => r.id))
  // полководцы из лора: названные в ARMY_LORE.cmd и те, чей титул называет соединение («Капитан Горной стражи», «Легат XI легиона»)
  const chars = W.entries.filter((e) => e.kind === 'character' && (e.base.tags ?? []).includes(name))
  const titleOf = (e) => String(e.base.props?.title ?? e.base.title ?? '')
  const usedCmd = new Set()
  const setCmd = (f, e) => { f.cmd = { name: e.base.name, trait: f.cmd?.trait ?? pick(CMD_TRAITS), entryId: e.id }; usedCmd.add(e.id) }
  for (const [fname, cname] of Object.entries(AL?.cmd ?? {})) {
    const e = chars.find((x) => x.base.name.includes(cname)) ?? W.entries.find((x) => x.kind === 'character' && x.base.name.includes(cname))
    for (const f of formations.filter((x) => x.name === fname)) if (e) setCmd(f, e)
  }
  const closed = /\(\s*\d{3,4}\s*[–-]\s*\d{3,4}\s*\)/
  for (const f of formations) {
    if (f.level === 'battalion' || f.cmd?.entryId) continue
    const words = f.name.split(/[\s«»—-]+/).filter((w) => w.length >= 5 && !/^[IVXL]+$/.test(w))
    if (!words.length) continue
    const stems = words.map((w) => w.toLowerCase().slice(0, Math.max(4, w.length - 3)))
    const e = chars.find((x) => !usedCmd.has(x.id) && !closed.test(titleOf(x)) && /капитан|командир|легат|маршал|префект|магистр|воевод|генерал|сотник|страж/i.test(titleOf(x)) && stems.every((s) => titleOf(x).toLowerCase().includes(s)))
    if (e) setCmd(f, e)
  }
  for (const f of formations) { delete f.parent; delete f.kind; delete f.group; if (f.base == null) delete f.base }
  // утечки: по лору или по культуре; шаткая страна и большое войско воруют больше
  const g0 = GRAFT_STATE[name] ?? GRAFT[cult] ?? GRAFT.imperial
  const men = companies.reduce((s, c) => s + c.men, 0)
  const stab = typeof b.stability === 'number' ? b.stability : 60
  const rate = Math.round(Math.max(0.01, Math.min(0.35, g0.rate + (GRAFT_STATE[name] ? 0 : (60 - stab) / 500 + (men > 20000 ? 0.03 : 0)))) * 100) / 100
  const graft = { ...g0, rate }
  b.military = { ladder, law, templates, companies, formations, roots, graft, ...(b.military?.measures ? { measures: b.military.measures } : {}), ...(b.military?.navy ? { navy: b.military.navy } : {}) }
}
W.version = Math.max(W.version ?? 0, 68)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
console.log(`войска: рот ${totalCompanies}, людей ${totalMen.toLocaleString('ru-RU')}`)
