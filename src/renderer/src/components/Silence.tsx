import { useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type SilenceData = NonNullable<Entry['base']['silence']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))

/**
 * «Капитул молчащих» Обливиума: девять приоров — девять высоких свечей; высота свечи — сколько лет приор молчит.
 * Самая высокая — аббат. Ползунок 960–1010; переключатель «Последнее слово» показывает, что будет, если аббат скажет «Говорите».
 */
export function SilenceView({ data, onOpen }: { data: SilenceData; onOpen: (id: string) => void }) {
  const [year, setYear] = useState(1010)
  const [last, setLast] = useState(false)
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const yrs = (since: number) => (last ? 0 : Math.max(0, Math.floor(year - since)))
  const shown = data.priors
  const total = shown.reduce((s, p) => s + yrs(p.since), 0)
  const abbot = [...shown].sort((a, b) => yrs(b.since) - yrs(a.since))[0]
  const maxY = 70
  const W = 480, H = 260
  return (
    <div className="sil">
      <div className="sil-head">
        <div>
          <small>Капитул в {year} г.</small>
          <b>{last ? 'Обет отменён: все голоса — ноль' : `Аббат — ${abbot?.name ?? '—'} · всего ${total} лет молчания`}</b>
        </div>
        <div className={`sil-status ${last ? 'hot' : year >= 1010 ? 'edge' : 'calm'}`}>{last ? <>⚠ «Говорите» — Последнее слово стало законом</> : year >= 1010 ? <>❗ Аббат умирает: ждут Последнего слова</> : <>✦ решение — больше {Math.floor(total / 2)} лет</>}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="sil-svg">
        <rect x="0" y="0" width={W} height={H} rx="8" className="sil-bg" />
        {Array.from({ length: 24 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={(i * 53) % 70 + 8} r={i % 3 ? 0.8 : 1.4} className="sil-star" />)}
        {data.priors.map((p, i) => {
          const x = 36 + i * 51, base = 216
          const y = yrs(p.since)
          const h = 6 + (y / maxY) * 150
          const col = side.get(p.side)?.color ?? '#888'
          const isAbbot = !last && abbot?.id === p.id
          return (
            <g key={p.id} className="sil-c" onClick={() => onOpen(p.id)}>
              <rect x={x - 9} y={base - h} width="18" height={h} rx="3" fill={col} opacity={y ? 0.9 : 0.35} stroke={isAbbot ? '#fff' : 'none'} strokeWidth="1.6" />
              {y > 0 && <path d={`M${x} ${base - h - 14} q-5 7 -2 12 q2 2 4 0 q3 -5 -2 -12z`} className="sil-flame" />}
              <text x={x} y={base - h - 18} textAnchor="middle" className="sil-y">{y}</text>
              <text x={x} y={base + 14} textAnchor="middle" className="sil-n">{p.name.split(' ').slice(-1)[0]}</text>
              <text x={x} y={base + 26} textAnchor="middle" className="sil-p">{p.parish}</text>
            </g>
          )
        })}
      </svg>
      <div className="sil-slider"><span>960</span><input type="range" min={960} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
      <label className="sil-last"><input type="checkbox" checked={last} onChange={(e) => setLast(e.target.checked)} /> аббат сказал последним словом <b>«Говорите»</b></label>
      <div className="sil-words">{data.words.map((w) => <div key={w.year} className="sil-word"><b>{Math.floor(w.year)} · {w.who}</b><small>потерял {w.lost} лет</small><p>{w.note}</p></div>)}</div>
      <div className="sil-legend">{data.sides.map((s) => <span key={s.key} title={s.who}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="sil-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
