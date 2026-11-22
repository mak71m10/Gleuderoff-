import { useState, type ReactNode } from 'react'
import type { Entry } from '../types'

type KeysData = NonNullable<Entry['base']['keys']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const MARK: Record<string, [string, string]> = { yes: ['грамота вернулась', '#7ac07a'], late: ['грамота с опозданием', '#d8b060'], no: ['грамоты нет', '#d0503a'], '—': ['ключа ещё нет', '#5a5a6a'] }

/**
 * «Два ключа» Ла Роше: лоза посередине, слева Ключ Пламени (архиепископ Бувезеоны), справа Золотой ключ (Дом Каяя);
 * от Сестёр к каждому ключу идёт дань, обратно — грамота. Ползунок по годам; цвет грамоты — вернулась, опоздала, нет.
 */
export function KeysView({ data }: { data: KeysData; onOpen: (id: string) => void }) {
  const [i, setI] = useState(data.tribute.length - 1)
  const t = data.tribute[i]
  const state = t.flame === 'no' && t.gold === 'no' ? 'empty' : t.flame === 'no' || t.gold === 'no' ? 'one' : 'calm'
  const key = (x: number, color: string, mark: string, label: string, gift: string) => (
    <g>
      <circle cx={x} cy="70" r="26" fill="none" stroke={color} strokeWidth="7" />
      <rect x={x - 4} y="94" width="8" height="70" fill={color} />
      <rect x={x} y="140" width="18" height="7" fill={color} /><rect x={x} y="154" width="12" height="7" fill={color} />
      <text x={x} y="190" textAnchor="middle" className="key-l">{label}</text>
      <text x={x} y="206" textAnchor="middle" className="key-g">дань: {gift}</text>
      <text x={x} y="222" textAnchor="middle" style={{ fill: MARK[mark][1] }} className="key-m">{MARK[mark][0]}</text>
    </g>
  )
  return (
    <div className="key">
      <div className="key-head">
        <div><small>Два ключа в {t.year} г.</small><b>Сёстры Лозы правят, пока оба ключа возвращают грамоту</b></div>
        <div className={`key-status ${state}`}>{state === 'empty' ? <>⚠ Пустые ключи: статья 9</> : state === 'one' ? <>❗ Год одного ключа</> : <>🍇 вольности подтверждены</>}</div>
      </div>
      <svg viewBox="0 0 420 236" className="key-svg">
        <rect x="0" y="0" width="420" height="236" rx="8" className="key-bg" />
        {key(80, '#c8503a', t.flame, 'Ключ Пламени — Бувезеона', t.toFlame)}
        {key(340, '#c9a45c', t.gold, 'Золотой ключ — Каяя', t.toGold)}
        <path d="M210 210 C 200 160, 225 130, 210 80 S 200 40, 214 20" className="key-vine" />
        {[60, 100, 140, 180].map((y, k) => <circle key={y} cx={210 + (k % 2 ? 12 : -12)} cy={y} r="7" className="key-grape" />)}
        <path d={`M196 110 L120 90`} className={`key-arrow ${t.flame}`} /><path d={`M224 110 L300 90`} className={`key-arrow ${t.gold}`} />
      </svg>
      <div className="key-slider"><span>{data.tribute[0].year}</span><input type="range" min={0} max={data.tribute.length - 1} value={i} onChange={(e) => setI(+e.target.value)} /><span>{data.tribute[data.tribute.length - 1].year}</span></div>
      <div className="key-years">{data.tribute.map((x, k) => <button key={x.year} className={k === i ? 'on' : ''} onClick={() => setI(k)}>{x.year}</button>)}</div>
      <p className="key-note">{t.note}</p>
      <div className="key-legend">{data.sides.map((s) => <span key={s.key} title={s.who}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="key-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
