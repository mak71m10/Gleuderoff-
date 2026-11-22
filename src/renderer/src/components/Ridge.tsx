import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type RData = NonNullable<Entry['base']['ridge']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))

/**
 * «Гряда Великанов» Фейноко: девять ниш в скале — по камню от племени (светится, если лежит на Гряде в выбранный год); над ними Венец-Рыба: горит,
 * пока камней не меньше шести. Ползунок лет, клик по камню — история и вождь; вкладки «Гряда», «Избрания».
 */
export function RidgeView({ data, onOpen }: { data: RData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'ridge' | 'chiefs'>('ridge')
  const [year, setYear] = useState(1010)
  const [sel, setSel] = useState<string | null>(null)
  const t = year + 0.99
  const on = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const s of data.stones) if (s.year <= t) m.set(s.tribe, s.kind === 'give')
    return m
  }, [data.stones, t])
  const count = [...on.values()].filter(Boolean).length
  const crowned = t >= data.crowned && count >= data.needed
  const chief = [...data.chiefs].reverse().find((c) => c.from <= t) ?? data.chiefs[0]
  const picked = data.tribes.find((x) => x.key === sel)
  const evs = data.stones.filter((s) => s.tribe === sel)
  const status: [string, string] = t < data.crowned ? [`Избранный без венца: ${count} из ${data.total} камней, нужно ${data.needed}`, 'wait'] : crowned ? [`Венец стоит: ${count} камней из ${data.total}`, 'ok'] : [`Пустая Гряда: ${count} камней`, 'bad']
  const face = (id: string): string | null => (img.get(id) ? assetUrl(img.get(id)!) : null)
  return (
    <div className="rdg">
      <div className="rdg-head">
        <div><small>Фейноко в {year} г.</small><b>{chief.name}</b></div>
        <div className={`rdg-status ${status[1]}`}>{status[0]}</div>
      </div>
      <div className="rdg-tabs">{([['ridge', 'Гряда'], ['chiefs', 'Избрания']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'ridge' && (
        <>
          <svg viewBox="0 0 420 210" className="rdg-pic">
            <rect x="0" y="0" width="420" height="210" rx="8" className="rdg-bg" />
            <path d="M0 210 L0 130 L60 90 L120 120 L210 60 L300 118 L360 86 L420 126 L420 210 Z" className="rdg-hill" />
            {/* Венец-Рыба над Грядой */}
            <g transform="translate(210 30)" className={crowned ? 'rdg-fish on' : 'rdg-fish'}>
              <ellipse rx="26" ry="11" /><path d="M24 0 L38 -10 L38 10 Z" /><circle cx="-14" cy="-2" r="2" className="rdg-eye" />
            </g>
            {data.tribes.map((tr, i) => {
              const x = 34 + i * 44, lit = on.get(tr.key)
              return (
                <g key={tr.key} className="rdg-niche" onClick={() => setSel(sel === tr.key ? null : tr.key)}>
                  <rect x={x - 17} y="92" width="34" height="86" rx="17" className={sel === tr.key ? 'rdg-hole sel' : 'rdg-hole'} />
                  {lit ? <ellipse cx={x} cy="140" rx="11" ry="26" fill={tr.color} className="rdg-stone" /> : <ellipse cx={x} cy="140" rx="11" ry="26" className="rdg-empty" />}
                  <text x={x} y="196" textAnchor="middle" className="rdg-name">{tr.name}</text>
                </g>
              )
            })}
          </svg>
          <div className="rdg-slider"><span>972</span><input type="range" min={972} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>
          {year === 1010 && <p className="rdg-note">{data.festival.note}</p>}
          {picked && (
            <div className="rdg-card">
              <b>{picked.name} · {picked.seat}</b>
              {evs.map((e, i) => <span key={i}>{Math.floor(e.year)}: {e.kind === 'give' ? 'камень на Гряде' : 'камень забран'} — {e.note}</span>)}
            </div>
          )}
        </>
      )}
      {tab === 'chiefs' && (
        <div className="rdg-chiefs">
          {data.chiefs.map((c, i) => (
            <button key={i} className="rdg-chief" onClick={() => onOpen(c.id)}>
              <span className="rdg-face">{face(c.id) ? <img src={face(c.id)!} alt="" /> : c.name[0]}</span>
              <span><b>{c.name}</b><small>{Math.floor(c.from)}–{c.to > 1010 ? 'ныне' : Math.floor(c.to)} · {c.how}</small></span>
            </button>
          ))}
        </div>
      )}
      <div className="rdg-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="rdg-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
