import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import { EMBLEMS } from './Heraldry'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['bans']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const ON: Record<string, [string, string]> = { sylva: ['на сильва', '#c9a24a'], stranger: ['на чужаков', '#d0604a'], land: ['на землю', '#7fc47a'] }
const RES: Record<string, [string, string]> = {
  fell: ['шнур упал', '#d0604a'], open: ['срок идёт', '#e8b84a'], held: ['кара — запрет устоял', '#7fc47a'], untied: ['развязал сам', '#8aa0c0'], lapsed: ['не перевязаны', '#8a8a70'],
}

/**
 * «Запреты Опушки» Сильвленда: Шнуровой столб с пятью шнурами Опекунов. Ползунок лет 981–1010: на шнурах завязываются и
 * падают узлы-запреты; золотая черта — семь узлов, ниже неё Печать не держат; у самого длинного шнура — Печать Листа.
 * Год со сломанным запретом: шнур краснеет, упавшие узлы лежат у корней.
 */
export function BansView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'cords' | 'broken' | 'keepers'>('cords')
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const cur = data.years.find((y) => y.y === year) ?? data.years[data.years.length - 1]
  const events = data.broken.filter((b) => Math.floor(b.y) === year)
  const holder = cur.holder ? data.houses.find((h) => h.key === cur.holder) : null
  const holderN = holder ? cur.knots[holder.key] : 0
  const openNow = events.find((e) => e.result === 'open')
  const house = sel ? data.houses.find((h) => h.key === sel) : null
  const W = 420, H = 340, top = 62, gap = 16
  const n = data.houses.length
  const px = (i: number) => 54 + (i * (W - 136)) / (n - 1)
  const ky = (k: number) => top + 14 + k * gap
  const sx = (y: number) => 30 + ((y - data.yearFrom) / (data.yearTo - data.yearFrom)) * 340
  const sy = (v: number) => 118 - v * 8.4
  const status = openNow ? 'hot' : cur.mode === 'quiet' ? 'root' : holderN === data.needKnots ? 'edge' : 'calm'
  return (
    <div className="wil ban">
      <div className="wil-head">
        <div>
          <small>Шнуровой столб в {year} г.</small>
          <b>{holder ? `Хранитель Опушки ${cur.ruler} · ${holderN} узлов` : 'Тихий лес: правит Совет Опекунов'}</b>
        </div>
        <div className={`wil-status ${status}`}>
          {openNow ? <>⚠ запрет сломан: {data.graceDays} дней на кару</> : cur.mode === 'quiet' ? <>⚠ ни у кого нет {data.needKnots} узлов</> : <>🍃 Печать Листа держится</>}
        </div>
      </div>
      <div className="wil-tabs">
        {([['cords', 'Шнуры'], ['broken', 'Сломанные запреты'], ['keepers', 'Хранители']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'cords' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="wil-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="wil-bg" />
            <path d={`M10 ${H - 34} Q ${W / 2} ${H - 52} ${W - 10} ${H - 34} L ${W - 10} ${H - 6} L 10 ${H - 6}z`} className="ban-ground" />
            {/* перекладина столба */}
            <rect x="24" y={top - 10} width={W - 48} height="8" rx="3" className="ban-beam" />
            <rect x="18" y="30" width="12" height={H - 64} rx="4" className="ban-pole" />
            <rect x={W - 30} y="30" width="12" height={H - 64} rx="4" className="ban-pole" />
            <defs>{data.houses.map((h, i) => <clipPath key={h.key} id={`ban-f-${h.key}`}><circle cx={px(i)} cy={H - 54} r="15" /></clipPath>)}</defs>
            <line x1="30" x2={W - 64} y1={ky(data.needKnots - 1) + gap / 2} y2={ky(data.needKnots - 1) + gap / 2} className="wil-thr" />
            <text x={W - 36} y={ky(data.needKnots - 1) + gap / 2 + 4} textAnchor="end" className="wil-axis">≥{data.needKnots}</text>
            {data.houses.map((h, i) => {
              const x = px(i)
              const k = cur.knots[h.key] ?? 0
              const ev = events.find((e) => e.house === h.key)
              const fell = ev && (ev.result === 'fell' || ev.result === 'lapsed' || ev.result === 'untied') ? ev.fell : 0
              const danger = ev?.result === 'open'
              const on = sel === h.key
              const isHolder = cur.holder === h.key
              const kid = cur.keepers[h.key]
              const src = kid ? img.get(kid) : ''
              return (
                <g key={h.key} className="ban-cord" onClick={() => setSel(h.key)}>
                  <line x1={x} y1={top - 4} x2={x} y2={ky(data.maxKnots - 1) + 6} stroke={danger ? '#d0604a' : h.color} strokeWidth={on ? 3.4 : 2.2} className={danger ? 'ban-danger' : ''} />
                  {Array.from({ length: data.maxKnots }, (_, j) => (
                    j < k
                      ? <circle key={j} cx={x} cy={ky(j)} r="6.2" fill={h.color} stroke={h.bg} strokeWidth="1.4" className="ban-knot" />
                      : <circle key={j} cx={x} cy={ky(j)} r="2.2" fill="#3a4a42" />
                  ))}
                  {Array.from({ length: fell }, (_, j) => <circle key={`f${j}`} cx={x - 14 + (j % 5) * 7} cy={H - 30 + Math.floor(j / 5) * 7} r="3.2" fill={h.color} opacity=".55" />)}
                  {isHolder && (
                    <g transform={`translate(${x} ${top - 28})`}>
                      <path d="M0 -12 C 9 -6 9 6 0 12 C -9 6 -9 -6 0 -12z" className="ban-seal" />
                      <line x1="0" y1="-10" x2="0" y2="10" stroke="#2f6b3a" strokeWidth="1" />
                    </g>
                  )}
                  <circle cx={x} cy={H - 54} r="17" fill={h.bg} stroke={on ? '#fff' : h.color} strokeWidth={on ? 3 : 2} />
                  {src ? <image href={assetUrl(src)} x={x - 15} y={H - 69} width="30" height="30" clipPath={`url(#ban-f-${h.key})`} preserveAspectRatio="xMidYMid slice" /> : <g transform={`translate(${x - 9} ${H - 63}) scale(.18)`}>{EMBLEMS[h.emblem]?.draw(h.color, h.bg)}</g>}
                  <text x={x} y={H - 24} textAnchor="middle" className="ban-name">{h.name.replace('Дом ', '')}</text>
                  <text x={x} y={H - 12} textAnchor="middle" className="ban-num">{k} из {data.maxKnots}</text>
                </g>
              )
            })}
          </svg>
          <svg viewBox="0 0 400 140" className="wil-chart">
            <rect x="0" y="0" width="400" height="140" rx="6" className="wil-bg" />
            <line x1="30" x2="370" y1={sy(data.needKnots)} y2={sy(data.needKnots)} className="wil-thr" />
            <text x="372" y={sy(data.needKnots) + 3} className="wil-axis">{data.needKnots}</text>
            {data.houses.map((h) => (
              <polyline key={h.key} points={data.years.map((p) => `${sx(p.y)},${sy(p.knots[h.key] ?? 0)}`).join(' ')} fill="none" stroke={h.color} strokeWidth={sel === h.key ? 2.6 : 1.5} opacity={sel && sel !== h.key ? 0.35 : 0.95} />
            ))}
            {data.years.filter((p) => p.mode === 'quiet').map((p) => <rect key={p.y} x={sx(p.y) - 5} y="8" width="10" height="114" fill="#d0604a" opacity=".18" />)}
            <line x1={sx(year)} x2={sx(year)} y1="8" y2="122" className="wil-cur" />
            <text x="30" y="134" className="wil-axis">узлов на шнурах по годам · красным — Тихий лес</text>
          </svg>
          <div className="wil-slider"><span>{data.yearFrom}</span><input type="range" min={data.yearFrom} max={data.yearTo} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{data.yearTo}</span></div>
          {events.length > 0 && (
            <ul className="wil-signs">
              {events.map((e, i) => <li key={i}><b style={{ color: RES[e.result][1] }}>{RES[e.result][0]}</b> — {data.houses.find((h) => h.key === e.house)?.name}: «{e.ban}». {e.note}</li>)}
            </ul>
          )}
          {house && (
            <div className="wil-card" style={{ ['--bc' as string]: house.color }}>
              <b>{house.name}</b> <small>· {house.race} · Мать {house.tree}, месяц {house.month}</small>
              <p>Опекун в {year} г.: <b>{cur.keepers[house.key] ? data.people[cur.keepers[house.key] as string] : '—'}</b>, узлов на шнуре: <b>{cur.knots[house.key]}</b>{cur.holder === house.key ? ' — Печать Листа у него.' : '.'}</p>
              <small>Узлы на шнуре в {data.yearTo} г.:</small>
              <ul className="ban-list">
                {data.bans.filter((b) => b.house === house.key).map((b, i) => <li key={i}><i style={{ background: ON[b.on][1] }} title={ON[b.on][0]} />{b.text} <small>с {b.since} г.</small></li>)}
              </ul>
              <div className="wil-card-btns">
                <button onClick={() => onOpen(house.houseId)}>Открыть Дом</button>
                {cur.keepers[house.key] && <button onClick={() => onOpen(cur.keepers[house.key] as string)}>{data.people[cur.keepers[house.key] as string]}</button>}
              </div>
            </div>
          )}
          <div className="wil-legend">
            {Object.entries(ON).map(([k, [l, c]]) => <span key={k}><i style={{ background: c }} />запрет {l}</span>)}
            <span><i className="ban-key-seal" />Печать Листа</span>
          </div>
        </>
      )}

      {tab === 'broken' && (
        <div className="wil-nights">
          {data.broken.map((e, i) => (
            <div key={i} className="wil-night" style={{ borderColor: RES[e.result][1] }} onClick={() => { setYear(Math.floor(e.y)); setTab('cords'); setSel(e.house) }}>
              <b>{Math.floor(e.y)} · {data.houses.find((h) => h.key === e.house)?.name}</b>
              <small style={{ color: RES[e.result][1] }}>{RES[e.result][0]}{e.fell ? ` · узлов: ${e.fell}` : ''}</small>
              <p>«{e.ban}» — {e.by}. {e.note}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'keepers' && (
        <div className="wil-guards">
          {data.guardians.map((g) => {
            const src = img.get(g.id)
            return (
              <button key={g.id} className="wil-guard" onClick={() => onOpen(g.id)}>
                <span className="wil-face">{src ? <img src={assetUrl(src)} alt="" /> : g.name[0]}</span>
                <span><b>{g.name}</b><small>{g.from}–{g.to ?? 'ныне'} · {data.houses.find((h) => h.key === g.house)?.name}</small><small>{g.note}</small></span>
              </button>
            )
          })}
        </div>
      )}
      <ul className="wil-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
