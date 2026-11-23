import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { provincesOf, stateReport, type EconReport } from '../econCalc'
import { armyLedger, MEASURES, measureOn, type Ledger } from '../armyLedger'
import { formatDate } from '../calendar'
import { actTitle, levelAt } from '../decisions'
import { DecisionsView, useProposeDecision } from './Decisions'
import { GOOD, fmtMarks, fmtPeople, type Good } from '../economy'
import {
  ARM, ARMS, KIT, KITS, PARTS, PART, QUALITY, REGION_KINDS, SLOTS, STATS, TRAIT, TRAITS, companyPower, companyStats,
  type Company, type CompanyTemplate, type Formation, type MeasureKind, type Mods, type Slot, type Stat, type StateMilitary
} from '../military'
import type { WorldState } from '../types'

type Place = 'van' | 'left' | 'center' | 'right' | 'reserve' | 'train'
const PLACES: { key: Place; name: string }[] = [
  { key: 'van', name: 'Авангард' }, { key: 'left', name: 'Левый фланг' }, { key: 'center', name: 'Центр' },
  { key: 'right', name: 'Правый фланг' }, { key: 'reserve', name: 'Резерв' }, { key: 'train', name: 'Обоз' }
]
const LEVY_FACTOR: Record<string, number> = { 'мир': 0.25, 'сбор': 0.5, 'великий сбор': 1, 'всеобщий призыв': 1.8 }
const powerWord = (p: number): string => (p < 300 ? 'слабое войско' : p < 1500 ? 'малое войско' : p < 5000 ? 'крепкое войско' : p < 15000 ? 'сильное войско' : 'великая сила')
const sign = (v: number): string => (v > 0 ? `+${v}` : `${v}`)
const modsText = (m: Mods): string => Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${sign(v as number)} ${STATS.find((s) => s.key === k)!.name.toLowerCase()}`).join(', ')

/** Вкладка «Армия»: сводка и призыв, дерево войск со схемой построения и карточками рот, конструктор уставов */
export function ArmyView({ st }: { st: WorldState }) {
  const m = st.base.military
  const [tab, setTab] = useState<'sum' | 'tree' | 'money' | 'decide' | 'designer'>('sum')
  if (!m) return <p className="ew-muted">У страны пока нет войска.</p>
  return (
    <div className="mil">
      <div className="mil-tabs">
        {([['sum', 'Сводка'], ['tree', 'Войска'], ['money', 'Казна войска'], ['decide', 'Решения власти'], ['designer', 'Конструктор уставов']] as const).map(([k, n]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{n}</button>
        ))}
      </div>
      {tab === 'sum' && <Summary st={st} m={m} onOpen={() => setTab('tree')} />}
      {tab === 'tree' && <Tree st={st} m={m} />}
      {tab === 'money' && <Treasury st={st} m={m} onDecide={() => setTab('decide')} />}
      {tab === 'decide' && <DecisionsView st={st} />}
      {tab === 'designer' && <Designer st={st} m={m} />}
    </div>
  )
}

/** изменить войско страны */
function useEditMilitary(st: WorldState) {
  const mutate = useStore((s) => s.mutate)
  return (fn: (m: StateMilitary) => void): void => mutate((w) => { const s = w.states.find((x) => x.id === st.id); if (s?.base.military) fn(s.base.military) })
}

// ---------------- сводка ----------------
function Summary({ st, m, onOpen }: { st: WorldState; m: StateMilitary; onOpen: () => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const edit = useEditMilitary(st)
  const tpl = useMemo(() => new Map(m.templates.map((t) => [t.id, t])), [m.templates])
  const calc = useMemo(() => {
    let men = 0, power = 0, cost = 0
    const goods: Partial<Record<Good, number>> = {}, byArm: Record<string, number> = {}, byRace: Record<string, number> = {}, byQ: Record<string, number> = {}
    const best: { c: Company; p: number }[] = []
    for (const c of m.companies) {
      const t = tpl.get(c.t), r = companyStats(c, t), p = companyPower(r.stats, c.men)
      men += c.men; power += p; cost += r.cost
      for (const [g, v] of Object.entries(r.goods) as [Good, number][]) goods[g] = (goods[g] ?? 0) + v
      const arm = t?.arm ?? 'line'
      byArm[arm] = (byArm[arm] ?? 0) + c.men; byRace[c.race] = (byRace[c.race] ?? 0) + c.men; byQ[c.quality] = (byQ[c.quality] ?? 0) + c.men
      best.push({ c, p })
    }
    best.sort((a, b) => b.p - a.p)
    return { men, power, cost, goods, byArm, byRace, byQ, best: best.slice(0, 6) }
  }, [m, tpl])
  const rep = useMemo(() => stateReport(world, st, date), [world, st, date])
  const law = m.law
  const level = levelAt(st, date)
  const k = LEVY_FACTOR[level] ?? 0.25
  const workers = (rep?.byRole.feeders ?? 0) + (rep?.byRole.makers ?? 0)
  const canCall = Math.round(workers * law.levy * k + (law.nobles ? (rep?.byRole.rulers ?? 0) * 0.3 : 0) + (law.unfree ? (rep?.byRole.unfree ?? 0) * law.levy * 2 * k : 0))
  const share = rep?.pop ? (100 * calc.men) / rep.pop : 0
  const paid = rep?.expense.find((l) => l.name.startsWith('Армия'))?.amount
  const goodsList = (Object.entries(calc.goods) as [Good, number][]).filter(([, v]) => v > 0.5).sort((a, b) => b[1] * GOOD[b[0]].price - a[1] * GOOD[a[0]].price)

  return (
    <div className="mil-sum">
      <div className="ew-tiles">
        <div className="ew-tile"><span>Под знамёнами</span><b>{fmtPeople(calc.men)}</b><i>{m.companies.length} рот · {share.toFixed(1).replace('.', ',')} % жителей</i></div>
        <div className="ew-tile"><span>Сила войска</span><b>{powerWord(calc.power)}</b><i>{calc.power.toLocaleString('ru-RU')} очков</i></div>
        <div className="ew-tile"><span>Можно призвать</span><b>{fmtPeople(canCall)}</b><i>при уровне «{level}»</i></div>
        <div className="ew-tile"><span>Содержание</span><b>{fmtMarks(paid ?? calc.cost)}</b><i>за ход{paid != null ? ` (всё войско на жалованье — ${fmtMarks(calc.cost)})` : ''}{rep ? ` · казна ${rep.net >= 0 ? '+' : ''}${fmtMarks(rep.net)}` : ''}</i></div>
        <div className="ew-tile"><span>Уставов</span><b>{m.templates.length}</b><i>{m.templates.filter((t) => t.unique).length} своих родов войск</i></div>
        <div className="ew-tile"><span>Лестница</span><b className="small">{[m.ladder.company, m.ladder.battalion, m.ladder.regiment].join(' → ')}</b><i>{[m.ladder.corps, m.ladder.army].join(' → ')}</i></div>
      </div>

      <div className="ed-grid">
        <section className="ew-sec">
          <h3>Закон призыва: {law.name}</h3>
          <p>{law.text}</p>
          <div className="mil-law">
            <span>Ополчение: <b>{Math.round(law.levy * 1000) / 10} %</b> кормильцев и мастеров</span>
            <span>Постоянное войско: <b>{Math.round(law.standing * 1000) / 10} %</b> жителей</span>
            <span>{law.nobles ? '✓' : '✕'} знать с дружинами</span>
            <span>{law.mercs ? '✓' : '✕'} наёмники</span>
            <span>{law.unfree ? '✓' : '✕'} несвободные воины</span>
            <span>{law.orders ? '✓' : '✕'} ордена и храмы</span>
          </div>
          <h4 className="ed-h4">Уровень сбора</h4>
          <div className="mil-levels">
            {Object.keys(LEVY_FACTOR).map((l) => (
              <button key={l} className={l === law.level ? 'active' : ''} disabled={!master} onClick={() => edit((mm) => { mm.law.level = l as StateMilitary['law']['level'] })}>{l}</button>
            ))}
          </div>
          <p className="ew-muted small">Выше уровень — больше людей под знамёнами, но меньше рабочих в экономике и ниже довольство кормильцев.</p>
        </section>

        <section className="ew-sec">
          <h3>Состав по родам войск</h3>
          {Object.entries(calc.byArm).sort((a, b) => b[1] - a[1]).map(([a, n]) => (
            <div key={a} className="ew-row"><span>{ARM[a]?.icon} {ARM[a]?.name ?? a}</span><div className="ew-bar"><i style={{ width: `${(100 * n) / Math.max(1, calc.men)}%` }} /></div><span className="ew-num">{fmtPeople(n)}</span></div>
          ))}
          <h4 className="ed-h4">Народы в войске</h4>
          {Object.entries(calc.byRace).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r, n]) => (
            <div key={r} className="ew-row"><span>{r}</span><div className="ew-bar gold"><i style={{ width: `${(100 * n) / Math.max(1, calc.men)}%` }} /></div><span className="ew-num">{Math.round((100 * n) / Math.max(1, calc.men))} %</span></div>
          ))}
        </section>

        <section className="ew-sec">
          <h3>Снаряжение и снабжение</h3>
          {QUALITY.filter((q) => calc.byQ[q.id]).map((q) => (
            <div key={q.id} className="ew-row"><span>{q.name}</span><div className="ew-bar gold"><i style={{ width: `${(100 * calc.byQ[q.id]) / Math.max(1, calc.men)}%` }} /></div><span className="ew-num">{Math.round((100 * calc.byQ[q.id]) / Math.max(1, calc.men))} %</span></div>
          ))}
          <h4 className="ed-h4">Товары на содержание за ход</h4>
          <div className="chip-list">{goodsList.map(([g, v]) => <span key={g} className="chip">{GOOD[g].icon} {GOOD[g].name.toLowerCase()} {Math.round(v)}</span>)}</div>
        </section>

        <section className="ew-sec">
          <h3>Лучшие роты</h3>
          {calc.best.map(({ c, p }) => {
            const t = tpl.get(c.t)
            return (
              <div key={c.id} className="mil-best">
                <span className="mil-chip-ico">{ARM[t?.arm ?? 'line']?.icon}</span>
                <div><b>{t?.name}</b><div className="ew-muted small">{c.name} · {c.race} · {c.traits.map((x) => TRAIT[x]?.name).filter(Boolean).join(', ') || 'без черт'}</div></div>
                <span className="ed-tp-val">{p}</span>
              </div>
            )
          })}
          <button className="eco-open mil-go" onClick={onOpen}>Открыть войска</button>
        </section>
      </div>
    </div>
  )
}

// ---------------- дерево войск ----------------
type Sel = { kind: 'f' | 'c'; id: string } | null
function Tree({ st, m }: { st: WorldState; m: StateMilitary }) {
  const [sel, setSel] = useState<Sel>(m.roots[0] ? { kind: 'f', id: m.roots[0] } : null)
  const [open, setOpen] = useState<Set<string>>(() => new Set(m.roots))
  const fById = useMemo(() => new Map(m.formations.map((f) => [f.id, f])), [m.formations])
  const cById = useMemo(() => new Map(m.companies.map((c) => [c.id, c])), [m.companies])
  const tpl = useMemo(() => new Map(m.templates.map((t) => [t.id, t])), [m.templates])
  const menOf = useMemo(() => {
    const memo = new Map<string, number>()
    const walk = (f: Formation): number => {
      if (memo.has(f.id)) return memo.get(f.id)!
      const n = (f.companies ?? []).reduce((s, id) => s + (cById.get(id)?.men ?? 0), 0) + f.children.reduce((s, id) => s + (fById.has(id) ? walk(fById.get(id)!) : 0), 0)
      memo.set(f.id, n); return n
    }
    for (const f of m.formations) walk(f)
    return memo
  }, [m, fById, cById])
  const toggle = (id: string): void => setOpen((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n })

  const Node = ({ id, depth }: { id: string; depth: number }) => {
    const f = fById.get(id)
    if (!f) return null
    const kids = [...f.children, ...(f.companies ?? [])]
    const isOpen = open.has(id)
    return (
      <div>
        <div className={`mil-node lvl-${f.level} ${sel?.kind === 'f' && sel.id === id ? 'sel' : ''}`} style={{ paddingLeft: 6 + depth * 14 }}>
          <button className="mil-twisty" onClick={() => toggle(id)}>{kids.length ? (isOpen ? '▾' : '▸') : '·'}</button>
          <span className="mil-flag" style={{ background: `linear-gradient(90deg, ${f.colors?.[0] ?? st.base.color} 50%, ${f.colors?.[1] ?? '#ccc'} 50%)` }} />
          <button className="mil-node-name" onClick={() => setSel({ kind: 'f', id })}>{f.name}</button>
          <span className="mil-node-men">{fmtPeople(menOf.get(id) ?? 0)}</span>
        </div>
        {isOpen && f.children.map((c) => <Node key={c} id={c} depth={depth + 1} />)}
        {isOpen && (f.companies ?? []).map((cid) => {
          const c = cById.get(cid); if (!c) return null
          const t = tpl.get(c.t)
          return (
            <div key={cid} className={`mil-node lvl-company ${sel?.kind === 'c' && sel.id === cid ? 'sel' : ''}`} style={{ paddingLeft: 20 + (depth + 1) * 14 }}>
              <span className="mil-chip-ico">{ARM[t?.arm ?? 'line']?.icon}</span>
              <button className="mil-node-name" onClick={() => setSel({ kind: 'c', id: cid })}>{c.name} · {t?.name}</button>
              <span className="mil-node-men">{c.men}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mil-tree">
      <div className="mil-tree-list">{m.roots.map((id) => <Node key={id} id={id} depth={0} />)}</div>
      <div className="mil-tree-detail">
        {sel?.kind === 'f' && fById.get(sel.id) && <FormationCard st={st} m={m} f={fById.get(sel.id)!} men={menOf.get(sel.id) ?? 0} onPick={(c) => setSel({ kind: 'c', id: c })} />}
        {sel?.kind === 'c' && cById.get(sel.id) && <CompanyCard st={st} m={m} c={cById.get(sel.id)!} />}
        {!sel && <p className="ew-muted">Выберите часть слева.</p>}
      </div>
    </div>
  )
}

const LEVEL_WORD: Record<string, string> = { battalion: 'battalion', regiment: 'regiment', corps: 'corps', army: 'army' }

function FormationCard({ st, m, f, men, onPick }: { st: WorldState; m: StateMilitary; f: Formation; men: number; onPick: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const master = useStore((s) => s.masterMode)
  const edit = useEditMilitary(st)
  const tpl = useMemo(() => new Map(m.templates.map((t) => [t.id, t])), [m.templates])
  const cById = useMemo(() => new Map(m.companies.map((c) => [c.id, c])), [m.companies])
  const [held, setHeld] = useState<string | null>(null)
  const base = world.provinces?.find((p) => p.id === f.base)
  const lore = f.lore ? world.entries.find((e) => e.id === f.lore) : null
  const levelName = m.ladder[f.level as keyof typeof m.ladder] ?? LEVEL_WORD[f.level]
  // для батальона — роты по местам; для крупных — дочерние части по местам (по умолчанию — по очереди)
  const units = f.companies?.length
    ? f.companies.map((id) => { const c = cById.get(id)!; const t = tpl.get(c.t); return { id, name: t?.name ?? c.name, sub: c.name, icon: ARM[t?.arm ?? 'line']?.icon ?? '🛡', men: c.men, company: true } })
    : f.children.map((id) => { const ch = m.formations.find((x) => x.id === id)!; return { id, name: ch.name, sub: m.ladder[ch.level as keyof typeof m.ladder], icon: '⚑', men: 0, company: false } })
  // по умолчанию боевые части — в линию и резерв, обоз пуст (туда ставит мастер)
  const DEFAULT: Place[] = ['center', 'left', 'right', 'van', 'reserve', 'center', 'left', 'right']
  const placeOf = (id: string, i: number): Place => (f.slots?.[id] as Place) ?? DEFAULT[i % DEFAULT.length]
  const move = (id: string, to: Place): void => { if (!master) return; edit((mm) => { const ff = mm.formations.find((x) => x.id === f.id)!; ff.slots = { ...(ff.slots ?? {}), [id]: to } }); setHeld(null) }

  return (
    <div className="mil-card">
      <div className="mil-card-head">
        <span className="mil-flag big" style={{ background: `linear-gradient(90deg, ${f.colors?.[0] ?? st.base.color} 50%, ${f.colors?.[1] ?? '#ccc'} 50%)` }} />
        <div>
          <h3>{f.name}</h3>
          <div className="ew-muted">{levelName} · {fmtPeople(men)}{f.cmd ? ` · командир ${f.cmd.name} (${f.cmd.trait})` : ''}{base ? ` · стоит в ${base.name}` : ''}</div>
        </div>
      </div>
      {lore && <p className="mil-lore">{lore.base.summary || lore.base.title}</p>}
      <h4 className="ed-h4">Схема построения {master ? '— перетащите или нажмите отряд, потом место' : ''}</h4>
      <div className="mil-scheme">
        {PLACES.map((pl) => (
          <div key={pl.key} className={`mil-zone z-${pl.key} ${held ? 'can' : ''}`} onDragOver={(e) => master && e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); if (id) move(id, pl.key) }} onClick={() => held && move(held, pl.key)}>
            <span className="mil-zone-name">{pl.name}</span>
            <div className="mil-zone-units">
              {units.map((u, i) => placeOf(u.id, i) === pl.key && (
                <div key={u.id} className={`mil-unit ${held === u.id ? 'held' : ''}`} draggable={master} onDragStart={(e) => e.dataTransfer.setData('text/plain', u.id)}
                  onClick={(e) => { e.stopPropagation(); if (master && !held) setHeld(u.id); else if (held === u.id) setHeld(null); else if (u.company) onPick(u.id) }}
                  onDoubleClick={() => u.company && onPick(u.id)} title={u.company ? 'Двойное нажатие — открыть роту' : u.name}>
                  <span>{u.icon}</span><b>{u.name}</b><i>{u.company ? `${u.men} чел.` : u.sub}</i>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {f.companies?.length ? <p className="ew-muted small">Нажмите роту дважды — откроется её карточка.</p> : null}
    </div>
  )
}

function StatBars({ stats, base }: { stats: Required<Mods>; base?: Required<Mods> }) {
  return (
    <div className="mil-stats">
      {STATS.map((s) => {
        const v = stats[s.key], d = base ? v - base[s.key] : 0
        return (
          <div key={s.key} className="mil-stat" title={s.about}>
            <span>{s.name}</span>
            <div className="mil-stat-bar"><i style={{ width: `${(100 * v) / 20}%` }} /></div>
            <b>{v}{d ? <em className={d > 0 ? 'up' : 'down'}> {sign(d)}</em> : null}</b>
          </div>
        )
      })}
    </div>
  )
}

function CompanyCard({ st, m, c }: { st: WorldState; m: StateMilitary; c: Company }) {
  const world = useStore((s) => s.world!)
  const master = useStore((s) => s.masterMode)
  const edit = useEditMilitary(st)
  const t = m.templates.find((x) => x.id === c.t)
  const r = companyStats(c, t)
  const arm = ARM[t?.arm ?? 'line']
  const area = world.adminRegions?.find((a) => a.id === c.area)
  const set = (fn: (cc: Company) => void): void => edit((mm) => { const cc = mm.companies.find((x) => x.id === c.id); if (cc) fn(cc) })
  return (
    <div className="mil-card">
      <div className="mil-card-head">
        <span className="mil-flag big" style={{ background: `linear-gradient(90deg, ${c.colors[0]} 50%, ${c.colors[1]} 50%)` }} />
        <div>
          <h3>{arm?.icon} {t?.name ?? 'Рота'} <span className="ew-muted">· {c.name}</span></h3>
          <div className="ew-muted">{arm?.name} · {c.men} чел. · {c.race} · {REGION_KINDS[c.region ?? 'plain']?.name}{area ? ` из «${area.name}»` : ''}</div>
        </div>
      </div>
      {t?.note && <p className="mil-lore">{t.note}</p>}
      <div className="mil-card-grid">
        <div>
          <StatBars stats={r.stats} />
          <div className="mil-cost">Сила <b>{companyPower(r.stats, c.men)}</b> · содержание <b>{fmtMarks(r.cost)}</b> за ход · {Object.entries(r.goods).filter(([, v]) => v! > 0.05).map(([g, v]) => `${GOOD[g as Good].icon} ${v}`).join(' ')}</div>
          <h4 className="ed-h4">Командир</h4>
          <p>{c.cmd.name} — {c.cmd.trait}. Опыт роты: {c.xp}.</p>
        </div>
        <div>
          <h4 className="ed-h4">Из чего сложилась</h4>
          <ul className="mil-parts">{r.parts.map((p, i) => <li key={i}><span>{p.name}</span><i>{modsText(p.mods) || '—'}</i></li>)}</ul>
          <h4 className="ed-h4">Черты</h4>
          <div className="chip-list">
            {c.traits.map((id) => { const tr = TRAIT[id]; return tr && (
              <span key={id} className={`chip mil-trait ${tr.good ? 'good' : 'bad'}`} title={`${tr.note}${Object.keys(tr.mods).length ? ` (${modsText(tr.mods)})` : ''}`}>
                {tr.name}{master && <button onClick={() => set((cc) => { cc.traits = cc.traits.filter((x) => x !== id) })}>×</button>}
              </span>
            ) })}
            {!c.traits.length && <span className="ew-muted small">без черт</span>}
          </div>
          {master && (
            <div className="mil-edit">
              <select value="" onChange={(e) => e.target.value && set((cc) => { cc.traits = [...new Set([...cc.traits, e.target.value])] })}>
                <option value="">+ черта…</option>
                {TRAITS.filter((x) => !c.traits.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.good ? '＋' : '－'} {x.name}</option>)}
              </select>
              <select value={c.t} onChange={(e) => set((cc) => { cc.t = e.target.value })}>{m.templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <select value={c.quality} onChange={(e) => set((cc) => { cc.quality = e.target.value })}>{QUALITY.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select>
              <label>Людей <input type="number" min={5} max={600} value={c.men} onChange={(e) => set((cc) => { cc.men = Math.max(5, Number(e.target.value) || cc.men) })} /></label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- конструктор уставов ----------------
function Designer({ st, m }: { st: WorldState; m: StateMilitary }) {
  const master = useStore((s) => s.masterMode)
  const edit = useEditMilitary(st)
  const [id, setId] = useState(m.templates[0]?.id ?? '')
  const saved = m.templates.find((t) => t.id === id)
  const [draft, setDraft] = useState<CompanyTemplate | null>(saved ? structuredClone(saved) : null)
  const tech = (st.base.tech?.levels ?? {}) as Record<string, number>
  const pickT = (tid: string): void => { setId(tid); const t = m.templates.find((x) => x.id === tid); setDraft(t ? structuredClone(t) : null) }
  if (!draft) return <p className="ew-muted">Нет уставов.</p>
  const sample = (t: CompanyTemplate): Company => ({ id: 'sample', name: '', t: t.id, race: '', region: 'plain', quality: 'common', traits: [], cmd: { name: '', trait: '' }, men: ARM[t.arm]?.men ?? 120, xp: 0, colors: ['#000', '#fff'] })
  const now = companyStats(sample(draft), draft), before = saved ? companyStats(sample(saved), saved) : now
  const locked = (req?: Record<string, number>): string | null => { if (!req) return null; const miss = Object.entries(req).filter(([k, v]) => (tech[k] ?? 0) < v); return miss.length ? `нужно: ${miss.map(([k, v]) => `${k === 'powder' ? 'порох' : k === 'gear' ? 'шестерня' : k === 'magic' ? 'магия' : k} ${v}`).join(', ')}` : null }
  const fits = (slot: Slot) => PARTS.filter((p) => p.slot === slot && (!p.for || p.for.includes(draft.arm)))
  const save = (): void => { edit((mm) => { const i = mm.templates.findIndex((x) => x.id === draft.id); if (i >= 0) mm.templates[i] = structuredClone(draft); else mm.templates.push(structuredClone(draft)) }) }
  const copy = (): void => { const n = { ...structuredClone(draft), id: `${draft.id}-${Date.now().toString(36)}`, name: `${draft.name} (новый)`, unique: false }; edit((mm) => { mm.templates.push(n) }); setId(n.id); setDraft(n) }
  const users = m.companies.filter((c) => c.t === draft.id).length

  return (
    <div className="mil-designer">
      <div className="mil-tpl-list">
        {m.templates.map((t) => (
          <button key={t.id} className={t.id === id ? 'sel' : ''} onClick={() => pickT(t.id)}>
            <span>{ARM[t.arm]?.icon}</span><b>{t.name}</b>{t.unique && <i>своё</i>}
          </button>
        ))}
      </div>
      <div className="mil-tpl-edit">
        <div className="mil-edit-row">
          <input className="mil-name" value={draft.name} disabled={!master} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <select value={draft.arm} disabled={!master} onChange={(e) => setDraft({ ...draft, arm: e.target.value })}>
            {ARMS.map((a) => { const l = locked(a.req); return <option key={a.key} value={a.key} disabled={!!l}>{a.icon} {a.name}{l ? ` (${l})` : ''}</option> })}
          </select>
        </div>
        <p className="ew-muted small">{ARM[draft.arm]?.from && `Люди: ${ARM[draft.arm].from}. `}По этому уставу набрано рот: {users}. {draft.note}</p>
        <div className="mil-slots">
          {SLOTS.map((s) => {
            const opts = fits(s.key)
            if (!opts.length) return null
            const cur = draft.parts[s.key]
            const p = cur ? PART[cur] : null
            return (
              <label key={s.key} className="mil-slot">
                <span>{s.name}</span>
                <select value={cur ?? ''} disabled={!master} onChange={(e) => setDraft({ ...draft, parts: { ...draft.parts, [s.key]: e.target.value || undefined } })}>
                  <option value="">—</option>
                  {opts.map((o) => { const l = locked(o.req); return <option key={o.id} value={o.id} disabled={!!l}>{o.name}{l ? ` (${l})` : ''}</option> })}
                </select>
                {p && <i>{modsText(p.mods) || 'без изменений'}{p.cost ? ` · ${p.cost > 0 ? '+' : ''}${p.cost} мар.` : ''}{p.note ? ` · ${p.note}` : ''}</i>}
              </label>
            )
          })}
        </div>
        <h4 className="ed-h4">Снаряжение, магия и вера</h4>
        <div className="mil-kit">
          {KIT.map((k) => {
            const l = locked(k.req), on = draft.kit.includes(k.id)
            return (
              <label key={k.id} className={`mil-kit-item ${on ? 'on' : ''} ${l ? 'locked' : ''}`} title={`${modsText(k.mods)}${k.note ? ` · ${k.note}` : ''}${l ? ` · ${l}` : ''}`}>
                <input type="checkbox" checked={on} disabled={!master || !!l} onChange={() => setDraft({ ...draft, kit: on ? draft.kit.filter((x) => x !== k.id) : [...draft.kit, k.id] })} />
                {k.magic ? '✦ ' : ''}{k.name}
              </label>
            )
          })}
        </div>
      </div>
      <div className="mil-tpl-preview">
        <h4 className="ed-h4">Рота по уставу (обычное снаряжение, без черт)</h4>
        <StatBars stats={now.stats} base={saved ? before.stats : undefined} />
        <div className="mil-cost">Сила <b>{companyPower(now.stats, ARM[draft.arm]?.men ?? 120)}</b> · содержание <b>{fmtMarks(now.cost)}</b> за ход{saved && now.cost !== before.cost ? ` (было ${fmtMarks(before.cost)})` : ''}</div>
        <div className="chip-list">{Object.entries(now.goods).filter(([, v]) => v! > 0.05).map(([g, v]) => <span key={g} className="chip">{GOOD[g as Good].icon} {v}</span>)}</div>
        {master && (
          <div className="mil-edit-row">
            <button className="eco-open" onClick={save}>Сохранить устав{users ? ` (изменит ${users} рот)` : ''}</button>
            <button className="eco-open" onClick={copy}>Новый устав из этого</button>
          </div>
        )}
        <p className="ew-muted small">Каждая рота по уставу ещё получает своё: народ, край набора, качество снаряжения, черты и опыт.</p>
      </div>
    </div>
  )
}

// ---------------- казна войска: ведомость, утечки, меры ----------------
/** пересчитать ведомость с другим войском (для предпросмотра мер) — те же условия, что в отчёте экономики */
function ledgerWith(world: Parameters<typeof provincesOf>[0], st: WorldState, mil: StateMilitary, date: number, rep: EconReport): Ledger {
  const provs = provincesOf(world, st.id, date)
  const cc: Record<string, number> = {}
  for (const p of provs) cc[p.culture] = (cc[p.culture] ?? 0) + 1
  const cult = Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'imperial'
  return armyLedger(world, st, mil, { date, pop: rep.pop, cult, war: rep.expense.some((l) => l.name.includes('военное время')), provs, byRole: rep.byRole })
}

function Treasury({ st, m, onDecide }: { st: WorldState; m: StateMilitary; onDecide: () => void }) {
  const propose = useProposeDecision(st)
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const edit = useEditMilitary(st)
  const rep = useMemo(() => stateReport(world, st, date), [world, st, date])
  const L = rep?.ledger
  const [scope, setScope] = useState<string>('')
  const targets = m.formations.filter((f) => f.level !== 'battalion')
  // сколько даст каждая мера, если принять её сейчас
  const preview = useMemo(() => {
    const out: Record<string, number> = {}
    if (!rep || !L) return out
    for (const k of Object.keys(MEASURES) as MeasureKind[]) {
      if (k !== 'settle' && (m.measures ?? []).some((x) => x.kind === k && measureOn(x, date))) continue
      const mil = { ...m, measures: [...(m.measures ?? []), { id: 'preview', kind: k, from: date - 600, scope: k === 'settle' ? [scope || m.roots[0]] : undefined }] }
      const L2 = ledgerWith(world, st, mil, date, rep)
      out[k] = Math.round(L.total - L2.total + L2.income.reduce((s, l) => s + l.amount, 0) - L.income.reduce((s, l) => s + l.amount, 0))
    }
    return out
  }, [world, st, m, date, rep, L, scope])
  if (!rep || !L) return <p className="ew-muted">Нет расчёта экономики на эту дату.</p>
  const fName = new Map(m.formations.map((f) => [f.id, f.name]))
  const showLeak = master || L.leak.revealed
  const max = Math.max(...L.lines.map((l) => Math.abs(l.amount)), 1)
  const adopt = (k: MeasureKind): void =>
    edit((mm) => { mm.measures = [...(mm.measures ?? []), { id: `m${Date.now().toString(36)}`, kind: k, from: date, scope: k === 'settle' ? [scope || mm.roots[0]] : undefined }] })
  const cancel = (id: string): void =>
    edit((mm) => { const x = mm.measures?.find((y) => y.id === id); if (!x) return; if (x.from >= date) mm.measures = mm.measures!.filter((y) => y.id !== id); else x.to = date })
  return (
    <div className="mil-money">
      <div className="ew-tiles">
        <div className="ew-tile"><span>Войско стоит казне</span><b>{fmtMarks(L.total)}</b><i>за ход</i></div>
        <div className="ew-tile"><span>На жалованье</span><b>{fmtPeople(L.standing)}</b><i>из {fmtPeople(L.men)}; остальным — {Math.round(L.atHome * 100)} % («{L.level}»)</i></div>
        <div className="ew-tile"><span>Казна страны</span><b>{rep.net >= 0 ? '+' : ''}{fmtMarks(rep.net)}</b><i>за ход, со всеми расходами</i></div>
        {showLeak && (
          <div className="ew-tile mil-leak-tile">
            <span>Утекает{master && !L.leak.revealed ? ' (видит мастер)' : ''}</span>
            <b>{fmtMarks(L.leak.amount)}</b>
            <i>{Math.round(L.leak.rate * 100)} % · {L.leak.audited ? 'идёт ревизия' : 'без ревизии'}</i>
          </div>
        )}
      </div>

      <section className="eco-sec">
        <h4 className="ed-h4">Ведомость за ход</h4>
        {L.lines.map((l) => (
          <div key={l.key} className="mil-led">
            <span>{l.name}</span>
            <div className="mil-led-bar">
              <i className={l.amount < 0 ? 'neg' : ''} style={{ width: `${(100 * Math.abs(l.amount)) / max}%` }} />
              {showLeak && (L.leak.byLine[l.key] ?? 0) > 0.5 && <i className="leak" style={{ width: `${(100 * L.leak.byLine[l.key]) / max}%` }} />}
            </div>
            <b>{fmtMarks(l.amount)}</b>
            {l.note && <em>{l.note}{showLeak && (L.leak.byLine[l.key] ?? 0) > 0.5 ? ` · из них утекает ${fmtMarks(L.leak.byLine[l.key])}` : ''}</em>}
          </div>
        ))}
        {L.income.map((l) => (
          <div key={l.key} className="mil-led inc"><span>{l.name}</span><div /><b>+{fmtMarks(l.amount)}</b>{l.note && <em>{l.note}</em>}</div>
        ))}
        {showLeak && (
          <div className="mil-leak">
            <b>Куда утекает:</b> {L.leak.through}. <b>Кто кормится:</b> {L.leak.who}.{L.leak.note ? ` ${L.leak.note}` : ''}
            {!L.leak.revealed && <div className="ew-muted">Игрок этого не видит — только раздутые статьи. Ревизия откроет утечки.</div>}
          </div>
        )}
      </section>

      <section className="eco-sec">
        <h4 className="ed-h4">Армии и места базирования</h4>
        {L.armies.map((a) => (
          <div key={a.id} className="mil-base">
            <b>{a.name}</b>
            <span>{fmtPeople(a.men)}</span>
            <span>📍 {a.baseName ?? 'без базы'}{a.hops ? ` · ${a.hops} обл. от столицы` : ' · у столицы'}</span>
            <span>{fmtMarks(a.total)} за ход</span>
          </div>
        ))}
      </section>

      <section className="eco-sec">
        <h4 className="ed-h4">Меры по бюджету войска</h4>
        <p className="ew-muted">
          Меры принимает власть страны: «Внести на решение» — и решение пройдёт через неё (вкладка «Решения власти»). Мастер может и ввести меру сразу.
        </p>
        {(m.measures ?? []).length > 0 && (
          <div className="mil-measures-on">
            {m.measures!.map((x) => (
              <div key={x.id} className={`mil-measure-on${measureOn(x, date) ? ' on' : ''}`}>
                <span>{MEASURES[x.kind].icon} {MEASURES[x.kind].name}{x.scope?.length ? `: ${x.scope.map((id) => fName.get(id) ?? id).join(', ')}` : ''}</span>
                <i>
                  с {formatDate(world.calendar, x.from)}{x.to != null ? ` по ${formatDate(world.calendar, x.to)}` : ''}
                  {measureOn(x, date) ? ' · действует' : x.from > date ? ' · ещё не началась' : ' · закончилась'}
                </i>
                {master && measureOn(x, date) && <button className="link-btn" onClick={() => cancel(x.id)}>Отменить с этой даты</button>}
              </div>
            ))}
          </div>
        )}
        <div className="mil-measures">
          {(Object.keys(MEASURES) as MeasureKind[]).map((k) => {
            const d = MEASURES[k], gain = preview[k]
            const on = k !== 'settle' && (m.measures ?? []).some((x) => x.kind === k && measureOn(x, date))
            return (
              <div key={k} className={`mil-measure${on ? ' on' : ''}`}>
                <div className="mil-measure-head">
                  <span>{d.icon}</span><b>{d.name}</b>
                  {gain != null && <em className={gain >= 0 ? 'up' : 'down'}>{gain >= 0 ? '+' : ''}{fmtMarks(gain)} за ход</em>}
                  {on && <em>действует</em>}
                </div>
                <p>{d.text}</p>
                <p className="ew-muted">Цена: {d.price}</p>
                {k === 'settle' && (
                  <select className="ed-select" value={scope || m.roots[0]} onChange={(e) => setScope(e.target.value)}>
                    {targets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                {master && !on && (
                  <div className="dec-actions">
                    <button className="mil-go" onClick={() => { const act = { kind: 'measure' as const, measure: k, scope: k === 'settle' ? [scope || m.roots[0]] : undefined }; propose(k === 'audit' ? 'audit' : 'budget', act, actTitle(act, st, (id) => fName.get(id) ?? id)); onDecide() }}>Внести на решение власти</button>
                    <button className="link-btn" onClick={() => adopt(k)}>Ввести сразу с {formatDate(world.calendar, date)}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
