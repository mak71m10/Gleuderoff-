import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type FleetData = NonNullable<Entry['base']['fleet']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const CAND = ['#e0b040', '#4fa0c8', '#c86a4a', '#8ac06a', '#b48ad8', '#d87aa8']
const TOKENS = 20 // один кораблик на 25 вымпелов

/** разложить число кораблей по колоннам: 20 корабликов, по методу наибольших остатков */
function shares(values: number[], total = TOKENS): number[] {
  const sum = values.reduce((s, v) => s + v, 0) || 1
  const raw = values.map((v) => (v / sum) * total)
  const base = raw.map(Math.floor)
  let left = total - base.reduce((s, v) => s + v, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) { if (left <= 0) break; base[i]++; left-- }
  return base
}

/**
 * «Рейд» Крайдонианской Лиги: корабли встают в колонны за кандидатами в Верховные адмиралы, пока идёт Выбор (до 27 вахт);
 * два «ветра» — тайные голоса Коллегии Флагов (нужно 16 из 31) и открытые вымпелы (нужно 251 из 500); в конце — график Смотра.
 */
export function FleetView({ data, onOpen }: { data: FleetData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [ei, setEi] = useState(data.elections.length - 1)
  const e = data.elections[Math.min(ei, data.elections.length - 1)]
  const [wi, setWi] = useState(e.watches.length - 1)
  const w = e.watches[Math.min(wi, e.watches.length - 1)]
  const last = w === e.watches[e.watches.length - 1]
  const pick = (i: number): void => { setEi(i); setWi(data.elections[i].watches.length - 1) }
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const cols = e.candidates.map((c, i) => ({ c, color: CAND[i % CAND.length], flags: w.flags[c.key] ?? 0, pen: w.pennants[c.key] ?? 0 }))
  const ships = shares(cols.map((x) => x.pen))
  const flagWin = cols.find((x) => x.flags >= data.needFlags)
  const penWin = cols.find((x) => x.pen >= data.needPennants)
  const winner = flagWin && penWin && flagWin.c.key === penWin.c.key ? flagWin : null
  const calm = !winner && (flagWin || penWin)
  const storm = !winner && last && w.n >= 27
  // места Коллегии: цвет — за кого в этой вахте проголосовал (по порядку мест, кандидатам по очереди)
  const seatOwner: string[] = []
  for (const x of cols) for (let k = 0; k < x.flags; k++) seatOwner.push(x.c.key)
  const colorOf = new Map(cols.map((x) => [x.c.key, x.color]))
  const kinds: [string, string][] = [['admiral', 'Адмиралы'], ['captain', 'Капитаны по жребию'], ['rank', 'Чины флота']]
  const W = 700, H = 190
  const colW = W / cols.length
  // салюты
  const sy0 = Math.min(...data.salutes.map((s) => s.year)), sy1 = Math.max(...data.salutes.map((s) => s.year))
  const sx = (y: number): number => 30 + ((y - sy0) / Math.max(1, sy1 - sy0)) * 650
  const sy = (p: number): number => 120 - ((p - 40) / 60) * 100
  const admirals = [...new Set(data.salutes.map((s) => s.admiral))]
  const admiralName = (k: string): string => (world.entries.find((x) => x.id === `lore-cr-${k}`)?.base.name ?? k).split(' «')[0]
  const [hs, setHs] = useState<number | null>(null)
  const shown = hs != null ? data.salutes[hs] : data.salutes[data.salutes.length - 1]
  return (
    <div className="fleet">
      <div className="fleet-head">
        <div>
          <small>Рейд</small>
          <b>{e.title}, {Math.floor(e.year)} г.</b>
        </div>
        <div className={`fleet-status ${winner ? 'won' : storm ? 'storm' : calm ? 'calm' : ''}`}>
          {winner ? <>Верховный адмирал — <b>{winner.c.name}</b></> : storm ? <>🌩 Штормовое право: год правит Регент-адмирал</> : calm ? <>⚓ ШТИЛЬ: ветры разошлись</> : <>Вахта {w.n} из 27: нужны {data.needFlags} голосов и {data.needPennants} вымпелов</>}
        </div>
      </div>
      <div className="fleet-tabs">
        {data.elections.map((x, i) => <button key={x.year} className={i === ei ? 'on' : ''} onClick={() => pick(i)}><small>{Math.floor(x.year)}</small> {x.title}</button>)}
      </div>
      <div className="fleet-watches">
        {e.watches.map((x, i) => <button key={x.n} className={i === wi ? 'on' : ''} onClick={() => setWi(i)}>вахта {x.n}</button>)}
      </div>
      <div className="fleet-sea">
        <svg viewBox={`0 0 ${W} ${H}`} className="fleet-svg">
          <defs>
            <linearGradient id="fleet-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1d3a5a" /><stop offset="1" stopColor="#0d1c30" /></linearGradient>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="url(#fleet-water)" rx="8" />
          {[44, 84, 124, 164].map((y) => <path key={y} d={`M0 ${y} q 20 -4 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} className="fleet-wave" />)}
          {cols.map((x, ci) => (
            <g key={x.c.key}>
              <line x1={colW * ci + colW / 2} y1="34" x2={colW * ci + colW / 2} y2={H - 6} stroke={x.color} strokeOpacity=".25" strokeDasharray="3 5" />
            </g>
          ))}
          {/* корабли: фиксированные места, на которые они переходят между колоннами */}
          {(() => {
            let idx = 0
            const out: ReactNode[] = []
            cols.forEach((x, ci) => {
              for (let k = 0; k < ships[ci]; k++) {
                const per = Math.max(1, Math.min(4, Math.floor((colW - 20) / 36)))
                const cx = colW * ci + colW / 2 + ((k % per) - (per - 1) / 2) * 34
                const cy = 78 + Math.floor(k / per) * 28
                out.push(
                  <g key={idx} className="fleet-ship" style={{ transform: `translate(${cx}px, ${cy}px)` }}>
                    <path d="M-12 0 h24 l-5 8 h-14 z" fill="#3a2a1e" stroke={x.color} strokeWidth="1.4" />
                    <path d="M-1 -14 v14 M-1 -13 q 9 5 0 11 z" stroke="#e8dcc0" strokeWidth="1.2" fill="#efe6d0" />
                    <rect x="-1" y="-17" width="7" height="3" fill={x.color} />
                  </g>
                )
                idx++
              }
            })
            return out
          })()}
        </svg>
        <div className="fleet-heads" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((x) => {
            const src = x.c.id ? img.get(x.c.id) : ''
            return (
              <button key={x.c.key} className={`fleet-cand ${winner?.c.key === x.c.key ? 'won' : ''}`} style={{ ['--cc' as string]: x.color }} disabled={!x.c.id} onClick={() => x.c.id && onOpen(x.c.id)}>
                <span className="fleet-face">{src ? <img src={assetUrl(src)} alt="" /> : x.c.name[0]}</span>
                <b>{x.c.name}</b>
                <small>{side.get(x.c.side)?.name} · {x.c.flagship}</small>
                <span className="fleet-nums"><i>{x.flags}</i> из 31 · <i>{x.pen}</i> вымпелов</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="fleet-winds">
        {([['Ветер Флагов', data.needFlags, 31, 'flags'], ['Ветер Вымпелов', data.needPennants, 500, 'pen']] as [string, number, number, 'flags' | 'pen'][]).map(([name, need, total, key]) => (
          <div key={name} className="fleet-wind">
            <span className="fleet-wind-name">{name}</span>
            <span className="fleet-wind-bar">
              {cols.map((x) => <i key={x.c.key} style={{ width: `${(x[key] / total) * 100}%`, background: x.color }} title={`${x.c.name}: ${x[key]}`}>{x[key]}</i>)}
              <em style={{ left: `${(need / total) * 100}%` }} />
            </span>
            <small>нужно {need}</small>
          </div>
        ))}
      </div>
      <p className="fleet-note">{w.note}</p>
      {last && <p className="fleet-final">{e.note}</p>}
      <div className="fleet-college">
        <h4 className="fleet-h">Коллегия Флагов</h4>
        {kinds.map(([kind, label]) => {
          const list = data.college.filter((m) => m.kind === kind)
          const offset = data.college.findIndex((m) => m.kind === kind)
          return (
            <div key={kind} className="fleet-row">
              <span className="fleet-row-name">{label}</span>
              <span className="fleet-row-seats">
                {list.map((m, k) => {
                  const owner = seatOwner[offset + k]
                  const src = m.id ? img.get(m.id) : ''
                  return (
                    <button key={m.name} className="fleet-seat" style={{ ['--bc' as string]: owner ? colorOf.get(owner) : '#555' }} disabled={!m.id} onClick={() => m.id && onOpen(m.id)} title={`${m.name} — ${m.office} (${side.get(m.side)?.name})`}>
                      <span className="fleet-face sm">{src ? <img src={assetUrl(src)} alt="" /> : m.name[0]}</span>
                      <span className="fleet-seat-name">{m.name.split(' ').slice(-1)[0]}</span>
                    </button>
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>
      <h4 className="fleet-h">Смотр: салют кораблей</h4>
      <svg viewBox="0 0 700 150" className="fleet-chart">
        <line x1="30" x2="680" y1={sy(50)} y2={sy(50)} className="fleet-half" />
        <text x="640" y={sy(50) - 4} className="fleet-axis">50 %</text>
        <polyline points={data.salutes.map((s) => `${sx(s.year)},${sy(s.percent)}`).join(' ')} className="fleet-line" />
        {data.salutes.map((s, i) => (
          <g key={s.year} onMouseEnter={() => setHs(i)} onClick={() => setHs(i)}>
            <circle cx={sx(s.year)} cy={sy(s.percent)} r={s.percent < 50 ? 6 : 4.5} fill={s.percent < 50 ? '#e04a3a' : CAND[admirals.indexOf(s.admiral) % CAND.length]} stroke="#0d1c30" strokeWidth="1.5" />
            {(i === 0 || sx(s.year) - sx(data.salutes[i - 1].year) > 26 || i === data.salutes.length - 1) && !(i === data.salutes.length - 1 && sx(s.year) - sx(data.salutes[i - 1].year) < 26) && <text x={sx(s.year)} y="142" textAnchor="middle" className="fleet-axis">{s.year}</text>}
          </g>
        ))}
      </svg>
      <p className="fleet-note"><b>{shown.year} г., {admiralName(shown.admiral)}: {shown.percent} %.</b> {shown.note}</p>
      <div className="fleet-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name} — {s.who}</span>)}</div>
      <ul className="fleet-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
