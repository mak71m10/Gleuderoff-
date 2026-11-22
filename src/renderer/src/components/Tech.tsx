import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { toParts } from '../calendar'
import { TECH_LINES, POWDER_ATTITUDES, type StateTech, type TechLine } from '../tech'

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const ICON: Record<TechLine, string> = { powder: '💥', gear: '⚙', steam: '♨', print: '✒', money: '⚖', sea: '⚓', med: '⚕', magic: '✦' }
const EMPTY: StateTech = {
  levels: { powder: 0, gear: 0, steam: 0, print: 0, money: 0, sea: 0, med: 0, magic: 0 },
  attitude: 'неизвестен',
  note: '',
  log: []
}

/**
 * «Технологии» страны в Век Шестерни: восемь линий 0–5 с описанием уровня, отношение к пороху,
 * что движет страной и следующий шаг. Мастер поднимает и опускает уровни: каждое изменение
 * ложится в журнал страны с годом и причиной (docs/технологии.md — как игроки развивают мир).
 */
export function TechView({ tech, onChange }: { tech?: StateTech; onChange: (t: StateTech) => void }) {
  const master = useStore((s) => s.masterMode)
  const world = useStore((s) => s.world!)
  const date = useStore((s) => s.date)
  const year = toParts(world.calendar, date).year
  const t = tech ?? EMPTY
  const [open, setOpen] = useState<TechLine | null>(null)
  const [why, setWhy] = useState('')

  const step = (key: TechLine, d: number): void => {
    const from = t.levels[key], to = Math.max(0, Math.min(5, from + d))
    if (to === from) return
    onChange({ ...t, levels: { ...t.levels, [key]: to }, log: [...t.log, { year, line: key, from, to, note: why.trim() }] })
    setWhy('')
  }

  return (
    <div className="tech">
      <div className="tech-head">
        <div className="tech-epoch">Век Шестерни · {year} г.</div>
        <div className={`tech-att tech-att-${t.attitude}`} title={POWDER_ATTITUDES[t.attitude] ?? ''}>
          Порох: <b>{t.attitude}</b>
        </div>
      </div>
      <p className="tech-att-text">{POWDER_ATTITUDES[t.attitude] ?? ''}</p>

      <div className="tech-lines">
        {TECH_LINES.map((l) => {
          const v = t.levels[l.key] ?? 0
          return (
            <div key={l.key} className={`tech-line ${open === l.key ? 'open' : ''}`}>
              <button className="tech-row" onClick={() => setOpen(open === l.key ? null : l.key)}>
                <span className="tech-ico">{ICON[l.key]}</span>
                <span className="tech-name">{l.name}</span>
                <span className="tech-dots" aria-label={`уровень ${v} из 5`}>
                  {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}
                </span>
                <span className="tech-lvl">{l.levels[v]}</span>
              </button>
              {open === l.key && (
                <div className="tech-more">
                  <p className="tech-about">{l.about}</p>
                  <ol start={0}>
                    {l.levels.map((s, i) => <li key={i} className={i === v ? 'cur' : i < v ? 'done' : ''}>{s}</li>)}
                  </ol>
                  {master && (
                    <div className="tech-edit">
                      <input value={why} placeholder="Что случилось (чертёж, мастер, война…)" onChange={(e) => setWhy(e.target.value)} />
                      <button disabled={v <= 0} onClick={() => step(l.key, -1)}>− шаг</button>
                      <button disabled={v >= 5} onClick={() => step(l.key, 1)}>+ шаг</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {t.note && <div className="tech-note">{t.note.split('\n').map((p, i) => <p key={i}>{bold(p)}</p>)}</div>}
      {t.next && <div className="tech-next"><b>Следующий шаг.</b> {bold(t.next)}</div>}

      {t.log.length > 0 && (
        <div className="tech-log">
          <h4>Журнал перемен</h4>
          {[...t.log].reverse().map((e, i) => {
            const l = TECH_LINES.find((x) => x.key === e.line)
            return (
              <div key={i} className={`tech-log-row ${e.to > e.from ? 'up' : 'down'}`}>
                <span className="tech-log-y">{e.year} г.</span>
                <span>{ICON[e.line]} {l?.name}: {e.from} → {e.to}</span>
                {e.note && <span className="tech-log-n">— {e.note}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
