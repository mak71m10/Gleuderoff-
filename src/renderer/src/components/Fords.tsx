import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type FordData = NonNullable<Entry['base']['ford']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const KIND: Record<string, string> = { found: 'Договор', law: 'закон', exile: 'откол', crisis: 'разрыв', peace: 'мир', aid: 'торг', reform: 'реформа', war: 'война' }
const RES: Record<string, [string, string]> = { passed: ['принято', '#6aaa7a'], failed: ['отклонено', '#d0604a'], pending: ['голосуют', '#c9a24a'] }

/**
 * «Кольцо Заложников» Кулагона: семь Домов по кругу, каждый отдал наследника следующему. Ползунок лет: звенья рвутся,
 * черепки Дня Черепков растут против отметки Трети. Вкладки: «Кольцо», «Совет» (голосования Семи), «Наследники».
 */
export function FordsView({ data, onOpen }: { data: FordData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const names = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.name])), [world.entries])
  const [tab, setTab] = useState<'ring' | 'votes' | 'heirs'>('ring')
  const [year, setYear] = useState(1010)
  const [di, setDi] = useState(data.decisions.length - 1)
  const s = data.series
  const Y0 = s[0].year, Y1 = s[s.length - 1].year
  const at = (y: number) => {
    if (y <= s[0].year) return s[0]
    for (let i = 1; i < s.length; i++) if (y <= s[i].year) {
      const a = s[i - 1], b = s[i], k = (y - a.year) / (b.year - a.year)
      const n = k < 0.5 ? a : b
      return { ...n, cast: Math.round(a.cast + k * (b.cast - a.cast)), share: Math.round(a.share + k * (b.share - a.share)) }
    }
    return s[s.length - 1]
  }
  const cur = at(year)
  const hot = cur.share >= data.threshold
  const dec = data.decisions[Math.min(di, data.decisions.length - 1)]
  const house = new Map(data.houses.map((h) => [h.key, h]))
  const wards = data.wards.filter((w) => w.since <= year)
  const W = 420, H = 330, cx = 210, cy = 165, R = 118
  const pos = (i: number, r = R) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / data.houses.length; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const }
  const idx = new Map(data.houses.map((h, i) => [h.key, i]))
  const broken = new Set(cur.broken)
  const alive = wards.filter((w) => !broken.has(w.house)).length
  const sx = (y: number) => 30 + ((y - Y0) / (Y1 - Y0)) * 340
  const sy = (v: number) => 118 - Math.min(v, 45) * 2.4
  return (
    <div className="ford">
      <div className="ford-head">
        <div>
          <small>{tab === 'votes' ? `Совет Семи ${Math.floor(dec.year)} г.` : `Кольцо Кулагона в ${year} г.`}</small>
          <b>{tab === 'votes' ? dec.title : `Звеньев ${alive} из ${wards.length} · черепков ${cur.cast}`}</b>
        </div>
        <div className={`ford-status ${tab === 'votes' ? dec.result : hot ? 'hot' : 'calm'}`}>
          {tab === 'votes' ? <>{RES[dec.result]?.[0]} · за {dec.yes}, нужно {dec.need}</> : hot ? <>⚠ {cur.top}: {cur.share}% — откол</> : <>⭕ {cur.top}: {cur.share}% из {data.threshold}</>}
        </div>
      </div>
      <div className="ford-tabs">
        {([['ring', 'Кольцо'], ['votes', 'Совет'], ['heirs', 'Наследники']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'ring' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="ford-svg">
            <defs><marker id="ford-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#d8b84a" /></marker></defs>
            <rect x="0" y="0" width={W} height={H} rx="8" className="ford-bg" />
            <circle cx={cx} cy={cy} r={R} className="ford-river" />
            {wards.map((w) => {
              const a = idx.get(w.house), b = idx.get(w.host)
              if (a === undefined || b === undefined) return null
              const [x1, y1] = pos(a, R - 22), [x2, y2] = pos(b, R - 22)
              const br = broken.has(w.house)
              return <line key={w.id} x1={x1} y1={y1} x2={x2} y2={y2} className={br ? 'ford-link broken' : 'ford-link'} markerEnd={br ? undefined : 'url(#ford-arr)'} />
            })}
            {data.houses.map((h, i) => {
              const [x, y] = pos(i)
              const top = cur.top.includes(h.name)
              return (
                <g key={h.key}>
                  <circle cx={x} cy={y} r="19" fill="#14120a" stroke={h.color} strokeWidth={top ? 4 : 2.4} />
                  <text x={x} y={y + 4} textAnchor="middle" className="ford-name" fill={h.color}>{h.name.slice(0, 4)}</text>
                  <text x={x} y={y + 34} textAnchor="middle" className="ford-axis">{h.ford}</text>
                </g>
              )
            })}
            <g transform={`translate(${cx - 34} ${cy - 22})`}>
              <path d="M2 40 Q 34 6 66 40 L58 40 Q 34 18 10 40z" fill="#6a6a58" stroke="#2a2a1a" strokeWidth="1.5" />
              <ellipse cx="34" cy="26" rx="17" ry="7" fill="none" stroke="#d8b84a" strokeWidth="2" />
            </g>
          </svg>
          <svg viewBox="0 0 400 140" className="ford-chart">
            <rect x="0" y="0" width="400" height="140" rx="6" className="ford-bg" />
            <line x1="30" x2="370" y1={sy(data.threshold)} y2={sy(data.threshold)} className="ford-thr" />
            <text x="372" y={sy(data.threshold) + 3} className="ford-axis">⅓</text>
            <polyline points={s.map((p) => `${sx(p.year)},${sy(p.share)}`).join(' ')} className="ford-line" />
            {s.map((p) => <circle key={p.year} cx={sx(p.year)} cy={sy(p.share)} r="3" fill={p.share >= data.threshold ? '#d0604a' : '#d8b84a'} />)}
            <line x1={sx(year)} x2={sx(year)} y1="8" y2="122" className="ford-cur" />
            <text x="30" y="134" className="ford-axis">доля первого имени на черепках, %</text>
          </svg>
          <div className="ford-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
          <p className="ford-note">{cur.note}</p>
          <div className="ford-legend">{data.houses.map((h) => <span key={h.key} title={h.who}><i style={{ background: h.color }} />{h.name}</span>)}</div>
        </>
      )}

      {tab === 'votes' && (
        <>
          <div className="ford-decs">
            {data.decisions.map((d, i) => <button key={i} className={i === di ? 'on' : ''} onClick={() => setDi(i)}><small>{Math.floor(d.year)}</small> {d.title} <span style={{ color: RES[d.result]?.[1] }}>· {RES[d.result]?.[0]}</span></button>)}
          </div>
          <svg viewBox="0 0 400 70" className="ford-dots">
            {Array.from({ length: 7 }, (_, i) => {
              const v = i < dec.yes ? 'yes' : i < dec.yes + dec.no ? 'no' : 'abstain'
              return <circle key={i} cx={50 + i * 50} cy="22" r="14" fill={v === 'yes' ? '#6aaa7a' : v === 'no' ? '#d0604a' : '#8a8a7a'} stroke={i === dec.need - 1 ? '#fff' : '#0a0a06'} strokeWidth={i === dec.need - 1 ? 2 : 1} />
            })}
            <text x="200" y="62" textAnchor="middle" className="ford-axis">за {dec.yes} · против {dec.no} · воздержались {dec.abstain} · нужно {dec.need} из 7</text>
          </svg>
          <p className="ford-note"><b>{KIND[dec.kind] ?? dec.kind}.</b> {dec.note}</p>
        </>
      )}

      {tab === 'heirs' && (
        <div className="ford-cards">
          {data.wards.map((w) => {
            const h = house.get(w.house), g = house.get(w.host)
            const src = img.get(w.id)
            const br = broken.has(w.house) && w.since <= year
            return (
              <button key={w.id} className={`ford-card${br ? ' broken' : ''}`} style={{ ['--bc' as string]: h?.color ?? '#aaa' }} onClick={() => onOpen(w.id)}>
                <span className="ford-face">{src ? <img src={assetUrl(src)} alt="" /> : (names.get(w.id) ?? '?')[0]}</span>
                <b>{(names.get(w.id) ?? '').replace(/ «.*»/, '')}</b>
                <small>Дом {h?.name} → у Дома {g?.name}</small>
                <small>{br ? 'звено порвано' : `с ${w.since} г.`}</small>
              </button>
            )
          })}
        </div>
      )}
      <ul className="ford-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
