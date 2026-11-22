import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['smoke']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))

/**
 * «Ворота и дымы» Уунааша: у Стены Ключей шесть очагов владетелей, над каждым — столб дыма, высота которого
 * равна числу приписанных дворов (плотный дым — живые, прозрачный — дальние, записанные заочно). Под картинкой — весы
 * Ключа князя: дымы князя и присягнувших против половины страны. Ползунок 977–1010, клик по очагу — владетель.
 */
export function SmokeView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const [fullFar, setFullFar] = useState(false)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const w = fullFar ? 1 : data.farWeight
  const weight = (k: string): number => cur.lords[k].live + cur.lords[k].far * w
  const total = data.lords.reduce((s, l) => s + weight(l.key), 0)
  const princeSum = ['yaffe', ...cur.oath].reduce((s, k) => s + weight(k), 0)
  const open = princeSum < total / 2
  const top = [...data.lords].sort((a, b) => weight(b.key) - weight(a.key))[0]
  const pass = data.passes.find((p) => p.y === year)
  const ruler = [...data.rulers].reverse().find((r) => r.from <= year + 0.5)
  const rImg = ruler ? img.get(ruler.id) : ''
  const side = (k: string) => data.sides.find((s) => s.key === k)
  const shown = sel ? data.lords.find((l) => l.key === sel) : null
  const SW = 460, SH = 300, G = 250, maxV = 180
  const colX = (i: number): number => 40 + i * 76

  return (
    <div className="uus">
      <div className="uus-head">
        <div>
          <small>Книга Дымов, {year} г.</small>
          <b>{cur.ruler}</b>
          <span className="uus-sub">живых дымов {(cur.live * 100).toLocaleString('ru')} · дальних {(cur.far * 100).toLocaleString('ru')} · у князя с присяжными {Math.round((princeSum / Math.max(1, total)) * 100)}%</span>
        </div>
        <div className="uus-status" style={{ borderColor: open ? '#e07a50' : '#e8c860', color: open ? '#e07a50' : '#e8c860' }}>{cur.winter ? 'Зимний переход' : open ? 'Ворота открыты' : 'Ключ у князя'}</div>
      </div>
      <div className="uus-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} />
        <span>{Y1}</span>
      </div>
      <label className="uus-toggle"><input type="checkbox" checked={fullFar} onChange={(e) => setFullFar(e.target.checked)} /> считать дальний дым целым (как требует Мелькер)</label>
      <div className="uus-main">
        <svg viewBox={`0 0 ${SW} ${SH}`} className="uus-scene">
          <defs>
            <linearGradient id="uus-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a2230" /><stop offset="1" stopColor="#3a3a40" /></linearGradient>
            <radialGradient id="uus-puff"><stop offset="0" stopColor="#e8e4dc" stopOpacity=".95" /><stop offset="1" stopColor="#b8b4ac" stopOpacity="0" /></radialGradient>
          </defs>
          <rect x="0" y="0" width={SW} height={SH} fill="url(#uus-sky)" />
          <rect x="0" y={G} width={SW} height={SH - G} fill="#2a2620" />
          {/* Стена Ключей позади очагов */}
          <rect x="8" y={G - 38} width={SW - 16} height="38" fill="#4a4440" stroke="#2a2622" />
          {Array.from({ length: 56 }, (_, i) => <path key={i} d={`M${16 + i * 7.9} ${G - 30 + (i % 3) * 9} m0 0 a2 2 0 1 0 0.1 0 m0 2 v5`} stroke="#c9a24a" strokeWidth="0.9" fill="none" opacity=".75" />)}
          {data.lords.map((l, i) => {
            const x = colX(i), lv = cur.lords[l.key].live, fr = cur.lords[l.key].far
            const hL = (lv / maxV) * (G - 70), hF = ((fr * w) / maxV) * (G - 70)
            const puffs = Math.max(1, Math.round(hL / 16)), fpuffs = Math.round(hF / 16)
            const isSel = sel === l.key
            const oath = l.key === 'yaffe' || cur.oath.includes(l.key)
            return (
              <g key={l.key} className="uus-hearth" onClick={() => setSel(isSel ? null : l.key)}>
                {Array.from({ length: puffs }, (_, j) => <circle key={j} cx={x + Math.sin(j * 1.7 + i) * 5} cy={G - 44 - j * 16} r={9 + (j % 3) * 2} fill="url(#uus-puff)" className="uus-puff" style={{ animationDelay: `${(j * 0.3 + i * 0.2) % 3}s` }} />)}
                {Array.from({ length: fpuffs }, (_, j) => <circle key={`f${j}`} cx={x + Math.sin((puffs + j) * 1.7 + i) * 6} cy={G - 44 - (puffs + j) * 16} r={9 + (j % 3) * 2} fill="none" stroke="#c8a8e0" strokeDasharray="3 3" opacity=".7" />)}
                <text x={x} y={Math.max(14, G - 54 - (puffs + fpuffs) * 16)} textAnchor="middle" className="uus-num">{Math.round(lv + fr * w)}</text>
                {/* очаг-горшок */}
                <path d={`M${x - 14} ${G - 30} h28 l-4 22 h-20 z`} fill={l.bg} stroke={isSel ? '#fff' : oath ? '#e8c860' : '#6a6460'} strokeWidth={isSel ? 2.4 : 1.4} />
                <ellipse cx={x} cy={G - 30} rx="14" ry="3.5" fill="#e8782a" className="uus-coal" />
                <g transform={`translate(${x - 8} ${G - 25}) scale(.16)`}>{EMBLEMS[l.emblem]?.draw(l.color, l.bg)}</g>
                <text x={x} y={G + 16} textAnchor="middle" className="uus-name">{l.name.replace(/^Дом /, '')}</text>
                <text x={x} y={G + 28} textAnchor="middle" className="uus-seat" style={{ fill: side(l.side)?.color }}>{oath ? 'присягнул' : l.seat}</text>
              </g>
            )
          })}
          {rImg && <image href={assetUrl(rImg)} x={SW - 54} y="8" width="46" height="46" preserveAspectRatio="xMidYMid slice" style={{ clipPath: 'circle(50%)' }} />}
          <text x={SW - 31} y="66" textAnchor="middle" className="uus-year">{year}</text>
        </svg>
        <div className="uus-card">
          {shown ? (
            <div className="uus-card-text">
              <small>{shown.seat} · {side(shown.side)?.name}</small>
              <b>{shown.name}</b>
              <span className="uus-line">живых дымов {cur.lords[shown.key].live * 100} · дальних {cur.lords[shown.key].far * 100}{shown.key === 'yaffe' || cur.oath.includes(shown.key) ? ' · за князя' : ''}</span>
              <p>{shown.arms}</p>
              <div className="uus-btns">
                <button onClick={() => onOpen(shown.houseId)}>дом</button>
                {shown.head && <button onClick={() => onOpen(shown.head as string)}>владетель</button>}
                <button onClick={() => setSel(null)}>к князю</button>
              </div>
            </div>
          ) : (
            <div className="uus-card-text">
              <small>Князь · {fmt(ruler?.from ?? null)} — {fmt(ruler?.to ?? null)}</small>
              <b>{ruler?.name ?? 'до Хартии Ворот'}</b>
              <div className="uus-scale"><span className="prince" style={{ width: `${(princeSum / Math.max(1, total)) * 100}%` }} /><i /></div>
              <span className="uus-line">{open ? 'меньше половины: новые подати и война — только с Советом Ворот' : 'больше половины: князь правит один'}</span>
              <span className="uus-line">по Статье Ключа ключ вручил бы: <b>{top.name}</b></span>
              {ruler && <p>{ruler.note}</p>}
              <div className="uus-btns">{ruler && <button onClick={() => onOpen(ruler.id)}>открыть</button>}</div>
            </div>
          )}
        </div>
      </div>
      {pass && <p className="uus-pass"><b>{pass.title}.</b> Перенесли около {pass.moved * 100} дымов. {pass.note}</p>}
      <h4 className="uus-h">Доля князя с присяжными по годам</h4>
      <div className="uus-chart" role="list">
        {data.years.map((r) => {
          const pct = r.prince / Math.max(1, r.total)
          return <button key={r.y} role="listitem" className={`uus-bar ${r.y === year ? 'on' : ''}`} style={{ height: 6 + pct * 60, background: r.winter ? '#8ab0d0' : pct < 0.5 ? '#e07a50' : '#e8c860' }} onClick={() => setYear(r.y)} title={`${r.y}: ${Math.round(pct * 100)}%`} />
        })}
      </div>
      <div className="uus-legend">
        {data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name} — {s.who}</span>)}
        <span><i className="uus-key-far" />дальний дым — семья за границей</span>
      </div>
      <ul className="uus-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
