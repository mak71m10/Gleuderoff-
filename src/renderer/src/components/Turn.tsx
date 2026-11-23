import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { fmtMarks } from '../economy'
import { formatDate } from '../calendar'
import { applyTurn, monthLabel, nextTurn, turnPreview, undoTurn } from '../turn'

/** кнопка хода в боковом меню: показывает итоги месяца по странам и записывает их в казну; последний ход можно отменить */
export function TurnButton() {
  const world = useStore((s) => s.world!)
  const mutate = useStore((s) => s.mutate)
  const setDate = useStore((s) => s.setDate)
  const [open, setOpen] = useState(false)
  const next = nextTurn(world)
  const pv = useMemo(() => (open ? turnPreview(world, next) : null), [open, world, next])
  const total = pv ? pv.rows.reduce((s, r) => s + r.net, 0) : 0
  return (
    <>
      <button className="turn-btn" onClick={() => setOpen(true)} title="Записать итог месяца в казну всех стран">📜 <span>Ход: {monthLabel(world, next)}</span></button>
      {open && pv && (
        <div className="turn-modal" onClick={() => setOpen(false)}>
          <div className="turn-box" onClick={(e) => e.stopPropagation()}>
            <h3>Провести ход: {pv.label}</h3>
            <p className="ew-muted">Итог бюджета месяца каждой страны (доходы − расходы, с армией, флотом, договорами и приказами) запишется в журнал её казны на {formatDate(world.calendar, pv.end)}. Шкала перейдёт на следующий месяц.</p>
            <div className="turn-sum"><span>Стран: {pv.rows.length}</span><span>Всего: {total >= 0 ? '+' : ''}{fmtMarks(total)}</span><span>В минусе: {pv.rows.filter((r) => r.net < 0).length}</span></div>
            <div className="turn-cols">
              <div><h4>Больше всех теряют</h4>{pv.rows.slice(0, 8).map((r) => <div key={r.id} className="turn-row"><span>{r.name}</span><b className="down">{fmtMarks(r.net)}</b><i>казна {fmtMarks(r.treasury)}</i></div>)}</div>
              <div><h4>Больше всех получают</h4>{pv.rows.slice(-8).reverse().map((r) => <div key={r.id} className="turn-row"><span>{r.name}</span><b className="up">+{fmtMarks(r.net)}</b><i>казна {fmtMarks(r.treasury)}</i></div>)}</div>
            </div>
            <div className="dec-actions">
              <button className="eco-open" onClick={() => { mutate((w) => applyTurn(w, pv)); setDate(pv.end + 1); setOpen(false) }}>Провести ход</button>
              {world.vpi?.lastTurn != null && <button className="link-btn" onClick={() => { mutate((w) => { undoTurn(w) }); setOpen(false) }}>Отменить последний ход ({monthLabel(world, world.vpi.lastTurn)})</button>}
              <button className="link-btn" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
