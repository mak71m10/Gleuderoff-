// Стартовые войска всех стран ВПИ (docs/впи-армия.md, этап 1): лестница, закон призыва, уставы рот (общие по культуре +
// свои рода войск страны), и всё войско деревом армия → корпус → полк → батальон → рота.
// Войсковые организации лора (легионы, полки, стража; links.overlord — подчинение) становятся полками и армиями с их именами
// и численностью; недостающее добирается полками с номерами и прозвищами. Каждая рота — своя: народ и край набора из её области,
// качество снаряжения по технологиям, черты, командир, цвета. Пишет states[].base.military.
// node scripts/military-seed.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { LADDER, LADDER_STATE, LAW, LAW_STATE, BASIC, UNIQUE, NAMES, CMD_TRAITS, ORDINAL, EPITHETS, TEMPLATE_RACE } from './lore/military.mjs'

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
  const ladderArr = LADDER_STATE[name] ?? LADDER[cult] ?? LADDER.imperial
  const ladder = Object.fromEntries(LEVELS.map((l, i) => [l, ladderArr[i]]))
  const law = { ...(LAW_STATE[name] ?? LAW[cult] ?? LAW.imperial), level: 'мир' }
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
  const battalion = (mix, idx) => {
    const n = 3 + Math.floor(rnd() * 4)
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
      pairs.push([t, w])
    }
    return pairs
  }
  const regiment = (title, men, kind, lore) => {
    const companySize = 130
    const nb = Math.max(1, Math.min(14, Math.round(men / (companySize * 4.5))))
    const bats = []
    for (let i = 0; i < nb; i++) bats.push(battalion(mixFor(kind), i))
    const f = { id: `f${++fn}`, level: 'regiment', name: title, children: bats.map((x) => x.id), cmd: cmd(), lore, colors: colors(), base: pick(provs).id }
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
    const r = regiment(e.base.name, men, kind, e.id)
    r.parent = e.base.links?.overlord && byId.has(e.base.links.overlord) ? e.base.links.overlord : null
    regiments.push(r); loreMen += men
  }
  // общая численность: текст армии, зонтики лора или оценка по населению
  const pop = provs.reduce((s, p) => s + (p.pop ?? 0), 0)
  const umbrella = mine.filter((e) => childrenOf(e.id).length).reduce((s, e) => s + sizeOf(e.base.props?.members), 0)
  const RATE = { orcish: 0.07, nordic: 0.02, dark: 0.03, church: 0.004, zlatay: 0.012 }
  // если в лоре есть общее войско (зонтик) — его численность главнее текста армии (там бывает и запас)
  const target = Math.min(150000, umbrella ? Math.max(umbrella, loreMen) : Math.max(armySize(b.army), loreMen, Math.round(pop * (RATE[cult] ?? 0.006))))
  const mainUmbrella = mine.filter((e) => childrenOf(e.id).length).sort((x, y) => sizeOf(y.base.props?.members) - sizeOf(x.base.props?.members))[0]
  let gi = 0
  for (let men = loreMen; men < target - 600 && gi < 40; gi++) { const m = Math.min(3500, target - men); const r = regiment(genericName(gi), m, gi % 5 === 4 ? 'levy' : 'line'); r.parent = mainUmbrella?.id ?? null; regiments.push(r); men += m }

  // корпуса и армии: зонтики лора — армии со своими полками; остальное — корпуса по 3–4 полка в одну армию
  for (const e of mine.filter((x) => childrenOf(x.id).length)) {
    const kids = regiments.filter((r) => r.parent === e.id)
    const a = { id: `f${++fn}`, level: 'army', name: e.base.name, children: kids.map((r) => r.id), cmd: cmd(), lore: e.id, colors: colors(), base: pick(provs).id }
    formations.push(a); roots.push(a.id)
    for (const r of kids) r.parent = 'done'
  }
  const free = regiments.filter((r) => r.parent !== 'done')
  if (free.length > 3) {
    const corps = []
    for (let i = 0; i < free.length; i += 4) {
      const part = free.slice(i, i + 4)
      const c = { id: `f${++fn}`, level: 'corps', name: `${ORDINAL[corps.length]} ${ladder.corps}`, children: part.map((r) => r.id), cmd: cmd(), colors: colors(), base: pick(provs).id }
      formations.push(c); corps.push(c)
    }
    const a = { id: `f${++fn}`, level: 'army', name: `${ladder.army[0].toUpperCase()}${ladder.army.slice(1)} — ${name}`, children: corps.map((c) => c.id), cmd: cmd(), colors: colors(), base: pick(provs).id }
    formations.push(a); roots.push(a.id)
  } else roots.push(...free.map((r) => r.id))
  for (const f of formations) delete f.parent
  b.military = { ladder, law, templates, companies, formations, roots }
}
W.version = Math.max(W.version ?? 0, 64)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
console.log(`войска: рот ${totalCompanies}, людей ${totalMen.toLocaleString('ru-RU')}`)
