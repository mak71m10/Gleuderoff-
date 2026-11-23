import { useState } from 'react'
import { useStore } from '../store'
import { formatDate } from '../calendar'
import type { WorldState } from '../types'

/** Приказы игроков и вердикты по стране (world.vpiLog; вносит scripts/vpi.mjs внести) */
export function VpiLogView({ st }: { st: WorldState }) {
  const world = useStore((s) => s.world!)
  const [open, setOpen] = useState<string | null>(null)
  const list = (world.vpiLog ?? []).filter((x) => x.state === st.base.name).slice().reverse()
  if (!list.length) return null
  return (
    <section className="vpi-log">
      <h3>📜 Приказы и вердикты</h3>
      {list.slice(0, 12).map((x) => (
        <div key={x.id} className="vpi-item">
          <button className="vpi-head" onClick={() => setOpen(open === x.id ? null : x.id)}>
            <span>{formatDate(world.calendar, x.date)}</span>
            <b>{x.title}</b>
            <i>{open === x.id ? '▾' : '▸'}</i>
          </button>
          {x.public && <p className="vpi-public">{x.public}</p>}
          {open === x.id && (
            <div className="vpi-body">
              {x.order && <p><b>Приказ:</b> {x.order}</p>}
              {x.verdict && <p><b>Вердикт:</b> {x.verdict}</p>}
              {x.changes?.length > 0 && <ul>{x.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>}
            </div>
          )}
        </div>
      ))}
    </section>
  )
}
