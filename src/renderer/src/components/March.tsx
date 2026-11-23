import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import { fmtMarks, fmtPeople } from '../economy'
import { stateReport } from '../econCalc'
import { companiesUnder } from '../orders'
import { planMarch } from '../marches'
import type { StateMilitary } from '../military'
import type { WorldState } from '../types'

/** Калькулятор похода: соединение → цель; путь по дорогам и местности, дни, хлеб, марки, потери; на карте и в поход */
export function MarchView({ st, m }: { st: WorldState; m: StateMilitary }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const master = useStore((s) => s.masterMode)
  const mutate = useStore((s) => s.mutate)
  const setRoute = useStore((s) => s.setRoutePreview)
  const setView = useStore((s) => s.setView)
  const closeCard = useStore((s) => s.openStateCard)
  const targets = m.formations.filter((f) => f.level !== 'battalion')
  const [fid, setFid] = useState(m.roots[0] ?? targets[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [dest, setDest] = useState<number | null>(null)
  const f = m.formations.find((x) => x.id === fid)
  const prov = useMemo(() => new Map((world.provinces ?? []).map((p) => [p.id, p])), [world.provinces])
  // поиск цели: области и города мира
  const wm = world.maps.find((x) => x.kind === 'world')
  const options = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const out: { id: number; label: string }[] = []
    for (const p of world.provinces ?? []) if (p.name.toLowerCase().includes(s)) out.push({ id: p.id, label: `${p.name} (область)` })
    for (const pl of world.places) {
      if (pl.mapId !== wm?.id) continue
      const name = (pl.base as { name?: string }).name ?? ''
      if (!name.toLowerCase().includes(s)) continue
      let best = -1, d = Infinity
      for (const p of world.provinces ?? []) { const dd = (p.x - pl.x) ** 2 + (p.y - pl.y) ** 2; if (dd < d) { d = dd; best = p.id } }
      out.push({ id: best, label: `${name} (город)` })
    }
    return out.slice(0, 10)
  }, [q, world.provinces, world.places, wm?.id])

  const ids = useMemo(() => (f ? companiesUnder(m, f) : []), [m, f])
  const men = useMemo(() => ids.reduce((s, id) => s + (m.companies.find((c) => c.id === id)?.men ?? 0), 0), [ids, m.companies])
  const rep = useMemo(() => stateReport(world, st, date), [world, st, date])
  const share = rep?.ledger && rep.ledger.men ? men / rep.ledger.men : 1
  const plan = useMemo(() => (f?.base != null && dest != null ? planMarch(world, st.id, m, ids, f.base, dest, date, men, (rep?.ledger?.total ?? 0) * share) : null), [world, st.id, m, ids, f, dest, date, men, rep, share])

  const pts = (): [number, number][] => (plan?.ok ? [[plan.steps[0].from.x, plan.steps[0].from.y], ...plan.steps.map((s) => [s.to.x, s.to.y] as [number, number])] : [])
  const show = (): void => { if (!plan?.ok || !f) return; setRoute({ points: pts(), color: st.base.color, label: `${f.name} → ${q.replace(/ \((город|область)\)$/, '') || prov.get(dest!)?.name}` }); closeCard(null); setView('map') }
  const send = (): void => {
    if (!plan?.ok || !f) return
    // поход на карте: точки — центры областей, дата каждой — по накопленным дням пути (с отдыхом)
    let t = 0
    const wp = [{ x: plan.steps[0].from.x, y: plan.steps[0].from.y, date }]
    for (const s of plan.steps) { t += s.days * (7 / 6); wp.push({ x: s.to.x, y: s.to.y, date: date + Math.round(t) }) }
    mutate((w) => { (w.armies ??= []).push({ id: `march-${Date.now().toString(36)}`, name: f.name, mapId: wm?.id ?? 'world', stateId: st.id, color: st.base.color, waypoints: wp }) })
  }
  const marches = (world.armies ?? []).filter((a) => a.stateId === st.id && a.id.startsWith('march-'))
  const removeMarch = (id: string): void => mutate((w) => { w.armies = (w.armies ?? []).filter((a) => a.id !== id) })

  return (
    <div className="mr">
      <section className="eco-sec">
        <h4 className="ed-h4">Кто и куда</h4>
        <div className="dec-form">
          <select className="ed-select" value={fid} onChange={(e) => setFid(e.target.value)}>
            {targets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <span className="ew-muted">из {f?.base != null ? prov.get(f.base)?.name : '—'} ({fmtPeople(men)})</span>
        </div>
        <div className="mr-search">
          <input className="dec-text" placeholder="Цель похода: область или город…" value={q} onChange={(e) => { setQ(e.target.value); setDest(null) }} />
          {options.length > 0 && dest == null && (
            <div className="mr-options">{options.map((o, i) => <button key={i} onClick={() => { setDest(o.id); setQ(o.label) }}>{o.label}</button>)}</div>
          )}
        </div>
        <p className="ew-muted small">Путь ищется по областям: мощёный тракт быстрее всего, дальше грунтовки и тропы, по бездорожью — по местности (лес, холмы, горы, снега, пустыня). Реки без моста задерживают переправой. Сезон — по дате шкалы. Каждый седьмой день — отдых.</p>
      </section>

      {plan && !plan.ok && <p className="mil-state">⛔ {plan.reason}. {plan.seasonNote}.</p>}
      {plan?.ok && (
        <>
          <div className="ew-tiles">
            <div className="ew-tile"><span>В пути</span><b>{plan.days} дн.</b><i>{plan.km.toLocaleString('ru-RU')} км · придут {formatDate(world.calendar, plan.arrive)}</i></div>
            <div className="ew-tile"><span>Хлеб и корм</span><b>{plan.grain.toLocaleString('ru-RU')} т</b><i>≈ 1,1 кг на человека в день</i></div>
            <div className="ew-tile"><span>Походная казна</span><b>{fmtMarks(plan.marks)}</b><i>полуторное содержание на время пути</i></div>
            <div className="ew-tile"><span>Отстанут и заболеют</span><b>{fmtPeople(plan.losses)}</b><i>{((100 * plan.losses) / Math.max(1, men)).toFixed(1).replace('.', ',')} % войска</i></div>
            <div className="ew-tile"><span>Сезон</span><b>{plan.season}</b><i>{plan.seasonNote}</i></div>
          </div>
          <section className="eco-sec">
            <h4 className="ed-h4">Отчего такая скорость</h4>
            <p className="small">Скорость войска ×{plan.speedK.toFixed(2)}{plan.speedWhy.length ? `: ${plan.speedWhy.join('; ')}` : ''}.{plan.rivers ? ` Переправ без моста: ${plan.rivers}.` : ''}{plan.foreign.length ? ` Через чужие земли: ${plan.foreign.join(', ')} — разрешение на проход или война.` : ''}</p>
            <div className="dec-actions">
              <button className="mil-go" onClick={show}>Показать путь на карте</button>
              {master && <button className="mil-go" onClick={send}>Отправить в поход с {formatDate(world.calendar, date)}</button>}
            </div>
            <h4 className="ed-h4">Путь по областям</h4>
            <div className="mr-steps">
              {plan.steps.map((s, i) => (
                <div key={i} className={`mr-step${s.foreign ? ' foreign' : ''}`}>
                  <span>{i + 1}</span>
                  <b>{s.to.name}</b>
                  <i>{s.how}{s.river ? ` · переправа: ${s.river}` : ''}{s.foreign ? ` · ${s.foreign}` : ''}</i>
                  <em>{Math.round(s.km)} км · {s.days.toFixed(1).replace('.', ',')} дн.</em>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {marches.length > 0 && (
        <section className="eco-sec">
          <h4 className="ed-h4">Походы на карте</h4>
          {marches.map((a) => (
            <div key={a.id} className="mil-order">
              <div className="mil-order-head"><span>⚑</span><b>{a.name}</b><em>{formatDate(world.calendar, a.waypoints[0].date)} — {formatDate(world.calendar, a.waypoints.at(-1)!.date)}</em></div>
              {master && <div className="dec-actions"><button className="link-btn" onClick={() => removeMarch(a.id)}>Отменить поход</button></div>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
