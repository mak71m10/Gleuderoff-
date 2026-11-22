import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['ice']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const rad = (a: number): number => (a * Math.PI) / 180
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))
const arc = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const p = (a: number): string => `${(cx + Math.cos(rad(a)) * r).toFixed(1)} ${(cy + Math.sin(rad(a)) * r).toFixed(1)}`
  return `M${p(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)}`
}

/**
 * «Стяг Саренто и чистая вода» Гренинсворда: кольцо года (500 дней) поделено между пятью полисами по их чистым дням;
 * у каждого полиса — гавань, где вода синяя, а лёд белый (сколько дней было чисто). Посередине — золотой Стяг и держатель.
 * Белый год — кольцо белое, Стяг у лоцманов. Ползунок 978–1010, клик по гавани — полис.
 */
export function IceView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const ruler = [...data.rulers].reverse().find((r) => r.from <= year + 0.5) ?? data.rulers[0]
  const rImg = img.get(ruler.id)
  const pol = (k: string) => data.polis.find((p) => p.key === k)
  const bell = data.bells.find((b) => b.y === year)
  const night = data.nights.find((n) => n.y === year)
  const shown = sel ? pol(sel) : null
  const SZ = 380, C = SZ / 2, RR = 104, RH = 152
  let acc = -90
  const arcs = data.polis.map((p) => {
    const span = cur.white ? 0 : (cur.share[p.key] / data.yearDays) * 360
    const a = { key: p.key, a0: acc, a1: acc + span }
    acc += span
    return a
  })

  return (
    <div className="gsi">
      <div className="gsi-head">
        <div>
          <small>Стяг Саренто в {year} г.</small>
          <b>{ruler.name}</b>
          <span className="gsi-sub">{cur.white ? 'залив замёрз — Стяг у лоцманов Иссикара' : `дольше всех держит ${pol(cur.top)?.name}: ${cur.share[cur.top]} дней из ${data.yearDays}`}</span>
        </div>
        <div className="gsi-status" style={{ borderColor: cur.white ? '#e8f0f8' : '#e8c860', color: cur.white ? '#e8f0f8' : '#e8c860' }}>{cur.white ? 'Белый год' : cur.skipped.length ? 'Набат: очередь пропущена' : 'Стяг по кругу'}</div>
      </div>
      <div className="gsi-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} />
        <span>{Y1}</span>
      </div>
      <div className="gsi-main">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="gsi-gulf">
          <defs>
            <radialGradient id="gsi-sea"><stop offset="0" stopColor="#1f4a6a" /><stop offset="1" stopColor="#0a1a2a" /></radialGradient>
            <clipPath id="gsi-face"><circle cx={C} cy={C + 14} r="26" /></clipPath>
          </defs>
          <circle cx={C} cy={C} r="186" fill="url(#gsi-sea)" />
          {cur.white && <circle cx={C} cy={C} r="186" fill="#e8f0f8" opacity=".55" />}
          {/* кольцо года */}
          <circle cx={C} cy={C} r={RR} fill="none" stroke={cur.white ? '#f4f8fc' : '#2a3a4a'} strokeWidth="16" />
          {arcs.map((a) => a.a1 - a.a0 > 0.5 && <path key={a.key} d={arc(C, C, RR, a.a0, a.a1 - 0.8)} fill="none" stroke={pol(a.key)?.color} strokeWidth="16" opacity={sel && sel !== a.key ? 0.4 : 1} />)}
          {/* гавани полисов */}
          {data.polis.map((p, i) => {
            const a = -90 + i * 72, x = C + Math.cos(rad(a)) * RH, y = C + Math.sin(rad(a)) * RH
            const d = cur.days[p.key], clear = d / data.yearDays
            const isSel = sel === p.key, skipped = cur.skipped.includes(p.key)
            return (
              <g key={p.key} className="gsi-harbor" onClick={() => setSel(isSel ? null : p.key)}>
                <circle cx={x} cy={y} r="27" fill="#f2f6fa" stroke={isSel ? '#fff' : p.color} strokeWidth={isSel ? 3 : 2} />
                <clipPath id={`gsi-h-${p.key}`}><circle cx={x} cy={y} r="26" /></clipPath>
                <rect x={x - 27} y={y + 27 - clear * 54} width="54" height={clear * 54} fill="#2a6a9a" clipPath={`url(#gsi-h-${p.key})`} />
                <g transform={`translate(${x - 9} ${y - 18}) scale(.18)`}>{EMBLEMS[p.emblem]?.draw(p.color, '#f2f6fa')}</g>
                <text x={x} y={y + 10} textAnchor="middle" className="gsi-days">{d}</text>
                <text x={x} y={y + 42} textAnchor="middle" className="gsi-name">{p.name}</text>
                {skipped && <text x={x} y={y - 32} textAnchor="middle" className="gsi-skip">пропуск</text>}
              </g>
            )
          })}
          {/* Стяг посередине */}
          <line x1={C - 22} y1={C - 56} x2={C - 22} y2={C - 8} stroke="#8a7a5a" strokeWidth="2" />
          <path d={`M${C - 21} ${C - 56} q22 -6 44 0 v22 q-22 -6 -44 0 z`} fill={cur.white ? '#d8e4ee' : '#e8c860'} className="gsi-flag" />
          {rImg ? <image href={assetUrl(rImg)} x={C - 26} y={C - 12} width="52" height="52" clipPath="url(#gsi-face)" preserveAspectRatio="xMidYMid slice" /> : <circle cx={C} cy={C + 14} r="26" fill="#1a2a3a" />}
          <circle cx={C} cy={C + 14} r="26" fill="none" stroke="#e8c860" strokeWidth="1.5" />
          <text x={C} y={C + 56} textAnchor="middle" className="gsi-year">{year}</text>
        </svg>
        <div className="gsi-card">
          {shown ? (
            <div className="gsi-card-text">
              <small>Полис · {shown.arms}</small>
              <b>{shown.name}</b>
              <span className="gsi-line">чистых дней гавани {cur.days[shown.key]} из {data.yearDays} · Стяг {cur.share[shown.key]} дней</span>
              <div className="gsi-meter"><span style={{ width: `${(cur.days[shown.key] / data.yearDays) * 100}%` }} /></div>
              <p>{shown.text}</p>
              <div className="gsi-btns">
                {shown.consul && <button onClick={() => onOpen(shown.consul as string)}>консул</button>}
                <button onClick={() => setSel(null)}>к Стягу</button>
              </div>
            </div>
          ) : (
            <div className="gsi-card-text">
              <small>Держатель Стяга · {fmt(ruler.from)} — {fmt(ruler.to)}</small>
              <b>{ruler.name}</b>
              <p>{ruler.note}</p>
              <ul className="gsi-shares">
                {data.polis.map((p) => <li key={p.key}><i style={{ background: p.color }} />{p.name} <b>{cur.share[p.key]}</b> дн.</li>)}
              </ul>
              <div className="gsi-btns"><button onClick={() => onOpen(ruler.id)}>открыть</button></div>
            </div>
          )}
        </div>
      </div>
      {night && <p className="gsi-night"><b>{night.title}.</b> {night.note}</p>}
      {bell && <p className="gsi-bell"><b>Набат {bell.y} г. против {pol(bell.against)?.name}: {bell.rung.length} колокола из 4 — {bell.passed ? 'принят' : 'не состоялся'}.</b> {bell.note}</p>}
      <h4 className="gsi-h">Чистые дни гаваней по годам</h4>
      <div className="gsi-chart" role="list">
        {data.years.map((r) => (
          <button key={r.y} role="listitem" className={`gsi-col ${r.y === year ? 'on' : ''}`} onClick={() => setYear(r.y)} title={`${r.y}`}>
            {data.polis.map((p) => <span key={p.key} style={{ height: (r.days[p.key] / data.yearDays) * 12, background: p.color }} />)}
          </button>
        ))}
      </div>
      <h4 className="gsi-h">Набаты</h4>
      <div className="gsi-bells">
        {data.bells.map((b) => (
          <div key={b.y} className={`gsi-bellrow ${b.y === year ? 'on' : ''}`} onClick={() => setYear(Math.min(Y1, b.y))}>
            <span className="gsi-by">{b.y}</span>
            <span>против <b style={{ color: pol(b.against)?.color }}>{pol(b.against)?.name}</b> · {b.rung.map((k) => pol(k)?.name).join(', ')}</span>
            <span className="gsi-res" style={{ color: b.passed ? '#6aaa7a' : '#d0604a' }}>{b.passed ? 'принят' : 'не набран'}</span>
          </div>
        ))}
      </div>
      <ul className="gsi-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
