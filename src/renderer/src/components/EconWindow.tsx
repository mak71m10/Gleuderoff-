import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import { GOOD, fmtPeople, type Good } from '../economy'
import { EAT } from '../econCalc'
import { ownerAt } from '../provinces'
import { EconDashboard } from './EconDashboard'
import type { WorldState } from '../types'

/**
 * Окно экономики страны во весь экран: та же панель, что во вкладке (EconDashboard, на дату хронологии),
 * плюс таблица всех областей страны.
 */
export function EconWindow({ st, onClose }: { st: WorldState; onClose: () => void }) {
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const areaRows = useMemo(() => {
    const provs = (world.provinces ?? []).filter((p) => ownerAt(p, date) === st.id)
    const ids = [...new Set(provs.map((p) => p.areaId))]
    return ids.map((id) => world.adminRegions?.find((a) => a.id === id)).filter((a) => a?.econ).map((a) => {
      const ap = provs.filter((p) => p.areaId === a!.id)
      const n = ap.reduce((x, p) => x + (p.pop ?? 0), 0)
      const cnt: Record<string, number> = {}
      for (const p of ap) if (p.res) cnt[p.res.good] = (cnt[p.res.good] ?? 0) + p.res.rich
      const top = Object.entries(cnt).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g as Good)
      return { a: a!, n, top, months: a!.econ!.granary / Math.max(1, n * EAT) }
    }).sort((x, y) => y.n - x.n)
  }, [world, st.id, date])

  return createPortal(
    <div className="econ-win-back" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="econ-win">
        <header className="ew-head">
          <div>
            <div className="ew-title">Экономика: {st.base.name}</div>
            <div className="ew-sub">{st.base.fullName || st.base.government}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </header>
        <EconDashboard st={st} full />
        <section className="ew-sec ew-areas">
          <h3>Области ({areaRows.length})</h3>
          <table className="ew-table">
            <thead><tr><th>Область</th><th>Жителей</th><th>Главные промыслы</th><th>Запас еды</th><th>Постройки</th></tr></thead>
            <tbody>
              {areaRows.map(({ a, n, top, months }) => (
                <tr key={a.id}>
                  <td><b>{a.name}</b></td>
                  <td>{fmtPeople(n)}</td>
                  <td>{top.map((g) => `${GOOD[g].icon} ${GOOD[g].name}`).join(', ')}</td>
                  <td className={months < 2 ? 'bad' : ''}>на {months.toFixed(1).replace('.', ',')} хода</td>
                  <td className="ew-muted">{a.econ!.buildings.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>,
    document.body
  )
}
