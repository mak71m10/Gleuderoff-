import { useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type SentenceData = NonNullable<Entry['base']['sentence']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
const roman = (n: number) => { let s = ''; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v } return s }

/**
 * «Книга Сроков» Рейха: тюремная стена, на которой каждый род — полоса срока от этапа до освобождения; черта «сегодня» двигается
 * ползунком 978–1020. Кончившиеся сроки — перечёркнутые клейма (Отбывшие), самый долгий из живых — Первый Узник у Пустого трона.
 */
export function SentenceView({ data, onOpen }: { data: SentenceData; onOpen: (id: string) => void }) {
  const [year, setYear] = useState(1010)
  const live = data.lines.filter((l) => l.from <= year && l.ends > year)
  const first = [...live].sort((a, b) => a.from - b.from)[0]
  const zius = data.lines.find((l) => l.key === data.first)
  const left = zius ? zius.ends - year : 0
  const x0 = 280, x1 = 1360
  const sx = (y: number) => 120 + ((y - x0) / (x1 - x0)) * 380
  const rows = [...data.lines].sort((a, b) => a.from - b.from)
  return (
    <div className="snt">
      <div className="snt-head">
        <div>
          <small>Книга Сроков в {year} г.</small>
          <b>Первый Узник — род {first?.name ?? '—'} ({first ? roman(first.years) : '—'})</b>
        </div>
        <div className={`snt-status ${left <= 0 ? 'hot' : left <= 3 ? 'edge' : 'calm'}`}>
          {left <= 0 ? <>⚠ Срок Зиусов кончился: Фар Зиус — дичь</> : <>Срок рода Зиус кончается через {left.toFixed(1).replace('.0', '')} г.</>}
        </div>
      </div>
      <svg viewBox="0 0 520 300" className="snt-svg">
        <rect x="0" y="0" width="520" height="300" rx="8" className="snt-bg" />
        {Array.from({ length: 11 }, (_, i) => <line key={i} x1={sx(300 + i * 100)} x2={sx(300 + i * 100)} y1="22" y2="262" className="snt-grid" />)}
        {[300, 500, 700, 900, 1100, 1300].map((y) => <text key={y} x={sx(y)} y="16" textAnchor="middle" className="snt-axis">{y}</text>)}
        {rows.map((l, i) => {
          const y = 30 + i * 29
          const out = l.ends <= year
          const isFirst = first?.key === l.key
          return (
            <g key={l.key} className="snt-row" onClick={() => onOpen(`lore-rh-line-${l.key}`)}>
              <text x="8" y={y + 14} className={`snt-name ${out ? 'out' : ''}`}>{isFirst ? '♛ ' : ''}{l.name}</text>
              <text x="112" y={y + 14} textAnchor="end" className="snt-brand">{roman(l.years)}</text>
              <rect x={sx(l.from)} y={y + 3} width={Math.max(2, sx(l.ends) - sx(l.from))} height="15" rx="3" className={`snt-bar ${out ? 'out' : isFirst ? 'first' : ''}`} />
              {l.from <= year && <rect x={sx(l.from)} y={y + 3} width={Math.max(0, Math.min(sx(year), sx(l.ends)) - sx(l.from))} height="15" rx="3" className="snt-served" />}
              {out && <line x1={sx(l.from)} x2={sx(l.ends)} y1={y + 10} y2={y + 10} className="snt-strike" />}
            </g>
          )
        })}
        <line x1={sx(year)} x2={sx(year)} y1="22" y2="268" className="snt-now" />
        <text x={sx(year)} y="282" textAnchor="middle" className="snt-axis">{year}</text>
      </svg>
      <div className="snt-slider"><span>978</span><input type="range" min={978} max={1020} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1020</span></div>
      <div className="snt-legend"><span><i className="first" />Первый Узник</span><span><i className="live" />срок идёт</span><span><i className="out" />Отбывшие — вне котла</span></div>
      <ul className="snt-notes">{rows.filter((l) => Math.abs(l.ends - year) < 6 || l.key === first?.key).map((l) => <li key={l.key}><b>Род {l.name}:</b> {l.note}</li>)}</ul>
      <ul className="snt-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
