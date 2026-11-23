// Отношения между странами для меню дипломатии (src/renderer/src/diplomacy.ts): из лора (поле «Союзы, войны, договоры, отношения»),
// из вассалитета (overlordId) и для всех соседей по суше. Пишет world.relations: { id, a, b, kind, base, treaties, note, source, from }.
// Мастер и вердикты потом правят отношения с датой (новая запись «с даты»). Запуск: node scripts/diplomacy-seed.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))
const live = W.states.filter((s) => s.base.military) // живые страны (у исторических нет войска)
const GENERIC = /^(королевство|княжество|княжества|графство|герцогство|маркграфство|республика|империя|архиепархия|архиепископия|союз|содружество|династия|семья|орден|клан|ханство|шейхство|земли|протекторат|братство|объединённые|вуфинская|кальтранская|великая|северная|южная|высокогорное|имперские|святая|церковь)$/i
// как страну называют в тексте: полное имя, последнее слово, отличительные слова (по основе)
const variants = (name) => {
  const words = name.split(/\s+/)
  const out = new Set([name.toLowerCase()])
  for (const w of words) if (w.length >= 5 && !GENERIC.test(w)) out.add(w.toLowerCase().slice(0, Math.max(5, w.length - 2)))
  return [...out]
}
const V = live.map((s) => ({ s, v: variants(s.base.name) }))
const mentions = (text) => {
  const t = text.toLowerCase()
  const hit = []
  for (const { s, v } of V) if (v.some((x) => t.includes(x))) hit.push(s)
  // «Империя Кагия» не должна засчитываться как «Империя»: длинное имя главнее
  return hit.filter((s) => !hit.some((o) => o !== s && o.base.name.length > s.base.name.length && o.base.name.includes(s.base.name) && t.includes(o.base.name.toLowerCase())))
}
const RULES = [
  ['war', -80, /войн[аеуы]|воюе?т|в войне|осажда/i],
  ['vassal', 15, /вассал|сюзерен|присяг|данник|дань\b|платит дань|под протекторат/i],
  ['alliance', 55, /союз(ник)?|дружб|брак|родня|обручен/i],
  ['hostile', -45, /враг|вражд|ненавист|набег|грабил|жгли|угроз|резн|кровн|месть/i],
  ['tension', -20, /спор|напряж|подозрева|соперни|ревну|холод|оборвал|стычк|беженц|дозор|дезертир|шантаж|бывший (сюзерен|хозяин)|не платит|к независимости/i],
  ['trade', 20, /торг|купц|покупа|прода|рынок|товар|кредитор|займ|заём|пай|ярмарк|караван/i],
  ['neutral', 0, /безразлич|нейтрал|граница|соседи/i]
]
const PRIORITY = ['war', 'vassal', 'alliance', 'hostile', 'tension', 'trade', 'neutral']
const TREATY = [['debt', /кредитор|займ|заём|пай|долг/i], ['trade', /торг|рынок|товар/i], ['tribute', /дань|данник|подать/i], ['marriage', /брак|обручен/i], ['passage', /проход|перевал/i]]

const rel = new Map() // ключ пары → запись
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const add = (a, b, kind, score, note, treaties, source) => {
  if (!a || !b || a === b) return
  const k = key(a, b)
  const cur = rel.get(k)
  if (!cur) { rel.set(k, { id: `r${rel.size + 1}`, a: k.split('|')[0], b: k.split('|')[1], kind, base: score, treaties: [...new Set(treaties)], note, source, n: 1 }); return }
  // оба упоминают друг друга: худший/сильнейший вид, оценка — среднее
  if (PRIORITY.indexOf(kind) < PRIORITY.indexOf(cur.kind)) cur.kind = kind
  cur.base = Math.round((cur.base * cur.n + score) / (cur.n + 1)); cur.n++
  cur.treaties = [...new Set([...cur.treaties, ...treaties])]
  if (note && !cur.note.includes(note)) cur.note = `${cur.note}\n${note}`.trim()
}

// 1. лор
let fromLore = 0
for (const s of live) {
  const text = String(s.base.diplomacy ?? '')
  if (!text) continue
  // каждое выделенное **Имя** начинает свой кусок (бывает, весь текст — одна строка)
  const parts = text.replace(/\*\*(?=[А-ЯЁA-Z])/g, '\n**').split(/\n+|(?<=[.;])\s+(?=[А-ЯЁ*])/).map((x) => x.trim()).filter(Boolean)
  for (const seg of parts) {
    const who = mentions(seg).filter((o) => o.id !== s.id)
    if (!who.length) continue
    // вассалитет — только по полю «Сюзерен» (ниже): в тексте «вассал» бывает и «бывший», и «дружба вассалов»
    const kinds = RULES.filter(([k, , re]) => k !== 'vassal' && re.test(seg))
    const kind = kinds.length ? kinds.sort((x, y) => PRIORITY.indexOf(x[0]) - PRIORITY.indexOf(y[0]))[0][0] : 'neutral'
    const score = kinds.length ? Math.round(kinds.reduce((sum, k) => sum + k[1], 0) / kinds.length) : 0
    const treaties = TREATY.filter(([, re]) => re.test(seg)).map(([t]) => t)
    const note = `${s.base.name}: ${seg.replace(/\*\*/g, '').slice(0, 220)}`
    for (const o of who) { add(s.id, o.id, kind, score, note, treaties, 'lore'); fromLore++ }
  }
}
// 2. вассалитет
for (const s of live) if (s.base.overlordId && live.some((o) => o.id === s.base.overlordId)) {
  const k = key(s.id, s.base.overlordId), cur = rel.get(k)
  if (cur) { cur.kind = cur.kind === 'war' ? 'war' : 'vassal'; cur.overlord = s.base.overlordId; if (!cur.treaties.includes('tribute')) cur.treaties.push('tribute') }
  else { add(s.id, s.base.overlordId, 'vassal', 15, '', ['tribute'], 'lore'); rel.get(k).overlord = s.base.overlordId }
}
// 3. соседи по суше без лора — нейтралитет
const owner = (p) => p.owners?.at(-1)?.[1]
const byId = new Map(W.provinces.map((p) => [p.id, p]))
const liveIds = new Set(live.map((s) => s.id))
const borders = new Map()
for (const p of W.provinces) { const o = owner(p); if (!liveIds.has(o)) continue; for (const n of p.neighbors ?? []) { const q = owner(byId.get(n) ?? {}); if (q && q !== o && liveIds.has(q)) { const k = key(o, q); borders.set(k, (borders.get(k) ?? 0) + 1) } } }
for (const [k, n] of borders) if (!rel.has(k)) { const [a, b] = k.split('|'); add(a, b, 'neutral', 0, '', [], 'auto') }

W.relations = [...rel.values()].map(({ n, ...r }) => ({ ...r, from: W.calendar.present - 500 * 3 }))
W.version = Math.max(W.version ?? 0, 68)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
const by = {}; for (const r of W.relations) by[r.kind] = (by[r.kind] ?? 0) + 1
console.log(`отношения: ${W.relations.length} пар (из лора — упоминаний ${fromLore}); по видам:`, by)
