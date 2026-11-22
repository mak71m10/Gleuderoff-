import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['descent']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))

/**
 * «Колодец и Лестница» Братства Бездны: разрез шахты вниз; каждый набор — ступень (ряд ярусов) с фигурками живых братьев;
 * цвет ступени — набор, дым над колодцем — Спуск. Старший набор, где осталась треть, подсвечен золотой каймой — из него Магистр.
 * Ползунок лет 977–1010; клик по ступени — набор и его история.
 */
export function WellView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const ruler = [...data.rulers].reverse().find((r) => r.from <= year + 0.5) ?? data.rulers[0]
  const rImg = img.get(ruler.id)
  const night = data.nights.find((n) => n.y === year)
  const descent = data.classes.find((c) => c.year === year)
  const shown = sel ? data.classes.find((c) => c.key === sel) : null
  const W = 360, rowH = 46, top = 40
  const elder = data.classes.find((c) => c.key === cur.elder)
  const loss = data.losses.find((l) => l.y === year)

  return (
    <div className="bzd">
      <div className="bzd-head">
        <div>
          <small>Колодец в {year} г.</small>
          <b>{ruler.name}</b>
          <span className="bzd-sub">в Колодце {cur.total} братьев и сестёр · старший набор: {elder ? elder.name : 'нет'}</span>
        </div>
        <div className="bzd-status" style={{ borderColor: descent ? '#c8788a' : '#8a8a96', color: descent ? '#c8788a' : '#c8c8d0' }}>{descent ? `Спуск: +${descent.taken}` : loss ? loss.name : 'Лестница'}</div>
      </div>
      <div className="bzd-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
      <div className="bzd-main">
        <svg viewBox={`0 0 ${W} ${top + data.classes.length * rowH + 20}`} className="bzd-well">
          <rect width={W} height={top + data.classes.length * rowH + 20} fill="#0a0810" rx="8" />
          <rect x="40" y="0" width={W - 80} height="26" fill="#2a2430" />
          {descent && Array.from({ length: 4 }, (_, i) => <circle key={i} cx={W / 2 + (i - 1.5) * 18} cy={14 - i * 3} r={8 - i} fill="#c8788a" opacity={0.5 - i * 0.1} className="bzd-puff" />)}
          {rImg && <image href={assetUrl(rImg)} x={W - 52} y="4" width="40" height="40" preserveAspectRatio="xMidYMid slice" style={{ clipPath: 'circle(50%)' }} />}
          {data.classes.map((c, i) => {
            const y = top + i * rowH, alive = cur.alive[c.key] ?? 0
            const on = sel === c.key, isElder = cur.elder === c.key
            const pips = Math.min(alive, 42)
            return (
              <g key={c.key} className="bzd-step" onClick={() => setSel(on ? null : c.key)}>
                <rect x={40 + i * 12} y={y} width={W - 80 - i * 12} height={rowH - 4} fill="#1a1620" stroke={on ? '#fff' : isElder ? '#e8c860' : '#2e2838'} strokeWidth={on ? 2.2 : isElder ? 2 : 1} rx="4" />
                <rect x={40 + i * 12} y={y} width="6" height={rowH - 4} fill={c.color} rx="2" opacity={alive ? 1 : 0.25} />
                <text x={54 + i * 12} y={y + 15} className="bzd-name" style={{ opacity: alive ? 1 : 0.4 }}>{c.stair} · {c.name}</text>
                <text x={W - 46} y={y + 15} textAnchor="end" className="bzd-n">{alive}/{c.taken}</text>
                {Array.from({ length: pips }, (_, k) => <circle key={k} cx={56 + i * 12 + (k % 21) * 7.2} cy={y + 26 + Math.floor(k / 21) * 8} r="2.6" fill={c.color} />)}
              </g>
            )
          })}
          <text x="14" y={top + data.classes.length * rowH + 12} className="bzd-yr">{year}</text>
        </svg>
        <div className="bzd-card">
          {shown ? (
            <div className="bzd-card-text">
              <small>{shown.stair} ступень · {shown.year} г.</small>
              <b>{shown.name}</b>
              <span className="bzd-line">взято {shown.taken} · живых {cur.alive[shown.key] ?? 0}{cur.elder === shown.key ? ' · из этого набора Магистр' : ''}</span>
              <p>{shown.text}</p>
              <div className="bzd-btns"><button onClick={() => setSel(null)}>к Магистру</button></div>
            </div>
          ) : (
            <div className="bzd-card-text">
              <small>Магистр · {fmt(ruler.from)} — {fmt(ruler.to)}</small>
              <b>{ruler.name}</b>
              <p>{ruler.note}</p>
              <div className="bzd-btns"><button onClick={() => onOpen(ruler.id)}>открыть</button></div>
            </div>
          )}
        </div>
      </div>
      {night && <p className="bzd-night"><b>{night.title}.</b> {night.note}</p>}
      <h4 className="bzd-h">Живых братьев по годам</h4>
      <div className="bzd-chart" role="list">
        {data.years.map((r) => (
          <button key={r.y} role="listitem" className={`bzd-col ${r.y === year ? 'on' : ''}`} onClick={() => setYear(r.y)} title={`${r.y}: ${r.total}`}>
            {data.classes.map((c) => <span key={c.key} style={{ height: ((r.alive[c.key] ?? 0) / 4), background: c.color }} />)}
          </button>
        ))}
      </div>
      <ul className="bzd-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
