// Инструменты ВПИ для мастера и агентов стран (docs/впи-ход.md): досье страны, прогноз решения, поход, внесение вердикта в мир, сводка хода.
// Запуск: node scripts/vpi.mjs <команда> … (собирает этот файл esbuild'ом). Мир — мир мастера (Документы\Gleuderoff\worlds\gleuderoff\world.json)
// или --world <путь>; --dev — стартовый мир проекта. Перед каждой правкой — копия в backups/.
import { readFileSync, writeFileSync, renameSync, copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import { worldReports, provincesOf } from '../../src/renderer/src/econCalc'
import { forecast, decideProfile, TOPICS, actTitle, levelAt, taxesAt, type Decision, type Topic, type Act } from '../../src/renderer/src/decisions'
import { MEASURES, armyLedger } from '../../src/renderer/src/armyLedger'
import { companiesUnder, rearmCost, rearmDays, trainCost, orderEnd } from '../../src/renderer/src/orders'
import { planMarch } from '../../src/renderer/src/marches'
import { SHIP, squadronStats } from '../../src/renderer/src/fleet'
import { ARM, PART, PARTS, SLOTS, KIT, companyStats, type CompanyTemplate, type Formation, type MeasureKind, type StateMilitary } from '../../src/renderer/src/military'
import { formatDate, fromParts, toParts } from '../../src/renderer/src/calendar'
import type { WorldData, WorldState } from '../../src/renderer/src/types'

type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any
const args = process.argv.slice(2)
const flag = (k: string): string | undefined => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const has = (k: string): boolean => args.includes(k)
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--world', '--date', '--since'].includes(args[i - 1])))

// ---------- мир ----------
function docs(): string {
  try { return execSync('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'MyDocuments\')"', { encoding: 'utf8' }).trim() } catch { return join(homedir(), 'Documents') }
}
const WORLD = flag('--world') ?? (has('--dev') ? 'resources/default-world/world.json' : join(docs(), 'Gleuderoff', 'worlds', 'gleuderoff', 'world.json'))
if (!existsSync(WORLD)) { console.error(`Нет мира: ${WORLD}`); process.exit(1) }
const W: WorldData & Json = JSON.parse(readFileSync(WORLD, 'utf8'))
const NEED = 66
if ((W.version ?? 0) < NEED) { console.error(`Мир версии ${W.version}: откройте приложение 0.46 или новее — оно обновит мир до ${NEED}, потом повторите.`); process.exit(1) }
const save = (): void => {
  const dir = dirname(WORLD), bk = join(dir, 'backups')
  mkdirSync(bk, { recursive: true })
  copyFileSync(WORLD, join(bk, `world-vpi-${new Date().toISOString().replace(/[:.]/g, '-')}.json`))
  writeFileSync(WORLD + '.tmp', JSON.stringify(W, null, 1), 'utf8'); renameSync(WORLD + '.tmp', WORLD)
}
const cal = W.calendar
const parseDate = (s: string): number => { const [y, m, d] = s.split(/[.\-/]/).map(Number); return fromParts(cal, { year: y, month: Math.max(0, (m ?? 1) - 1), day: d ?? 1 }) }
/** текущая дата игры: --date, иначе world.vpi.date, иначе «настоящее» календаря */
const DATE = flag('--date') ? parseDate(flag('--date')!) : (W.vpi?.date ?? cal.present)
const fd = (d: number): string => formatDate(cal, d)
const findState = (q: string): WorldState => {
  const s = W.states.find((x) => x.base.name.toLowerCase() === q.toLowerCase()) ?? W.states.find((x) => x.base.name.toLowerCase().includes(q.toLowerCase()))
  if (!s) { console.error(`Нет страны «${q}»`); process.exit(1) }
  return s
}
const marks = (v: number): string => `${Math.round(v).toLocaleString('ru-RU')} мар.`

// ---------- досье ----------
function dossier(st: WorldState): string {
  const b = st.base, out: string[] = []
  const rep = worldReports(W, DATE).get(st.id)
  out.push(`# ${b.name} — досье на ${fd(DATE)}`, '', `**Строй:** ${b.government}. **Правитель:** ${b.ruler || '—'} (${b.rulerTitle || ''}). **Столица:** ${W.places.find((p) => p.id === b.capitalId)?.base?.name ?? '—'}.`)
  if (b.laws) out.push(`**Законы:** ${String(b.laws).replace(/\s+/g, ' ').slice(0, 600)}`)
  out.push('', '## Как решает страна')
  const prof = decideProfile(W, st)
  for (const k of Object.keys(TOPICS) as Topic[]) out.push(`- ${TOPICS[k].name}: **${prof[k].name}** (${prof[k].kind}, ${prof[k].days} дн.) — ${prof[k].how}`)
  if (rep) {
    out.push('', '## Экономика', `Казна: ${marks(rep.treasury)}; за ход: ${rep.net >= 0 ? '+' : ''}${marks(rep.net)}. Население ≈ ${Math.round(rep.pop).toLocaleString('ru-RU')}. Хлеб: ${rep.food.yearPct} % годовой потребности.`)
    out.push(`Доходы: ${rep.income.map((l) => `${l.name} ${l.amount}`).join('; ')}`)
    out.push(`Расходы: ${rep.expense.map((l) => `${l.name} ${l.amount}`).join('; ')}`)
    const tx = taxesAt(st, DATE)
    out.push(`Подати: ${Object.entries(b.econ?.estates ?? {}).map(([r, n]) => `${n} [${r}] — ${tx[r as keyof typeof tx] ?? 'обычные'}, довольство ${rep.content[r as keyof typeof rep.content] ?? '—'}`).join('; ')}`)
    if (b.econ?.debts?.length) out.push(`Долги: ${b.econ.debts.map((d) => `${d.to} ${Math.round(d.sum)} под ${(d.rate * 100).toFixed(1).replace(".", ",")} %`).join('; ')}`)
  }
  const m = b.military as StateMilitary | undefined
  if (m) {
    const L = rep?.ledger
    out.push('', '## Войско', `Лестница: ${Object.values(m.ladder).join(' → ')}. Закон: ${m.law.name}; уровень сбора: ${levelAt(st, DATE)}. Людей: ${(L?.men ?? 0).toLocaleString('ru-RU')}; казне стоит ${marks(L?.total ?? 0)} за ход${L ? `; утечки ${Math.round(L.leak.rate * 100)} % (${L.leak.who}) — ТАЙНА МАСТЕРА` : ''}.`)
    const fById = new Map(m.formations.map((f) => [f.id, f]))
    const prov = new Map((W.provinces ?? []).map((p) => [p.id, p.name]))
    const menOf = (f: Formation): number => companiesUnder(m, f).reduce((s, id) => s + (m.companies.find((c) => c.id === id)?.men ?? 0), 0)
    const line = (f: Formation, depth: number): void => {
      if (f.level === 'battalion' || depth > 2) return
      out.push(`${'  '.repeat(depth)}- [${f.id}] ${f.name} (${m.ladder[f.level as keyof typeof m.ladder]}), ${menOf(f).toLocaleString('ru-RU')} чел., стоит: ${f.base != null ? prov.get(f.base) : '—'}${f.cmd ? `, командир ${f.cmd.name}` : ''}`)
      for (const ch of f.children) { const x = fById.get(ch); if (x) line(x, depth + 1) }
    }
    for (const r of m.roots) { const f = fById.get(r); if (f) line(f, 0) }
    out.push(`Уставы: ${m.templates.map((t) => `[${t.id}] ${t.name} (${ARM[t.arm]?.name}${t.unique ? ', свой' : ''}; ${m.companies.filter((c) => c.t === t.id).length} рот)`).join('; ')}`)
    // каталог деталей для перевооружения: ячейка → id (название); [закрыто] — не хватает технологий
    const tech = (b.tech?.levels ?? {}) as Record<string, number>
    const locked = (req?: Record<string, number>): boolean => !!req && Object.entries(req).some(([k, v]) => (tech[k] ?? 0) < v)
    out.push('Детали для перевооружения (parts: ячейка → id):')
    for (const s of SLOTS) out.push(`  ${s.key} (${s.name}): ${PARTS.filter((x) => x.slot === s.key).map((x) => `${x.id}=${x.name}${locked(x.req) ? ' [закрыто]' : ''}`).join(', ')}`)
    out.push(`  kit: ${KIT.map((k) => `${k.id}=${k.name}${locked(k.req) ? ' [закрыто]' : ''}`).join(', ')}`)
    const act = (m.orders ?? []).filter((o) => orderEnd(o) > DATE)
    if (act.length) out.push(`Приказы в работе: ${act.map((o) => `${o.kind === 'rearm' ? 'перевооружение' : 'учения'} ${o.note} до ${fd(orderEnd(o))}`).join('; ')}`)
    if ((m.measures ?? []).length) out.push(`Меры: ${m.measures!.map((x) => `${MEASURES[x.kind].name} с ${fd(x.from)}`).join('; ')}`)
    if (m.navy) out.push(`Флот: ${m.navy.squadrons.map((s) => `${s.name} ${s.count}×${SHIP[s.ship]?.name}${s.merchant ? ' (торговые)' : ''}`).join('; ')} — содержание ${marks(m.navy.squadrons.reduce((s, q) => s + squadronStats(q).cost, 0))}`)
  }
  const dec = (b.decisions ?? []).slice(-8)
  if (dec.length) out.push('', '## Решения', ...dec.map((d) => `- ${d.title} — ${d.status} (${d.body}, решится ${fd(d.due)})`))
  const log = ((W.vpiLog ?? []) as Json[]).filter((x) => x.state === b.name).slice(-6)
  if (log.length) out.push('', '## Последние вердикты', ...log.map((x) => `- ${fd(x.date)}: ${x.title} — ${x.verdict.slice(0, 200)}`))
  if (rep) out.push('', `Соседи: ${rep.neighbors.map((id) => W.states.find((s) => s.id === id)?.base.name).filter(Boolean).join(', ')}`)
  return out.join('\n')
}

// ---------- внесение вердикта ----------
const fByName = (m: StateMilitary, q: string): Formation | undefined => m.formations.find((f) => f.id === q) ?? m.formations.find((f) => f.name === q) ?? m.formations.find((f) => f.name.toLowerCase().includes(q.toLowerCase()))
const provByName = (q: string): number | undefined => {
  const p = (W.provinces ?? []).find((x) => x.name.toLowerCase() === q.toLowerCase())
  if (p) return p.id
  const pl = W.places.find((x) => (x.base as Json)?.name?.toLowerCase() === q.toLowerCase())
  if (!pl) return undefined
  return (W.provinces ?? []).reduce((b, x) => ((x.x - pl.x) ** 2 + (x.y - pl.y) ** 2 < (b.x - pl.x) ** 2 + (b.y - pl.y) ** 2 ? x : b)).id
}
function applyAction(a: Json, notes: string[]): void {
  const st = findState(a.state)
  const b = st.base as Json
  const m = b.military as StateMilitary
  const id = (p: string): string => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
  switch (a.type) {
    case 'decision': {
      const prof = decideProfile(W, st)[a.topic as Topic]
      const act = a.act as Act
      const d: Decision = { id: id('d'), topic: a.topic, title: a.title ?? actTitle(act, st, (x) => m?.formations.find((f) => f.id === x)?.name ?? x), act, proposed: DATE, due: a.due ? parseDate(a.due) : DATE + prof.days, body: prof.name, status: a.status ?? 'внесено' }
      const f = forecast(W, st, d, DATE); d.forecast = `${f.word} (${Math.round(f.chance * 100)} %)`
      ;(b.decisions ??= []).push(d); notes.push(`${b.name}: решение «${d.title}» — ${d.status}, решится ${fd(d.due)} (${d.forecast})`); break
    }
    case 'decide': { // исход внесённого решения
      const d = (b.decisions ?? []).find((x: Decision) => x.id === a.id || x.title === a.title)
      if (!d) throw new Error(`нет решения ${a.id ?? a.title}`)
      d.status = a.status; notes.push(`${b.name}: «${d.title}» — ${a.status}`); break
    }
    case 'measure': (m.measures ??= []).push({ id: id('m'), kind: a.kind as MeasureKind, from: a.from ? parseDate(a.from) : DATE, scope: a.scope?.map((q: string) => fByName(m, q)?.id).filter(Boolean) }); notes.push(`${b.name}: мера «${MEASURES[a.kind as MeasureKind].name}» с ${fd(DATE)}`); break
    case 'level': m.law.level = a.level; notes.push(`${b.name}: уровень сбора — ${a.level}`); break
    case 'tax': b.econ.taxes[a.role] = a.level; notes.push(`${b.name}: подати «${b.econ.estates[a.role] ?? a.role}» — ${a.level}`); break
    case 'treasury': b.econ.treasury += a.amount; notes.push(`${b.name}: казна ${a.amount >= 0 ? '+' : ''}${a.amount} — ${a.note ?? ''}`); break
    case 'debt': (b.econ.debts ??= []).push({ to: a.to, sum: a.sum, rate: a.rate ?? 0.08, due: a.due ?? toParts(cal, DATE).year + 5 }); b.econ.treasury += a.sum; notes.push(`${b.name}: заём у ${a.to} на ${a.sum} под ${Math.round((a.rate ?? 0.08) * 100)} %`); break
    case 'rearm': {
      // перевооружение соединения: у каждого устава внутри — свой вариант с новыми деталями; меняются только роты этого соединения
      if (a.formation) {
        const f = fByName(m, a.formation); if (!f) throw new Error(`нет соединения ${a.formation}`)
        const ids = new Set(companiesUnder(m, f))
        const byT = new Map<string, string[]>()
        for (const c of m.companies) if (ids.has(c.id)) (byT.get(c.t) ?? byT.set(c.t, []).get(c.t)!).push(c.id)
        let total = 0, maxDays = 0
        for (const [tid, cids] of byT) {
          const t = m.templates.find((x) => x.id === tid) as CompanyTemplate
          if (!t) continue
          const vid = `${t.id}~${f.id}`
          let v = m.templates.find((x) => x.id === vid) as CompanyTemplate | undefined
          const base = v ?? t
          const neu: CompanyTemplate = { ...structuredClone(base), id: vid, name: v ? v.name : `${t.name} — ${f.name}`, unique: t.unique, parts: { ...base.parts, ...(a.parts ?? {}) }, kit: a.kit ?? base.kit }
          if (!a.arm && JSON.stringify(neu.parts) === JSON.stringify(base.parts) && neu.kit.join() === base.kit.join()) continue
          for (const pid of Object.values(neu.parts)) if (pid && !PART[pid]) throw new Error(`нет детали ${pid}`)
          const days = rearmDays(base, neu), cost = rearmCost(base, neu, cids.length)
          total += cost; maxDays = Math.max(maxDays, days)
          if (!v) { m.templates.push(neu); for (const c of m.companies) if (cids.includes(c.id)) c.t = vid } else Object.assign(v, neu)
          ;(m.orders ??= []).push({ id: id('o'), kind: 'rearm', from: DATE, days, cost, template: vid, old: { arm: base.arm, parts: structuredClone(base.parts), kit: [...base.kit], name: base.name }, note: `${neu.name} (${cids.length} рот)` })
        }
        notes.push(`${b.name}: перевооружение «${f.name}» — ${ids.size} рот, до ${maxDays} дн., ${total} мар.`); break
      }
      const t = m.templates.find((x) => x.id === a.template || x.name === a.template) as CompanyTemplate
      if (!t) throw new Error(`нет устава ${a.template}`)
      const neu: CompanyTemplate = { ...structuredClone(t), ...(a.name ? { name: a.name } : {}), ...(a.arm ? { arm: a.arm } : {}), parts: { ...t.parts, ...(a.parts ?? {}) }, kit: a.kit ?? t.kit }
      for (const pid of Object.values(neu.parts)) if (pid && !PART[pid]) throw new Error(`нет детали ${pid}`)
      const users = m.companies.filter((c) => c.t === t.id).length
      const days = rearmDays(t, neu), cost = rearmCost(t, neu, users)
      ;(m.orders ??= []).push({ id: id('o'), kind: 'rearm', from: DATE, days, cost, template: t.id, old: { arm: t.arm, parts: structuredClone(t.parts), kit: [...t.kit], name: t.name }, note: `${neu.name} (${users} рот)` })
      Object.assign(t, neu); notes.push(`${b.name}: перевооружение «${neu.name}» — ${users} рот, ${days} дн., ${cost} мар.`); break
    }
    case 'train': {
      const f = fByName(m, a.formation); if (!f) throw new Error(`нет соединения ${a.formation}`)
      const ids = companiesUnder(m, f), days = a.days ?? 35, xp = Math.round(days / 5)
      ;(m.orders ??= []).push({ id: id('o'), kind: 'train', from: DATE, days, xp, cost: trainCost(m, ids, days), target: f.id, companies: ids, note: f.name })
      notes.push(`${b.name}: учения «${f.name}» ${days} дн.`); break
    }
    case 'march': {
      const f = fByName(m, a.formation); if (!f || f.base == null) throw new Error(`нет соединения или базы ${a.formation}`)
      const to = provByName(a.to); if (to == null) throw new Error(`нет цели ${a.to}`)
      const ids = companiesUnder(m, f), men = ids.reduce((s, x) => s + (m.companies.find((c) => c.id === x)?.men ?? 0), 0)
      const L = worldReports(W, DATE).get(st.id)?.ledger
      const plan = planMarch(W, st.id, m, ids, f.base, to, DATE, men, (L?.total ?? 0) * (men / Math.max(1, L?.men ?? men)))
      if (!plan.ok) throw new Error(`поход невозможен: ${plan.reason}`)
      let tt = 0
      const wp = [{ x: plan.steps[0].from.x, y: plan.steps[0].from.y, date: DATE }]
      for (const s of plan.steps) { tt += s.days * (7 / 6); wp.push({ x: s.to.x, y: s.to.y, date: DATE + Math.round(tt) }) }
      ;(W.armies ??= []).push({ id: id('march-'), name: f.name, mapId: W.maps.find((x) => x.kind === 'world')?.id ?? 'world', stateId: st.id, color: b.color, waypoints: wp })
      if (a.rebase !== false) f.base = to
      notes.push(`${b.name}: поход «${f.name}» → ${a.to}: ${plan.days} дн., ${plan.km} км, прибытие ${fd(plan.arrive)}, хлеба ${plan.grain} т, потери ≈ ${plan.losses}`); break
    }
    case 'recruit': {
      const f = fByName(m, a.formation); if (!f) throw new Error(`нет соединения ${a.formation}`)
      const t = m.templates.find((x) => x.id === a.template || x.name === a.template); if (!t) throw new Error(`нет устава ${a.template}`)
      const n = a.companies ?? 4, ids: string[] = []
      const proto = m.companies.find((c) => c.t === t.id) ?? m.companies[0]
      for (let i = 0; i < n; i++) { const c = { ...structuredClone(proto), id: id('c'), t: t.id, name: `${m.ladder.company} нового набора №${i + 1}`, men: ARM[t.arm]?.men ?? 120, xp: 0, traits: ['green'], quality: 'common' }; m.companies.push(c); ids.push(c.id) }
      const bat = { id: id('f'), level: 'battalion' as const, name: `Новый ${m.ladder.battalion}`, children: [], companies: ids, cmd: proto.cmd, base: f.base, colors: proto.colors }
      m.formations.push(bat); f.children.push(bat.id)
      const cost = ids.reduce((s, x) => s + companyStats(m.companies.find((c) => c.id === x)!, t).cost * 3, 0)
      b.econ.treasury -= Math.round(cost)
      notes.push(`${b.name}: набор ${n} рот «${t.name}» в «${f.name}», разово ${Math.round(cost)} мар.`); break
    }
    case 'disband': {
      const f = fByName(m, a.formation); if (!f) throw new Error(`нет соединения ${a.formation}`)
      const ids = new Set(companiesUnder(m, f)), drop = new Set<string>()
      const walk = (x: Formation): void => { drop.add(x.id); for (const ch of x.children) { const y = m.formations.find((z) => z.id === ch); if (y) walk(y) } }
      walk(f)
      m.companies = m.companies.filter((c) => !ids.has(c.id)); m.formations = m.formations.filter((x) => !drop.has(x.id))
      for (const x of m.formations) x.children = x.children.filter((c) => !drop.has(c))
      m.roots = m.roots.filter((r) => !drop.has(r)); notes.push(`${b.name}: распущено «${f.name}» (${ids.size} рот)`); break
    }
    case 'navy': {
      const nv = m.navy; if (!nv) throw new Error('нет флота')
      const s = nv.squadrons.find((x) => x.name === a.squadron || x.id === a.squadron)
      if (s) { s.count = a.count ?? s.count; if (a.arm) s.arm = a.arm; if (a.crew) s.crew = a.crew; notes.push(`${b.name}: эскадра «${s.name}» — ${s.count} кораблей`) }
      else { const fl = nv.fleets.find((x) => x.name === a.fleet) ?? nv.fleets[0]; const ns = { id: id('s'), name: a.squadron, ship: a.ship ?? 'cog', count: a.count ?? 4, arm: a.arm ?? 'board', crew: a.crew ?? 'raw', base: fl.base, cmd: { name: a.captain ?? 'новый капитан', trait: 'осторожный' }, colors: [b.color, '#d8c48a'] as [string, string] }; nv.squadrons.push(ns); fl.squadrons.push(ns.id); notes.push(`${b.name}: новая эскадра «${ns.name}» ${ns.count}×${SHIP[ns.ship]?.name}`) }
      break
    }
    case 'law': b.laws = `${b.laws ?? ''}\n${a.text}`.trim(); notes.push(`${b.name}: закон — ${a.text.slice(0, 80)}`); break
    case 'note': notes.push(`${b.name}: ${a.text}`); break
    default: throw new Error(`неизвестное действие ${a.type}`)
  }
}

// ---------- команды ----------
const cmd = positional[0]
if (cmd === 'досье' || cmd === 'dossier') {
  console.log(dossier(findState(positional[1])))
} else if (cmd === 'прогноз' || cmd === 'forecast') {
  const st = findState(positional[1]); const act = JSON.parse(positional[3]) as Act; const topic = positional[2] as Topic
  const d: Decision = { id: 'x', topic, title: actTitle(act, st, (x) => x), act, proposed: DATE, due: DATE + decideProfile(W, st)[topic].days, body: '', status: 'внесено' }
  const f = forecast(W, st, d, DATE)
  console.log(`${f.word} (${Math.round(f.chance * 100)} %). ${f.text}. Против: ${f.against.join(', ') || '—'}`)
} else if (cmd === 'поход' || cmd === 'march') {
  const st = findState(positional[1]); const m = st.base.military!; const f = fByName(m, positional[2])!; const to = provByName(positional[3])!
  const ids = companiesUnder(m, f), men = ids.reduce((s, x) => s + (m.companies.find((c) => c.id === x)?.men ?? 0), 0)
  const p = planMarch(W, st.id, m, ids, f.base!, to, DATE, men, 0)
  console.log(p.ok ? `${f.name} → ${positional[3]}: ${p.days} дн., ${p.km} км, прибытие ${fd(p.arrive)}, хлеба ${p.grain} т, потери ≈ ${p.losses}; ${p.season}: ${p.seasonNote}; через ${p.foreign.join(', ') || 'свои земли'}` : `нельзя: ${p.reason}`)
} else if (cmd === 'оценка' || cmd === 'estimate') {
  // перевооружение без внесения: срок, цена, характеристики было → стало
  const st = findState(positional[1]); const m = st.base.military!
  const t = m.templates.find((x) => x.id === positional[2] || x.name === positional[2]); if (!t) { console.error('нет устава'); process.exit(1) }
  const ch = JSON.parse(positional[3] ?? '{}')
  const neu = { ...structuredClone(t), ...(ch.arm ? { arm: ch.arm } : {}), parts: { ...t.parts, ...(ch.parts ?? ch) }, kit: ch.kit ?? t.kit }
  const users = m.companies.filter((c) => c.t === t.id).length
  const sample = { id: 's', name: '', t: t.id, race: '', region: 'plain', quality: 'common', traits: [], cmd: { name: '', trait: '' }, men: ARM[t.arm]?.men ?? 120, xp: 0, colors: ['#000', '#fff'] as [string, string] }
  const a = companyStats(sample, t).stats, z = companyStats(sample, neu).stats
  console.log(`${t.name}: ${users} рот, ${rearmDays(t, neu)} дн., ${rearmCost(t, neu, users)} мар.; ${Object.keys(a).map((k) => `${k} ${(a as Json)[k]}→${(z as Json)[k]}`).join(', ')}`)
} else if (cmd === 'внести' || cmd === 'apply') {
  // файл вердикта: { state, order, verdict, public?, actions: [...] }
  const v = JSON.parse(readFileSync(positional[1], 'utf8'))
  const list = Array.isArray(v) ? v : [v]
  const notes: string[] = []
  for (const x of list) {
    const before = notes.length
    for (const a of x.actions ?? []) applyAction({ state: x.state, ...a }, notes)
    ;((W.vpiLog ??= []) as Json[]).push({ id: `v${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`, date: DATE, at: new Date().toISOString(), state: findState(x.state).base.name, title: x.title ?? (x.order ?? '').slice(0, 80), order: x.order ?? '', verdict: x.verdict ?? '', public: x.public ?? '', changes: notes.slice(before) })
  }
  if (has('--проба') || has('--dry')) { console.log('ПРОБА — мир не изменён:\n' + notes.join('\n')) } else { save(); console.log(`Внесено в ${WORLD}:\n` + notes.join('\n')) }
} else if (cmd === 'сводка' || cmd === 'summary') {
  const since = flag('--since') ? parseDate(flag('--since')!) : DATE
  const log = ((W.vpiLog ?? []) as Json[]).filter((x) => x.date >= since)
  const by = new Map<string, Json[]>(); for (const x of log) (by.get(x.state) ?? by.set(x.state, []).get(x.state)!).push(x)
  const out = [`# Сводка ВПИ с ${fd(since)}`, '']
  for (const [s, list] of by) { out.push(`## ${s}`); for (const x of list) out.push(`- ${x.public || x.title}`); out.push('') }
  console.log(out.join('\n'))
} else if (cmd === 'дата' || cmd === 'date') {
  if (positional[1]) { (W.vpi ??= {}).date = parseDate(positional[1]); save(); console.log(`Дата игры: ${fd(W.vpi.date)}`) } else console.log(`Дата игры: ${fd(DATE)}`)
} else {
  console.log('Команды: досье <страна> | оценка <страна> <устав> \'{"armor":"mail"}\' | прогноз <страна> <тема> <act JSON> | поход <страна> <соединение> <цель> | внести <вердикт.json> [--проба] | сводка [--since 1010.1.1] | дата [1010.2.1]\nФлаги: --world <путь> | --dev | --date 1010.1.1')
}
