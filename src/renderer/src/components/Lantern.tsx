import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type LanternData = NonNullable<Entry['base']['lantern']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const rad = (a: number): number => (a * Math.PI) / 180
const BY: Record<string, string> = { own: 'своя очередь', pledge: 'по залогу', skip: 'отведён', dark: 'Тёмный год', future: 'впереди' }
const ST: Record<string, [string, string]> = { redeemed: ['выкуплен', '#6aaa7a'], served: ['исполнен', '#8aa0c0'], active: ['в силе', '#c9a24a'], refused: ['отказ', '#d0604a'], offer: ['предложение', '#b48ad8'] }

/** дуга-сектор между радиусами r0..r1 и углами a0..a1 (градусы; 0 — вправо, по часовой) */
function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number): string => `${(cx + Math.cos(rad(a)) * r).toFixed(1)} ${(cy + Math.sin(rad(a)) * r).toFixed(1)}`
  const big = a1 - a0 > 180 ? 1 : 0
  return `M${p(r1, a0)} A${r1} ${r1} 0 ${big} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${big} 0 ${p(r0, a0)} Z`
}

/**
 * «Круг Светоча» Княжеств Гарефорда: десять княжеств по очереди носят фонарь со Святым Пламенем (по 3 года), колесо в два кольца —
 * первый и второй круг; ползунок лет двигает фонарь; залоги — цепные звенья на дугах, отводы — свечи, «три звена» — золотая скоба.
 */
export function LanternView({ data, onOpen }: { data: LanternData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(1010)
  const [sel, setSel] = useState<number | null>(null)
  const [ri, setRi] = useState(data.removals.length - 1)
  const Y0 = 977, Y1 = 1032
  const cur = data.turns.find((t) => t.by !== 'skip' && t.from <= year + 0.5 && year + 0.5 < t.to) ?? data.turns[0]
  const shown = sel != null ? data.turns[sel] : cur
  const colorOfHouse = (house: string): string => data.order.find((o) => house.startsWith(o.house))?.color ?? '#c9a24a'
  const SZ = 360, C = SZ / 2
  const step = 360 / data.order.length
  const ang = (i: number): number => -90 - step / 2 + i * step // сектор i: от a до a+step; первое княжество — вверху слева от оси
  const ring = (round: number): [number, number] => (round === 1 ? [80, 114] : [120, 154])
  const rm = data.removals[Math.min(ri, data.removals.length - 1)]
  const out = Object.values(rm.votes).filter((v) => v === 'out').length
  const chainTurns = data.turns.filter((t) => data.chain.held.includes(t.n) || t.n === data.chain.need)
  const ruler = shown.rulerId ? img.get(shown.rulerId) : ''
  const lantern = (t: typeof cur, k: number): [number, number] => {
    const [r0, r1] = ring(t.round)
    const a = ang(t.seatIdx) + step * Math.min(0.96, Math.max(0.04, k))
    const r = (r0 + r1) / 2
    return [C + Math.cos(rad(a)) * r, C + Math.sin(rad(a)) * r]
  }
  const k = cur.to > cur.from ? Math.min(1, Math.max(0, (year + 0.5 - cur.from) / (cur.to - cur.from))) : 0.5
  const [lx, ly] = lantern(cur, k)
  return (
    <div className="lan">
      <div className="lan-head">
        <div>
          <small>Светоч в {year} г.</small>
          <b>{cur.ruler}</b>
          <span className="lan-sub">{cur.seat === 'orhaim' ? 'правит из Орхайма' : `очередь ${data.order[cur.seatIdx].name}`} · {BY[cur.by]}</span>
        </div>
        <div className={`lan-status ${cur.by}`}>
          {cur.by === 'pledge' ? <>⛓ По залогу держит {cur.house}</> : cur.by === 'dark' ? <>🕯 Тёмный год: Пламя гаснет</> : <>🔥 Светоч горит</>}
        </div>
      </div>
      <div className="lan-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => { setYear(+e.target.value); setSel(null) }} />
        <span>{Y1}</span>
      </div>
      <div className="lan-main">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="lan-wheel">
          <defs>
            <pattern id="lan-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#16161c" /><line x1="0" y1="0" x2="0" y2="6" stroke="#444" strokeWidth="2" /></pattern>
            <radialGradient id="lan-glow"><stop offset="0" stopColor="#ffe9a0" stopOpacity=".95" /><stop offset="1" stopColor="#ffe9a0" stopOpacity="0" /></radialGradient>
          </defs>
          <circle cx={C} cy={C} r="160" fill="#0e1410" stroke="#3a4a3a" />
          {data.turns.map((t, i) => {
            const [r0, r1] = ring(t.round)
            const a0 = ang(t.seatIdx) + 1, a1 = ang(t.seatIdx) + step - 1
            const base = t.by === 'skip' ? 'url(#lan-hatch)' : t.by === 'pledge' ? colorOfHouse(t.house) : data.order[t.seatIdx].color
            const op = t.by === 'future' ? 0.32 : t.by === 'pledge' && t.from > year + 0.5 ? 0.5 : 0.92
            return (
              <g key={i} className="lan-arc" onClick={() => setSel(i === sel ? null : i)}>
                <path d={arc(C, C, r0, r1, a0, a1)} fill={base} opacity={op} stroke={shown === t ? '#fff' : t === cur ? '#ffe9a0' : '#0e1410'} strokeWidth={shown === t || t === cur ? 2.4 : 1} />
                {t.by === 'pledge' && <path d={arc(C, C, r0 + 14, r0 + 17, a0 + 2, a1 - 2)} fill="none" stroke="#0e1410" strokeWidth="3" strokeDasharray="3 3" opacity=".75" pointerEvents="none" />}
                {t.by === 'dark' && <path d={arc(C, C, r0, r1, a0, a1)} fill="none" stroke="#d0604a" strokeWidth="2" strokeDasharray="4 3" pointerEvents="none" />}
              </g>
            )
          })}
          {/* «три звена»: золотая скоба на дугах второго круга, что держат Хельмбрехты, и недостающая */}
          {chainTurns.length > 1 && (() => {
            const i0 = Math.min(...chainTurns.map((t) => t.seatIdx)), i1 = Math.max(...chainTurns.map((t) => t.seatIdx))
            const [, r1] = ring(2)
            return <path d={arc(C, C, r1 + 2, r1 + 6, ang(i0) + 1, ang(i1) + step - 1)} fill="#c9a24a" opacity=".85" />
          })()}
          {/* гербы княжеств по ободу */}
          {data.order.map((o, i) => {
            const a = ang(i) + step / 2
            const x = C + Math.cos(rad(a)) * 172, y = C + Math.sin(rad(a)) * 172
            return (
              <g key={o.key} className="lan-crest" onClick={() => o.houseId && onOpen(o.houseId)}>
                <circle cx={x} cy={y} r="14.5" fill="#101612" stroke={o.color} strokeWidth="1.5" />
                <g transform={`translate(${x - 9} ${y - 9}) scale(.18)`}>{EMBLEMS[o.emblem]?.draw(o.color, '#101612')}</g>
                <text x={x} y={y + (Math.sin(rad(a)) > 0 ? 27 : -20)} textAnchor="middle" className="lan-seat-name">{o.name}</text>
              </g>
            )
          })}
          {/* фонарь на дуге выбранного года */}
          <circle cx={lx} cy={ly} r="16" fill="url(#lan-glow)" className="lan-flame-glow" />
          <path d={`M${lx - 4} ${ly + 4} h8 v-8 q-4 -4 -8 0 z`} fill="#2a2a30" stroke="#ffe9a0" strokeWidth="1" />
          <path d={`M${lx} ${ly + 2} q-3 -4 0 -9 q3 5 0 9 z`} fill="#ffd060" className="lan-flame" />
          {/* центр: год и портрет Светочедержца */}
          <circle cx={C} cy={C} r="62" fill="#161c18" stroke="#c9a24a" strokeWidth="1.5" />
          <clipPath id="lan-face"><circle cx={C} cy={C - 8} r="36" /></clipPath>
          {ruler ? <image href={assetUrl(ruler)} x={C - 36} y={C - 44} width="72" height="72" clipPath="url(#lan-face)" preserveAspectRatio="xMidYMid slice" /> : <circle cx={C} cy={C - 8} r="36" fill="#222a24" />}
          <text x={C} y={C + 42} textAnchor="middle" className="lan-year">{year}</text>
          <text x={C} y={C + 56} textAnchor="middle" className="lan-ring-name">{cur.round === 1 ? 'первый круг' : 'второй круг'}</text>
        </svg>
        <div className="lan-card">
          <button className="lan-face" disabled={!shown.rulerId} onClick={() => shown.rulerId && onOpen(shown.rulerId)}>
            {ruler ? <img src={assetUrl(ruler)} alt="" /> : shown.ruler[0]}
          </button>
          <div className="lan-card-text">
            <small>Очередь №{shown.n}, {data.order[shown.seatIdx].name} · {shown.round === 1 ? 'первый' : 'второй'} круг</small>
            <b>{shown.ruler}</b>
            <span className="lan-years">{shown.from === shown.to ? Math.floor(shown.from) : `${shown.from} — ${shown.to}`} · {BY[shown.by]} · {shown.house}</span>
            <p>{shown.note}</p>
            {sel != null && <button className="lan-reset" onClick={() => setSel(null)}>к фонарю на ползунке</button>}
          </div>
        </div>
      </div>
      <div className="lan-legend">
        {data.order.map((o) => <span key={o.key}><i style={{ background: o.color }} />{o.name}</span>)}
        <span><i className="lan-key lan-key-chain" />залог (звенья)</span>
        <span><i className="lan-key lan-key-skip" />отвод</span>
        <span><i className="lan-key lan-key-gold" />«три звена»</span>
      </div>
      <p className="lan-note">{data.chain.note}</p>

      <h4 className="lan-h">Цепная книга: залоги очередей</h4>
      <div className="lan-pledges">
        {data.pledges.map((p, i) => {
          const [label, col] = ST[p.status] ?? [p.status, '#888']
          return (
            <div key={i} className="lan-pledge" onClick={() => { setYear(Math.min(Y1, Math.max(Y0, Math.floor(p.year)))); setSel(data.turns.findIndex((t) => t.n === p.turn)) }}>
              <span className="lan-pledge-y">{Math.floor(p.year)}</span>
              <span className="lan-pledge-t"><b>{data.order.find((o) => o.key === p.seat)?.name}</b> · очередь {p.turn}</span>
              <span className="lan-pledge-w">{p.from} → {p.to} · {p.price}</span>
              <span className="lan-pledge-s" style={{ color: col, borderColor: col }}>{label}</span>
              <small>{p.reason}</small>
            </div>
          )
        })}
      </div>

      <h4 className="lan-h">Ночь Передачи: свечи отвода</h4>
      <div className="lan-removal-tabs">
        {data.removals.map((r, i) => <button key={i} className={i === ri ? 'on' : ''} onClick={() => setRi(i)}><small>{Math.floor(r.year)}</small> {r.target}{r.passed ? ' ✕' : ''}</button>)}
      </div>
      <div className="lan-candles">
        {data.order.map((o) => {
          const v = rm.votes[o.key] ?? 'none'
          return (
            <div key={o.key} className={`lan-candle ${v}`} title={`${o.name}: ${v === 'out' ? 'погасила' : v === 'keep' ? 'держит' : 'не считается'}`}>
              <svg viewBox="0 0 24 44" width="22" height="40">
                <rect x="7" y="16" width="10" height="24" rx="2" fill={v === 'none' ? '#33332e' : '#e8dcb0'} opacity={v === 'out' ? 0.55 : 1} />
                {v === 'keep' && <path d="M12 14 q-5 -5 0 -12 q5 7 0 12 z" fill="#ffd060" className="lan-flame" />}
                {v === 'out' && <path d="M12 14 q-1 -4 2 -8" stroke="#777" fill="none" strokeWidth="1.2" />}
              </svg>
              <small>{o.name}</small>
            </div>
          )
        })}
      </div>
      <p className={`lan-note ${rm.passed ? 'lan-pass' : ''}`}><b>Погашено {out} из {data.needCandles}.</b> {rm.note}</p>

      {data.dark.map((d) => <p key={d.year} className="lan-final">🕯 {Math.floor(d.year)} г.: {d.note}</p>)}
      <ul className="lan-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
