import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type UrnData = NonNullable<Entry['base']['urn']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
// цвета кандидатов: шар и место в палате окрашиваются в цвет того, за кого брошен белый шар
const CAND = ['#e0b040', '#4fa0c8', '#c86a4a', '#8ac06a', '#b48ad8', '#d87aa8']

/**
 * «Соляная урна» Республики Чеафарал: Совет Двадцати (по пять мест у Гербов, Соли, Счёта и Хоругвей) на год выборов,
 * круги голосования белыми и чёрными шарами — нужно одиннадцать. После третьего круга палата заперта на хлебе и соли,
 * после седьмого Хоругви могут положить Меч на урну. Места в палате окрашены в цвет того, за кого брошен шар.
 */
export function UrnView({ data, onOpen }: { data: UrnData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [ei, setEi] = useState(data.elections.length - 1)
  const e = data.elections[Math.min(ei, data.elections.length - 1)]
  const [ri, setRi] = useState(e.rounds.length - 1)
  const r = Math.min(ri, e.rounds.length - 1)
  const round = e.rounds[r]
  const pick = (i: number): void => { setEi(i); setRi(data.elections[i].rounds.length - 1) }
  const colorOf = new Map(e.candidates.map((c, i) => [c.key, CAND[i % CAND.length]]))
  const fac = new Map(data.factions.map((f) => [f.key, f]))
  const total = (key: string): number => Object.values(round.votes[key] ?? {}).reduce((s, v) => s + v, 0)
  const last = r === e.rounds.length - 1
  const winner = last ? e.candidates.find((c) => c.key === e.winner) : null
  // кто сидел в Совете в год урны (до выбора)
  const seats = data.factions.map((f) => {
    const ms = data.members.filter((m) => m.faction === f.key && m.from <= e.year + 0.001 && (m.to == null || m.to > e.year + 0.001)).slice(0, 5)
    // шары стороны: сколько за каждого кандидата; остальные — чёрные
    const balls: (string | null)[] = []
    for (const c of e.candidates) for (let k = 0; k < (round.votes[c.key]?.[f.key] ?? 0); k++) balls.push(c.key)
    while (balls.length < 5) balls.push(null)
    return { f, ms, balls }
  })
  const blacks = 20 - e.candidates.reduce((s, c) => s + total(c.key), 0)
  const H = 11
  return (
    <div className="urn">
      <div className="urn-head">
        <div>
          <small>Соляная урна</small>
          <b>{e.title}, {Math.floor(e.year)} г.</b>
        </div>
        <div className={`urn-status ${winner ? 'won' : r >= 7 ? 'sword' : r >= 3 ? 'locked' : ''}`}>
          {winner ? <>Протектор — <b>{winner.name}</b></> : r >= 7 ? <>⚔ Меч на столе: Хоругви вправе положить его на урну</> : r >= 3 ? <>🔒 Палата заперта: хлеб и соль</> : <>Круг {r + 1}: нужно {data.need} белых шаров</>}
        </div>
      </div>
      <div className="urn-tabs">
        {data.elections.map((x, i) => (
          <button key={x.year} className={i === ei ? 'on' : ''} onClick={() => pick(i)}><small>{Math.floor(x.year)}</small> {x.title}</button>
        ))}
      </div>
      <div className="urn-rounds">
        {e.rounds.map((_, i) => (
          <button key={i} className={`${i === r ? 'on' : ''} ${i >= 3 ? 'locked' : ''} ${i >= 7 ? 'sword' : ''}`} onClick={() => setRi(i)} title={i >= 7 ? 'после седьмого круга — право Меча на урну' : i >= 3 ? 'палата заперта' : ''}>
            {i >= 7 ? '⚔' : i >= 3 ? '🔒' : ''}{i + 1}
          </button>
        ))}
      </div>
      <div className="urn-body">
        <div className="urn-hall">
          {seats.map(({ f, ms, balls }) => (
            <div key={f.key} className="urn-side" style={{ ['--fc' as string]: f.color, ['--fl' as string]: f.light }}>
              <div className="urn-side-name">{f.name}</div>
              <div className="urn-seats">
                {Array.from({ length: 5 }, (_, k) => {
                  const m = ms[k]
                  const b = balls[k]
                  const src = m?.id ? img.get(m.id) : ''
                  return (
                    <button key={k} className={`urn-seat ${b ? 'white' : 'black'}`} style={{ ['--bc' as string]: b ? colorOf.get(b) : '#111' }} disabled={!m?.id} onClick={() => m?.id && onOpen(m.id)} title={m ? `${m.name} — ${b ? 'белый шар за ' + e.candidates.find((c) => c.key === b)?.name : 'чёрный шар'}` : ''}>
                      <span className="urn-face">{src ? <img src={assetUrl(src)} alt="" /> : (m?.name[0] ?? '?')}</span>
                      <span className="urn-seat-name">{m?.name.replace(/^(\S+)\s.*?(\S+)$/, '$1 $2') ?? '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="urn-count">
          {e.candidates.map((c) => {
            const n = total(c.key)
            const v = round.votes[c.key] ?? {}
            const won = winner?.key === c.key
            return (
              <div key={c.key} className={`urn-cand ${won ? 'won' : ''} ${n === 0 ? 'out' : ''}`}>
                <div className="urn-stack" style={{ ['--cc' as string]: colorOf.get(c.key) }}>
                  <i className="urn-need" style={{ bottom: `${(H / 20) * 100}%` }} />
                  {Object.entries(v).flatMap(([fk, k]) => Array.from({ length: k }, (_, j) => <span key={fk + j} className="urn-ball" style={{ borderColor: fac.get(fk)?.color }} title={fac.get(fk)?.name} />))}
                </div>
                <b className="urn-n">{n}{won ? ' ♛' : ''}</b>
                <button className="urn-cand-name" disabled={!c.id} onClick={() => c.id && onOpen(c.id)} style={{ color: colorOf.get(c.key) }}>{c.name}</button>
                <small>{fac.get(c.faction)?.name ?? 'не из Совета'}</small>
              </div>
            )
          })}
          <div className="urn-cand blacks">
            <div className="urn-stack">{Array.from({ length: Math.max(0, blacks) }, (_, j) => <span key={j} className="urn-ball black" />)}</div>
            <b className="urn-n">{blacks}</b>
            <span className="urn-cand-name">чёрные</span>
          </div>
        </div>
      </div>
      <p className="urn-note">{round.note}</p>
      {last && <p className="urn-final">{e.note}</p>}
      <div className="urn-legend">{data.factions.map((f) => <span key={f.key}><i style={{ background: f.color }} />{f.name} — {f.who}</span>)}</div>
      <ul className="urn-rules">{data.rules.map((x) => <li key={x}>{bold(x)}</li>)}</ul>
    </div>
  )
}
