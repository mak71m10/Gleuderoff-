import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type CartData = NonNullable<Entry['base']['cart']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const KIND: Record<string, string> = { found: 'основание', law: 'закон', aid: 'приют', crisis: 'Общий Сход', war: 'война', peace: 'мир', reform: 'реформа' }
const RES: Record<string, [string, string]> = { passed: ['принято', '#6aaa7a'], failed: ['отклонено', '#d0604a'], pending: ['голосуют', '#c9a24a'] }

/**
 * «Воз» Когалыма: шестьдесят Достойных тянут общий Воз, каждый — своё Бремя (Кормить, Учить, Чинить, Судить, Сторожить). Ползунок лет:
 * груз растёт, тянущих меньше — и Воз встаёт (Общий Сход). Вкладки: «Воз», «Сбор» (решения), «Бирки» (Достойные и их Три Слова).
 */
export function CartView({ data, onOpen }: { data: CartData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const names = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.name])), [world.entries])
  const [tab, setTab] = useState<'cart' | 'votes' | 'tally'>('cart')
  const [year, setYear] = useState(1010)
  const [di, setDi] = useState(data.decisions.length - 1)
  const Y0 = data.series[0].year, Y1 = data.series[data.series.length - 1].year
  const at = (y: number): { pull: number; load: number; note: string; seats: Record<string, number> } => {
    const s = data.series
    if (y <= s[0].year) return s[0]
    for (let i = 1; i < s.length; i++) if (y <= s[i].year) {
      const a = s[i - 1], b = s[i], k = (y - a.year) / (b.year - a.year)
      return { pull: Math.round(a.pull + k * (b.pull - a.pull)), load: Math.round(a.load + k * (b.load - a.load)), note: k < 0.5 ? a.note : b.note, seats: k < 0.5 ? a.seats : b.seats }
    }
    return s[s.length - 1]
  }
  const cur = at(year)
  const stalled = cur.load > cur.pull
  const burden = new Map(data.burdens.map((b) => [b.key, b]))
  const dec = data.decisions[Math.min(di, data.decisions.length - 1)]
  // 60 фишек: по бремени, затем «не тянут»
  const tokens = useMemo(() => {
    const out: { color: string; on: boolean }[] = []
    for (const b of data.burdens) for (let i = 0; i < (cur.seats[b.key] ?? 0); i++) out.push({ color: b.color, on: true })
    while (out.length < data.seats) out.push({ color: '#3a3626', on: false })
    return out
  }, [cur, data.burdens, data.seats])
  const sacks = Math.round(cur.load / 6)
  const W = 700, H = 250
  const named = data.pullers.filter((p) => p.since <= year)
  return (
    <div className="cart">
      <div className="cart-head">
        <div>
          <small>{tab === 'votes' ? `Сбор ${Math.floor(dec.year)} г.` : `Воз Когалыма в ${year} г.`}</small>
          <b>{tab === 'votes' ? dec.title : `Тянут ${cur.pull} из ${data.seats} · груз ${cur.load}`}</b>
        </div>
        <div className={`cart-status ${tab === 'votes' ? dec.result : stalled ? 'stalled' : 'go'}`}>
          {tab === 'votes' ? <>{RES[dec.result]?.[0]} · за {dec.yes}, нужно {dec.need}</> : stalled ? <>⛔ Воз встал — Общий Сход</> : <>🛞 Воз идёт</>}
        </div>
      </div>
      <div className="cart-tabs">
        {([['cart', 'Воз'], ['votes', 'Сбор'], ['tally', 'Бирки']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'cart' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="cart-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="cart-bg" />
            <path d={`M0 ${H - 40} Q ${W * 0.3} ${H - 52} ${W * 0.6} ${H - 42} T ${W} ${H - 46}`} className="cart-road" />
            {/* верёвка и команда */}
            <line x1="120" y1="160" x2="470" y2="160" className="cart-rope" />
            {tokens.map((t, i) => {
              const row = Math.floor(i / 20), col = i % 20
              const x = 36 + col * 17 + (row % 2) * 6, y = 96 + row * 22 + (col % 2) * 3
              return <circle key={i} cx={x} cy={y} r="6" fill={t.on ? t.color : 'none'} stroke={t.on ? '#0a0a06' : '#4a4430'} strokeWidth="1.2" strokeDasharray={t.on ? undefined : '2 2'} className={t.on && !stalled ? 'cart-pull' : ''} style={{ animationDelay: `${(i % 7) * 0.12}s` }} />
            })}
            {named.slice(0, 12).map((p, i) => {
              const x = 44 + i * 36, y = 36
              const src = img.get(p.id)
              return (
                <g key={p.id} className="cart-named" onClick={() => onOpen(p.id)}>
                  <circle cx={x} cy={y} r="15" fill="#14120a" stroke={burden.get(p.burden)?.color ?? '#aaa'} strokeWidth="2.2" />
                  <clipPath id={`cp-${i}`}><circle cx={x} cy={y} r="13" /></clipPath>
                  {src ? <image href={assetUrl(src)} x={x - 13} y={y - 14} width="26" height="30" clipPath={`url(#cp-${i})`} preserveAspectRatio="xMidYMid slice" /> : <text x={x} y={y + 4} textAnchor="middle" className="cart-axis">{(names.get(p.id) ?? '?')[0]}</text>}
                </g>
              )
            })}
            {/* телега с грузом */}
            <g transform={`translate(${stalled ? 470 : 470 + (year % 3)} 112)`} className={stalled ? 'cart-stuck' : ''}>
              <rect x="0" y="40" width="160" height="22" rx="3" fill="#6a4a2a" stroke="#2a1a0a" strokeWidth="2" />
              <rect x="-18" y="48" width="22" height="5" fill="#6a4a2a" />
              {Array.from({ length: sacks }, (_, i) => <rect key={i} x={8 + (i % 6) * 24} y={30 - Math.floor(i / 6) * 17} width="22" height="15" rx="5" fill={i % 3 === 0 ? '#c8b878' : '#a89860'} stroke="#3a3216" strokeWidth="1.2" />)}
              {[34, 128].map((cx) => <g key={cx}><circle cx={cx} cy="68" r="22" fill="none" stroke="#3a2a14" strokeWidth="5" /><circle cx={cx} cy="68" r="4" fill="#3a2a14" />{[0, 45, 90, 135].map((a) => <line key={a} x1={cx} y1="68" x2={cx + Math.cos((a * Math.PI) / 180) * 20} y2={68 + Math.sin((a * Math.PI) / 180) * 20} stroke="#3a2a14" strokeWidth="2.5" />)}</g>)}
            </g>
            {stalled && <text x="550" y="230" textAnchor="middle" className="cart-stamp">ВОЗ ВСТАЛ</text>}
          </svg>
          <div className="cart-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
          <p className="cart-note">{cur.note}</p>
          <div className="cart-legend">{data.burdens.map((b) => <span key={b.key} title={b.desc}><i style={{ background: b.color }} />{b.name} · {cur.seats[b.key] ?? 0}</span>)}</div>
        </>
      )}

      {tab === 'votes' && (
        <>
          <div className="cart-decs">
            {data.decisions.map((d, i) => <button key={i} className={i === di ? 'on' : ''} onClick={() => setDi(i)}><small>{Math.floor(d.year)}</small> {d.title} <span style={{ color: RES[d.result]?.[1] }}>· {RES[d.result]?.[0]}</span></button>)}
          </div>
          <svg viewBox="0 0 400 78" className="cart-dots">
            {Array.from({ length: data.seats }, (_, i) => {
              const col = i % 30, row = Math.floor(i / 30)
              const v = i < dec.yes ? 'yes' : i < dec.yes + dec.no ? 'no' : 'abstain'
              return <circle key={i} cx={14 + col * 12.4} cy={16 + row * 22} r="5" fill={v === 'yes' ? '#6aaa7a' : v === 'no' ? '#d0604a' : '#8a8a7a'} />
            })}
            <text x="200" y="74" textAnchor="middle" className="cart-axis">за {dec.yes} · против {dec.no} · воздержались {dec.abstain} · нужно {dec.need} из {data.seats}</text>
          </svg>
          <p className="cart-note"><b>{KIND[dec.kind] ?? dec.kind}.</b> {dec.note}</p>
        </>
      )}

      {tab === 'tally' && (
        <div className="cart-cards">
          {data.pullers.map((p) => {
            const b = burden.get(p.burden)
            const src = img.get(p.id)
            return (
              <button key={p.id} className="cart-card" style={{ ['--bc' as string]: b?.color ?? '#aaa' }} onClick={() => onOpen(p.id)}>
                <span className="cart-face">{src ? <img src={assetUrl(src)} alt="" /> : (names.get(p.id) ?? '?')[0]}</span>
                <b>{(names.get(p.id) ?? '').replace(/ «.*»/, '')}</b>
                <small>{b?.name} · с {p.since}</small>
                <svg viewBox="0 0 120 20" className="cart-stick"><rect x="2" y="7" width="116" height="6" rx="3" fill="#8a6a3a" />{Array.from({ length: p.tally }, (_, i) => <line key={i} x1={8 + (i * 104) / Math.max(1, p.tally - 1)} x2={8 + (i * 104) / Math.max(1, p.tally - 1)} y1="3" y2="17" stroke="#2a1a0a" strokeWidth="1.6" />)}</svg>
                <small>Слов: {p.tally}</small>
              </button>
            )
          })}
        </div>
      )}
      <ul className="cart-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
