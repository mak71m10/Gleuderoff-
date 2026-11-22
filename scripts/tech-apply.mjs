// «Век Шестерни»: записывает технологии стран (scripts/lore/tech.mjs) в мир — states[].base.tech — и собирает
// docs/технологии.md из тех же данных и описаний уровней (src/renderer/src/tech.ts).
// Журнал изменений (log), который уже есть у страны в мире, сохраняется.
// node scripts/tech-apply.mjs
import { readFileSync, writeFileSync, renameSync } from 'fs'
import { TECH, EPOCH } from './lore/tech.mjs'
import { TECH_LINES, POWDER_ATTITUDES } from '../src/renderer/src/tech.ts'

const WF = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(WF, 'utf8'))

// живые страны и их континенты
const ar = new Map(W.adminRegions.map((a) => [a.id, a]))
const top = (id) => { let a = ar.get(id); while (a?.parentId && ar.get(a.parentId)) a = ar.get(a.parentId); return a?.name }
const cont = new Map()
for (const p of W.provinces) {
  const o = p.owners?.at(-1)?.[1]
  if (!o) continue
  const m = cont.get(o) ?? {}
  const c = top(p.areaId); m[c] = (m[c] ?? 0) + 1; cont.set(o, m)
}
const live = W.states.filter((s) => cont.has(s.id))
const missing = [], unused = new Set(Object.keys(TECH))
for (const s of live) {
  const t = TECH[s.base.name]
  if (!t) { missing.push(s.base.name); continue }
  unused.delete(s.base.name)
  s.base.tech = { ...t, log: s.base.tech?.log ?? [] }
}
if (missing.length) console.log('Нет данных о технологиях:', missing.join(', '))
if (unused.size) console.log('Данные есть, а страны нет:', [...unused].join(', '))
W.version = Math.max(W.version ?? 0, 62) // v62 — технологии (миграция в src/main/index.ts)
writeFileSync(WF + '.tmp', JSON.stringify(W, null, 1)); renameSync(WF + '.tmp', WF)
console.log(`технологии записаны: ${live.length - missing.length} стран`)

// ---------- docs/технологии.md ----------
const L = TECH_LINES
const dots = (n) => '●'.repeat(n) + '○'.repeat(5 - n)
const ORDER = ['Лора', 'Святой архипелаг', 'Восходные острова', 'Закатные острова', 'Лиза', 'Эльза', 'Земли Тьмы']
const byCont = new Map(ORDER.map((c) => [c, []]))
for (const s of live) {
  if (!s.base.tech) continue
  const c = Object.entries(cont.get(s.id)).sort((a, b) => b[1] - a[1])[0][0]
  if (!byCont.has(c)) byCont.set(c, [])
  const n = W.provinces.filter((p) => p.owners?.at(-1)?.[1] === s.id).length
  byCont.get(c).push({ s, n })
}
const out = []
out.push(`# ${EPOCH.name} — технологическая эпоха Gleuderoff (${EPOCH.year} г.)`, '')
out.push('> Документ собирается скриптом `node scripts/tech-apply.mjs` из `scripts/lore/tech.mjs` (страны) и `src/renderer/src/tech.ts` (линии и уровни). Править — там, а не здесь.', '')
out.push('**Коротко:** средневековый облик и обычаи — гербы, замки, сословия, цеха; общество — как в XVIII–XIX веках: канцелярии, почта, банки, газеты, мануфактуры. Двигатель прогресса — **шестерня** гномов. **Порох** появился недавно, его мало: где-то он под запретом, где-то его считают глупостью, а Дака делает его ненадёжным. **Пар** — первые машины, их можно пересчитать по пальцам.', '')
const sec = (title, paras) => { out.push(`## ${title}`, ''); for (const p of paras) out.push(p, '') }
sec('Порох: недавний, редкий и капризный', EPOCH.powderHistory)
sec('Шестерня — двигатель эпохи', EPOCH.gearHistory)
sec('Пар — первые машины', EPOCH.steamHistory)
sec('Общество XVIII–XIX века в средневековом облике', EPOCH.society)
sec('Магия в Век Шестерни', EPOCH.magic)
out.push('## Линии и уровни', '', 'У каждой страны восемь линий, уровень 0–5. Пятого уровня в 1010 г. почти нет нигде — это потолок эпохи.', '')
for (const l of L) {
  out.push(`### ${l.name}`, '', l.about, '')
  l.levels.forEach((t, i) => out.push(`${i}. ${t}`))
  out.push('')
}
out.push('### Отношение к пороху', '')
for (const [k, v] of Object.entries(POWDER_ATTITUDES)) out.push(`- **${k}** — ${v}`)
out.push('')
sec('Как игроки развивают технологии', EPOCH.players)
out.push('## Сводная таблица', '')
out.push(`| Страна | ${L.map((l) => l.name).join(' | ')} | Порох — отношение |`)
out.push(`|---|${L.map(() => ':-:').join('|')}|---|`)
for (const [c, list] of byCont) {
  if (!list.length) continue
  out.push(`| **${c}** |${L.map(() => '').join('|')}| |`)
  for (const { s } of list.sort((a, b) => b.n - a.n)) out.push(`| ${s.base.name} | ${L.map((l) => s.base.tech.levels[l.key]).join(' | ')} | ${s.base.tech.attitude} |`)
}
out.push('')
out.push('## Страны', '')
for (const [c, list] of byCont) {
  if (!list.length) continue
  out.push(`### ${c}`, '')
  for (const { s, n } of list.sort((a, b) => b.n - a.n)) {
    const t = s.base.tech
    out.push(`#### ${s.base.name} (${n} пров.)`, '')
    out.push(L.map((l) => `${l.name} ${dots(t.levels[l.key])}`).join(' · '), '')
    out.push(`**Порох:** ${t.attitude} — ${POWDER_ATTITUDES[t.attitude] ?? ''}`, '')
    out.push(t.note, '')
    if (t.next) out.push(`**Следующий шаг:** ${t.next}`, '')
  }
}
writeFileSync('docs/технологии.md', out.join('\n'))
console.log('docs/технологии.md собран')
