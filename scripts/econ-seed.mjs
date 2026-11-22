// Начальная экономика ВПИ для всего мира (docs/впи-экономика.md, этап 1). Берёт то, что уже есть в мире:
// население стран (текст «около 1,4 млн: дварфов — 55 %…», рабы/трэлли), местность и культуру провинций, поселения,
// тексты экономики («**Соль** Исагардских копей…») и технологии (scripts/lore/tech.mjs) — и раскладывает:
//   провинция: res (промысел) и pop; область: econ (расы × сословия, довольство, амбар, постройки);
//   страна: econ (монета, названия сословий, порог, беды и силы, казна, подати).
// Ручные уточнения по странам — scripts/lore/econ.mjs. Повторный запуск пересчитывает всё, кроме долгов и летописи.
// node scripts/econ-seed.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { ECON_STATES } from './lore/econ.mjs'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
let seed = 7
const rnd = () => ((seed = (Math.imul(seed, 48271) >>> 0) % 2147483647) / 2147483647)
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const pick = (s, arr) => arr[hash(s) % arr.length]

// ---------- культуры: раса по умолчанию, доли сословий, названия, монета, порог ----------
const C = {
  imperial: { race: 'Имперцы', share: [0.76, 0.13, 0.025, 0.02, 0.005, 0.06], names: ['крестьяне', 'бюргеры', 'дворянство', 'клир', 'маги Кругов', 'кабальные'], coin: 'талер', th: 30 },
  nordic: { race: 'Норды', share: [0.74, 0.12, 0.04, 0.02, 0.005, 0.075], names: ['бонды', 'карлы-ремесленники', 'ярлы и хёвдинги', 'годи и сейдконы', 'рунознатцы', 'трэлли'], coin: 'эйрир', th: 42 },
  dwarven: { race: 'Дварфы', share: [0.2, 0.62, 0.06, 0.05, 0.04, 0.03], names: ['подземные пахари', 'горные цеха', 'Дома Камня', 'рунные жрецы', 'мастера-механики', 'должники шахт'], coin: 'рудная марка', th: 32 },
  romance: { race: 'Южане', share: [0.66, 0.2, 0.04, 0.04, 0.005, 0.055], names: ['контадини', 'пополаны', 'нобили', 'клир', 'дотти и маги', 'кабальные'], coin: 'лира', th: 36 },
  eleon: { race: 'Элеоны', share: [0.55, 0.3, 0.05, 0.03, 0.01, 0.06], names: ['земледельцы', 'корабелы и купцы', 'капитанские дома', 'клир', 'навигаторы', 'галерники'], coin: 'флорин', th: 34 },
  elven: { race: 'Эльфы', share: [0.6, 0.2, 0.08, 0.06, 0.06, 0], names: ['Дети Корня', 'резчики и травники', 'старшие Дома', 'хранители рощ', 'маги', ''], coin: 'листовой лунник', th: 30 },
  eluin: { race: 'Элуины', share: [0.68, 0.16, 0.05, 0.06, 0.05, 0], names: ['общинники', 'мастера очага', 'держатели сфер', 'хранители огня', 'знающие', ''], coin: 'круглыш', th: 33 },
  church: { race: 'Имперцы', share: [0.7, 0.14, 0.02, 0.1, 0.02, 0.02], names: ['миряне-пахари', 'миряне-ремесленники', 'князья церкви', 'клир и братия', 'маги Света', 'послушники-должники'], coin: 'солид', th: 26 },
  kaltrans: { race: 'Кальтранцы', share: [0.62, 0.22, 0.05, 0.03, 0.005, 0.075], names: ['пахари', 'моряки и оружейники', 'капитанские кланы', 'клир', 'знахари', 'должники'], coin: 'дукат', th: 38 },
  desert: { race: 'Люди пустыни', share: [0.6, 0.22, 0.05, 0.05, 0.02, 0.06], names: ['феллахи', 'базарные цеха', 'шейхи и беки', 'улемы', 'звездочёты', 'рабы'], coin: 'динар', th: 36 },
  cin: { race: 'Цинь', share: [0.74, 0.16, 0.03, 0.03, 0.02, 0.02], names: ['земледельцы', 'ремесленники и купцы', 'учёные чиновники', 'монахи', 'мастера огненных цветов', 'кабальные'], coin: 'лян', th: 28 },
  zlatay: { race: 'Златайцы', share: [0.76, 0.12, 0.04, 0.03, 0.005, 0.045], names: ['смерды', 'посадские', 'бояре и старшина', 'клир', 'ведуны', 'холопы'], coin: 'гривна', th: 40 },
  orcish: { race: 'Орки', share: [0.6, 0.06, 0.08, 0.04, 0, 0.22], names: ['стадо', 'кузнецы клана', 'вожди', 'шаманы', '', 'рабы'], coin: 'зуб-обменник', th: 46 },
  yut: { race: 'Юты', share: [0.7, 0.18, 0.04, 0.04, 0.01, 0.03], names: ['земледельцы', 'мастера и купцы', 'дома самураев', 'монахи', 'механики', 'кабальные'], coin: 'мон', th: 30 },
  dark: { race: 'Дети тьмы', share: [0.5, 0.1, 0.08, 0.12, 0.05, 0.15], names: ['пахари пепла', 'мастера', 'избранные', 'жрецы Тьмы', 'маги', 'обречённые'], coin: 'чёрная монета', th: 40 }
}
// смеси народов по культурам (доли); в каждой стране — меньшинства, а не «100 % одного народа»
const MIX = {
  imperial: { Имперцы: 0.66, Эшландцы: 0.07, Зиггауцы: 0.05, Норды: 0.03, Дварфы: 0.03, Гномы: 0.03, 'Синти и Рома': 0.02, Полуэльфы: 0.02, Веринцы: 0.02, Тифлинги: 0.005, Прочие: 0.065 },
  nordic: { Норды: 0.84, Имперцы: 0.05, 'Северные орки': 0.03, Дварфы: 0.02, Фьяли: 0.02, Прочие: 0.04 },
  dwarven: { Дварфы: 0.6, Гномы: 0.3, Люди: 0.07, Прочие: 0.03 },
  romance: { Южане: 0.78, Имперцы: 0.07, Кальтранцы: 0.04, 'Синти и Рома': 0.04, Ционы: 0.03, Прочие: 0.04 },
  eleon: { Элеоны: 0.6, Люди: 0.27, Эльфы: 0.06, Прочие: 0.07 },
  elven: { Эльфы: 0.72, 'Высшие эльфы': 0.08, Полуэльфы: 0.08, Сильва: 0.05, Люди: 0.04, Прочие: 0.03 },
  eluin: { Элуины: 0.78, Валлины: 0.18, Илутсы: 0.02, Прочие: 0.02 },
  church: { Имперцы: 0.7, Южане: 0.12, Эшландцы: 0.05, 'Синти и Рома': 0.02, Прочие: 0.11 },
  kaltrans: { Кальтранцы: 0.8, Южане: 0.12, Прочие: 0.08 },
  desert: { Ярмолы: 0.4, Нарги: 0.32, Дукулиты: 0.1, Табакси: 0.05, 'Синти и Рома': 0.03, Прочие: 0.1 },
  cin: { Цинь: 0.9, Ярмолы: 0.03, Прочие: 0.07 },
  zlatay: { Златайцы: 0.86, Имперцы: 0.04, 'Синти и Рома': 0.03, Гномы: 0.01, Прочие: 0.06 },
  orcish: { Орки: 0.74, Огры: 0.05, Тролли: 0.03, Гремлины: 0.05, Люди: 0.1, Прочие: 0.03 },
  yut: { Юты: 0.88, Прочие: 0.12 },
  dark: { 'Тёмные эльфы': 0.3, Нежить: 0.15, Тифлинги: 0.1, Далорианцы: 0.1, Голиафы: 0.1, Люди: 0.15, Прочие: 0.1 }
}
/** народы, которые целиком несвободны (Цепной народ Аргуса) */
const UNFREE_RACES = new Set(['Цепной народ'])
const norm = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / t])) }
/** смесь области: своя культура области, горы — больше дварфов и гномов, лес — эльфов, берег — веринцев */
function areaMix(base, ap, stateCult) {
  const cc = {}; for (const p of ap) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const ac = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0]
  let m = { ...base }
  if (ac && ac !== stateCult && MIX[ac]) { const t = MIX[ac]; m = {}; for (const k of new Set([...Object.keys(base), ...Object.keys(t)])) m[k] = 0.3 * (base[k] ?? 0) + 0.7 * (t[k] ?? 0) }
  const share = (f) => ap.filter(f).length / Math.max(1, ap.length)
  const mt = share((p) => p.terrain >= 4), fo = share((p) => p.terrain === 2), co = share((p) => p.coastal)
  if (mt > 0.5) { m['Дварфы'] = (m['Дварфы'] ?? 0.01) * 3; m['Гномы'] = (m['Гномы'] ?? 0.005) * 2.5 }
  if (fo > 0.5) for (const k of Object.keys(m)) if (/эльф|Сильва/i.test(k)) m[k] *= 2
  if (co > 0.5 && m['Веринцы']) m['Веринцы'] *= 2
  return norm(m)
}
const ROLE = ['feeders', 'makers', 'rulers', 'servants', 'learned', 'unfree']
const RACE_FIX = { дварфов: 'Дварфы', гномов: 'Гномы', людей: 'Люди', имперцев: 'Имперцы', элеонов: 'Элеоны', эльфов: 'Эльфы', лирийцев: 'Лирийцы', нордов: 'Норды', прочих: 'Прочие', элуины: 'Элуины', валлины: 'Валлины', сильва: 'Сильва', орков: 'Орки', полуэльфов: 'Полуэльфы', момитов: 'Момиты', илутсов: 'Илутсы', южан: 'Южане', кальтранцев: 'Кальтранцы', златайцев: 'Златайцы', гладров: 'Гладры' }
const raceName = (w) => RACE_FIX[w.toLowerCase()] ?? w[0].toUpperCase() + w.slice(1).replace(/(ов|ев|ей)$/, 'ы')

/** «Около 1,4 млн», «около 900 тысяч», «около 160 тыс.» → число */
function parsePop(text) {
  const m = String(text ?? '').match(/(\d+(?:[.,]\d+)?)\s*(млн|миллион|тыс|тысяч)/i)
  if (!m) return 0
  const n = parseFloat(m[1].replace(',', '.'))
  return Math.round(/млн|миллион/i.test(m[2]) ? n * 1e6 : n * 1e3)
}
/** расы из текста: «дварфов — 55 %», «(элуины — 125 тыс., валлины — 35 тыс.)» */
function parseRaces(text, total) {
  const out = {}
  for (const m of String(text ?? '').matchAll(/([А-ЯЁа-яё-]{3,})\s*[—–-]\s*(\d+(?:[.,]\d+)?)\s*(%|тыс)/g)) {
    const v = parseFloat(m[2].replace(',', '.'))
    out[raceName(m[1])] = m[3] === '%' ? v / 100 : total ? (v * 1000) / total : 0
  }
  const s = Object.values(out).reduce((a, b) => a + b, 0)
  if (!s) return null
  if (s < 0.98) out[out['Прочие'] ? 'Прочие' : 'Прочие'] = (out['Прочие'] ?? 0) + (1 - s)
  return out
}
/** несвободные из текста: «из них около 600 тысяч — рабы», «25 тысяч трэлей» */
function parseUnfree(text) {
  const m = String(text ?? '').match(/(\d+(?:[.,]\d+)?)\s*(млн|тыс\w*)[^.;]{0,25}(раб|трэл|кабальн|холоп|каторж)|(раб|трэл|кабальн)[^.;]{0,20}?(\d+(?:[.,]\d+)?)\s*(млн|тыс)/i)
  if (!m) return 0
  const n = parseFloat((m[1] ?? m[5]).replace(',', '.')), u = m[2] ?? m[6]
  return Math.round(/млн/i.test(u) ? n * 1e6 : n * 1e3)
}

// ---------- провинции стран ----------
const owner = (p) => p.owners?.at(-1)?.[1] ?? null
const provsOf = new Map()
for (const p of W.provinces) { const o = owner(p); if (!o) continue; (provsOf.get(o) ?? provsOf.set(o, []).get(o)).push(p) }
const areaById = new Map(W.adminRegions.map((a) => [a.id, a]))
const SW = { capital: 60, city: 40, town: 14, port: 16, castle: 4, temple: 3, village: 3, fishing: 2, tower: 1, ruins: 0 }
const TF = { 1: 1.2, 2: 0.8, 3: 1, 4: 0.55, 5: 0.3, 6: 0.45 }
const DENS = { imperial: 9000, church: 8000, romance: 8000, eleon: 8000, kaltrans: 7000, nordic: 2500, dwarven: 8000, elven: 3000, eluin: 3500, desert: 3000, cin: 9000, zlatay: 5000, orcish: 2500, yut: 6000, dark: 2000 }

// ---------- промыслы: по местности + по тексту экономики страны ----------
const KEYS = [
  ['salt', /сол[ьи]\b|соля/i], ['silver', /серебр|золот/i], ['iron', /желез/i], ['copper', /\bмед[ьи]\b|олов/i], ['coal', /уг[оо]?л[ья]|\bуголь/i],
  ['stone', /мрамор|камен|жернов|базальт/i], ['wood', /\bлес\b|лесн|тис|сосн|смол|дёгот/i], ['wine', /вин[оа]|виноград|пряност|благовон/i],
  ['fish', /рыб|кит|тюлен/i], ['furs', /мех[аи]|пушн|шкур/i], ['horses', /\bкон[ейиь]|конн/i], ['luxury', /шёлк|шелк|ювели|самоцвет|магнол|красил|лак\b/i],
  ['saltpetre', /селитр/i], ['grain', /хлеб|зерн|пшени|ячмен|житниц|хмел/i], ['cattle', /скот|овец|овеч|шерст|сукн|кож/i], ['reagents', /реагент|дака|чёрный камень|смол[аы] колодца/i]
]
function terrainRes(p, cult) {
  const h = hash(p.id), r = (h % 100) / 100
  if (p.coastal && (p.settlement?.type === 'fishing' || p.settlement?.type === 'port' || r < 0.25)) return 'fish'
  switch (p.terrain) {
    case 1: return ['zlatay', 'orcish', 'desert'].includes(cult) && r < 0.2 ? 'horses' : r < 0.72 ? 'grain' : 'cattle'
    case 2: return ['nordic', 'eluin', 'zlatay'].includes(cult) && r < 0.3 ? 'furs' : r < 0.85 ? 'wood' : 'cattle'
    case 3: return ['romance', 'kaltrans', 'desert'].includes(cult) && r < 0.3 ? 'wine' : r < 0.6 ? 'cattle' : 'grain'
    case 4: return r < 0.38 ? 'iron' : r < 0.6 ? 'stone' : r < 0.78 ? 'copper' : r < 0.88 ? 'silver' : 'coal'
    case 5: return p.coastal && r >= 0.7 ? 'fish' : 'furs'
    case 6: return r < 0.3 ? 'salt' : r < 0.55 ? 'horses' : 'cattle'
  }
  return 'grain'
}
const FITS = { salt: [6, 1, 4, 3], silver: [4, 3], iron: [4, 3], copper: [4, 3], coal: [4, 3, 2], stone: [4, 3], wood: [2], wine: [3, 1], fish: [], furs: [5, 2], horses: [1, 6], luxury: [1, 3], saltpetre: [6, 4, 3], grain: [1], cattle: [3, 1], reagents: [4, 2, 5] }

// ---------- постройки областей по тексту экономики ----------
const BUILD = [[/ткач|ткацк|сукн|мануфакт/i, 'ткацкая мануфактура'], [/литейн|оружейн|пушк/i, 'литейный двор'], [/верф|судостро/i, 'верфь'], [/типограф|печатн/i, 'типография'], [/банк|меняльн/i, 'банк'], [/рудник|шахт|копи|жил[аы]/i, 'рудник'], [/мельниц/i, 'мельница'], [/пивовар|пиво/i, 'пивоварня'], [/порт|гавань/i, 'порт'], [/ярмарк|рынок/i, 'ярмарка']]

let nStates = 0
const live = W.states.filter((s) => provsOf.has(s.id))
for (const s of live) {
  const b = s.base, provs = provsOf.get(s.id), M = ECON_STATES[b.name] ?? {}
  // главная культура страны
  const cc = {}; for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((a, c) => c[1] - a[1])[0][0], K = C[cult] ?? C.imperial
  const total = M.pop ?? (parsePop(b.population) || provs.reduce((a, p) => a + (DENS[p.culture] ?? 5000) * (TF[p.terrain] ?? 1), 0))
  const races = norm(M.races ?? parseRaces(b.population, total) ?? MIX[cult] ?? { [K.race]: 1 })
  const unfreeN = M.unfree ?? parseUnfree(b.population)
  const share = [...(M.share ?? K.share)]
  if (unfreeN) { share[5] = Math.min(0.6, unfreeN / total); const rest = 1 - share[5], s0 = share.slice(0, 5).reduce((a, c) => a + c, 0); for (let i = 0; i < 5; i++) share[i] = (share[i] / s0) * rest }
  if (M.noUnfree) { const u = share[5]; share[5] = 0; share[0] += u }
  const names = M.estates ?? Object.fromEntries(ROLE.map((r, i) => [r, K.names[i]]).filter(([, n], i) => n && share[i] > 0))

  // промыслы провинций
  for (const p of provs) p.res = { good: terrainRes(p, p.culture), rich: 1 + (hash(p.id + 'r') % 3) }
  const text = `${b.economy ?? ''} ${M.text ?? ''}`
  for (const [good, re] of KEYS) {
    if (!re.test(text)) continue
    const fit = FITS[good] ?? []
    const cand = provs.filter((p) => (good === 'fish' ? p.coastal : !fit.length || fit.includes(p.terrain)) && p.res.good !== good)
    const want = Math.max(1, Math.round(provs.length * (['silver', 'saltpetre', 'luxury', 'reagents', 'furs'].includes(good) ? 0.04 : 0.08)))
    for (const p of cand.sort((a, c) => hash(a.id + good) - hash(c.id + good)).slice(0, want)) p.res = { good, rich: Math.min(3, p.res.rich + 1) }
  }
  for (const [pid, good, rich] of M.res ?? []) { const p = provs.find((x) => x.name === pid || x.id === pid); if (p) p.res = { good, rich: rich ?? 3 } }

  // население провинций и областей
  const wsum = provs.reduce((a, p) => a + (SW[p.settlement?.type] ?? 1) * (TF[p.terrain] ?? 1) + 1, 0)
  const areas = new Map()
  for (const p of provs) {
    p.pop = Math.round((total * ((SW[p.settlement?.type] ?? 1) * (TF[p.terrain] ?? 1) + 1)) / wsum / 10) * 10
    const a = areaById.get(p.areaId); if (!a) continue
    areas.set(a.id, (areas.get(a.id) ?? 0) + p.pop)
  }
  const tech = b.tech?.levels ?? {}
  for (const [aid, n] of areas) {
    const a = areaById.get(aid)
    const ap = provs.filter((p) => p.areaId === aid)
    const mix = areaMix(races, ap, cult)
    const chained = Object.keys(mix).filter((r) => UNFREE_RACES.has(r)).reduce((a, r) => a + mix[r], 0)
    const pop = {}
    for (const [race, rs] of Object.entries(mix)) {
      const row = {}
      if (UNFREE_RACES.has(race)) { const v = Math.round((n * rs) / 10) * 10; if (v > 0 && names.unfree) row.unfree = v }
      else ROLE.forEach((r, i) => {
        // если несвободных даёт свой народ (Цепной народ) — у остальных их нет, доли делятся на свободные роли
        const sh = chained ? (r === 'unfree' ? 0 : share[i] / (1 - share[5] || 1)) : share[i]
        const v = Math.round((n * rs * sh) / 10) * 10; if (v > 0 && names[r]) row[r] = v
      })
      if (Object.keys(row).length) pop[race] = row
    }
    const food = ap.filter((p) => ['grain', 'fish', 'cattle'].includes(p.res.good)).length / ap.length
    const content = {}; for (const r of ROLE) if (names[r]) content[r] = Math.max(20, Math.min(85, 62 + (r === 'unfree' ? -20 : 0) + (r === 'rulers' ? 8 : 0) + Math.round((food - 0.4) * 20)))
    const words = (ap.map((p) => p.description ?? '').join(' ') + ' ' + (a.description ?? '')).slice(0, 6000)
    const buildings = [...new Set(BUILD.filter(([re]) => re.test(words)).map(([, n]) => n))]
    a.econ = { pop, content, granary: Math.round(n * (0.6 + food) * 0.12), buildings }
  }
  // постройки столицы — из текста экономики страны
  const cap = provs.find((p) => p.settlement?.type === 'capital' || p.settlement?.type === 'city')
  const ca = cap && areaById.get(cap.areaId)
  if (ca?.econ) ca.econ.buildings = [...new Set([...ca.econ.buildings, ...BUILD.filter(([re]) => re.test(b.economy ?? '')).map(([, n]) => n)])]

  // беды и силы
  const coast = provs.filter((p) => p.coastal).length / provs.length
  const foodAll = provs.filter((p) => ['grain', 'fish', 'cattle'].includes(p.res.good)).length / provs.length
  const mount = provs.filter((p) => p.terrain >= 4).length / provs.length
  const troubles = [...(M.troubles ?? [])], strengths = [...(M.strengths ?? [])]
  if (!M.troubles) {
    if (coast === 0) troubles.push('Нет выхода к морю: торговля идёт по суше и через чужие пошлины.')
    if (foodAll < 0.3) troubles.push('Своего хлеба не хватает — кормит рынок, и цена зимы бьёт по казне.')
    if (mount > 0.65) troubles.push('Горы: мало пашни, дорогие дороги.')
    if (share[5] > 0.15) troubles.push('Держится на подневольном труде — несвободные вспыхивают быстро.')
    if (!troubles.length) troubles.push(pick(b.name, ['Дорогой двор и чиновники съедают подати.', 'Знать не любит платить и прячет доход.', 'Соседи держат главные пути и берут пошлину.']))
  }
  if (!M.strengths) {
    const cnt = {}; for (const p of provs) cnt[p.res.good] = (cnt[p.res.good] ?? 0) + p.res.rich
    const top = Object.entries(cnt).filter(([g]) => !['grain', 'cattle', 'wood'].includes(g)).sort((a, c) => c[1] - a[1])[0]
    const NM = { salt: 'соли', silver: 'серебра', iron: 'железа', copper: 'меди', coal: 'угля', stone: 'камня', wine: 'вина', fish: 'рыбы', furs: 'мехов', horses: 'коней', luxury: 'роскоши', saltpetre: 'селитры', reagents: 'реагентов Даки' }
    if (top) strengths.push(`Богата ${NM[top[0]] ?? top[0]}.`)
    if (foodAll > 0.6) strengths.push('Хлебный край: свой хлеб с запасом.')
    if (coast > 0.5) strengths.push('Море рядом: дешёвая торговля и рыба.')
  }
  const money = tech.money ?? 2
  const threshold = M.threshold ?? K.th + (share[5] > 0.15 ? 6 : 0)
  const old = b.econ ?? {}
  b.econ = {
    coin: M.coin ?? { name: K.coin, perMark: Math.round((0.35 + money * 0.13 + ((hash(b.name) % 9) - 4) / 100) * 100) / 100 },
    estates: names,
    threshold,
    troubles,
    strengths,
    treasury: M.treasury ?? Math.round((total * (0.4 + money * 0.5)) / 100 / 10) * 10,
    taxes: Object.fromEntries(Object.keys(names).map((r) => [r, M.taxes?.[r] ?? 'обычные'])),
    debts: M.debts ?? old.debts ?? [],
    history: old.history ?? [],
    special: M.special ?? []
  }
  nStates++
}
W.version = Math.max(W.version ?? 0, 63)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
const withRes = W.provinces.filter((p) => p.res).length, withEcon = W.adminRegions.filter((a) => a.econ).length
console.log(`экономика: стран ${nStates}, провинций с промыслом ${withRes}, областей ${withEcon}`)
