import { useMemo } from 'react'
import { useStore } from '../store'
import { resolve } from '../temporal'
import { Button, assetUrl } from './ui'
import { Flag, defaultHeraldry } from './Heraldry'
import { GOOD, GOODS, ROLES, fmtMarks, fmtPeople, type Role } from '../economy'
import { EAT, stateReport } from '../econCalc'
import { TECH_LINES } from '../tech'
import type { Province } from '../types'

const armyWord = (n: number): string => (!n ? 'войска нет или не указано' : n < 3000 ? 'малая дружина' : n < 15000 ? 'небольшое войско' : n < 40000 ? 'сильное войско' : 'великая армия')
const contentWord = (c: number): string => (c >= 75 ? 'довольны' : c >= 60 ? 'спокойны' : c >= 45 ? 'ропщут' : c >= 30 ? 'злы' : 'на грани бунта')

/**
 * Панель страны справа при нажатии на карте: флаг, правитель с портретом, строй и столица,
 * население, казна и итог хода, продовольствие, главные товары, войско, беды и сильные стороны, сильнейшие технологии.
 */
export function StatePanel({ id }: { id: string }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const openCard = useStore((s) => s.openStateCard)
  const st = world.states.find((s) => s.id === id)
  const rep = useMemo(() => (st ? stateReport(world, st, date) : null), [world, st, date])
  if (!st) return null
  const f = resolve(st, date)
  const e = f.econ
  const ruler = world.entries.find((x) => x.id === f.rulerId)
  const capital = world.places.find((p) => p.id === f.capitalId)
  const goods = rep ? GOODS.map((g) => ({ g, v: (rep.production[g.key] ?? 0) * g.price })).filter((x) => !['grain', 'cloth', 'tools'].includes(x.g.key)).sort((a, b) => b.v - a.v).slice(0, 4) : []
  const foodPct = rep ? rep.food.yearPct : 0
  const tech = f.tech ? [...TECH_LINES].sort((a, b) => f.tech!.levels[b.key] - f.tech!.levels[a.key]).slice(0, 3) : []
  return (
    <div className="inspector-body mp">
      <div className="inspector-kicker">Государство</div>
      <div className="mp-head">
        {f.flag ? <img className="mp-flag" src={assetUrl(f.flag)} alt="" /> : <Flag heraldry={f.heraldry ?? defaultHeraldry(st, f.color)} width={84} />}
        <div>
          <h2 className="inspector-title" style={{ color: f.color }}>{f.name}</h2>
          <div className="muted small">{f.government || 'Строй не указан'}</div>
        </div>
      </div>
      {(ruler || f.ruler) && (
        <div className="mp-ruler">
          {ruler?.base.image && <img src={assetUrl(ruler.base.image)} alt="" />}
          <div>
            <div className="muted small">{f.rulerTitle || 'Правитель'}</div>
            <b>{ruler?.base.name ?? f.ruler}</b>
          </div>
        </div>
      )}
      <div className="mp-facts">
        {capital && <div><span>Столица</span><b>{resolve(capital, date).name}</b></div>}
        {rep && <div><span>Население</span><b>{fmtPeople(rep.pop)}</b></div>}
        {e && <div><span>Казна</span><b>{fmtMarks(e.treasury)}</b>{rep && <i className={rep.net < 0 ? 'neg' : 'pos'}>{rep.net >= 0 ? '+' : ''}{fmtMarks(rep.net)} за ход</i>}</div>}
        {rep && <div><span>Продовольствие</span><b className={foodPct < 100 ? 'neg' : ''}>{foodPct >= 100 ? 'хватает' : `своего ${foodPct} %`}</b></div>}
        {rep && <div><span>Войско</span><b>{armyWord(rep.soldiers)}</b>{rep.soldiers > 0 && <i>≈ {rep.soldiers.toLocaleString('ru-RU')}</i>}</div>}
        {e && <div><span>Монета</span><b>{e.coin.name}</b></div>}
      </div>
      {goods.length > 0 && (
        <div className="mp-block">
          <div className="field-label">Главные товары</div>
          <div className="chip-list">{goods.map(({ g }) => <span key={g.key} className="chip">{g.icon} {g.name}</span>)}</div>
        </div>
      )}
      {tech.length > 0 && (
        <div className="mp-block">
          <div className="field-label">Сильнее всего в технологиях</div>
          <div className="chip-list">{tech.map((l) => <span key={l.key} className="chip">{l.name} {f.tech!.levels[l.key]}/5</span>)}</div>
        </div>
      )}
      {e && e.troubles.length > 0 && (
        <div className="mp-block">
          <div className="field-label">Беды</div>
          <ul className="mp-list bad">{e.troubles.slice(0, 2).map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
      <Button icon="crown" variant="primary" onClick={() => openCard(id)}>Открыть карточку</Button>
    </div>
  )
}

/**
 * Экономика провинции и её области (для панели провинции): промысел, жители, народы и сословия области,
 * довольство, запас продовольствия, постройки.
 */
export function ProvinceEcon({ p }: { p: Province }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const area = world.adminRegions?.find((a) => a.id === p.areaId)
  const owner = p.owners?.at(-1)?.[1]
  const st = world.states.find((s) => s.id === owner)
  const estates = st ? resolve(st, date).econ?.estates ?? {} : {}
  const ae = area?.econ
  if (!p.res && !ae) return null
  const rows = ae ? Object.entries(ae.pop).map(([race, row]) => [race, Object.values(row).reduce((x, y) => x + (y ?? 0), 0)] as [string, number]).sort((a, b) => b[1] - a[1]) : []
  const total = rows.reduce((x, r) => x + r[1], 0)
  const byRole: Partial<Record<Role, number>> = {}
  if (ae) for (const row of Object.values(ae.pop)) for (const [r, n] of Object.entries(row) as [Role, number][]) byRole[r] = (byRole[r] ?? 0) + n
  const months = ae ? ae.granary / Math.max(1, total * EAT) : 0
  return (
    <div className="mp">
      <div className="mp-facts">
        {p.res && <div><span>Промысел</span><b>{GOOD[p.res.good].icon} {GOOD[p.res.good].name}</b><i>{['', 'скудно', 'хорошо', 'богато'][p.res.rich]}</i></div>}
        {p.pop != null && <div><span>Жителей в провинции</span><b>{fmtPeople(p.pop)}</b></div>}
      </div>
      {ae && area && (
        <div className="mp-area">
          <div className="field-label">Область «{area.name}» — {fmtPeople(total)}</div>
          {rows.slice(0, 6).map(([race, n]) => (
            <div key={race} className="mp-row"><span>{race}</span><div className="ew-bar"><i style={{ width: `${(100 * n) / Math.max(1, total)}%` }} /></div><span className="mp-num">{Math.round((100 * n) / Math.max(1, total))} %</span></div>
          ))}
          <div className="field-label mp-gap">Сословия</div>
          {ROLES.filter((r) => byRole[r.key]).map((r) => {
            const c = ae.content[r.key] ?? 50
            return (
              <div key={r.key} className="mp-row" title={r.does}>
                <span>{estates[r.key] ?? r.name}</span>
                <span className="mp-num">{fmtPeople(byRole[r.key]!)}</span>
                <span className={`mp-num ${c < 45 ? 'neg' : ''}`}>{c} · {contentWord(c)}</span>
              </div>
            )
          })}
          <div className="mp-facts mp-gap">
            <div><span>Запас продовольствия</span><b>{Math.round(ae.granary).toLocaleString('ru-RU')} мер</b><i>на {months.toFixed(1).replace('.', ',')} хода без урожая</i></div>
            <div><span>Постройки</span><b>{ae.buildings.join(', ') || '—'}</b></div>
          </div>
        </div>
      )}
    </div>
  )
}
