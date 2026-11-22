import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type StarData = NonNullable<Entry['base']['star']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const RES: Record<string, [string, string]> = { clear: ['звезды нет — король правит', 'ok'], deposed: ['Звёздный суд: король снят', 'bad'], blind: ['Слепая ночь — суда нет девять лет', 'blind'], pending: ['ночь впереди', 'due'] }
const hash = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/**
 * «Мостовые и Звёздная ночь» Королевства Редания: река с пятью мостами, над каждым — его Мостовой; ночное небо, где в Звёздную ночь
 * падает звезда (или тучи). Ползунок лет: кто Мостовой, какие мосты закрыты, какой король. Вкладки: «Мосты», «Звёздные ночи».
 */
export function StarView({ data, onOpen }: { data: StarData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'bridges' | 'nights'>('bridges')
  const [year, setYear] = useState(1010)
  const [ni, setNi] = useState(data.nights.length - 1)
  const [sel, setSel] = useState<string | null>(null)
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const night = data.nights[Math.min(ni, data.nights.length - 1)]
  const viewYear = tab === 'nights' ? Math.floor(night.year) : year
  const roll = [...data.rolls].reverse().find((r) => r.year <= viewYear) ?? data.rolls[0]
  const king = [...data.kings].reverse().find((k) => k.from <= (tab === 'nights' ? night.year : viewYear + 0.99)) ?? data.kings[0]
  const closed = data.closures.filter((c) => Math.floor(c.year) === viewYear)
  const isClosed = (k: string): boolean => closed.some((c) => c.bridge === k || c.bridge === 'all')
  const nightNow = tab === 'nights' ? night : data.nights.find((n) => Math.floor(n.year) === year)
  const face = (id: string | null | undefined): string | null => (id && img.get(id) ? assetUrl(img.get(id)!) : null)
  const stars = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ x: (hash(`x${i}`) % 700) + 10, y: (hash(`y${i}`) % 90) + 6, r: 0.6 + (hash(`r${i}`) % 10) / 10 })), [])
  const B = data.bridges.length
  const bx = (i: number): number => 80 + i * (560 / (B - 1))
  const starCount = nightNow ? Object.values(nightNow.seen).filter((v) => v === 'star').length : 0
  const status: [string, string] = nightNow ? [`Звёздная ночь ${Math.floor(nightNow.year)}: ${RES[nightNow.result]?.[0]}`, RES[nightNow.result]?.[1] ?? ''] : closed.length ? [`Закрыто мостов: ${closed.some((c) => c.bridge === 'all') ? 'все пять' : closed.length}`, 'bad'] : ['Мосты открыты, Клятвы принесены', 'ok']
  const next = 983 + Math.ceil((viewYear - 983) / 9) * 9
  const picked = sel ? data.bridges.find((b) => b.key === sel) : null
  const pm = picked ? roll.men[picked.key] : null
  const kf = face(king.id)
  return (
    <div className="str">
      <div className="str-head">
        <div>
          <small>{tab === 'nights' ? `Звёздная ночь ${Math.floor(night.year)} г.` : `Редания в ${year} г. · следующая Звёздная ночь — ${next === viewYear ? 'в этот год' : `${next} г.`}`}</small>
          <b>Король {king.name}</b>
        </div>
        <div className={`str-status ${status[1]}`}>{status[0]}</div>
      </div>
      <div className="str-tabs">
        {([['bridges', 'Мосты'], ['nights', 'Звёздные ночи']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <svg viewBox="0 0 720 300" className="str-pic">
        <defs>
          <linearGradient id="str-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070a1c" /><stop offset="1" stopColor="#1a2440" /></linearGradient>
          <clipPath id="str-kf"><circle cx="360" cy="40" r="22" /></clipPath>
          {data.bridges.map((b, i) => <clipPath key={b.key} id={`str-f-${b.key}`}><circle cx={bx(i)} cy="140" r="19" /></clipPath>)}
        </defs>
        <rect x="0" y="0" width="720" height="300" rx="8" fill="url(#str-sky)" />
        {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} className="str-st" />)}
        {/* король над рекой */}
        <circle cx="360" cy="40" r="24" className="str-kring" />
        {kf ? <image href={kf} x="338" y="18" width="44" height="44" clipPath="url(#str-kf)" preserveAspectRatio="xMidYMid slice" style={{ cursor: 'pointer' }} onClick={() => onOpen(king.id)} /> : <text x="360" y="47" textAnchor="middle" className="str-init" onClick={() => onOpen(king.id)}>{king.name[0]}</text>}
        {/* река */}
        <path d="M0 220 C120 200 240 240 360 220 S600 200 720 222 V300 H0 Z" className="str-river" />
        <path d="M0 236 C140 220 260 252 380 236 S620 218 720 238" className="str-ripple" />
        {data.bridges.map((b, i) => {
          const x = bx(i), m = roll.men[b.key], col = side.get(m?.side ?? '')?.color ?? '#888', shut = isClosed(b.key), seen = nightNow?.seen[b.key]
          const f = face(m?.id)
          return (
            <g key={b.key} className="str-br" onClick={() => setSel(sel === b.key ? null : b.key)}>
              {seen === 'star' && <g className="str-fall"><line x1={x + 46} y1="20" x2={x + 8} y2="88" /><circle cx={x + 8} cy="88" r="3" /></g>}
              {seen === 'cloud' && <g className="str-cloud">{[-22, 0, 22].map((d) => <ellipse key={d} cx={x + d} cy="72" rx="26" ry="12" />)}</g>}
              {seen === 'wait' && <text x={x} y="88" textAnchor="middle" className="str-q">?</text>}
              <path d={`M${x - 44} 222 Q${x} 168 ${x + 44} 222`} className={`str-arch ${shut ? 'shut' : ''}`} />
              <rect x={x - 48} y="196" width="96" height="7" rx="2" className={`str-deck ${shut ? 'shut' : ''}`} />
              {shut && <text x={x} y="192" textAnchor="middle" className="str-x">закрыт</text>}
              <circle cx={x} cy="140" r="21" fill={col} className={sel === b.key ? 'str-ring sel' : 'str-ring'} />
              {f ? <image href={f} x={x - 19} y="121" width="38" height="38" clipPath={`url(#str-f-${b.key})`} preserveAspectRatio="xMidYMid slice" /> : <text x={x} y="146" textAnchor="middle" className="str-init sm">{m?.name[0]}</text>}
              <text x={x} y="250" textAnchor="middle" className="str-name">{b.name}</text>
              <text x={x} y="266" textAnchor="middle" className="str-man">{m?.name}</text>
            </g>
          )
        })}
      </svg>
      {tab === 'bridges' && <div className="str-slider"><span>979</span><input type="range" min={979} max={1010} value={year} onChange={(e) => setYear(+e.target.value)} /><span>1010</span></div>}
      {tab === 'nights' && (
        <>
          <div className="str-decs">{data.nights.map((n, i) => <button key={i} className={i === ni ? 'on' : ''} onClick={() => setNi(i)}><small>{Math.floor(n.year)}</small> {RES[n.result]?.[0]}</button>)}</div>
          <p className="str-note">Звезду видели: <b>{starCount} из {B}</b> (нужно 3). {night.note}</p>
        </>
      )}
      {tab === 'bridges' && closed.map((c) => <p key={c.year} className="str-note"><b>{Math.floor(c.year)}:</b> {c.note}</p>)}
      {picked && pm && (
        <div className="str-card">
          <button className="str-man-btn" disabled={!pm.id} onClick={() => pm.id && onOpen(pm.id)}>
            <span className="str-face">{face(pm.id) ? <img src={face(pm.id)!} alt="" /> : pm.name[0]}</span>
            <span><small>Мостовой · {side.get(pm.side)?.name}</small><b>{pm.name}</b><em>{picked.note}</em></span>
          </button>
        </div>
      )}
      <div className="str-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="str-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
