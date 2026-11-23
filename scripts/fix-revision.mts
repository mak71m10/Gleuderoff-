// Правка данных по ревизии противоречий (docs/ревизия-противоречий.md, п. Ж, З, И), мир v68.
// Запуск: npx esbuild scripts/fix-revision.mts --bundle --platform=node --format=esm --outfile=node_modules/.cache/fix-revision.mjs && node node_modules/.cache/fix-revision.mjs
// То же переносит в мир мастера миграция v68 (src/main/index.ts).
import { readFileSync, writeFileSync } from 'fs'
import { ownerAt } from '../src/renderer/src/provinces'
import { worldReports } from '../src/renderer/src/econCalc'

const FILE = 'resources/default-world/world.json'
const W = JSON.parse(readFileSync(FILE, 'utf8'))
const byName = (n: string) => { const s = W.states.find((x: any) => x.base.name === n); if (!s) throw new Error('нет страны ' + n); return s }
const present = W.calendar.present
const log: string[] = []

// Ж. технологии: у кого лор даёт свои рода войск и корабли — технологии поднимаются до них (лор главнее, но без противоречия)
export const TECH_FIX: Record<string, Record<string, number>> = {
  'Империя': { magic: 3, sea: 3 }, // лицензированные маги Кругов; каракки Аурхафена
  'Креит': { magic: 3 }, // берсерки — обряд крови
  'Княжества Гарефорда': { magic: 2 }, // Хранители Пламени
  'Фарвольская лига': { magic: 2 }, // рунные латы и щиты
  'Крайдонианская Лига': { powder: 4 }, // береговые канониры, линейные корабли
  'Златайская Гетманщина': { powder: 3 }, // реестровые казаки с пищалями
  'Семья Каяя': { powder: 3 } // каравеллы стражи с пушками
}
for (const [n, t] of Object.entries(TECH_FIX)) {
  const lv = byName(n).base.tech.levels
  for (const [k, v] of Object.entries(t)) if ((lv[k] ?? 0) < v) { log.push(`${n}: ${k} ${lv[k]} → ${v}`); lv[k] = v }
}

// З. эскадры не у моря — в ближайшую свою приморскую область
for (const st of W.states) {
  const nv = st.base.military?.navy
  if (!nv) continue
  const own = W.provinces.filter((p: any) => ownerAt(p, present) === st.id)
  const coast = own.filter((p: any) => p.coastal)
  if (!coast.length) continue
  const fix = (o: { base?: number; name: string }) => {
    const p = W.provinces.find((x: any) => x.id === o.base)
    if (!p || p.coastal) return
    const best = coast.reduce((b: any, x: any) => ((x.x - p.x) ** 2 + (x.y - p.y) ** 2 < (b.x - p.x) ** 2 + (b.y - p.y) ** 2 ? x : b))
    log.push(`${st.base.name}: «${o.name}» ${p.name} → ${best.name}`)
    o.base = best.id
  }
  for (const q of nv.squadrons) fix(q)
  for (const f of nv.fleets) fix(f)
}

// И. долг Республики — банку Лиги Векселя (Гольдахи, Тиррит), как в лоре городов
for (const st of W.states) for (const d of st.base.econ?.debts ?? []) if (d.to === 'Банк Гольдах') { d.to = 'Банк Гольдах (Лига Векселя, Тиррит)'; log.push(`${st.base.name}: долг — Банк Гольдах (Лига Векселя, Тиррит)`) }

// И. голод по расчёту — в беды страны
const reps = worldReports(W, present)
export const FAMINE_NOTE: Record<string, string> = {
  'Фарвольская лига': 'Под камнем хлеб не растёт: своего зерна — около {p} % нужды, остальное везут с Поверхности за железо и серебро. Перекроют подвоз — подземным городам грозит голод.',
  'Республика Чеафарал': 'Своего хлеба — около {p} % годовой нужды: остальное покупают у соседей и на рынке Каяи. Война или неурожай за границей — и в городах голод.',
  'Высокогорное Княжество': 'Горные пашни дают лишь {p} % нужного хлеба: зерно везут снизу, из долин. Закроются перевалы — голод.',
  'Дресфент': 'Своего хлеба — около {p} % нужды: остальное привозное. Неурожай у соседей бьёт по Дресфенту сильнее, чем по ним самим.',
  'Анастар': 'Горная пустыня: своего хлеба — около {p} % нужды, остальное везут караваны. Перережут караванные пути — голод в крепостях у колодцев.'
}
for (const [n, text] of Object.entries(FAMINE_NOTE)) {
  const st = byName(n), r = reps.get(st.id)
  if (!r) continue
  const line = text.replace('{p}', String(Math.round(r.food.yearPct / 5) * 5))
  const tr: string[] = (st.base.econ.troubles ??= [])
  if (!tr.some((x) => /хлеб/.test(x) && /нужд/.test(x))) { tr.push(line); log.push(`${n}: беда — ${line.slice(0, 60)}…`) }
}

W.version = Math.max(W.version ?? 1, 68)
writeFileSync(FILE, JSON.stringify(W))
console.log(log.join('\n'))
