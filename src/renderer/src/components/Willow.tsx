import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type WillowData = NonNullable<Entry['base']['willow']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const STATE: Record<string, [string, string]> = { g: ['зелёная', '#7fc47a'], d: ['сохнет', '#d2a446'], b: ['голая', '#7d6a58'] }
const SIGN: Record<string, [string, string]> = { fire: ['пожар рощи', '🔥'], drought: ['засуха', '☀'], defeat: ['поражение', '⚔'], spirit: ['жалоба духа', '✦'], vow: ['обет', '❦'] }

/**
 * «Ива» Эльфборна: Серебряная Ива с двенадцатью ветвями Домов Книги Побегов. Ползунок лет 981–1010: ветви зеленеют,
 * сохнут и голеют; знаки года — искры у концов ветвей; в корне — Страж Корня. Вкладки: «Ива», «Дома», «Ночи».
 */
export function WillowView({ data, onOpen }: { data: WillowData; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [tab, setTab] = useState<'tree' | 'houses' | 'nights'>('tree')
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const cur = data.years.find((y) => y.y === year) ?? data.years[data.years.length - 1]
  const signs = data.signs.filter((s) => s.y === year)
  const side = new Map(data.sides.map((s) => [s.key, s]))
  const house = sel ? data.houses.find((h) => h.key === sel) : null
  const hot = cur.green < data.needGreen
  const root = cur.green < data.rootGreen
  const W = 420, H = 330, cx = 210, ty = 250
  const n = data.houses.length
  const tip = (i: number) => {
    const a = Math.PI * (0.06 + (0.88 * i) / (n - 1))
    const r = 150 + (i % 2) * 22
    return [cx - Math.cos(a) * r, ty - 40 - Math.sin(a) * r * 0.95] as const
  }
  const sx = (y: number) => 30 + ((y - data.yearFrom) / (data.yearTo - data.yearFrom)) * 340
  const sy = (v: number) => 118 - v * 9
  const guardian = data.guardians.find((g) => year >= g.from && (g.to === null || year < g.to))
  return (
    <div className="wil">
      <div className="wil-head">
        <div>
          <small>Серебряная Ива в {year} г.</small>
          <b>Зелёных ветвей {cur.green} из {n}{cur.ruler ? ` · Страж Корня ${cur.ruler}` : ''}</b>
        </div>
        <div className={`wil-status ${root ? 'root' : hot ? 'hot' : cur.green === data.needGreen ? 'edge' : 'calm'}`}>
          {root ? <>⚠ меньше {data.rootGreen}: жребий Корня</> : hot ? <>⚠ Ночь Голых Ветвей</> : cur.green === data.needGreen ? <>❗ одна ветвь до падения</> : <>🌿 мандат держится</>}
        </div>
      </div>
      <div className="wil-tabs">
        {([['tree', 'Ива'], ['houses', 'Дома'], ['nights', 'Ночи и Стражи']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'tree' && (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="wil-svg">
            <rect x="0" y="0" width={W} height={H} rx="8" className="wil-bg" />
            <path d={`M${cx - 70} ${H - 12} Q ${cx - 30} ${ty + 20} ${cx - 10} ${ty} L ${cx + 10} ${ty} Q ${cx + 30} ${ty + 20} ${cx + 70} ${H - 12}z`} className="wil-root" />
            <path d={`M${cx - 14} ${ty + 6} L ${cx - 9} ${ty - 42} L ${cx + 9} ${ty - 42} L ${cx + 14} ${ty + 6}z`} className="wil-trunk" />
            {data.houses.map((h, i) => {
              const [x, y] = tip(i)
              const s = cur.states[h.key] ?? 'g'
              const col = STATE[s][1]
              const mx = (cx + x) / 2, my = ty - 60 - Math.abs(x - cx) * 0.15
              const on = sel === h.key
              const hs = signs.filter((g) => g.house === h.key)
              return (
                <g key={h.key} className="wil-branch" onClick={() => setSel(on ? null : h.key)}>
                  <path d={`M${cx} ${ty - 38} Q ${mx} ${my} ${x} ${y}`} stroke={col} strokeWidth={on ? 5 : 3.2} fill="none" strokeLinecap="round" />
                  {s !== 'b' && [0.35, 0.55, 0.75].map((k) => {
                    const lx = (1 - k) * (1 - k) * cx + 2 * (1 - k) * k * mx + k * k * x
                    const ly = (1 - k) * (1 - k) * (ty - 38) + 2 * (1 - k) * k * my + k * k * y
                    return <path key={k} d={`M${lx} ${ly} q -3 9 0 22 q 3 -13 0 -22z`} fill={s === 'g' ? '#cfe0d4' : '#c9a24a'} opacity={s === 'g' ? 0.85 : 0.6} />
                  })}
                  <circle cx={x} cy={y} r="15" fill={h.bg} stroke={on ? '#fff' : col} strokeWidth={on ? 3 : 2.2} />
                  <text x={x} y={y + 4} textAnchor="middle" className="wil-name" fill={h.color}>{h.name.replace('Дом ', '').slice(0, 3)}</text>
                  {hs.map((g, k) => <text key={k} x={x + 14 + k * 9} y={y - 12} className="wil-spark">{SIGN[g.kind]?.[1] ?? '·'}</text>)}
                </g>
              )
            })}
            <text x={cx} y={H - 22} textAnchor="middle" className="wil-ruler">{guardian?.name ?? '—'}</text>
            <text x={cx} y={H - 8} textAnchor="middle" className="wil-axis">Страж Корня</text>
          </svg>
          <svg viewBox="0 0 400 140" className="wil-chart">
            <rect x="0" y="0" width="400" height="140" rx="6" className="wil-bg" />
            <line x1="30" x2="370" y1={sy(data.needGreen)} y2={sy(data.needGreen)} className="wil-thr" />
            <text x="372" y={sy(data.needGreen) + 3} className="wil-axis">{data.needGreen}</text>
            <line x1="30" x2="370" y1={sy(data.rootGreen)} y2={sy(data.rootGreen)} className="wil-thr root" />
            <text x="372" y={sy(data.rootGreen) + 3} className="wil-axis">{data.rootGreen}</text>
            <polyline points={data.years.map((p) => `${sx(p.y)},${sy(p.green)}`).join(' ')} className="wil-line" />
            {data.years.map((p) => <circle key={p.y} cx={sx(p.y)} cy={sy(p.green)} r="2.6" fill={p.green < data.needGreen ? '#d0604a' : '#7fc47a'} />)}
            <line x1={sx(year)} x2={sx(year)} y1="8" y2="122" className="wil-cur" />
            <text x="30" y="134" className="wil-axis">зелёных ветвей по годам</text>
          </svg>
          <div className="wil-slider"><span>{data.yearFrom}</span><input type="range" min={data.yearFrom} max={data.yearTo} value={year} onChange={(e) => setYear(+e.target.value)} /><span>{data.yearTo}</span></div>
          {signs.length > 0 && (
            <ul className="wil-signs">
              {signs.map((g, i) => <li key={i}><span>{SIGN[g.kind]?.[1]}</span> <b>{data.houses.find((h) => h.key === g.house)?.name}</b> — {SIGN[g.kind]?.[0]}: {g.note}</li>)}
            </ul>
          )}
          {house && (
            <div className="wil-card" style={{ ['--bc' as string]: house.color }}>
              <b>{house.name}</b> <small>· {house.race} · {side.get(house.side)?.name}</small>
              <p>Герб: {house.arms}. Ветвь в {year} г.: <b style={{ color: STATE[cur.states[house.key] ?? 'g'][1] }}>{STATE[cur.states[house.key] ?? 'g'][0]}</b>.</p>
              <div className="wil-card-btns">
                <button onClick={() => onOpen(house.houseId)}>Открыть Дом</button>
                {house.head && <button onClick={() => onOpen(house.head!.id)}>{house.head.name}</button>}
              </div>
            </div>
          )}
          <div className="wil-legend">{data.sides.map((s) => <span key={s.key} title={s.who}><i style={{ background: s.color }} />{s.name}</span>)}</div>
        </>
      )}

      {tab === 'houses' && (
        <div className="wil-cards">
          {data.houses.map((h) => {
            const s = cur.states[h.key] ?? 'g'
            const src = h.head ? img.get(h.head.id) : undefined
            return (
              <button key={h.key} className={`wil-hcard ${s}`} style={{ ['--bc' as string]: h.color, ['--bg' as string]: h.bg }} onClick={() => onOpen(h.houseId)}>
                <span className="wil-face">{src ? <img src={assetUrl(src)} alt="" /> : h.name.replace('Дом ', '')[0]}</span>
                <b>{h.name}</b>
                <small>{h.race} · {side.get(h.side)?.name}</small>
                <small style={{ color: STATE[s][1] }}>ветвь {STATE[s][0]} ({year})</small>
              </button>
            )
          })}
        </div>
      )}

      {tab === 'nights' && (
        <>
          <div className="wil-nights">
            {data.nights.map((nt) => <div key={nt.y} className="wil-night"><b>{nt.y} · {nt.title}</b><small>зелёных: {nt.green}</small><p>{nt.note}</p></div>)}
          </div>
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
        </>
      )}
      <ul className="wil-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
