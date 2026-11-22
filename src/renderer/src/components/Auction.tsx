import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type AucData = NonNullable<Entry['base']['auction']>
type Reign = AucData['reigns'][number]

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const KIND: Record<string, string> = { founding: 'первые торги', death: 'по смерти', empty: 'Пустые торги', default: 'после Открытых ворот', term: 'срочные (через 7 лет)' }
const fmt = (n: number): string => n.toLocaleString('ru')

/**
 * «Ворота Торга» Империи Кагия: трон продаётся Багряной гвардии у Семи ворот Целведеля. Ворота закрыты, пока взносы уплачены,
 * приоткрыты при пропуске и распахнуты в год торгов; на фризе — семь монет взносов. Вкладки: «Ворота» (ползунок лет), «Торги», «Ценовая книга».
 */
export function AuctionView({ data, onOpen }: { data: AucData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'gates' | 'bids' | 'book'>('gates')
  const [year, setYear] = useState(1010)
  const [ai, setAi] = useState(data.auctions.length - 1)
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const reign: Reign = [...data.reigns].reverse().find((r) => r.from <= year + 0.99) ?? data.reigns[0]
  const auc = data.auctions.find((a) => Math.floor(a.year) === year)
  const missed = data.reigns.some((r) => r.missed.includes(year))
  const due = year === Math.floor(data.due.year)
  const gate: 'open' | 'ajar' | 'shut' = auc ? 'open' : missed || due ? 'ajar' : 'shut'
  const spears = [...data.spears].reverse().find(([y]) => y <= year + 0.99)?.[1] ?? data.spears[0][1]
  const status = auc ? (auc.kind === 'empty' ? ['Пустые торги — правит Хранитель Ворот', 'empty'] : [`Ворота открыты: ${auc.title}`, 'open']) : missed ? ['Взнос пропущен — через сто дней ворота откроют', 'miss'] : due ? [`Взнос ${Math.floor(data.due.year)} г.: собрано ${fmt(data.due.have)} из ${fmt(data.due.sum)}`, 'due'] : ['Взносы уплачены, ворота заперты', 'ok']
  const coins = Array.from({ length: 7 }, (_, i) => {
    const y = Math.floor(reign.from) + i
    const st = reign.paid.includes(y) && y <= year ? 'paid' : reign.missed.includes(y) && y <= year ? 'miss' : y === Math.floor(data.due.year) && year >= y ? 'due' : 'wait'
    return { y, st }
  })
  const face = (id: string | null | undefined): string | null => (id && img.get(id) ? assetUrl(img.get(id)!) : null)
  const leaf = gate === 'open' ? 0.28 : gate === 'ajar' ? 0.86 : 1
  const a = data.auctions[Math.min(ai, data.auctions.length - 1)]
  const maxBid = Math.max(...data.auctions.flatMap((x) => x.bids.map((b) => b.price)), 1)
  const Y0 = 978, Y1 = 1010
  const rf = face(reign.id)

  return (
    <div className="auc">
      <div className="auc-head">
        <div>
          <small>{tab === 'bids' ? `Торги ${Math.floor(a.year)} г.` : `Кагия в ${year} г.`}</small>
          <b>{tab === 'bids' ? a.title : reign.price ? `${reign.name} — ${reign.price} м. на копьё` : reign.name}</b>
        </div>
        <div className={`auc-status ${tab === 'bids' ? (a.kind === 'empty' ? 'empty' : 'open') : status[1]}`}>
          {tab === 'bids' ? <>{KIND[a.kind] ?? a.kind} · {fmt(a.spears)} копий{a.floor ? ` · нижняя цена ${String(a.floor).replace('.', ',')}` : ''}</> : status[0]}
        </div>
      </div>
      <div className="auc-tabs">
        {([['gates', 'Ворота'], ['bids', 'Торги'], ['book', 'Ценовая книга']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'gates' && (
        <>
          <div className="auc-main">
            <svg viewBox="0 0 420 300" className="auc-pic">
              <defs>
                <clipPath id="auc-face"><circle cx="210" cy="44" r="25" /></clipPath>
                <linearGradient id="auc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1c14" /><stop offset="1" stopColor="#120a08" /></linearGradient>
              </defs>
              <rect x="0" y="0" width="420" height="300" rx="8" fill="url(#auc-sky)" />
              {/* башни */}
              {[[40, 110], [290, 110]].map(([x], i) => (
                <g key={i}>
                  <rect x={x} y="80" width="90" height="180" className="auc-stone" />
                  {[0, 1, 2, 3].map((k) => <rect key={k} x={x + k * 24} y="68" width="14" height="14" className="auc-stone" />)}
                  <rect x={x + 38} y="120" width="14" height="26" rx="7" className="auc-win" />
                </g>
              ))}
              {/* арка и фриз */}
              <rect x="120" y="96" width="180" height="164" className="auc-stone" />
              <rect x="112" y="80" width="196" height="30" className="auc-frieze" />
              <path d="M150 260 V160 A60 60 0 0 1 270 160 V260 Z" className={`auc-hole ${gate}`} />
              {/* створки */}
              <g className="auc-leaf" style={{ transform: `scaleX(${leaf})`, transformOrigin: '150px 0' }}><path d="M150 260 V160 A60 60 0 0 1 210 100 V260 Z" className="auc-door" />{[180, 205, 230].map((y) => <line key={y} x1="152" x2="208" y1={y} y2={y} className="auc-band" />)}</g>
              <g className="auc-leaf" style={{ transform: `scaleX(${leaf})`, transformOrigin: '270px 0' }}><path d="M270 260 V160 A60 60 0 0 0 210 100 V260 Z" className="auc-door" />{[180, 205, 230].map((y) => <line key={y} x1="212" x2="268" y1={y} y2={y} className="auc-band" />)}</g>
              {/* семь монет взносов */}
              {coins.map((c, i) => (
                <g key={c.y} transform={`translate(${129 + i * 27} 95)`}>
                  <circle r="9" className={`auc-coin ${c.st}`} />
                  <text y="3.5" textAnchor="middle" className="auc-coin-t">{String(c.y).slice(-2)}</text>
                </g>
              ))}
              {/* портрет над аркой */}
              <circle cx="210" cy="44" r="27" className="auc-ring" />
              {rf ? <image href={rf} x="185" y="19" width="50" height="50" clipPath="url(#auc-face)" preserveAspectRatio="xMidYMid slice" style={{ cursor: 'pointer' }} onClick={() => onOpen(reign.id)} /> : <text x="210" y="52" textAnchor="middle" className="auc-init" onClick={() => onOpen(reign.id)}>{reign.name[0]}</text>}
              {/* свинцовая бирка с ценой */}
              {reign.price > 0 && <g transform="translate(242 52)"><line x1="-6" y1="-6" x2="4" y2="4" className="auc-string" /><rect x="2" y="2" width="44" height="20" rx="3" className="auc-tag" /><text x="24" y="16" textAnchor="middle" className="auc-tag-t">{reign.price} м.</text></g>}
              {/* копья гвардии: одно на сотню */}
              {Array.from({ length: Math.round(spears / 100) }, (_, i) => {
                const x = 30 + i * (360 / Math.max(1, Math.round(spears / 100) - 1))
                return <g key={i}><line x1={x} y1="292" x2={x} y2="262" className="auc-spear" /><path d={`M${x - 3} 263 L${x} 255 L${x + 3} 263 Z`} className="auc-tip" /></g>
              })}
              <text x="210" y="285" textAnchor="middle" className="auc-cap">{fmt(spears)} копий Багряной гвардии</text>
            </svg>
            <div className="auc-card">
              <button className="auc-ruler" onClick={() => onOpen(reign.id)}>
                <span className="auc-face">{rf ? <img src={rf} alt="" /> : reign.name[0]}</span>
                <span><small>{side.get(reign.side)?.name}</small><b>{reign.name}</b><em>{Math.floor(reign.from)}–{reign.end === 'правит' ? 'ныне' : Math.floor(reign.to)} · {reign.end}</em></span>
              </button>
              {reign.price > 0 ? <p>Цена: <b>{reign.price} м.</b> × {fmt(reign.spears)} копий = <b>{fmt(Math.round(reign.price * reign.spears))} марок</b>, взнос — {fmt(Math.round((reign.price * reign.spears) / 7))} в год. Уплачено взносов: {reign.paid.filter((y) => y <= year).length} из 7.</p> : <p>Торги не состоялись: никто не дал нижней цены. Правит Префект гвардии.</p>}
              {due && <div className="auc-due"><div className="auc-due-bar"><i style={{ width: `${(data.due.have / data.due.sum) * 100}%` }} /></div><small>{data.due.note}</small></div>}
              {auc && <p className="auc-note">{auc.note}</p>}
            </div>
          </div>
          <div className="auc-slider"><span>{Y0}</span><input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{Y1}</span></div>
          <div className="auc-coins-legend"><span><i className="paid" />взнос уплачен</span><span><i className="miss" />пропущен</span><span><i className="due" />срок сейчас</span><span><i className="wait" />впереди</span></div>
        </>
      )}

      {tab === 'bids' && (
        <>
          <div className="auc-decs">
            {data.auctions.map((x, i) => <button key={i} className={i === ai ? 'on' : ''} onClick={() => setAi(i)}><small>{Math.floor(x.year)}</small> {x.title}</button>)}
          </div>
          <div className="auc-bids">
            {a.bids.map((b) => {
              const f = face(b.id)
              return (
                <button key={b.name} className={`auc-bid ${b.won ? 'won' : ''}`} disabled={!b.id} onClick={() => b.id && onOpen(b.id)}>
                  <span className="auc-face sm">{f ? <img src={f} alt="" /> : b.name[0]}</span>
                  <span className="auc-bid-body">
                    <span className="auc-bid-top"><b>{b.name}</b><em>{b.price} м. на копьё{b.won ? ' · продано' : ''}</em></span>
                    <span className="auc-bar"><i style={{ width: `${(b.price / maxBid) * 100}%`, background: side.get(b.side)?.color }} />{a.floor && <s style={{ left: `${(a.floor / maxBid) * 100}%` }} />}</span>
                    <small>{b.note}</small>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="auc-note">{a.note}</p>
        </>
      )}

      {tab === 'book' && (
        <svg viewBox="0 0 420 190" className="auc-chart">
          {(() => {
            const X = (y: number): number => 34 + ((y - Y0) / (Y1 - Y0)) * 366
            const V = (v: number): number => 160 - (v / 80) * 140
            const won = data.auctions.map((x) => ({ x, w: x.bids.find((b) => b.won) }))
            return (
              <>
                {[20, 40, 60, 80].map((v) => <g key={v}><line x1="30" x2="404" y1={V(v)} y2={V(v)} className="auc-grid" /><text x="26" y={V(v) + 3} textAnchor="end" className="auc-axis">{v}</text></g>)}
                <polyline points={won.filter((o) => o.w).map((o) => `${X(o.x.year)},${V(o.w!.price)}`).join(' ')} className="auc-line" />
                {won.map((o) => (
                  <g key={o.x.year}>
                    {o.x.bids.filter((b) => !b.won).map((b) => <circle key={b.name} cx={X(o.x.year)} cy={V(b.price)} r="3" className="auc-lost" />)}
                    {o.w ? <circle cx={X(o.x.year)} cy={V(o.w.price)} r="6" className="auc-won" onClick={() => o.w?.id && onOpen(o.w.id)} /> : <text x={X(o.x.year)} y={V(30)} textAnchor="middle" className="auc-x">✕</text>}
                    {o.x.floor && <line x1={X(o.x.year) - 8} x2={X(o.x.year) + 8} y1={V(o.x.floor)} y2={V(o.x.floor)} className="auc-floor" />}
                    <text x={X(o.x.year)} y="178" textAnchor="middle" className="auc-axis">{Math.floor(o.x.year)}</text>
                    {o.w && <text x={X(o.x.year)} y={V(o.w.price) - 10} textAnchor="middle" className="auc-val">{o.w.price}</text>}
                  </g>
                ))}
              </>
            )
          })()}
        </svg>
      )}
      <div className="auc-legend">{data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}</div>
      <ul className="auc-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
