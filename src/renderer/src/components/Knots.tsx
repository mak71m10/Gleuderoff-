import { useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { assetUrl } from './ui'
import type { Entry } from '../types'

type Data = NonNullable<Entry['base']['knots']>

const bold = (s: string): ReactNode[] => s.split(/\*\*(.+?)\*\*/g).map((t, i) => (i % 2 ? <b key={i}>{t}</b> : t))
const rad = (a: number): number => (a * Math.PI) / 180
const fmt = (v: number | null): string => (v == null ? 'по сей день' : String(Math.floor(v)))

/**
 * «Белая нить» Олекохта: арена Ясного дня; по кругу девять сфер совета (золотые — свет Элу, лиловые — нить Кайри),
 * от каждой к Тулакролу в середине тянется белая нить с узлами. Три узла — сфера темнеет; пять тёмных — Сумерки.
 * Вокруг портрета Эрэдама — его собственная нить из семи делений (статья Леннина). Ползунок лет 978–1010.
 */
export function KnotsView({ data, onOpen }: { data: Data; onOpen: (id: string) => void }) {
  const world = useStore((s) => s.world!)
  const img = useMemo(() => new Map(world.entries.map((e) => [e.id, e.base.image])), [world.entries])
  const [year, setYear] = useState(data.yearTo)
  const [sel, setSel] = useState<string | null>(null)
  const Y0 = data.yearFrom, Y1 = data.yearTo
  const cur = data.years.find((r) => r.y === year) ?? data.years[data.years.length - 1]
  const side = (k: string) => data.sides.find((s) => s.key === k)
  const col = (k: string): string => side(k)?.color ?? '#aaa'
  const ruler = [...data.rulers].reverse().find((r) => r.from <= year + 0.5) ?? data.rulers[0]
  const rImg = cur.rulerId ? img.get(cur.rulerId) : ''
  const dusk = cur.dark >= data.darkLimit
  const night = data.nights.find((n) => n.y === year)
  const status = dusk ? ['Сумерки', '#b070e0'] : cur.dark === data.darkLimit - 1 ? ['Канун Сумерек', '#e8a04a'] : ['Ясный порядок', '#e8c860']
  const SZ = 380, C = SZ / 2, R = 138, n = data.spheres.length
  const shown = sel ? data.spheres.find((s) => s.key === sel) : null
  const shownNow = shown ? cur.spheres[shown.key] : null
  const crownPct = Math.min(1, cur.crown / data.crownLimit)

  return (
    <div className="olk" style={{ ['--olk-dusk' as string]: String(cur.dark / data.darkLimit) }}>
      <div className="olk-head">
        <div>
          <small>Белая нить в {year} г.</small>
          <b>{cur.ruler || 'Эрэдамство Олекохт'}</b>
          <span className="olk-sub">тёмных сфер {cur.dark} из {n} · до Сумерек {Math.max(0, data.darkLimit - cur.dark)} · узлов на нити Эрэдама {cur.crown} из {data.crownLimit}</span>
        </div>
        <div className="olk-status" style={{ borderColor: status[1], color: status[1] }}>{status[0]}</div>
      </div>
      <div className="olk-slider">
        <span>{Y0}</span>
        <input type="range" min={Y0} max={Y1} value={year} onChange={(e) => setYear(+e.target.value)} />
        <span>{Y1}</span>
      </div>
      <div className="olk-main">
        <svg viewBox={`0 0 ${SZ} ${SZ}`} className="olk-arena">
          <defs>
            <radialGradient id="olk-light" cx=".35" cy=".35"><stop offset="0" stopColor="#fff6d0" /><stop offset=".5" stopColor="#e8c860" /><stop offset="1" stopColor="#8a6a20" /></radialGradient>
            <radialGradient id="olk-dark" cx=".35" cy=".35"><stop offset="0" stopColor="#e0c8ff" /><stop offset=".45" stopColor="#7a48b8" /><stop offset="1" stopColor="#24123a" /></radialGradient>
            <radialGradient id="olk-vallin" cx=".35" cy=".35"><stop offset="0" stopColor="#f0f4f8" /><stop offset=".5" stopColor="#8aa0b8" /><stop offset="1" stopColor="#3a4858" /></radialGradient>
            <radialGradient id="olk-sand"><stop offset="0" stopColor="#3a2a1c" /><stop offset="1" stopColor="#1a120c" /></radialGradient>
            <clipPath id="olk-face"><circle cx={C} cy={C} r="30" /></clipPath>
          </defs>
          {/* арена: деревянные ряды и песок */}
          <circle cx={C} cy={C} r="186" fill="#140e0a" />
          {[180, 172, 164].map((r) => <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#4a3420" strokeWidth="5" opacity=".8" />)}
          <circle cx={C} cy={C} r="158" fill="url(#olk-sand)" />
          <circle cx={C} cy={C} r="158" fill="#1a0a2a" className="olk-dusk" />
          {/* три шатра трупп по краю */}
          {data.troupes.map((t, i) => {
            const a = 90 + (i - 1) * 40
            const x = C + Math.cos(rad(a)) * 176, y = C + Math.sin(rad(a)) * 176
            return <path key={t.key} d={`M${x - 11} ${y + 7} L${x} ${y - 11} L${x + 11} ${y + 7} Z`} fill={t.color} stroke="#140e0a" strokeWidth="1" />
          })}
          {/* нити и сферы */}
          {data.spheres.map((s, i) => {
            const a = -90 + (i * 360) / n
            const x = C + Math.cos(rad(a)) * R, y = C + Math.sin(rad(a)) * R
            const now = cur.spheres[s.key]
            const k = now?.knots ?? 0
            const sd = now?.side ?? 'light'
            const x0 = C + Math.cos(rad(a)) * 44, y0 = C + Math.sin(rad(a)) * 44
            const isSel = sel === s.key
            return (
              <g key={s.key} className="olk-sphere" onClick={() => setSel(isSel ? null : s.key)}>
                <line x1={x0} y1={y0} x2={x - Math.cos(rad(a)) * 24} y2={y - Math.sin(rad(a)) * 24} stroke={sd === 'dark' ? '#b89ae0' : '#f4efe4'} strokeWidth={isSel ? 2.2 : 1.3} strokeDasharray={sd === 'dark' ? '1 3' : undefined} opacity=".9" />
                {Array.from({ length: data.sphereLimit }, (_, j) => {
                  const f = 0.3 + j * 0.2
                  const kx = x0 + (x - x0) * f, ky = y0 + (y - y0) * f
                  return j < k ? <circle key={j} cx={kx} cy={ky} r="4.6" fill="#f4efe4" stroke="#8a1c24" strokeWidth="1.6" className="olk-knot" /> : <circle key={j} cx={kx} cy={ky} r="2" fill="#5a4a3a" />
                })}
                <circle cx={x} cy={y} r="24" fill={`url(#olk-${sd})`} stroke={isSel ? '#fff' : col(sd)} strokeWidth={isSel ? 2.8 : 1.4} className={sd === 'dark' ? 'olk-orb dark' : 'olk-orb'} />
                <ellipse cx={x} cy={y} rx="11" ry="6" fill="none" stroke={sd === 'dark' ? '#1a0a2a' : '#5a4010'} strokeWidth="1.6" opacity=".7" />
                <circle cx={x} cy={y} r="3.4" fill={sd === 'dark' ? '#1a0a2a' : '#5a4010'} opacity=".8" />
                <text x={x} y={y + 36} textAnchor="middle" className="olk-name">{s.name}</text>
              </g>
            )
          })}
          {/* Тулакрол: красные лепестки над Эрэдамом */}
          {Array.from({ length: 12 }, (_, i) => {
            const a = i * 30
            return <path key={i} d={`M${C} ${C - 36} c-6 -10 -6 -20 0 -24 c6 4 6 14 0 24z`} fill="#c8303a" opacity=".85" transform={`rotate(${a} ${C} ${C})`} />
          })}
          {/* нить Эрэдама: семь делений вокруг портрета */}
          {Array.from({ length: data.crownLimit }, (_, j) => {
            const a0 = -90 + j * (360 / data.crownLimit) + 4, a1 = a0 + 360 / data.crownLimit - 8
            const r = 38
            const on = j < cur.crown
            return <path key={j} d={`M${C + Math.cos(rad(a0)) * r} ${C + Math.sin(rad(a0)) * r} A${r} ${r} 0 0 1 ${C + Math.cos(rad(a1)) * r} ${C + Math.sin(rad(a1)) * r}`} fill="none" stroke={on ? '#f4efe4' : '#4a2a2a'} strokeWidth={on ? 4 : 2} strokeLinecap="round" />
          })}
          {rImg ? <image href={assetUrl(rImg)} x={C - 30} y={C - 30} width="60" height="60" clipPath="url(#olk-face)" preserveAspectRatio="xMidYMid slice" /> : <circle cx={C} cy={C} r="30" fill="#2a1a1a" />}
          <circle cx={C} cy={C} r="30" fill="none" stroke="#8a1c24" strokeWidth="2" />
          <text x={C} y={C + 82} textAnchor="middle" className="olk-year">{year}</text>
        </svg>
        <div className="olk-card">
          {shown && shownNow ? (
            <div className="olk-card-text">
              <small>Сфера · {shown.desc}</small>
              <b>{shown.name}</b>
              <span className="olk-line" style={{ color: col(shownNow.side) }}>{side(shownNow.side)?.name} · держит {shownNow.holder}</span>
              <span className="olk-line">узлов {shownNow.knots} из {data.sphereLimit}{shownNow.side === 'dark' ? ' — тёмная сфера узлов не копит: жалобы на неё судит тот же Храм' : shownNow.knots === data.sphereLimit - 1 ? ' — ещё один, и сфера потемнеет' : ''}</span>
              <ul className="olk-holders">
                {shown.holders.map((h, i) => (
                  <li key={i} className={h.from <= year + 0.5 && (h.to === null || year + 0.5 < h.to) ? 'on' : ''}>
                    <i style={{ background: col(h.side) }} />{h.name} <small>{fmt(h.from)}–{fmt(h.to)}</small>
                    {h.id && <button onClick={() => onOpen(h.id as string)}>открыть</button>}
                  </li>
                ))}
              </ul>
              <div className="olk-btns"><button onClick={() => setSel(null)}>к Эрэдаму</button></div>
            </div>
          ) : (
            <div className="olk-card-text">
              <small>Эрэдам · {fmt(ruler.from)} — {fmt(ruler.to)}</small>
              <b>{ruler.name}</b>
              <span className="olk-line" style={{ color: status[1] }}>{dusk ? 'Ясный день ведёт Храм Нити, Эрэдам не развязывает узлов' : `Эрэдам правит один; раз в год развязывает один чужой узел`}</span>
              <div className="olk-meter"><span style={{ width: `${crownPct * 100}%` }} /></div>
              <span className="olk-line">нить Эрэдама: {cur.crown} из {data.crownLimit} узлов{cur.crown >= data.crownLimit - 2 ? ' — статья Леннина близко' : ''}</span>
              <p>{ruler.note}</p>
              <div className="olk-btns"><button onClick={() => onOpen(ruler.id)}>открыть</button></div>
            </div>
          )}
        </div>
      </div>
      {night && <p className="olk-night"><b>{night.title}.</b> {night.note}</p>}

      <h4 className="olk-h">Ясный день {year} г.: сколько жалоб сыграли труппы</h4>
      <div className="olk-troupes">
        {data.troupes.map((t) => (
          <div key={t.key} className="olk-troupe" onClick={() => onOpen(t.head)}>
            <b style={{ color: t.color }}>{t.name}</b>
            <span className="olk-pips">{Array.from({ length: data.perTroupe }, (_, j) => <i key={j} style={{ background: j < (cur.staged[t.key] ?? 0) ? t.color : 'transparent', borderColor: t.color }} />)}</span>
            <small>{t.text}</small>
          </div>
        ))}
      </div>

      <h4 className="olk-h">Тёмные сферы по годам</h4>
      <div className="olk-chart" role="list">
        {data.years.map((r) => (
          <button key={r.y} role="listitem" className={`olk-bar ${r.y === year ? 'on' : ''}`} style={{ height: 6 + r.dark * 10, background: r.dark >= data.darkLimit ? '#b070e0' : r.dark === data.darkLimit - 1 ? '#e8a04a' : r.dark ? '#7a58a8' : '#e8c860' }} onClick={() => setYear(r.y)} title={`${r.y}: тёмных ${r.dark}`} />
        ))}
      </div>
      <div className="olk-legend">
        {data.sides.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name} — {s.who}</span>)}
        <span><i className="olk-key-knot" />узел: жалоба, не решённая за год</span>
      </div>
      <ul className="olk-rules">{data.rules.map((r) => <li key={r}>{bold(r)}</li>)}</ul>
    </div>
  )
}
